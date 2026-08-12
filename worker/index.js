"use strict";

/*
 * =========================================================
 * RIDERX — CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * BACKBLAZE B2 NATIVE API VERSION
 *
 * CLOUDFLARE VARIABLES / SECRETS:
 *
 * Secret:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Text:
 *   B2_BUCKET
 *   B2_ENDPOINT
 *
 * B2 BUCKET:
 *   riderx2-prod
 *
 * B2 S3 ENDPOINT:
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
    10 * 1024 * 1024; // 10 MB


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
 * TEXT ENCODER
 * ========================================================= */

const encoder =
    new TextEncoder();


/* =========================================================
 * SHA-1
 *
 * Backblaze Native B2 upload requires SHA-1.
 * ========================================================= */

async function sha1Hex(data) {

    const hash =
        await crypto.subtle.digest(
            "SHA-1",
            data
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
 * BASE64
 * ========================================================= */

function base64Encode(value) {

    return btoa(value);
}


/* =========================================================
 * B2 CONFIGURATION CHECK
 * ========================================================= */

function getMissingB2Config(env) {

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

    return missing;
}


/* =========================================================
 * BACKBLAZE AUTHORIZATION
 *
 * Native B2 API:
 *
 * POST
 * https://api.backblazeb2.com/b2api/v2/b2_authorize_account
 *
 * ========================================================= */

async function authorizeB2(env) {

    const keyId =
        String(
            env.B2_APPLICATION_KEY_ID
        ).trim();

    const applicationKey =
        String(
            env.B2_APPLICATION_KEY
        ).trim();


    const credentials =
        base64Encode(
            keyId +
            ":" +
            applicationKey
        );


    const response =
        await fetch(
            "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
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
        !data.accountId
    ) {

        throw new Error(
            "B2 authorization response is incomplete."
        );
    }


    return data;
}


/* =========================================================
 * FIND B2 BUCKET
 * ========================================================= */

async function findB2Bucket(
    auth,
    env
) {

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
                            env.B2_BUCKET
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

    } catch {

        data = {
            raw:
                text
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
                item.bucketName ===
                env.B2_BUCKET
        );


    if (!bucket) {

        throw new Error(
            'B2 bucket "' +
            env.B2_BUCKET +
            '" was not found.'
        );
    }


    if (!bucket.bucketId) {

        throw new Error(
            "B2 bucket ID was not returned."
        );
    }


    return bucket;
}


/* =========================================================
 * GET B2 UPLOAD URL
 * ========================================================= */

async function getB2UploadUrl(
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

    } catch {

        data = {
            raw:
                text
        };
    }


    if (!response.ok) {

        throw new Error(
            "B2 upload URL request failed: " +
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

function sanitizeFilename(
    filename
) {

    let name =
        filename ||
        "upload.bin";


    name =
        name
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            )
            .replace(
                /\.{2,}/g,
                "."
            )
            .replace(
                /^\.+/,
                ""
            )
            .slice(
                0,
                150
            );


    if (!name) {

        name =
            "upload.bin";
    }


    return name;
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

        let cleanPath =
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


        cleanPath =
            cleanPath
                .replace(
                    /^\/+/,
                    ""
                );


        if (
            cleanPath &&
            !cleanPath.endsWith("/")
        ) {

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
 * BACKBLAZE FILE NAME ENCODING
 *
 * B2 requires URL encoded file names.
 * ========================================================= */

function encodeB2Filename(
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
     * CONFIGURATION
     * -------------------------------------------------------
     */

    const missing =
        getMissingB2Config(
            env
        );


    if (
        missing.length > 0
    ) {

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
        );


    if (contentType) {

        contentType =
            contentType
                .split(";")[0]
                .trim()
                .toLowerCase();

    } else {

        contentType =
            "application/octet-stream";
    }


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
                    10,

                receivedBytes:
                    body.byteLength
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
        sanitizeFilename(
            originalFilename
        );


    /*
     * -------------------------------------------------------
     * OBJECT PATH
     * -------------------------------------------------------
     */

    const objectPath =
        createObjectPath(
            request,
            safeFilename
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
     * AUTHORIZE ACCOUNT
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
        await findB2Bucket(
            auth,
            env
        );


    /*
     * -------------------------------------------------------
     * GET UPLOAD URL
     * -------------------------------------------------------
     */

    const uploadInfo =
        await getB2UploadUrl(
            auth,
            bucket.bucketId
        );


    /*
     * -------------------------------------------------------
     * UPLOAD FILE
     * -------------------------------------------------------
     */

    const uploadResponse =
        await fetch(
            uploadInfo.uploadUrl,
            {
                method:
                    "POST",

                headers: {
                    "Authorization":
                        uploadInfo.authorizationToken,

                    "X-Bz-File-Name":
                        encodeB2Filename(
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


    const uploadText =
        await uploadResponse.text();


    let uploadData;

    try {

        uploadData =
            JSON.parse(
                uploadText
            );

    } catch {

        uploadData = {
            raw:
                uploadText
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
            uploadData
        );


        return jsonResponse(
            {
                ok: false,

                error:
                    "Backblaze B2 upload failed.",

                status:
                    uploadResponse.status,

                details:
                    uploadData
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
                bucket.bucketName,

            bucketId:
                bucket.bucketId,

            key:
                objectPath,

            fileId:
                uploadData.fileId ||
                null,

            fileName:
                uploadData.fileName ||
                objectPath,

            contentType:
                contentType,

            size:
                body.byteLength,

            sha1:
                sha1,

            b2Response:
                uploadData
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

    border-radius: 20px;

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
        40px;

    line-height:
        1.15;
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

    font-size:
        16px;
}

button {

    width: 100%;

    padding: 17px;

    border: none;

    border-radius:
        12px;

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
        22px;

    padding:
        18px;

    min-height:
        70px;

    border-radius:
        12px;

    background:
        #030712;

    color:
        #d1d5db;

    overflow-x:
        auto;

    font-size:
        14px;

    line-height:
        1.6;
}

.success {

    color:
        #86efac;
}

.error {

    color:
        #fca5
