"use strict";

/*
 * =========================================================
 * RIDERX — CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * REQUIRED CLOUDFLARE VARIABLES / SECRETS
 *
 * Secret:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Text:
 *   B2_BUCKET
 *   B2_ENDPOINT
 *
 * Example:
 *
 * B2_BUCKET:
 *   riderx2-prod
 *
 * B2_ENDPOINT:
 *   https://s3.us-east-005.backblazeb2.com
 *
 * ROUTES:
 *
 * GET
 *   /api/health
 *
 * POST
 *   /api/storage/upload
 *
 * GET
 *   /storage-test
 *
 * =========================================================
 */


/* =========================================================
 * CONFIGURATION
 * ========================================================= */

const MAX_UPLOAD_BYTES =
    10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES =
    new Set([
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
        "Access-Control-Allow-Origin":
            origin,

        "Access-Control-Allow-Methods":
            "GET,POST,DELETE,OPTIONS",

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
            : await new Response(
                data
            ).arrayBuffer();

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
            new TextEncoder().encode(
                message
            )
        )
    );
}


/* =========================================================
 * BYTES → HEX
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
                "AWS4" +
                secretKey
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
                encodeURIComponent(
                    part
                ).replace(
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

function safeFileName(filename) {

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

function safeObjectPath(
    requestedPath,
    filename
) {

    if (requestedPath) {

        const cleaned =
            requestedPath
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

        if (cleaned) {
            return cleaned;
        }
    }

    return (
        "riderx2/uploads/" +
        Date.now() +
        "-" +
        crypto.randomUUID() +
        "-" +
        safeFileName(filename)
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
     * CHECK CONFIGURATION
     * ------------------------------------------------------- */

    const missing = [];

    if (!env.B2_APPLICATION_KEY_ID) {
        missing.push(
            "B2_APPLICATION_KEY_ID"
        );
    }

    if (!env.B2_APPLICATION_KEY) {
        missing.push(
            "B2_APPLICATION_KEY"
        );
    }

    if (!env.B2_BUCKET) {
        missing.push(
            "B2_BUCKET"
        );
    }

    if (!env.B2_ENDPOINT) {
        missing.push(
            "B2_ENDPOINT"
        );
    }

    if (missing.length) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "B2 storage configuration is incomplete.",

                missing
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

                received:
                    contentType || null,

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


    const bodySize =
        body.byteLength;


    if (!bodySize) {

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
     * MAX SIZE
     * ------------------------------------------------------- */

    if (
        bodySize >
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

    const suppliedFilename =
        request.headers.get(
            "X-Filename"
        ) ||
        "upload.bin";


    const filename =
        safeFileName(
            suppliedFilename
        );


    /* -------------------------------------------------------
     * OBJECT PATH
     * ------------------------------------------------------- */

    const objectPath =
        safeObjectPath(
            request.headers.get(
                "X-Upload-Path"
            ),
            filename
        );


    /* -------------------------------------------------------
     * B2 S3 CONFIGURATION
     * ------------------------------------------------------- */

    const endpoint =
        env.B2_ENDPOINT
            .replace(
                /\/+$/,
                ""
            );


    const endpointUrl =
        new URL(
            endpoint
        );


    const host =
        endpointUrl.host;


    const region =
        "us-east-005";


    const service =
        "s3";


    const bucket =
        env.B2_BUCKET;


    /* -------------------------------------------------------
     * PAYLOAD HASH
     * ------------------------------------------------------- */

    const payloadHash =
        await sha256Hex(
            body
        );


    /* -------------------------------------------------------
     * CONTENT LENGTH
     *
     * IMPORTANT:
     * B2 needs the actual body length.
     * This is also included in the signed headers.
     * ------------------------------------------------------- */

    const contentLength =
        String(
            bodySize
        );


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
            bucket
        ) +
        "/" +
        encodePath(
            objectPath
        );


    /* -------------------------------------------------------
     * CANONICAL HEADERS
     *
     * IMPORTANT:
     * Header names MUST be lowercase
     * and alphabetically ordered.
     * ------------------------------------------------------- */

    const canonicalHeaders =
        "content-length:" +
        contentLength +
        "\n" +

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


    /* -------------------------------------------------------
     * SIGNED HEADERS
     * ------------------------------------------------------- */

    const signedHeaders =
        "content-length;" +
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
        region +
        "/" +
        service +
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
     * SIGNATURE
     * ------------------------------------------------------- */

    const signingKey =
        await getSignatureKey(
            env.B2_APPLICATION_KEY,
            dateStamp,
            region,
            service
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
        encodePath(bucket) +
        "/" +
        encodePath(objectPath);


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

                    "Content-Length":
                        contentLength,

                    "Host":
                        host,

                    "X-Amz-Content-Sha256":
                        payloadHash,

                    "X-Amz-Date":
                        amzDate
                },

                body:
                    body
            }
        );


    /* -------------------------------------------------------
     * READ B2 RESPONSE
     * ------------------------------------------------------- */

    const responseText =
        await b2Response.text();


    /* -------------------------------------------------------
     * B2 ERROR
     * ------------------------------------------------------- */

    if (!b2Response.ok) {

        console.error(
            "Backblaze B2 upload failed:",
            b2Response.status,
            responseText
        );


        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                status:
                    b2Response.status,

                details:
                    responseText
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
                bucket,

            key:
                objectPath,

            contentType:
                contentType,

            size:
                bodySize,

            b2Status:
                b2Response.status
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
    RiderX B2 Storage Test
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

    border-radius:
        20px;

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

    line-height:
        1.2;
}

p {

    color:
        #d1d5db;

    line-height:
        1.7;
}

input[type="file"] {

    width: 100%;

    padding: 14px;

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

.info {

    color:
        #93c5fd;
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
    file and upload it directly through
    the RiderX Cloudflare Worker to
    Backblaze B2.
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

<pre
    id="result"
    class="info"
>Waiting for file...</pre>

</div>


<script>

"use strict";


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
        input.files &&
        input.files[0];


    if (!file) {

        result.className =
            "error";

        result.textContent =
            "Pehle file select karo.";

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


    button.disabled =
        true;

    button.textContent =
        "Uploading...";


    result.className =
        "info";

    result.textContent =
        "Uploading " +
        file.name +
        " (" +
        Math.round(
            file.size / 1024
        ) +
        " KB)...";


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


        const raw =
            await response.text();


        let data;

        try {

            data =
                JSON.parse(
                    raw
                );

        } catch {

            data = {
                ok: false,
                raw
            };
        }


        if (!response.ok) {

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
            "RiderX upload error:",
            error
        );


        result.className =
            "error";

        result.textContent =
            "Upload failed: " +
            (
                error &&
                error.message
                    ? error.message
                    : String(error)
            );

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


        /* =====================================================
         * CORS PREFLIGHT
         * ===================================================== */

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


        /* =====================================================
         * HEALTH CHECK
         * ===================================================== */

        if (
            request.method ===
                "GET" &&
            url.pathname ===
                "/api/health"
        ) {

            const missing = [];


            if (
                !env.B2_APPLICATION_KEY_ID
            ) {
                missing.push(
                    "B2_APPLICATION_KEY_ID"
                );
            }


            if (
                !env.B2_APPLICATION_KEY
            ) {
                missing.push(
                    "B2_APPLICATION_KEY"
                );
            }


            if (
                !env.B2_BUCKET
            ) {
                missing.push(
                    "B2_BUCKET"
                );
            }


            if (
                !env.B2_ENDPOINT
            ) {
                missing.push(
                    "B2_ENDPOINT"
                );
            }


            const response = {
                ok: true,

                service:
                    "RiderX API",

                status:
                    "online",

                storage:
                    "Backblaze B2",

                storageConfigured:
                    missing.length === 0,

                timestamp:
                    new Date()
                        .toISOString()
            };


            if (missing.length) {

                response.missing =
                    missing;
            }


            return jsonResponse(
                response,
                200,
                origin
            );
        }


        /* =====================================================
         * STORAGE TEST PAGE
         * ===================================================== */

        if (
            request.method ===
                "GET" &&
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


        /* =====================================================
         * B2 STORAGE UPLOAD
         * ===================================================== */

        if (
            request.method ===
                "POST" &&
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
                            error &&
                            error.message
                                ? error.message
                                : String(error)
                    },
                    500,
                    origin
                );
            }
        }


        /* =====================================================
         * STATIC RIDERX WEBSITE
         * ===================================================== */

        if (
            env.ASSETS
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
