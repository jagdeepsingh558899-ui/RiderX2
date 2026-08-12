"use strict";

/*
 * =========================================================
 * RIDERX — CLOUDFLARE WORKER + BACKBLAZE B2 STORAGE
 * =========================================================
 *
 * Required Cloudflare secrets/variables:
 *
 * Secret:
 *   B2_APPLICATION_KEY_ID
 *   B2_APPLICATION_KEY
 *
 * Variable:
 *   B2_BUCKET
 *   B2_ENDPOINT
 *
 * Current B2 bucket:
 *   riderx2-prod
 *
 * Current B2 endpoint:
 *   https://s3.us-east-005.backblazeb2.com
 * =========================================================
 */


/* =========================================================
 * CONFIG
 * ========================================================= */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
]);


/* =========================================================
 * COMMON HEADERS
 * ========================================================= */

function corsHeaders(origin = "*") {
    return {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-headers":
            "Content-Type, Authorization, X-Filename, X-Upload-Path",
        "access-control-max-age": "86400"
    };
}


/* =========================================================
 * JSON RESPONSE
 * ========================================================= */

function jsonResponse(data, status = 200, origin = "*") {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "content-type": "application/json; charset=UTF-8",
                "cache-control": "no-store",
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

    const hash = await crypto.subtle.digest("SHA-256", buffer);

    return [...new Uint8Array(hash)]
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


/* =========================================================
 * HMAC-SHA256
 * ========================================================= */

async function hmacSha256(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
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
 * HEX HELPER
 * ========================================================= */

function bytesToHex(bytes) {
    return [...bytes]
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


/* =========================================================
 * AWS SIGNING KEY
 * ========================================================= */

async function getSignatureKey(secretKey, dateStamp, region, service) {
    const encoder = new TextEncoder();

    const kDate = await hmacSha256(
        encoder.encode("AWS4" + secretKey),
        dateStamp
    );

    const kRegion = await hmacSha256(
        kDate,
        region
    );

    const kService = await hmacSha256(
        kRegion,
        service
    );

    const kSigning = await hmacSha256(
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
        .map(part =>
            encodeURIComponent(part)
                .replace(/[!'()*]/g, character =>
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
 * BACKBLAZE B2 S3 UPLOAD
 * ========================================================= */

async function uploadToB2(request, env, origin) {
    /*
     * -------------------------------------------------------
     * Check required configuration
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
                error: "B2 storage configuration is incomplete."
            },
            500,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * Content-Type
     * -------------------------------------------------------
     */

    const contentType =
        request.headers.get("content-type") ||
        "application/octet-stream";

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return jsonResponse(
            {
                ok: false,
                error: "File type is not allowed.",
                allowedTypes: [...ALLOWED_CONTENT_TYPES]
            },
            415,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * Read request body
     * -------------------------------------------------------
     */

    const body = await request.arrayBuffer();

    if (!body.byteLength) {
        return jsonResponse(
            {
                ok: false,
                error: "Upload body is empty."
            },
            400,
            origin
        );
    }

    if (body.byteLength > MAX_UPLOAD_BYTES) {
        return jsonResponse(
            {
                ok: false,
                error: "File is too large.",
                maxBytes: MAX_UPLOAD_BYTES,
                maxMB: 10
            },
            413,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * Filename
     * -------------------------------------------------------
     */

    const suppliedFilename =
        request.headers.get("x-filename") ||
        "upload.bin";

    const safeFilename = suppliedFilename
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.{2,}/g, ".")
        .slice(0, 150);


    /*
     * -------------------------------------------------------
     * Upload path
     *
     * Optional X-Upload-Path can be supplied later by the
     * authenticated RiderX frontend/backend.
     *
     * For now uploads go into:
     *
     * riderx2/uploads/<timestamp>-<filename>
     * -------------------------------------------------------
     */

    const requestedPath =
        request.headers.get("x-upload-path");

    let objectPath;

    if (requestedPath) {
        objectPath = requestedPath
            .replace(/^\/+/, "")
            .replace(/\.\./g, "_")
            .replace(/[^a-zA-Z0-9/_\-.]/g, "_")
            .slice(0, 500);
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
     * B2 S3 configuration
     * -------------------------------------------------------
     */

    const endpoint = env.B2_ENDPOINT.replace(/\/+$/, "");

    const endpointUrl = new URL(endpoint);

    const host = endpointUrl.host;

    const region = "us-east-005";

    const service = "s3";

    const bucket = env.B2_BUCKET;


    /*
     * -------------------------------------------------------
     * SHA-256 payload hash
     * -------------------------------------------------------
     */

    const payloadHash = await sha256Hex(body);


    /*
     * -------------------------------------------------------
     * AWS date
     * -------------------------------------------------------
     */

    const now = new Date();

    const amzDate =
        now.toISOString()
            .replace(/[:-]|\.\d{3}/g, "")
            .replace("Z", "Z");

    const dateStamp = amzDate.slice(0, 8);


    /*
     * -------------------------------------------------------
     * Canonical URI
     * -------------------------------------------------------
     */

    const canonicalUri =
        "/" +
        encodePath(bucket) +
        "/" +
        encodePath(objectPath);


    /*
     * -------------------------------------------------------
     * Canonical headers
     * -------------------------------------------------------
     */

    const canonicalHeaders =
        "content-type:" + contentType + "\n" +
        "host:" + host + "\n" +
        "x-amz-content-sha256:" + payloadHash + "\n" +
        "x-amz-date:" + amzDate + "\n";

    const signedHeaders =
        "content-type;host;x-amz-content-sha256;x-amz-date";


    /*
     * -------------------------------------------------------
     * Canonical request
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
     * Credential scope
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
     * String to sign
     * -------------------------------------------------------
     */

    const canonicalRequestHash =
        await sha256Hex(canonicalRequest);

    const stringToSign =
        "AWS4-HMAC-SHA256\n" +
        amzDate +
        "\n" +
        credentialScope +
        "\n" +
        canonicalRequestHash;


    /*
     * -------------------------------------------------------
     * Signature
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
        bytesToHex(signatureBytes);


    /*
     * -------------------------------------------------------
     * Authorization
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
     * Send upload to Backblaze
     * -------------------------------------------------------
     */

    const uploadUrl =
        endpoint +
        "/" +
        encodePath(bucket) +
        "/" +
        encodePath(objectPath);

    const b2Response =
        await fetch(
            uploadUrl,
            {
                method: "PUT",
                headers: {
                    "Authorization": authorization,
                    "Content-Type": contentType,
                    "Host": host,
                    "X-Amz-Content-Sha256": payloadHash,
                    "X-Amz-Date": amzDate
                },
                body
            }
        );


    /*
     * -------------------------------------------------------
     * Handle B2 error
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
                error: "Backblaze upload failed.",
                status: b2Response.status
            },
            502,
            origin
        );
    }


    /*
     * -------------------------------------------------------
     * Success
     * -------------------------------------------------------
     */

    return jsonResponse(
        {
            ok: true,
            message: "File uploaded successfully.",
            bucket,
            key: objectPath,
            contentType,
            size: body.byteLength
        },
        201,
        origin
    );
}


/* =========================================================
 * MAIN WORKER
 * ========================================================= */

export default {

    async fetch(request, env) {

        const url =
            new URL(request.url);

        const origin =
            request.headers.get("Origin") || "*";


        /*
         * =====================================================
         * CORS PREFLIGHT
         * =====================================================
         */

        if (request.method === "OPTIONS") {
            return new Response(
                null,
                {
                    status: 204,
                    headers: corsHeaders(origin)
                }
            );
        }


        /*
         * =====================================================
         * HEALTH CHECK
         * =====================================================
         */

        if (
            request.method === "GET" &&
            url.pathname === "/api/health"
        ) {
            return jsonResponse(
                {
                    ok: true,
                    service: "RiderX API",
                    status: "online",
                    storage: "Backblaze B2",
                    timestamp:
                        new Date().toISOString()
                },
                200,
                origin
            );
        }


        /*
         * =====================================================
         * STORAGE UPLOAD
         * =====================================================
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
                    "Storage upload error:",
                    error
                );

                return jsonResponse(
                    {
                        ok: false,
                        error: "Storage upload failed."
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

        return env.ASSETS.fetch(request);
    }
};
