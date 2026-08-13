"use strict";

/*
 * ============================================================
 * RIDERX2 — CLOUDFLARE WORKER + BACKBLAZE B2
 * ============================================================
 *
 * Native Backblaze B2 API
 *
 * REQUIRED CLOUDFLARE VARIABLES / SECRETS
 *
 * Secrets:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Variables:
 *   B2_BUCKET
 *
 * Optional:
 *   B2_BUCKET_ID
 *   B2_ENDPOINT
 *
 * Example:
 *
 *   B2_BUCKET = riderx2-prod
 *
 *   B2_BUCKET_ID =
 *   7f158cc2e466fa7d9ef30314
 *
 *   B2_ENDPOINT =
 *   https://s3.us-east-005.backblazeb2.com
 *
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
 * ============================================================
 */


/* ============================================================
 * CONFIGURATION
 * ============================================================ */

const MAX_UPLOAD_BYTES =
    10 * 1024 * 1024;


const ALLOWED_CONTENT_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ]);


/*
 * Backblaze Native B2 API.
 *
 * Authorization endpoint.
 */

const B2_AUTHORIZE_URL =
    "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";


/* ============================================================
 * CORS
 * ============================================================ */

function corsHeaders(origin = "*") {

    return {

        "Access-Control-Allow-Origin":
            origin,

        "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS",

        "Access-Control-Allow-Headers":
            [
                "Content-Type",
                "Authorization",
                "X-Filename",
                "X-Upload-Path"
            ].join(", "),

        "Access-Control-Max-Age":
            "86400"
    };
}


/* ============================================================
 * JSON RESPONSE
 * ============================================================ */

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

                ...corsHeaders(
                    origin
                )
            }
        }
    );
}


/* ============================================================
 * TEXT RESPONSE
 * ============================================================ */

function textResponse(
    text,
    status = 200,
    origin = "*"
) {

    return new Response(
        text,
        {
            status,

            headers: {

                "Content-Type":
                    "text/plain; charset=UTF-8",

                "Cache-Control":
                    "no-store",

                ...corsHeaders(
                    origin
                )
            }
        }
    );
}


/* ============================================================
 * SHA-1
 *
 * Required by Native B2 upload API.
 * ============================================================ */

async function sha1Hex(data) {

    let buffer;


    if (
        data instanceof ArrayBuffer
    ) {

        buffer =
            data;

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
            "SHA-1",
            buffer
        );


    return Array
        .from(
            new Uint8Array(
                hash
            )
        )
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(
                        2,
                        "0"
                    )
        )
        .join("");
}


/* ============================================================
 * SAFE FILE NAME
 * ============================================================ */

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


/* ============================================================
 * SAFE OBJECT PATH
 * ============================================================ */

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


/* ============================================================
 * B2 CONFIGURATION
 * ============================================================ */

function getB2Configuration(
    env
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


    return {

        configured:
            missing.length === 0,

        missing
    };
}


/* ============================================================
 * BACKBLAZE AUTHORIZATION
 *
 * Uses Native B2 API.
 *
 * IMPORTANT:
 * Do NOT expose the application key in responses.
 * ============================================================ */

async function authorizeB2(
    env
) {

    if (
        !env.B2_APPLICATION_KEY_ID ||
        !env.B2_APPLICATION_KEY
    ) {

        throw new Error(
            "B2 credentials are missing."
        );
    }


    const credentials =
        btoa(
            String(
                env.B2_APPLICATION_KEY_ID
            ) +
            ":" +
            String(
                env.B2_APPLICATION_KEY
            )
        );


    let response;


    try {

        response =
            await fetch(
                B2_AUTHORIZE_URL,
                {
                    method:
                        "GET",

                    headers: {

                        "Authorization":
                            "Basic " +
                            credentials
                    }
                }
            );

    } catch (error) {

        throw new Error(
            "Could not connect to Backblaze authorization API: " +
            (
                error?.message ||
                String(error)
            )
        );
    }


    const text =
        await response.text();


    let data;

    try {

        data =
            JSON.parse(
                text
            );

    } catch (error) {

        throw new Error(
            "Backblaze authorization returned invalid JSON."
        );
    }


    if (
        !response.ok
    ) {

        throw new Error(
            "Backblaze authorization failed (" +
            response.status +
            "): " +
            JSON.stringify(
                data
            )
        );
    }


    if (
        !data.authorizationToken ||
        !data.apiUrl ||
        !data.accountId
    ) {

        throw new Error(
            "Backblaze authorization response is incomplete."
        );
    }


    return data;
}


/* ============================================================
 * GET BUCKET ID
 *
 * If B2_BUCKET_ID is configured, use it directly.
 *
 * Otherwise find the bucket by bucket name.
 * ============================================================ */

async function getBucketId(
    auth,
    env
) {

    if (
        env.B2_BUCKET_ID
    ) {

        return String(
            env.B2_BUCKET_ID
        ).trim();
    }


    const response =
        await fetch(
            auth.apiUrl +
            "/b2api/v2/b2_list_buckets",
            {

                method:
                    "POST",

                headers: {

                    "Authorization":
                        auth.authorizationToken,

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        accountId:
                            auth.accountId,

                        bucketName:
                            String(
                                env.B2_BUCKET
                            ).trim()

                    })
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

    } catch (error) {

        throw new Error(
            "Backblaze bucket lookup returned invalid JSON."
        );
    }


    if (
        !response.ok
    ) {

        throw new Error(
            "Backblaze bucket lookup failed (" +
            response.status +
            "): " +
            JSON.stringify(
                data
            )
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
                item &&
                item.bucketName ===
                    String(
                        env.B2_BUCKET
                    ).trim()
        );


    if (
        !bucket ||
        !bucket.bucketId
    ) {

        throw new Error(
            "Backblaze bucket was not found: " +
            String(
                env.B2_BUCKET
            )
        );
    }


    return bucket.bucketId;
}


/* ============================================================
 * GET UPLOAD URL
 * ============================================================ */

async function getUploadUrl(
    auth,
    bucketId
) {

    const response =
        await fetch(
            auth.apiUrl +
            "/b2api/v2/b2_get_upload_url",
            {

                method:
                    "POST",

                headers: {

                    "Authorization":
                        auth.authorizationToken,

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

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
            JSON.parse(
                text
            );

    } catch (error) {

        throw new Error(
            "Backblaze upload URL response was invalid."
        );
    }


    if (
        !response.ok
    ) {

        throw new Error(
            "Backblaze upload URL request failed (" +
            response.status +
            "): " +
            JSON.stringify(
                data
            )
        );
    }


    if (
        !data.uploadUrl ||
        !data.authorizationToken
    ) {

        throw new Error(
            "Backblaze upload URL response is incomplete."
        );
    }


    return data;
}


/* ============================================================
 * ENCODE B2 FILE NAME
 *
 * B2 expects the file name in X-Bz-File-Name to be URL encoded.
 * ============================================================ */

function encodeB2FileName(
    filename
) {

    return encodeURIComponent(
        filename
    );
}


/* ============================================================
 * BACKBLAZE B2 UPLOAD
 * ============================================================ */

async function uploadToB2(
    request,
    env,
    origin
) {

    /* --------------------------------------------------------
     * CONFIGURATION
     * ------------------------------------------------------ */

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


    /* --------------------------------------------------------
     * CONTENT TYPE
     * ------------------------------------------------------ */

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


    /* --------------------------------------------------------
     * READ REQUEST BODY
     *
     * IMPORTANT:
     *
     * Read the complete body into Uint8Array.
     *
     * We then send EXACTLY the same bytes to B2.
     *
     * This avoids the previous S3-style
     * IncompleteBody problem.
     * ------------------------------------------------------ */

    let body;


    try {

        const arrayBuffer =
            await request.arrayBuffer();


        body =
            new Uint8Array(
                arrayBuffer
            );

    } catch (error) {

        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Could not read upload body.",

                details:
                    error?.message ||
                    String(error)

            },
            400,
            origin
        );
    }


    /* --------------------------------------------------------
     * EMPTY BODY
     * ------------------------------------------------------ */

    if (
        body.byteLength === 0
    ) {

        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Upload body is empty."

            },
            400,
            origin
        );
    }


    /* --------------------------------------------------------
     * SIZE LIMIT
     * ------------------------------------------------------ */

    if (
        body.byteLength >
        MAX_UPLOAD_BYTES
    ) {

        return jsonResponse(
            {

                ok:
                    false,

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


    /* --------------------------------------------------------
     * FILE NAME
     * ------------------------------------------------------ */

    const suppliedFilename =
        request.headers.get(
            "X-Filename"
        ) ||
        "upload.bin";


    const safeFilename =
        sanitizeFilename(
            suppliedFilename
        );


    /* --------------------------------------------------------
     * OBJECT PATH
     * ------------------------------------------------------ */

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


    /* --------------------------------------------------------
     * SHA-1
     * ------------------------------------------------------ */

    const sha1 =
        await sha1Hex(
            body
        );


    /* --------------------------------------------------------
     * AUTHORIZE B2
     * ------------------------------------------------------ */

    let auth;


    try {

        auth =
            await authorizeB2(
                env
            );

    } catch (error) {

        console.error(
            "B2 authorization error:",
            error
        );


        const message =
            error?.message ||
            String(error);


        if (
            message.includes(
                "(401)"
            ) ||
            message.includes(
                "401"
            ) ||
            message.includes(
                "bad_auth_token"
            ) ||
            message.includes(
                "unauthorized"
            )
        ) {

            return jsonResponse(
                {

                    ok:
                        false,

                    error:
                        "Backblaze B2 authorization failed.",

                    details:
                        message

                },
                502,
                origin
            );
        }


        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Could not authorize with Backblaze B2.",

                details:
                    message

            },
            502,
            origin
        );
    }


    /* --------------------------------------------------------
     * BUCKET ID
     * ------------------------------------------------------ */

    let bucketId;


    try {

        bucketId =
            await getBucketId(
                auth,
                env
            );

    } catch (error) {

        console.error(
            "B2 bucket lookup error:",
            error
        );


        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Could not find Backblaze B2 bucket.",

                details:
                    error?.message ||
                    String(error)

            },
            502,
            origin
        );
    }


    /* --------------------------------------------------------
     * UPLOAD URL
     * ------------------------------------------------------ */

    let uploadInfo;


    try {

        uploadInfo =
            await getUploadUrl(
                auth,
                bucketId
            );

    } catch (error) {

        console.error(
            "B2 upload URL error:",
            error
        );


        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Could not get Backblaze B2 upload URL.",

                details:
                    error?.message ||
                    String(error)

            },
            502,
            origin
        );
    }


    /* --------------------------------------------------------
     * SEND FILE TO B2
     *
     * Native B2 upload endpoint.
     *
     * IMPORTANT HEADERS:
     *
     * Authorization
     * X-Bz-File-Name
     * Content-Type
     * Content-Length
     * X-Bz-Content-Sha1
     *
     * Body is the exact Uint8Array.
     * ------------------------------------------------------ */

    let b2Response;


    try {

        b2Response =
            await fetch(
                uploadInfo.uploadUrl,
                {

                    method:
                        "POST",

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

    } catch (error) {

        console.error(
            "B2 upload network error:",
            error
        );


        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Could not connect to Backblaze B2 upload server.",

                details:
                    error?.message ||
                    String(error)

            },
            502,
            origin
        );
    }


    /* --------------------------------------------------------
     * READ B2 RESPONSE
     * ------------------------------------------------------ */

    const responseText =
        await b2Response.text();


    let b2Data = null;


    try {

        b2Data =
            responseText
                ? JSON.parse(
                    responseText
                )
                : null;

    } catch (error) {

        b2Data = null;
    }


    /* --------------------------------------------------------
     * B2 ERROR
     * ------------------------------------------------------ */

    if (
        !b2Response.ok
    ) {

        console.error(
            "Backblaze B2 upload failed:",
            b2Response.status,
            responseText
        );


        /*
         * Token can expire.
         *
         * Return clean error instead of leaking
         * unnecessary credentials.
         */

        if (
            b2Response.status ===
            401
        ) {

            return jsonResponse(
                {

                    ok:
                        false,

                    error:
                        "Backblaze B2 upload authorization expired.",

                    b2Status:
                        b2Response.status,

                    b2Response:
                        responseText.slice(
                            0,
                            2000
                        )

                },
                502,
                origin
            );
        }


        return jsonResponse(
            {

                ok:
                    false,

                error:
                    "Backblaze B2 upload failed.",

                b2Status:
                    b2Response.status,

                b2StatusText:
                    b2Response.statusText,

                b2Response:
                    responseText.slice(
                        0,
                        2000
                    )

            },
            502,
            origin
        );
    }


    /* --------------------------------------------------------
     * SUCCESS
     * ------------------------------------------------------ */

    return jsonResponse(
        {

            ok:
                true,

            message:
                "File uploaded successfully.",

            storage:
                "Backblaze B2",

            bucket:
                b2Data?.bucketName ||
                String(
                    env.B2_BUCKET
                ),

            bucketId:
                bucketId,

            key:
                b2Data?.fileName ||
                objectPath,

            fileId:
                b2Data?.fileId ||
                null,

            contentType:
                b2Data?.contentType ||
                contentType,

            size:
                body.byteLength,

            sha1:
                b2Data?.contentSha1 ||
                sha1

        },
        201,
        origin
    );
}


/* ============================================================
 * STORAGE TEST PAGE
 * ============================================================ */

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
    margin-top: 0;

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
    width: 100%;

    padding:
        16px;

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

<pre id="result">
Checking storage...
</pre>

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


/* ============================================================
 * UPLOAD
 * ============================================================ */

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

                raw:
                    raw
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


/* ============================================================
 * HEALTH CHECK
 * ============================================================ */

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


        const data =
            await response.json();


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


/* ============================================================
 * MAIN CLOUDFLARE WORKER
 * ============================================================ */

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


        /* ====================================================
         * CORS PREFLIGHT
         * ================================================== */

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


        /* ====================================================
         * HEALTH CHECK
         * ================================================== */

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

                    bucket:
                        env.B2_BUCKET ||
                        null,

                    bucketId:
                        env.B2_BUCKET_ID ||
                        null,

                    api:
                        "Native B2 API",

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


        /* ====================================================
         * STORAGE TEST
         * ================================================== */

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


        /* ====================================================
         * B2 UPLOAD
         * ================================================== */

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


        /* ====================================================
         * STATIC WEBSITE
         * ================================================== */

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


        /* ====================================================
         * FALLBACK
         * ================================================== */

        return textResponse(
            "RiderX Worker is online.",
            200,
            origin
        );
    }
};
