"use strict";

/*
 * =========================================================
 * RIDERX — CLOUDFLARE WORKER + BACKBLAZE B2
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
 *   B2_BUCKET:
 *   riderx2-prod
 *
 *   B2_ENDPOINT:
 *   https://s3.us-east-005.backblazeb2.com
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

const B2_API_ENDPOINT =
    "https://api.backblazeb2.com";


/* =========================================================
 * CORS
 * ========================================================= */

function corsHeaders(origin = "*") {

    return {
        "Access-Control-Allow-Origin": origin,

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
 * SHA-1
 * ========================================================= */

async function sha1Hex(data) {

    const buffer =
        data instanceof ArrayBuffer
            ? data
            : await new Response(
                data
            ).arrayBuffer();

    const hash =
        await crypto.subtle.digest(
            "SHA-1",
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
 * BASE64
 * ========================================================= */

function base64Encode(value) {

    const bytes =
        new TextEncoder().encode(
            value
        );

    let binary = "";

    const chunkSize = 0x8000;

    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {

        binary += String.fromCharCode(
            ...bytes.subarray(
                i,
                i + chunkSize
            )
        );
    }

    return btoa(binary);
}


/* =========================================================
 * SAFE FILE NAME
 * ========================================================= */

function safeFilename(
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

function createObjectPath(
    request,
    filename
) {

    const requestedPath =
        request.headers.get(
            "X-Upload-Path"
        );

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
        filename
    );
}


/* =========================================================
 * CHECK CONFIGURATION
 * ========================================================= */

function getMissingConfig(env) {

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

    return missing;
}


/* =========================================================
 * BACKBLAZE AUTHORIZE ACCOUNT
 * ========================================================= */

async function authorizeB2(env) {

    const credentials =
        env.B2_APPLICATION_KEY_ID +
        ":" +
        env.B2_APPLICATION_KEY;

    const authorization =
        "Basic " +
        base64Encode(
            credentials
        );

    const response =
        await fetch(
            B2_API_ENDPOINT +
            "/b2api/v3/b2_authorize_account",
            {
                method: "GET",

                headers: {
                    "Authorization":
                        authorization
                }
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            raw: text
        };
    }

    if (!response.ok) {

        throw new Error(
            "B2 authorization failed: " +
            response.status +
            " " +
            JSON.stringify(data)
        );
    }

    if (
        !data.authorizationToken ||
        !data.apiUrl
    ) {

        throw new Error(
            "B2 authorization response is incomplete."
        );
    }

    return data;
}


/* =========================================================
 * FIND BUCKET
 * ========================================================= */

async function getBucket(
    auth
) {

    const response =
        await fetch(
            auth.apiUrl +
            "/b2api/v3/b2_list_buckets",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        auth.authorizationToken,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    accountId:
                        auth.accountId,

                    bucketName:
                        auth.bucketName
                })
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            raw: text
        };
    }

    if (!response.ok) {

        throw new Error(
            "B2 list buckets failed: " +
            response.status +
            " " +
            JSON.stringify(data)
        );
    }

    const buckets =
        Array.isArray(
            data.buckets
        )
            ? data.buckets
            : [];

    const bucket =
        buckets.find(
            item =>
                item.bucketName ===
                auth.bucketName
        );

    if (!bucket) {

        throw new Error(
            "B2 bucket not found: " +
            auth.bucketName
        );
    }

    return bucket;
}


/* =========================================================
 * GET B2 UPLOAD URL
 * ========================================================= */

async function getUploadUrl(
    auth,
    bucketId
) {

    const response =
        await fetch(
            auth.apiUrl +
            "/b2api/v3/b2_get_upload_url",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        auth.authorizationToken,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    bucketId:
                        bucketId
                })
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            raw: text
        };
    }

    if (!response.ok) {

        throw new Error(
            "B2 get upload URL failed: " +
            response.status +
            " " +
            JSON.stringify(data)
        );
    }

    if (
        !data.uploadUrl ||
        !data.authorizationToken
    ) {

        throw new Error(
            "B2 upload URL response is incomplete."
        );
    }

    return data;
}


/* =========================================================
 * UPLOAD FILE TO B2
 * ========================================================= */

async function uploadToB2(
    request,
    env,
    origin
) {

    /*
     * -------------------------------------------------------
     * CONFIGURATION
     * -------------------------------------------------------
     */

    const missing =
        getMissingConfig(
            env
        );

    if (missing.length) {

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

    let contentType =
        request.headers.get(
            "Content-Type"
        ) ||
        "application/octet-stream";

    /*
     * Remove accidental parameters such as:
     *
     * image/png; charset=UTF-8
     *
     * because browser file uploads normally
     * provide a clean MIME type.
     */

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
     * FILE SIZE
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
        safeFilename(
            request.headers.get(
                "X-Filename"
            )
        );


    /*
     * -------------------------------------------------------
     * OBJECT KEY
     * -------------------------------------------------------
     */

    const objectPath =
        createObjectPath(
            request,
            filename
        );


    /*
     * -------------------------------------------------------
     * AUTHORIZE
     * -------------------------------------------------------
     */

    const auth =
        await authorizeB2(
            {
                B2_APPLICATION_KEY_ID:
                    env.B2_APPLICATION_KEY_ID,

                B2_APPLICATION_KEY:
                    env.B2_APPLICATION_KEY
            }
        );


    /*
     * Add values required by the
     * subsequent B2 API calls.
     */

    auth.bucketName =
        env.B2_BUCKET;


    /*
     * -------------------------------------------------------
     * FIND BUCKET
     * -------------------------------------------------------
     */

    const bucket =
        await getBucket(
            auth
        );


    /*
     * -------------------------------------------------------
     * GET UPLOAD URL
     * -------------------------------------------------------
     */

    const upload =
        await getUploadUrl(
            auth,
            bucket.bucketId
        );


    /*
     * -------------------------------------------------------
     * SHA-1
     * -------------------------------------------------------
     */

    const contentSha1 =
        await sha1Hex(
            body
        );


    /*
     * -------------------------------------------------------
     * B2 FILE NAME
     * -------------------------------------------------------
     *
     * B2 expects the file name to be URL encoded.
     *
     * encodeURIComponent is used for every path
     * character while preserving "/" as folder separators.
     * -------------------------------------------------------
     */

    const encodedFilename =
        objectPath
            .split("/")
            .map(
                part =>
                    encodeURIComponent(
                        part
                    )
            )
            .join("/");


    /*
     * -------------------------------------------------------
     * UPLOAD
     * -------------------------------------------------------
     */

    const b2Response =
        await fetch(
            upload.uploadUrl,
            {
                method: "POST",

                headers: {

                    "Authorization":
                        upload.authorizationToken,

                    "X-Bz-File-Name":
                        encodedFilename,

                    "Content-Type":
                        contentType,

                    "X-Bz-Content-Sha1":
                        contentSha1,

                    "Content-Length":
                        String(
                            body.byteLength
                        )
                },

                body:
                    body
            }
        );


    /*
     * -------------------------------------------------------
     * READ B2 RESPONSE
     * -------------------------------------------------------
     */

    const responseText =
        await b2Response.text();

    let b2Data;

    try {

        b2Data =
            JSON.parse(
                responseText
            );

    } catch {

        b2Data = {
            raw:
                responseText
        };
    }


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
            b2Data
        );

        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                status:
                    b2Response.status,

                b2:
                    b2Data,

                file:
                    filename,

                size:
                    body.byteLength
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
                env.B2_BUCKET,

            key:
                objectPath,

            fileId:
                b2Data.fileId ||
                null,

            fileName:
                b2Data.fileName ||
                objectPath,

            contentType:
                contentType,

            size:
                body.byteLength,

            sha1:
                contentSha1
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
        570px;

    margin:
        0 auto;

    padding:
        30px;

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
        0 0 20px;

    color:
        #FFD400;

    font-size:
        40px;

    line-height:
        1.15;
}

p {

    margin:
        0 0 20px;

    color:
        #d1d5db;

    font-size:
        18px;

    line-height:
        1.6;
}

input[type="file"] {

    display:
        block;

    width:
        100%;

    padding:
        15px;

    margin:
        20px 0;

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

    display:
        block;

    width:
        100%;

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
        19px;

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

    margin:
        22px 0 0;

    padding:
        18px;

    min-height:
        80px;

    white-space:
        pre-wrap;

    word-break:
        break-word;

    border-radius:
        14px;

    background:
        #030712;

    color:
        #d1d5db;

    font-size:
        14px;

    line-height:
        1.5;

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
>
    Upload to Backblaze B2
</button>

<pre
    id="result"
    class="info"
>Waiting for file...</pre>

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
                raw:
                    text
            };
        }


        if (!response.ok) {

            console.error(
                "Upload error:",
                data
            );

            result.className =
                "error";

            result.textContent =
                "Upload failed:\\n\\n" +
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
            "Network/Worker error:\\n\\n" +
            error.message;

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

            const missing =
                getMissingConfig(
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
         * =====================================================
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


        /*
         * =====================================================
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
                            error &&
                            error.message
                                ? error.message
                                : String(
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
         * ===================================================== */

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
