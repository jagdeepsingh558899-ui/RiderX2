"use strict";

/*
 * =========================================================
 * RIDERX
 * CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * REQUIRED CLOUDFLARE SECRETS:
 *
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * REQUIRED CLOUDFLARE VARIABLES:
 *
 *   B2_BUCKET
 *   B2_ENDPOINT
 *
 *
 * EXAMPLE:
 *
 * B2_BUCKET:
 *   riderx2-prod
 *
 * B2_ENDPOINT:
 *   https://s3.us-east-005.backblazeb2.com
 *
 *
 * ROUTES:
 *
 * GET
 *   /api/health
 *
 * GET
 *   /storage-test
 *
 * POST
 *   /api/storage/upload
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
            "GET, POST, OPTIONS",

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

    return Array
        .from(
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
 * BYTES TO HEX
 * ========================================================= */

function bytesToHex(bytes) {

    return Array
        .from(bytes)
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


/* =========================================================
 * AWS SIGV4 SIGNING KEY
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

    return path
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

function getSafeFilename(
    filename
) {

    return (
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

function getObjectPath(
    request,
    filename
) {

    const requestedPath =
        request.headers.get(
            "X-Upload-Path"
        );

    if (
        requestedPath &&
        requestedPath.trim()
    ) {

        const cleanPath =
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

        if (cleanPath) {
            return cleanPath;
        }
    }

    return (
        "riderx2/uploads/" +
        Date.now() +
        "-" +
        crypto.randomUUID() +
        "-" +
        filename
    );
}


/* =========================================================
 * BACKBLAZE B2 S3 UPLOAD
 * ========================================================= */

async function uploadToB2(
    request,
    env,
    origin
) {

    /*
     * -------------------------------------------------------
     * CHECK CONFIGURATION
     * -------------------------------------------------------
     */

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

    if (missing.length > 0) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "B2 storage configuration is incomplete.",

                missing:
                    missing
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


    /*
     * -------------------------------------------------------
     * READ FILE
     * -------------------------------------------------------
     */

    const body =
        await request.arrayBuffer();


    if (
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


    /*
     * -------------------------------------------------------
     * SIZE CHECK
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

    const originalFilename =
        request.headers.get(
            "X-Filename"
        ) ||
        "upload.bin";

    const safeFilename =
        getSafeFilename(
            originalFilename
        );


    /*
     * -------------------------------------------------------
     * OBJECT PATH
     * -------------------------------------------------------
     */

    const objectPath =
        getObjectPath(
            request,
            safeFilename
        );


    /*
     * -------------------------------------------------------
     * ENDPOINT
     * -------------------------------------------------------
     */

    const endpoint =
        String(
            env.B2_ENDPOINT
        )
        .replace(
            /\/+$/,
            ""
        );


    let endpointUrl;

    try {

        endpointUrl =
            new URL(
                endpoint
            );

    } catch {

        return jsonResponse(
            {
                ok: false,

                error:
                    "B2_ENDPOINT is not a valid URL."
            },
            500,
            origin
        );
    }


    const host =
        endpointUrl.host;


    /*
     * -------------------------------------------------------
     * B2 S3 REGION
     * -------------------------------------------------------
     *
     * Example:
     *
     * s3.us-east-005.backblazeb2.com
     *
     */

    let region =
        "us-east-005";


    const hostMatch =
        host.match(
            /^s3\.([^.]+)\.backblazeb2\.com$/i
        );

    if (
        hostMatch &&
        hostMatch[1]
    ) {

        region =
            hostMatch[1];
    }


    const service =
        "s3";


    const bucket =
        String(
            env.B2_BUCKET
        ).trim();


    /*
     * -------------------------------------------------------
     * PAYLOAD HASH
     * -------------------------------------------------------
     */

    const payloadHash =
        await sha256Hex(
            body
        );


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
        encodePath(
            bucket
        ) +
        "/" +
        encodePath(
            objectPath
        );


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
     * SIGNING KEY
     * -------------------------------------------------------
     */

    const signingKey =
        await getSignatureKey(
            env.B2_APPLICATION_KEY,
            dateStamp,
            region,
            service
        );


    /*
     * -------------------------------------------------------
     * SIGNATURE
     * -------------------------------------------------------
     */

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
     * AUTHORIZATION
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
     * UPLOAD URL
     * -------------------------------------------------------
     */

    const uploadUrl =
        endpoint +
        "/" +
        encodePath(
            bucket
        ) +
        "/" +
        encodePath(
            objectPath
        );


    /*
     * -------------------------------------------------------
     * UPLOAD
     * -------------------------------------------------------
     */

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

    } catch (networkError) {

        console.error(
            "B2 network error:",
            networkError
        );

        return jsonResponse(
            {
                ok: false,

                error:
                    "Could not connect to Backblaze B2.",

                details:
                    networkError?.message ||
                    String(
                        networkError
                    )
            },
            502,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * READ B2 RESPONSE
     * ------------------------------------------------------- */

    const responseText =
        await b2Response.text();


    /*
     * -------------------------------------------------------
     * B2 ERROR
     * -------------------------------------------------------
     */

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
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                b2Status:
                    b2Response.status,

                b2Response:
                    responseText.slice(
                        0,
                        3000
                    ),

                bucket:
                    bucket,

                endpoint:
                    endpoint,

                region:
                    region
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

body {

    margin: 0;

    min-height: 100vh;

    padding:
        48px 20px;

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
        620px;

    margin:
        0 auto;

    padding:
        34px;

    border-radius:
        22px;

    background:
        #1f2937;

    box-shadow:
        0 20px 50px
        rgba(0,0,0,.35);
}

h1 {

    margin:
        0 0 22px;

    color:
        #FFD400;

    font-size:
        42px;

    line-height:
        1.15;
}

p {

    margin:
        0 0 24px;

    color:
        #d1d5db;

    font-size:
        18px;

    line-height:
        1.65;
}

input[type="file"] {

    width: 100%;

    padding:
        15px;

    margin:
        0 0 20px;

    border:
        2px solid #4b5563;

    border-radius:
        12px;

    background:
        #111827;

    color:
        #ffffff;

    font-size:
        16px;
}

button {

    width: 100%;

    padding:
        18px;

    border:
        0;

    border-radius:
        14px;

    background:
        #FFD400;

    color:
        #111111;

    font-size:
        18px;

    font-weight:
        700;

    cursor:
        pointer;
}

button:disabled {

    opacity:
        .55;

    cursor:
        not-allowed;
}

pre {

    width: 100%;

    min-height:
        90px;

    margin:
        22px 0 0;

    padding:
        18px;

    border-radius:
        14px;

    background:
        #030712;

    color:
        #d1d5db;

    font-size:
        14px;

    line-height:
        1.55;

    white-space:
        pre-wrap;

    word-break:
        break-word;

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

.info {

    color:
        #d1d5db;
}

@media (
    max-width: 600px
) {

    body {

        padding:
            28px 16px;
    }

    .container {

        padding:
            28px 22px;

        border-radius:
            20px;
    }

    h1 {

        font-size:
            38px;
    }

    p {

        font-size:
            17px;
    }
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
    accept="
        image/jpeg,
        image/png,
        image/webp,
        application/pdf
    "
>

<button
    id="uploadButton"
    type="button"
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


    const allowedTypes =
        new Set([
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
        ]);


    if (
        !allowedTypes.has(
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


    uploadButton.disabled =
        true;

    uploadButton.textContent =
        "Uploading...";


    result.className =
        "info";

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
                rawResponse:
                    text
            };
        }


        if (
            !response.ok
        ) {

            result.className =
                "error";

            result.textContent =
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
            JSON.stringify(
                {
                    ok: false,

                    error:
                        "Request failed.",

                    details:
                        error?.message ||
                        String(
                            error
                        )
                },
                null,
                2
            );

    } finally {

        uploadButton.disabled =
            false;

        uploadButton.textContent =
            "Upload to Backblaze B2";
    }
}


uploadButton.addEventListener(
    "click",
    uploadFile
);

</script>

</body>

</html>
`;
}


/* =========================================================
 * MAIN WORKER
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
                    status:
                        204,

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


        /*
         * =====================================================
         * B2 UPLOAD
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
                            "Storage upload failed.",

                        details:
                            error?.message ||
                            String(
                                error
                            )
                    },
                    500,
                    origin
                );
            }
        }


        /*
         * =====================================================
         * STATIC WEBSITE
         * =====================================================
         */

        if (
            env.ASSETS &&
            typeof env.ASSETS.fetch ===
                "function"
        ) {

            return env.ASSETS.fetch(
                request
            );
        }


        /*
         * =====================================================
         * ASSETS BINDING MISSING
         * =====================================================
         */

        return jsonResponse(
            {
                ok: false,

                error:
                    "ASSETS binding is not configured."
            },
            500,
            origin
        );
    }
};
