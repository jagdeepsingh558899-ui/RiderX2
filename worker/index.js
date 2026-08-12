"use strict";

/*
 * =========================================================
 * RIDERX — CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * CLOUDFLARE VARIABLES / SECRETS REQUIRED:
 *
 * Secret:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Variable:
 *   B2_BUCKET
 *   B2_ENDPOINT
 *
 * B2 BUCKET:
 *   riderx2-prod
 *
 * B2 ENDPOINT:
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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

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
        "access-control-allow-origin": origin,
        "access-control-allow-methods":
            "GET,POST,DELETE,OPTIONS",
        "access-control-allow-headers":
            "Content-Type, Authorization, X-Filename, X-Upload-Path",
        "access-control-max-age": "86400"
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
                "content-type":
                    "application/json; charset=UTF-8",

                "cache-control":
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
            : await new Response(data).arrayBuffer();

    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            buffer
        );

    return [...new Uint8Array(hash)]
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
            new TextEncoder().encode(message)
        )
    );
}


/* =========================================================
 * BYTES → HEX
 * ========================================================= */

function bytesToHex(bytes) {

    return [...bytes]
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


/* =========================================================
 * AWS / S3 SIGNING KEY
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
 * BACKBLAZE B2 UPLOAD
 * ========================================================= */

async function uploadToB2(
    request,
    env,
    origin
) {

    /*
     * -------------------------------------------------------
     * CHECK B2 CONFIGURATION
     * -------------------------------------------------------
     */

    if (
        !env.B2_APPLICATION_KEY_ID ||
        !env.B2_APPLICATION_KEY ||
        !env.B2_BUCKET ||
        !env.B2_ENDPOINT
    ) {

        return jsonResponse(
            {
                ok: false,
                error:
                    "B2 storage configuration is incomplete."
            },
            500,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * CONTENT TYPE
     * -------------------------------------------------------
     */

    const contentType =
        request.headers.get(
            "content-type"
        ) ||
        "application/octet-stream";


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
                    [
                        ...ALLOWED_CONTENT_TYPES
                    ]
            },
            415,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * READ BODY
     * -------------------------------------------------------
     */

    const body =
        await request.arrayBuffer();


    if (!body.byteLength) {

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


    /*
     * -------------------------------------------------------
     * MAX FILE SIZE
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * FILE NAME
     * -------------------------------------------------------
     */

    const suppliedFilename =
        request.headers.get(
            "x-filename"
        ) ||
        "upload.bin";


    const safeFilename =
        suppliedFilename
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


    /*
     * -------------------------------------------------------
     * OBJECT PATH
     * -------------------------------------------------------
     *
     * Default:
     *
     * riderx2/uploads/
     *     timestamp-random-filename
     *
     * -------------------------------------------------------
     */

    const requestedPath =
        request.headers.get(
            "x-upload-path"
        );

    let objectPath;


    if (requestedPath) {

        objectPath =
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

    } else {

        objectPath =
            "riderx2/uploads/" +
            Date.now() +
            "-" +
            crypto.randomUUID() +
            "-" +
            safeFilename;
    }


    /*
     * -------------------------------------------------------
     * B2 S3 CONFIG
     * -------------------------------------------------------
     */

    const endpoint =
        env.B2_ENDPOINT
            .replace(
                /\/+$/,
                ""
            );


    const endpointUrl =
        new URL(endpoint);


    const host =
        endpointUrl.host;


    /*
     * B2 S3 REGION
     *
     * Your B2 endpoint:
     * s3.us-east-005.backblazeb2.com
     */

    const region =
        "us-east-005";


    const service =
        "s3";


    const bucket =
        env.B2_BUCKET;


    /*
     * -------------------------------------------------------
     * PAYLOAD HASH
     * -------------------------------------------------------
     */

    const payloadHash =
        await sha256Hex(body);


    /*
     * -------------------------------------------------------
     * AWS DATE
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * CANONICAL URI
     * -------------------------------------------------------
     */

    const canonicalUri =
        "/" +
        encodePath(bucket) +
        "/" +
        encodePath(objectPath);


    /*
     * -------------------------------------------------------
     * CANONICAL HEADERS
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * CANONICAL REQUEST
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * CREDENTIAL SCOPE
     * -------------------------------------------------------
     */

    const credentialScope =
        dateStamp +
        "/" +
        region +
        "/" +
        service +
        "/aws4_request";


    /*
     * -------------------------------------------------------
     * STRING TO SIGN
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * SIGNATURE
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * AUTHORIZATION HEADER
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * B2 UPLOAD URL
     * -------------------------------------------------------
     */

    const uploadUrl =
        endpoint +
        "/" +
        encodePath(bucket) +
        "/" +
        encodePath(objectPath);


    /*
     * -------------------------------------------------------
     * SEND TO BACKBLAZE
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * HANDLE B2 ERROR
     * -------------------------------------------------------
     */

    if (!b2Response.ok) {

        const errorText =
            await b2Response.text();


        console.error(
            "Backblaze upload failed:",
            b2Response.status,
            errorText
        );


        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze upload failed.",

                status:
                    b2Response.status
            },
            502,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    return jsonResponse(
        {
            ok: true,

            message:
                "File uploaded successfully.",

            bucket:
                bucket,

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

    max-width: 520px;

    margin:
        0 auto;

    padding: 25px;

    border-radius: 18px;

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
}

p {

    color:
        #d1d5db;

    line-height: 1.6;
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

    padding: 15px;

    border: none;

    border-radius:
        10px;

    background:
        #FFD400;

    color:
        #111111;

    font-size:
        16px;

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
        15px;

    border-radius:
        10px;

    background:
        #030712;

    color:
        #d1d5db;

    overflow-x:
        auto;
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
    file and upload it to Backblaze B2.
</p>

<input
    id="file"
    type="file"
    accept="image/jpeg,image/png,image/webp,application/pdf"
>

<button
    id="uploadButton"
    onclick="uploadFile()"
>
    Upload to Backblaze B2
</button>

<pre id="result">
Waiting for file...
</pre>

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


        const data =
            await response.json();


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


        /*
         * =====================================================
         * CORS PREFLIGHT
         * =====================================================
         */

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


        /*
         * =====================================================
         * HEALTH CHECK
         * =====================================================
         */

        if (
            request.method ===
                "GET" &&
            url.pathname ===
                "/api/health"
        ) {

            return jsonResponse(
                {
                    ok: true,

                    service:
                        "RiderX API",

                    status:
                        "online",

                    storage:
                        "Backblaze B2",

                    timestamp:
                        new Date()
                            .toISOString()
                },
                200,
                origin
            );
        }


        /*
         * =====================================================
         * STORAGE TEST PAGE
         * =====================================================
         */

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
                        "content-type":
                            "text/html; charset=UTF-8",

                        "cache-control":
                            "no-store"
                    }
                }
            );
        }


        /*
         * =====================================================
         * B2 STORAGE UPLOAD
         * =====================================================
         */

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
                            "Storage upload failed."
                    },
                    500,
                    origin
                );
            }
        }


        /*
         * =====================================================
         * STATIC RIDERX WEBSITE
         * =====================================================
         */

        return env.ASSETS.fetch(
            request
        );
    }
};
