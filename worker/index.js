"use strict";

/*
 * =========================================================
 * RIDERX2
 * CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * REQUIRED CLOUDFLARE SETTINGS
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
 *
 *   B2_BUCKET  = riderx2-prod
 *   B2_ENDPOINT =
 *   https://s3.us-east-005.backblazeb2.com
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
 * CONFIG
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
        "Access-Control-Allow-Origin": origin,

        "Access-Control-Allow-Methods":
            "GET, POST, DELETE, OPTIONS",

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
    keyBytes,
    message
) {

    const cryptoKey =
        await crypto.subtle.importKey(
            "raw",
            keyBytes,
            {
                name: "HMAC",
                hash: "SHA-256"
            },
            false,
            ["sign"]
        );


    const signature =
        await crypto.subtle.sign(
            "HMAC",
            cryptoKey,
            new TextEncoder().encode(
                message
            )
        );


    return new Uint8Array(
        signature
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
 * AWS URI ENCODING
 * ========================================================= */

function encodePath(path) {

    return path
        .split("/")
        .map(
            part =>
                encodeURIComponent(part)
                    .replace(
                        /[!'()*]/g,
                        char =>
                            "%" +
                            char
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

function sanitizeFilename(filename) {

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

function sanitizeObjectPath(path) {

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
 * B2 UPLOAD
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


    if (missing.length > 0) {

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

    const filename =
        sanitizeFilename(
            request.headers.get(
                "X-Filename"
            )
        );


    /*
     * -------------------------------------------------------
     * OBJECT PATH
     * -------------------------------------------------------
     */

    const requestedPath =
        request.headers.get(
            "X-Upload-Path"
        );


    let objectPath;


    if (requestedPath) {

        objectPath =
            sanitizeObjectPath(
                requestedPath
            );

    } else {

        objectPath =
            "riderx2/uploads/" +
            new Date()
                .toISOString()
                .replace(
                    /[:.]/g,
                    "-"
                ) +
            "-" +
            crypto.randomUUID() +
            "-" +
            filename;
    }


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
                    "B2_ENDPOINT is invalid."
            },
            500,
            origin
        );
    }


    const host =
        endpointUrl.host;


    /*
     * -------------------------------------------------------
     * REGION
     * -------------------------------------------------------
     *
     * Example:
     *
     * https://s3.us-east-005.backblazeb2.com
     *
     * Region:
     *
     * us-east-005
     *
     * -------------------------------------------------------
     */

    const regionMatch =
        host.match(
            /^s3\.([^.]+)\.backblazeb2\.com$/i
        );


    if (!regionMatch) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "Unable to determine B2 region from endpoint.",

                endpoint:
                    endpoint
            },
            500,
            origin
        );
    }


    const region =
        regionMatch[1];


    const service =
        "s3";


    const bucket =
        String(
            env.B2_BUCKET
        );


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
        [
            "PUT",
            canonicalUri,
            "",
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join("\n");


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
     * HASH CANONICAL REQUEST
     * -------------------------------------------------------
     */

    const canonicalRequestHash =
        await sha256Hex(
            canonicalRequest
        );


    /*
     * -------------------------------------------------------
     * STRING TO SIGN
     * -------------------------------------------------------
     */

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
        encodePath(bucket) +
        "/" +
        encodePath(objectPath);


    /*
     * -------------------------------------------------------
     * B2 REQUEST
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
                    String(
                        networkError?.message ||
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
     * -------------------------------------------------------
     */

    const b2Text =
        await b2Response.text();


    /*
     * -------------------------------------------------------
     * B2 ERROR
     * -------------------------------------------------------
     */

    if (!b2Response.ok) {

        console.error(
            "Backblaze B2 upload failed:",
            b2Response.status,
            b2Text
        );


        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                b2Status:
                    b2Response.status,

                b2Response:
                    b2Text.slice(
                        0,
                        2000
                    )
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

<title>RiderX Storage Test</title>

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

    background: #111827;
    color: #ffffff;
}

.container {
    width: 100%;
    max-width: 620px;
    margin: 0 auto;

    padding: 30px;

    border-radius: 20px;

    background: #1f2937;

    box-shadow:
        0 15px 45px
        rgba(0,0,0,.35);
}

h1 {
    margin-top: 0;

    color: #FFD400;

    font-size: 38px;
}

p {
    color: #d1d5db;

    line-height: 1.7;

    font-size: 18px;
}

input[type="file"] {
    width: 100%;

    padding: 15px;

    margin:
        18px 0;

    border:
        1px solid #4b5563;

    border-radius:
        12px;

    background:
        #111827;

    color:
        #ffffff;
}

button {
    width: 100%;

    padding: 17px;

    border: none;

    border-radius: 12px;

    background:
        #FFD400;

    color:
        #111111;

    font-size: 18px;

    font-weight: 700;

    cursor: pointer;
}

button:disabled {
    opacity: .6;

    cursor:
        not-allowed;
}

pre {
    white-space:
        pre-wrap;

    word-break:
        break-word;

    margin-top:
        22px;

    padding:
        18px;

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
>
    Upload to Backblaze B2
</button>

<pre id="result">Waiting for file...</pre>

</div>


<script>

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


async function uploadFile() {

    const file =
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


    const allowedTypes =
        [
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
                raw: text
            };
        }


        if (!response.ok) {

            throw new Error(
                data.b2Response
                    ? (
                        "B2 Error " +
                        data.b2Status +
                        ": " +
                        data.b2Response
                    )
                    : (
                        data.error ||
                        "Upload failed."
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
            error
        );


        result.className =
            "error";

        result.textContent =
            "Upload failed: " +
            (
                error?.message ||
                error
            );

    } finally {

        uploadButton.disabled =
            false;

        uploadButton.textContent =
            "Upload to Backblaze B2";
    }
}

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
         * -----------------------------------------------------
         * CORS PREFLIGHT
         * -----------------------------------------------------
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
         * -----------------------------------------------------
         * HEALTH
         * -----------------------------------------------------
         */

        if (
            request.method === "GET" &&
            url.pathname === "/api/health"
        ) {

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


            return jsonResponse(
                {
                    ok: true,

                    service:
                        "RiderX API",

                    status:
                        "online",

                    storage:
                        "Backblaze B2",

                    storageConfigured:
                        missing.length === 0,

                    missing:
                        missing,

                    timestamp:
                        new Date()
                            .toISOString()
                },
                200,
                origin
            );
        }


        /*
         * -----------------------------------------------------
         * STORAGE TEST
         * -----------------------------------------------------
         */

        if (
            request.method === "GET" &&
            url.pathname === "/storage-test"
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
         * -----------------------------------------------------
         * B2 UPLOAD
         * -----------------------------------------------------
         */

        if (
            request.method === "POST" &&
            url.pathname === "/api/storage/upload"
        ) {

            try {

                return await uploadToB2(
                    request,
                    env,
                    origin
                );

            } catch (error) {

                console.error(
                    "Unexpected storage error:",
                    error
                );


                return jsonResponse(
                    {
                        ok: false,

                        error:
                            "Storage upload failed.",

                        details:
                            String(
                                error?.message ||
                                error
                            )
                    },
                    500,
                    origin
                );
            }
        }


        /*
         * -----------------------------------------------------
         * STATIC WEBSITE
         * -----------------------------------------------------
         */

        return env.ASSETS.fetch(
            request
        );
    }
};
