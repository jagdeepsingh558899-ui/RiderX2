"use strict";

/*
 * =========================================================
 * RIDERX2 — CLOUDFLARE WORKER + BACKBLAZE B2
 * FINAL UPLOAD VERSION
 * =========================================================
 *
 * CLOUDFLARE:
 *
 * Secrets:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Variables:
 *   B2_BUCKET
 *   B2_ENDPOINT
 *
 * Example:
 *   B2_BUCKET   = riderx2-prod
 *   B2_ENDPOINT = https://s3.us-east-005.backblazeb2.com
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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
]);

const B2_REGION = "us-east-005";
const B2_SERVICE = "s3";


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
            "86400",

        "Vary":
            "Origin"
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
        JSON.stringify(
            data,
            null,
            2
        ),
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

    let buffer;

    if (data instanceof ArrayBuffer) {

        buffer = data;

    } else if (
        ArrayBuffer.isView(data)
    ) {

        buffer =
            data.buffer.slice(
                data.byteOffset,
                data.byteOffset +
                    data.byteLength
            );

    } else {

        buffer =
            await new Response(
                data
            ).arrayBuffer();
    }


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
                name:
                    "HMAC",

                hash:
                    "SHA-256"
            },
            false,
            ["sign"]
        );


    const signature =
        await crypto.subtle.sign(
            "HMAC",
            cryptoKey,
            new TextEncoder()
                .encode(message)
        );


    return new Uint8Array(
        signature
    );
}


/* =========================================================
 * BYTES TO HEX
 * ========================================================= */

function bytesToHex(bytes) {

    return Array.from(
        bytes
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
 * AWS URI ENCODING
 * ========================================================= */

function encodePath(path) {

    return String(path)
        .split("/")
        .map(
            part =>
                encodeURIComponent(
                    part
                )
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

function sanitizeFilename(
    filename
) {

    return String(
        filename ||
        "upload.bin"
    )
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

function sanitizeObjectPath(
    path
) {

    return String(
        path ||
        ""
    )
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
 * B2 CONFIGURATION
 * ========================================================= */

function getB2Configuration(
    env
) {

    const missing = [];


    if (
        !env ||
        !env.B2_APPLICATION_KEY_ID
    ) {

        missing.push(
            "B2_APPLICATION_KEY_ID"
        );
    }


    if (
        !env ||
        !env.B2_APPLICATION_KEY
    ) {

        missing.push(
            "B2_APPLICATION_KEY"
        );
    }


    if (
        !env ||
        !env.B2_BUCKET
    ) {

        missing.push(
            "B2_BUCKET"
        );
    }


    if (
        !env ||
        !env.B2_ENDPOINT
    ) {

        missing.push(
            "B2_ENDPOINT"
        );
    }


    return {
        configured:
            missing.length === 0,

        missing
    };
}


/* =========================================================
 * NORMALIZE B2 ENDPOINT
 * ========================================================= */

function getB2Endpoint(
    env
) {

    const raw =
        String(
            env.B2_ENDPOINT ||
            ""
        )
        .trim();


    if (!raw) {

        throw new Error(
            "B2_ENDPOINT is empty."
        );
    }


    let url;

    try {

        url =
            new URL(raw);

    } catch (error) {

        throw new Error(
            "B2_ENDPOINT is not a valid URL."
        );
    }


    if (
        url.protocol !==
        "https:"
    ) {

        throw new Error(
            "B2_ENDPOINT must use HTTPS."
        );
    }


    return {
        base:
            url.origin,

        host:
            url.host
    };
}


/* =========================================================
 * READ REQUEST BODY
 * ========================================================= */

async function readUploadBody(
    request
) {

    const contentLengthHeader =
        request.headers.get(
            "Content-Length"
        );


    if (
        contentLengthHeader
    ) {

        const declaredLength =
            Number(
                contentLengthHeader
            );


        if (
            Number.isFinite(
                declaredLength
            ) &&
            declaredLength >
                MAX_UPLOAD_BYTES
        ) {

            throw new Error(
                "File is too large."
            );
        }
    }


    const arrayBuffer =
        await request.arrayBuffer();


    const body =
        new Uint8Array(
            arrayBuffer
        );


    if (
        body.byteLength === 0
    ) {

        throw new Error(
            "Upload body is empty."
        );
    }


    if (
        body.byteLength >
        MAX_UPLOAD_BYTES
    ) {

        throw new Error(
            "File is too large."
        );
    }


    return body;
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
     * CONFIGURATION
     * ----------------------------------------------------- */

    const configuration =
        getB2Configuration(
            env
        );


    if (
        !configuration.configured
    ) {

        return jsonResponse(
            {
                ok:
                    false,

                error:
                    "B2 storage configuration is incomplete.",

                missing:
                    configuration.missing
            },
            500,
            origin
        );
    }


    /* -------------------------------------------------------
     * CONTENT TYPE
     * ----------------------------------------------------- */

    let contentType =
        request.headers.get(
            "Content-Type"
        ) ||
        "application/octet-stream";


    contentType =
        contentType
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
                ok:
                    false,

                error:
                    "File type is not allowed.",

                received:
                    contentType,

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
     * ----------------------------------------------------- */

    let body;

    try {

        body =
            await readUploadBody(
                request
            );

    } catch (error) {

        const message =
            error?.message ||
            String(error);


        if (
            message ===
            "File is too large."
        ) {

            return jsonResponse(
                {
                    ok:
                        false,

                    error:
                        message,

                    maxBytes:
                        MAX_UPLOAD_BYTES,

                    maxMB:
                        10
                },
                413,
                origin
            );
        }


        return jsonResponse(
            {
                ok:
                    false,

                error:
                    message
            },
            400,
            origin
        );
    }


    /* -------------------------------------------------------
     * FILE NAME
     * ----------------------------------------------------- */

    const suppliedFilename =
        request.headers.get(
            "X-Filename"
        ) ||
        "upload.bin";


    const safeFilename =
        sanitizeFilename(
            suppliedFilename
        );


    /* -------------------------------------------------------
     * OBJECT PATH
     * ----------------------------------------------------- */

    const requestedPath =
        request.headers.get(
            "X-Upload-Path"
        );


    let objectPath;


    if (
        requestedPath
    ) {

        objectPath =
            sanitizeObjectPath(
                requestedPath
            );
    }


    if (
        !objectPath
    ) {

        objectPath =
            "riderx2/uploads/" +
            Date.now() +
            "-" +
            crypto.randomUUID() +
            "-" +
            safeFilename;
    }


    /* -------------------------------------------------------
     * B2 ENDPOINT
     * ----------------------------------------------------- */

    let endpoint;

    try {

        endpoint =
            getB2Endpoint(
                env
            );

    } catch (error) {

        return jsonResponse(
            {
                ok:
                    false,

                error:
                    error?.message ||
                    String(error)
            },
            500,
            origin
        );
    }


    /* -------------------------------------------------------
     * B2 BUCKET
     * ----------------------------------------------------- */

    const bucket =
        String(
            env.B2_BUCKET ||
            ""
        )
        .trim();


    if (
        !bucket
    ) {

        return jsonResponse(
            {
                ok:
                    false,

                error:
                    "B2_BUCKET is empty."
            },
            500,
            origin
        );
    }


    /* -------------------------------------------------------
     * PAYLOAD HASH
     * ----------------------------------------------------- */

    const payloadHash =
        await sha256Hex(
            body
        );


    /* -------------------------------------------------------
     * AWS DATE
     * ----------------------------------------------------- */

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
     * ----------------------------------------------------- */

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
     *
     * We sign only headers that we control and send.
     *
     * Content-Length is intentionally NOT manually set.
     * Cloudflare fetch handles the request body framing.
     * ----------------------------------------------------- */

    const canonicalHeaders =
        "content-type:" +
        contentType +
        "\n" +

        "host:" +
        endpoint.host +
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
     * ----------------------------------------------------- */

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
     * ----------------------------------------------------- */

    const credentialScope =
        dateStamp +
        "/" +
        B2_REGION +
        "/" +
        B2_SERVICE +
        "/aws4_request";


    /* -------------------------------------------------------
     * CANONICAL REQUEST HASH
     * ----------------------------------------------------- */

    const canonicalRequestHash =
        await sha256Hex(
            canonicalRequest
        );


    /* -------------------------------------------------------
     * STRING TO SIGN
     * ----------------------------------------------------- */

    const stringToSign =
        "AWS4-HMAC-SHA256\n" +
        amzDate +
        "\n" +
        credentialScope +
        "\n" +
        canonicalRequestHash;


    /* -------------------------------------------------------
     * SIGNING KEY
     * ----------------------------------------------------- */

    const signingKey =
        await getSignatureKey(
            env.B2_APPLICATION_KEY,
            dateStamp,
            B2_REGION,
            B2_SERVICE
        );


    /* -------------------------------------------------------
     * SIGNATURE
     * ----------------------------------------------------- */

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
     * ----------------------------------------------------- */

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
     * ----------------------------------------------------- */

    const uploadUrl =
        endpoint.base +
        "/" +
        encodePath(
            bucket
        ) +
        "/" +
        encodePath(
            objectPath
        );


    /* -------------------------------------------------------
     * SEND TO B2
     *
     * IMPORTANT:
     *
     * DO NOT manually set Content-Length.
     *
     * The exact Uint8Array is passed as the request body.
     * ----------------------------------------------------- */

    let b2Response;


    try {

        b2Response =
            await fetch(
                uploadUrl,
                {
                    method:
                        "PUT",

                    headers: {
                        "Authorization":
                            authorization,

                        "Content-Type":
                            contentType,

                        "X-Amz-Content-Sha256":
                            payloadHash,

                        "X-Amz-Date":
                            amzDate
                    },

                    body:
                        body
                }
            );

    } catch (error) {

        console.error(
            "B2 network error:",
            error
        );


        return jsonResponse(
            {
                ok:
                    false,

                error:
                    "Could not connect to Backblaze B2.",

                details:
                    error?.message ||
                    String(error)
            },
            502,
            origin
        );
    }


    /* -------------------------------------------------------
     * READ B2 RESPONSE
     * ----------------------------------------------------- */

    let responseText = "";


    try {

        responseText =
            await b2Response.text();

    } catch (error) {

        responseText =
            "";
    }


    /* -------------------------------------------------------
     * B2 ERROR
     * ----------------------------------------------------- */

    if (
        !b2Response.ok
    ) {

        console.error(
            "Backblaze B2 upload failed:",
            b2Response.status,
            responseText
        );


        return jsonResponse(
            {
                ok:
                    false,

                error:
                    "Backblaze B2 upload failed.",

                b2Status:
                    b2Response.status,

                b2StatusText:
                    b2Response.statusText ||
                    "",

                b2Response:
                    responseText.slice(
                        0,
                        4000
                    )
            },
            502,
            origin
        );
    }


    /* -------------------------------------------------------
     * SUCCESS
     * ----------------------------------------------------- */

    return jsonResponse(
        {
            ok:
                true,

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

html,
body {
    margin: 0;
    padding: 0;
    min-height: 100%;
}

body {

    min-height: 100vh;

    padding:
        30px 20px;

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

    max-width:
        520px;

    margin:
        0 auto;

    padding:
        25px;

    border-radius:
        18px;

    background:
        #1f2937;

    box-shadow:
        0 15px 40px
        rgba(
            0,
            0,
            0,
            0.35
        );
}

h1 {

    margin-top:
        0;

    color:
        #FFD400;

    font-size:
        40px;

    line-height:
        1.1;
}

p {

    color:
        #d1d5db;

    line-height:
        1.7;

    font-size:
        18px;
}

input[type="file"] {

    width:
        100%;

    padding:
        15px;

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

    width:
        100%;

    padding:
        16px;

    border:
        none;

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
        0.6;

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
    file and upload it through the RiderX
    Cloudflare Worker to Backblaze B2.
</p>

<input
    id="file"
    type="file"
    accept="image/jpeg,image/png,image/webp,application/pdf"
>

<button
    id="uploadButton"
    type="button"
>
    Upload to Backblaze B2
</button>

<pre id="result">Checking storage...</pre>

</div>


<script>

"use strict";


const fileInput =
    document.getElementById(
        "file"
    );


const uploadButton =
    document.getElementById(
        "uploadButton"
    );


const result =
    document.getElementById(
        "result"
    );


uploadButton.addEventListener(
    "click",
    uploadFile
);


/* =========================================================
 * UPLOAD
 * ========================================================= */

async function uploadFile() {

    const file =
        fileInput.files &&
        fileInput.files[0];


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


    uploadButton.disabled =
        true;


    uploadButton.textContent =
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


        const raw =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(
                    raw
                );

        } catch (error) {

            data = {

                ok:
                    false,

                error:
                    "Worker returned invalid JSON.",

                status:
                    response.status,

                raw:
                    raw.slice(
                        0,
                        5000
                    )
            };
        }


        if (
            !response.ok
        ) {

            throw new Error(
                JSON.stringify(
                    data,
                    null,
                    2
                )
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
            "Upload failed:\\n\\n" +
            (
                error?.message ||
                String(error)
            );

    } finally {

        uploadButton.disabled =
            false;


        uploadButton.textContent =
            "Upload to Backblaze B2";
    }
}


/* =========================================================
 * HEALTH CHECK
 * ========================================================= */

async function checkStorage() {

    try {

        const response =
            await fetch(
                "/api/health",
                {
                    cache:
                        "no-store"
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

        } catch (error) {

            result.className =
                "error";

            result.textContent =
                "Health check returned invalid response.";

            return;
        }


        if (
            data.storageConfigured ===
            false
        ) {

            result.className =
                "error";


            result.textContent =
                "Storage configuration incomplete:\\n\\n" +
                JSON.stringify(
                    data,
                    null,
                    2
                );

            return;
        }


        result.className =
            "success";


        result.textContent =
            "Storage ready. Select a file to upload.";


    } catch (error) {

        result.className =
            "error";


        result.textContent =
            "Could not check storage.";
    }
}


checkStorage();

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
                    status:
                        204,

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

            const configuration =
                getB2Configuration(
                    env
                );


            return jsonResponse(
                {
                    ok:
                        true,

                    service:
                        "RiderX API",

                    status:
                        "online",

                    storage:
                        "Backblaze B2",

                    storageConfigured:
                        configuration.configured,

                    ...(configuration.missing.length
                        ? {
                            missing:
                                configuration.missing
                        }
                        : {}),

                    timestamp:
                        new Date()
                            .toISOString()
                },
                200,
                origin
            );
        }


        /* =====================================================
         * STORAGE TEST
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
                    status:
                        200,

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
         * B2 UPLOAD
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
                        ok:
                            false,

                        error:
                            "Storage upload failed.",

                        details:
                            error?.message ||
                            String(error)
                    },
                    500,
                    origin
                );
            }
        }


        /* =====================================================
         * STATIC WEBSITE / CLOUDFLARE ASSETS
         * ===================================================== */

        if (
            env &&
            env.ASSETS &&
            typeof env.ASSETS.fetch ===
                "function"
        ) {

            try {

                return await env.ASSETS.fetch(
                    request
                );

            } catch (error) {

                console.error(
                    "Assets fetch error:",
                    error
                );


                return new Response(
                    "RiderX Assets error.",
                    {
                        status:
                            502,

                        headers: {
                            "Content-Type":
                                "text/plain; charset=UTF-8"
                        }
                    }
                );
            }
        }


        /* =====================================================
         * FALLBACK
         * ===================================================== */

        return new Response(
            "RiderX Worker is online.",
            {
                status:
                    200,

                headers: {

                    "Content-Type":
                        "text/plain; charset=UTF-8"
                }
            }
        );
    }
};
