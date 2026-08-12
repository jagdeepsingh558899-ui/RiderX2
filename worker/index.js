"use strict";

/*
 * =========================================================
 * RIDERX — CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * CLOUDFLARE SECRETS REQUIRED:
 *
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * BACKBLAZE B2:
 *
 *   Bucket:
 *   riderx2-prod
 *
 *   Endpoint:
 *   https://s3.us-east-005.backblazeb2.com
 *
 * ROUTES:
 *
 *   GET
 *   /api/health
 *
 *   POST
 *   /api/storage/upload
 *
 *   GET
 *   /storage-test
 *
 * =========================================================
 */


/* =========================================================
 * FIXED B2 CONFIGURATION
 * ========================================================= */

const B2_BUCKET = "riderx2-prod";

const B2_ENDPOINT =
    "https://s3.us-east-005.backblazeb2.com";

const B2_REGION = "us-east-005";

const B2_SERVICE = "s3";

const MAX_UPLOAD_BYTES =
    10 * 1024 * 1024;


/* =========================================================
 * ALLOWED FILE TYPES
 * ========================================================= */

const ALLOWED_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
]);


/* =========================================================
 * CORS
 * ========================================================= */

function corsHeaders(origin = "*") {

    return {
        "Access-Control-Allow-Origin": origin,

        "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Filename, X-Upload-Path",

        "Access-Control-Max-Age":
            "86400"
    };
}


/* =========================================================
 * JSON RESPONSE
 * ========================================================= */

function jsonResponse(
    data,
    status = 200,
    origin = "*"
) {

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8",

                "Cache-Control":
                    "no-store",

                ...corsHeaders(origin)
            }
        }
    );
}


/* =========================================================
 * SHA-256
 * ========================================================= */

async function sha256Hex(data) {

    const buffer =
        data instanceof ArrayBuffer
            ? data
            : await new Response(data)
                .arrayBuffer();

    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            buffer
        );

    return Array.from(
        new Uint8Array(hash)
    )
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


/* =========================================================
 * HMAC-SHA256
 * ========================================================= */

async function hmacSha256(
    key,
    message
) {

    const cryptoKey =
        await crypto.subtle.importKey(
            "raw",
            key,
            {
                name: "HMAC",
                hash: "SHA-256"
            },
            false,
            ["sign"]
        );

    return new Uint8Array(
        await crypto.subtle.sign(
            "HMAC",
            cryptoKey,
            new TextEncoder()
                .encode(message)
        )
    );
}


/* =========================================================
 * BYTES TO HEX
 * ========================================================= */

function bytesToHex(bytes) {

    return Array.from(bytes)
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


/* =========================================================
 * AWS SIGNING KEY
 * ========================================================= */

async function getSignatureKey(
    secretKey,
    dateStamp,
    region,
    service
) {

    const encoder =
        new TextEncoder();

    const kDate =
        await hmacSha256(
            encoder.encode(
                "AWS4" + secretKey
            ),
            dateStamp
        );

    const kRegion =
        await hmacSha256(
            kDate,
            region
        );

    const kService =
        await hmacSha256(
            kRegion,
            service
        );

    const kSigning =
        await hmacSha256(
            kService,
            "aws4_request"
        );

    return kSigning;
}


/* =========================================================
 * URI ENCODING
 * ========================================================= */

function encodePath(path) {

    return path
        .split("/")
        .map(
            part =>
                encodeURIComponent(part)
                    .replace(
                        /[!'()*]/g,
                        character =>
                            "%" +
                            character
                                .charCodeAt(0)
                                .toString(16)
                                .toUpperCase()
                    )
        )
        .join("/");
}


/* =========================================================
 * SAFE FILE NAME
 * ========================================================= */

function safeFilename(filename) {

    return String(filename || "upload.bin")
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        )
        .replace(
            /\.{2,}/g,
            "."
        )
        .slice(
            0,
            150
        );
}


/* =========================================================
 * SAFE OBJECT PATH
 * ========================================================= */

function safeObjectPath(path) {

    return String(path || "")
        .replace(
            /^\/+/,
            ""
        )
        .replace(
            /\.\./g,
            "_"
        )
        .replace(
            /[^a-zA-Z0-9/_\-.]/g,
            "_"
        )
        .slice(
            0,
            500
        );
}


/* =========================================================
 * BACKBLAZE B2 UPLOAD
 * ========================================================= */

async function uploadToB2(
    request,
    env,
    origin
) {

    /* -------------------------------------------------------
     * CHECK CLOUDFLARE SECRETS
     * ------------------------------------------------------- */

    if (
        !env.B2_APPLICATION_KEY_ID ||
        !env.B2_APPLICATION_KEY
    ) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 credentials are not configured.",

                required:
                    [
                        "B2_APPLICATION_KEY_ID",
                        "B2_APPLICATION_KEY"
                    ]
            },
            500,
            origin
        );
    }


    /* -------------------------------------------------------
     * CONTENT TYPE
     * ------------------------------------------------------- */

    const contentType =
        (
            request.headers.get(
                "Content-Type"
            ) ||
            ""
        )
            .split(";")[0]
            .trim()
            .toLowerCase();


    if (
        !ALLOWED_CONTENT_TYPES.has(
            contentType
        )
    ) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "File type is not allowed.",

                allowedTypes:
                    Array.from(
                        ALLOWED_CONTENT_TYPES
                    )
            },
            415,
            origin
        );
    }


    /* -------------------------------------------------------
     * READ BODY
     * ------------------------------------------------------- */

    const body =
        await request.arrayBuffer();


    if (
        !body ||
        body.byteLength === 0
    ) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "Upload body is empty."
            },
            400,
            origin
        );
    }


    /* -------------------------------------------------------
     * FILE SIZE
     * ------------------------------------------------------- */

    if (
        body.byteLength >
        MAX_UPLOAD_BYTES
    ) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "File is too large.",

                maxBytes:
                    MAX_UPLOAD_BYTES,

                maxMB:
                    10
            },
            413,
            origin
        );
    }


    /* -------------------------------------------------------
     * FILE NAME
     * ------------------------------------------------------- */

    const filename =
        safeFilename(
            request.headers.get(
                "X-Filename"
            )
        );


    /* -------------------------------------------------------
     * OBJECT PATH
     * ------------------------------------------------------- */

    const requestedPath =
        request.headers.get(
            "X-Upload-Path"
        );


    let objectPath;


    if (requestedPath) {

        objectPath =
            safeObjectPath(
                requestedPath
            );

        if (!objectPath) {

            return jsonResponse(
                {
                    ok: false,

                    error:
                        "Invalid upload path."
                },
                400,
                origin
            );
        }

    } else {

        objectPath =
            "riderx2/uploads/" +
            Date.now() +
            "-" +
            crypto.randomUUID() +
            "-" +
            filename;
    }


    /* -------------------------------------------------------
     * B2 ENDPOINT
     * ------------------------------------------------------- */

    const endpoint =
        B2_ENDPOINT.replace(
            /\/+$/,
            ""
        );


    const endpointUrl =
        new URL(endpoint);


    const host =
        endpointUrl.host;


    /* -------------------------------------------------------
     * PAYLOAD HASH
     * ------------------------------------------------------- */

    const payloadHash =
        await sha256Hex(body);


    /* -------------------------------------------------------
     * AWS DATE
     * ------------------------------------------------------- */

    const now =
        new Date();


    const amzDate =
        now
            .toISOString()
            .replace(
                /[:-]|\.\d{3}/g,
                ""
            );


    const dateStamp =
        amzDate.slice(
            0,
            8
        );


    /* -------------------------------------------------------
     * CANONICAL URI
     * ------------------------------------------------------- */

    const canonicalUri =
        "/" +
        encodePath(
            B2_BUCKET
        ) +
        "/" +
        encodePath(
            objectPath
        );


    /* -------------------------------------------------------
     * CANONICAL HEADERS
     * ------------------------------------------------------- */

    const canonicalHeaders =
        "content-type:" +
        contentType +
        "\n" +

        "host:" +
        host +
        "\n" +

        "x-amz-content-sha256:" +
        payloadHash +
        "\n" +

        "x-amz-date:" +
        amzDate +
        "\n";


    const signedHeaders =
        "content-type;" +
        "host;" +
        "x-amz-content-sha256;" +
        "x-amz-date";


    /* -------------------------------------------------------
     * CANONICAL REQUEST
     * ------------------------------------------------------- */

    const canonicalRequest =
        "PUT\n" +
        canonicalUri +
        "\n" +
        "\n" +
        canonicalHeaders +
        "\n" +
        signedHeaders +
        "\n" +
        payloadHash;


    /* -------------------------------------------------------
     * CREDENTIAL SCOPE
     * ------------------------------------------------------- */

    const credentialScope =
        dateStamp +
        "/" +
        B2_REGION +
        "/" +
        B2_SERVICE +
        "/aws4_request";


    /* -------------------------------------------------------
     * STRING TO SIGN
     * ------------------------------------------------------- */

    const canonicalRequestHash =
        await sha256Hex(
            canonicalRequest
        );


    const stringToSign =
        "AWS4-HMAC-SHA256\n" +
        amzDate +
        "\n" +
        credentialScope +
        "\n" +
        canonicalRequestHash;


    /* -------------------------------------------------------
     * SIGNING KEY
     * ------------------------------------------------------- */

    const signingKey =
        await getSignatureKey(
            env.B2_APPLICATION_KEY,
            dateStamp,
            B2_REGION,
            B2_SERVICE
        );


    const signatureBytes =
        await hmacSha256(
            signingKey,
            stringToSign
        );


    const signature =
        bytesToHex(
            signatureBytes
        );


    /* -------------------------------------------------------
     * AUTHORIZATION
     * ------------------------------------------------------- */

    const authorization =
        "AWS4-HMAC-SHA256 " +
        "Credential=" +
        env.B2_APPLICATION_KEY_ID +
        "/" +
        credentialScope +
        ", " +
        "SignedHeaders=" +
        signedHeaders +
        ", " +
        "Signature=" +
        signature;


    /* -------------------------------------------------------
     * UPLOAD URL
     * ------------------------------------------------------- */

    const uploadUrl =
        endpoint +
        "/" +
        encodePath(
            B2_BUCKET
        ) +
        "/" +
        encodePath(
            objectPath
        );


    /* -------------------------------------------------------
     * SEND TO BACKBLAZE
     * ------------------------------------------------------- */

    const b2Response =
        await fetch(
            uploadUrl,
            {
                method: "PUT",

                headers: {
                    "Authorization":
                        authorization,

                    "Content-Type":
                        contentType,

                    "Host":
                        host,

                    "X-Amz-Content-Sha256":
                        payloadHash,

                    "X-Amz-Date":
                        amzDate
                },

                body
            }
        );


    /* -------------------------------------------------------
     * B2 ERROR
     * ------------------------------------------------------- */

    if (
        !b2Response.ok
    ) {

        const errorText =
            await b2Response.text();


        console.error(
            "Backblaze B2 upload failed:",
            b2Response.status,
            errorText
        );


        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                status:
                    b2Response.status,

                details:
                    errorText.slice(
                        0,
                        1000
                    )
            },
            502,
            origin
        );
    }


    /* -------------------------------------------------------
     * SUCCESS
     * ------------------------------------------------------- */

    return jsonResponse(
        {
            ok: true,

            message:
                "File uploaded successfully.",

            storage:
                "Backblaze B2",

            bucket:
                B2_BUCKET,

            key:
                objectPath,

            contentType:
                contentType,

            size:
                body.byteLength
        },
        201,
        origin
    );
}


/* =========================================================
 * STORAGE TEST PAGE
 * ========================================================= */

function storageTestPage() {

    return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<meta
    name="theme-color"
    content="#111827"
>

<title>
    RiderX Storage Test
</title>

<style>

* {
    box-sizing: border-box;
}

body {

    margin: 0;

    padding: 30px 20px;

    min-height: 100vh;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        #111827;

    color:
        #ffffff;
}

.container {

    width: 100%;

    max-width: 620px;

    margin:
        0 auto;

    padding: 30px;

    border-radius: 22px;

    background:
        #1f2937;

    box-shadow:
        0 15px 40px
        rgba(0,0,0,.35);
}

h1 {

    margin-top: 0;

    color:
        #FFD400;

    font-size:
        32px;
}

p {

    color:
        #d1d5db;

    line-height:
        1.7;

    font-size:
        16px;
}

input[type="file"] {

    width: 100%;

    padding: 15px;

    margin:
        15px 0;

    border:
        1px solid #4b5563;

    border-radius:
        10px;

    background:
        #111827;

    color:
        #ffffff;
}

button {

    width: 100%;

    padding: 16px;

    border: none;

    border-radius:
        12px;

    background:
        #FFD400;

    color:
        #111111;

    font-size:
        17px;

    font-weight:
        700;

    cursor:
        pointer;
}

button:disabled {

    opacity:
        .6;

    cursor:
        not-allowed;
}

pre {

    white-space:
        pre-wrap;

    word-break:
        break-word;

    margin-top:
        20px;

    padding:
        16px;

    border-radius:
        12px;

    background:
        #030712;

    color:
        #d1d5db;

    overflow-x:
        auto;

    line-height:
        1.5;
}

.success {

    color:
        #86efac;
}

.error {

    color:
        #fca5a5;
}

</style>

</head>

<body>

<div class="container">

<h1>
    RiderX Storage Test
</h1>

<p>
    Select a small JPG, PNG, WebP or PDF
    file and upload it directly through the
    RiderX Cloudflare Worker to Backblaze B2.
</p>

<input
    id="file"
    type="file"
    accept="image/jpeg,image/png,image/webp,application/pdf"
>

<button
    id="uploadButton"
    type="button"
    onclick="uploadFile()"
>
    Upload to Backblaze B2
</button>

<pre id="result">Waiting for file...</pre>

</div>


<script>

async function uploadFile() {

    const input =
        document.getElementById(
            "file"
        );

    const button =
        document.getElementById(
            "uploadButton"
        );

    const result =
        document.getElementById(
            "result"
        );


    const file =
        input.files[0];


    if (!file) {

        result.className =
            "error";

        result.textContent =
            "Pehle file select karo.";

        return;
    }


    if (
        file.size >
        10 * 1024 * 1024
    ) {

        result.className =
            "error";

        result.textContent =
            "File 10 MB se chhoti honi chahiye.";

        return;
    }


    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        result.className =
            "error";

        result.textContent =
            "Sirf JPG, PNG, WebP ya PDF allowed hai.";

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Uploading...";


    result.className =
        "";

    result.textContent =
        "Uploading " +
        file.name +
        "...";


    try {

        const response =
            await fetch(
                "/api/storage/upload",
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            file.type,

                        "X-Filename":
                            file.name
                    },

                    body:
                        file
                }
            );


        const text =
            await response.text();


        let data;

        try {

            data =
                JSON.parse(
                    text
                );

        } catch {

            data = {
                ok: false,
                error:
                    text ||
                    "Invalid server response."
            };
        }


        if (
            !response.ok ||
            !data.ok
        ) {

            throw new Error(
                data.error ||
                "Upload failed."
            );
        }


        result.className =
            "success";

        result.textContent =
            JSON.stringify(
                data,
                null,
                2
            );


    } catch (error) {

        console.error(
            "Upload error:",
            error
        );

        result.className =
            "error";

        result.textContent =
            "Upload failed: " +
            error.message;

    } finally {

        button.disabled =
            false;

        button.textContent =
            "Upload to Backblaze B2";
    }
}

</script>

</body>

</html>
`;
}


/* =========================================================
 * MAIN CLOUDFLARE WORKER
 * ========================================================= */

export default {

    async fetch(
        request,
        env
    ) {

        const url =
            new URL(
                request.url
            );


        const origin =
            request.headers.get(
                "Origin"
            ) ||
            "*";


        /* ---------------------------------------------------
         * CORS PREFLIGHT
         * --------------------------------------------------- */

        if (
            request.method ===
            "OPTIONS"
        ) {

            return new Response(
                null,
                {
                    status: 204,

                    headers:
                        corsHeaders(
                            origin
                        )
                }
            );
        }


        /* ---------------------------------------------------
         * HEALTH CHECK
         * --------------------------------------------------- */

        if (
            request.method === "GET" &&
            url.pathname ===
                "/api/health"
        ) {

            const configured =
                Boolean(
                    env.B2_APPLICATION_KEY_ID &&
                    env.B2_APPLICATION_KEY
                );


            return jsonResponse(
                {
                    ok: true,

                    service:
                        "RiderX API",

                    status:
                        "online",

                    storage:
                        "Backblaze B2",

                    bucket:
                        B2_BUCKET,

                    b2Configured:
                        configured,

                    timestamp:
                        new Date()
                            .toISOString()
                },
                200,
                origin
            );
        }


        /* ---------------------------------------------------
         * STORAGE TEST PAGE
         * --------------------------------------------------- */

        if (
            request.method === "GET" &&
            url.pathname ===
                "/storage-test"
        ) {

            return new Response(
                storageTestPage(),
                {
                    status: 200,

                    headers: {
                        "Content-Type":
                            "text/html; charset=UTF-8",

                        "Cache-Control":
                            "no-store"
                    }
                }
            );
        }


        /* ---------------------------------------------------
         * B2 STORAGE UPLOAD
         * --------------------------------------------------- */

        if (
            request.method === "POST" &&
            url.pathname ===
                "/api/storage/upload"
        ) {

            try {

                return await uploadToB2(
                    request,
                    env,
                    origin
                );

            } catch (error) {

                console.error(
                    "Storage upload error:",
                    error
                );

                return jsonResponse(
                    {
                        ok: false,

                        error:
                            "Storage upload failed.",

                        details:
                            error?.message ||
                            "Unknown error."
                    },
                    500,
                    origin
                );
            }
        }


        /* ---------------------------------------------------
         * STATIC RIDERX WEBSITE
         * --------------------------------------------------- */

        if (
            env.ASSETS &&
            typeof env.ASSETS.fetch ===
                "function"
        ) {

            return env.ASSETS.fetch(
                request
            );
        }


        return new Response(
            "RiderX Worker is online.",
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "text/plain; charset=UTF-8"
                }
            }
        );
    }
};
