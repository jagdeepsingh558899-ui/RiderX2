"use strict";

/*
 * =========================================================
 * RIDERX 2 — CLOUDFLARE WORKER + BACKBLAZE B2
 * =========================================================
 *
 * CLOUDFLARE VARIABLES / SECRETS
 *
 * Secret:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Text:
 *   B2_BUCKET
 *
 * Example:
 *   B2_BUCKET = riderx2-prod
 *
 * =========================================================
 *
 * ROUTES
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
 * SHA-1
 *
 * Backblaze B2 Native Upload API requires:
 *
 * X-Bz-Content-Sha1
 *
 * ========================================================= */

async function sha1Hex(data) {

    const buffer =
        data instanceof ArrayBuffer
            ? data
            : await new Response(data)
                .arrayBuffer();

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

    return btoa(value);
}


/* =========================================================
 * BACKBLAZE AUTHORIZATION
 *
 * B2 Native API:
 *
 * POST
 * https://api.backblazeb2.com/b2api/v2/b2_authorize_account
 *
 * ========================================================= */

async function authorizeB2(env) {

    if (
        !env.B2_APPLICATION_KEY_ID ||
        !env.B2_APPLICATION_KEY
    ) {

        throw new Error(
            "B2 credentials are missing."
        );
    }


    const credentials =
        env.B2_APPLICATION_KEY_ID +
        ":" +
        env.B2_APPLICATION_KEY;


    const authorization =
        "Basic " +
        base64Encode(credentials);


    const response =
        await fetch(
            "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
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

        data =
            JSON.parse(text);

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
        !data.apiUrl ||
        !data.downloadUrl
    ) {

        throw new Error(
            "B2 authorization response is incomplete."
        );
    }


    return data;
}


/* =========================================================
 * FIND BUCKET
 *
 * We use the bucket name configured in:
 *
 * B2_BUCKET
 *
 * ========================================================= */

async function getBucket(
    auth,
    env
) {

    const bucketName =
        String(
            env.B2_BUCKET || ""
        ).trim();


    if (!bucketName) {

        throw new Error(
            "B2_BUCKET is missing."
        );
    }


    const response =
        await fetch(
            auth.apiUrl +
            "/b2api/v2/b2_list_buckets",
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
                        bucketName
                })
            }
        );


    const text =
        await response.text();


    let data;

    try {

        data =
            JSON.parse(text);

    } catch {

        data = {
            raw: text
        };
    }


    if (!response.ok) {

        throw new Error(
            "B2 bucket lookup failed: " +
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
                item.name ===
                bucketName
        );


    if (!bucket) {

        throw new Error(
            "B2 bucket not found: " +
            bucketName
        );
    }


    return bucket;
}


/* =========================================================
 * GET UPLOAD URL
 *
 * ========================================================= */

async function getUploadUrl(
    auth,
    bucketId
) {

    const response =
        await fetch(
            auth.apiUrl +
            "/b2api/v2/b2_get_upload_url",
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

        data =
            JSON.parse(text);

    } catch {

        data = {
            raw: text
        };
    }


    if (!response.ok) {

        throw new Error(
            "B2 upload URL failed: " +
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
 * SAFE FILE NAME
 * ========================================================= */

function safeFilename(filename) {

    let value =
        String(
            filename ||
            "upload.bin"
        );


    value =
        value
            .replace(
                /\\/g,
                "_"
            )
            .replace(
                /\//g,
                "_"
            )
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            )
            .replace(
                /\.{2,}/g,
                "."
            )
            .replace(
                /^[-.]+/,
                "_"
            )
            .slice(
                0,
                150
            );


    if (!value) {

        value =
            "upload.bin";
    }


    return value;
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

        let path =
            String(
                requestedPath
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


        path =
            path.replace(
                /\/+/g,
                "/"
            );


        if (
            path &&
            !path.endsWith("/")
        ) {

            return path;
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
 * B2 FILE NAME ENCODING
 *
 * B2 expects the file name to be URL encoded.
 *
 * ========================================================= */

function encodeB2FileName(
    filename
) {

    return encodeURIComponent(
        filename
    );
}


/* =========================================================
 * UPLOAD TO BACKBLAZE B2
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


    if (missing.length) {

        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 configuration is incomplete.",

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
     * READ REQUEST BODY
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
     * MAX SIZE
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
     * OBJECT PATH
     * -------------------------------------------------------
     */

    const objectPath =
        createObjectPath(
            request,
            filename
        );


    /*
     * -------------------------------------------------------
     * SHA-1
     * -------------------------------------------------------
     */

    const sha1 =
        await sha1Hex(
            body
        );


    /*
     * -------------------------------------------------------
     * AUTHORIZE B2
     * -------------------------------------------------------
     */

    const auth =
        await authorizeB2(
            env
        );


    /*
     * -------------------------------------------------------
     * FIND BUCKET
     * -------------------------------------------------------
     */

    const bucket =
        await getBucket(
            auth,
            env
        );


    /*
     * -------------------------------------------------------
     * GET UPLOAD URL
     * -------------------------------------------------------
     */

    const uploadInfo =
        await getUploadUrl(
            auth,
            bucket.bucketId
        );


    /*
     * -------------------------------------------------------
     * UPLOAD FILE
     *
     * IMPORTANT:
     *
     * Do NOT use Content-Length manually as a string
     * generated incorrectly.
     *
     * Cloudflare fetch will send the ArrayBuffer correctly.
     *
     * -------------------------------------------------------
     */

    const uploadResponse =
        await fetch(
            uploadInfo.uploadUrl,
            {
                method: "POST",

                headers: {

                    "Authorization":
                        uploadInfo.authorizationToken,

                    "X-Bz-File-Name":
                        encodeB2FileName(
                            objectPath
                        ),

                    "Content-Type":
                        contentType,

                    "Content-Length":
                        String(
                            body.byteLength
                        ),

                    "X-Bz-Content-Sha1":
                        sha1
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
        await uploadResponse.text();


    let responseData;

    try {

        responseData =
            JSON.parse(
                responseText
            );

    } catch {

        responseData = {
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
        !uploadResponse.ok
    ) {

        console.error(
            "Backblaze B2 upload failed:",
            uploadResponse.status,
            responseData
        );


        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                status:
                    uploadResponse.status,

                details:
                    responseData
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
                bucket.name,

            bucketId:
                bucket.bucketId,

            key:
                objectPath,

            fileId:
                responseData.fileId ||
                null,

            fileName:
                responseData.fileName ||
                objectPath,

            contentType:
                contentType,

            size:
                body.byteLength,

            sha1:
                sha1
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
        620px;

    margin:
        0 auto;

    padding:
        28px;

    border-radius:
        22px;

    background:
        #1f2937;

    box-shadow:
        0 20px 50px
        rgba(0, 0, 0, .35);
}

h1 {

    margin:
        0 0 18px;

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

    width: 100%;

    margin:
        18px 0;

    padding:
        14px;

    border:
        1px solid #4b5563;

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
        17px;

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
        .55;

    cursor:
        not-allowed;
}

pre {

    margin-top:
        20px;

    padding:
        18px;

    min-height:
        90px;

    white-space:
        pre-wrap;

    word-break:
        break-word;

    border-radius:
        12px;

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
    file and upload it through the
    RiderX Cloudflare Worker to
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


    /*
     * -------------------------------------------------------
     * FILE TYPE
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * FILE SIZE
     * -------------------------------------------------------
     */

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


    /*
     * -------------------------------------------------------
     * UI
     * -------------------------------------------------------
     */

    button.disabled =
        true;

    button.textContent =
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


        if (
            !response.ok ||
            !data.ok
        ) {

            const errorMessage =
                data.error ||
                "Upload failed.";


            result.className =
                "error";

            result.textContent =
                errorMessage +
                "\\n\\n" +
                JSON.stringify(
                    data,
                    null,
                    2
                );

            return;
        }


        /*
         * ---------------------------------------------------
         * SUCCESS
         * ---------------------------------------------------
         */

        result.className =
            "success";

        result.textContent =
            "UPLOAD SUCCESSFUL\\n\\n" +
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
                            "no-store",

                        ...corsHeaders(
                            origin
                        )
                    }
                }
            );
        }


        /*
         * =====================================================
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
         * STATIC RIDERX WEBSITE
         * =====================================================
         */

        if (
            env &&
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
         * FALLBACK 404
         * =====================================================
         */

        return new Response(
            "RiderX Worker is online.",
            {
                status:
                    404,

                headers:
                    corsHeaders(
                        origin
                    )
            }
        );
    }
};
