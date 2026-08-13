"use strict";

/*
 * ============================================================
 * RIDERX2 — BACKBLAZE B2 STORAGE CLIENT
 * ============================================================
 *
 * Browser
 *    ↓
 * Cloudflare Worker
 *    ↓
 * Backblaze B2
 *
 * IMPORTANT:
 * - B2 credentials browser mein nahi aayenge.
 * - B2 Application Key sirf Cloudflare Worker mein rahegi.
 * - RiderX sirf Worker API ko call karega.
 *
 * Worker endpoint:
 *     /api/storage/upload
 *
 * ============================================================
 */


/* ============================================================
 * CONFIGURATION
 * ============================================================ */

const RIDERX_STORAGE_CONFIG = Object.freeze({

    uploadEndpoint:
        "/api/storage/upload",

    maxUploadBytes:
        10 * 1024 * 1024,

    allowedTypes:
        Object.freeze([
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
        ])

});


/* ============================================================
 * STORAGE ERROR
 * ============================================================ */

class RiderXStorageError extends Error {

    constructor(
        message,
        details = {}
    ) {

        super(message);

        this.name =
            "RiderXStorageError";

        this.details =
            details;
    }

}


/* ============================================================
 * GET CONFIG
 * ============================================================ */

function getRiderXStorageConfig() {

    return RIDERX_STORAGE_CONFIG;

}


/* ============================================================
 * VALIDATE FILE
 * ============================================================ */

function validateRiderXFile(file) {

    if (!(file instanceof File)) {

        throw new RiderXStorageError(
            "A valid file is required."
        );

    }


    if (!file.size) {

        throw new RiderXStorageError(
            "Selected file is empty."
        );

    }


    if (
        file.size >
        RIDERX_STORAGE_CONFIG.maxUploadBytes
    ) {

        throw new RiderXStorageError(
            "File is too large. Maximum allowed size is 10 MB.",
            {
                size:
                    file.size,

                maxBytes:
                    RIDERX_STORAGE_CONFIG.maxUploadBytes
            }
        );

    }


    const contentType =
        String(
            file.type || ""
        )
            .split(";")[0]
            .trim()
            .toLowerCase();


    if (
        !RIDERX_STORAGE_CONFIG.allowedTypes.includes(
            contentType
        )
    ) {

        throw new RiderXStorageError(
            "File type is not allowed.",
            {
                received:
                    contentType,

                allowedTypes:
                    RIDERX_STORAGE_CONFIG.allowedTypes
            }
        );

    }


    return {
        contentType,
        size:
            file.size,
        name:
            file.name || "upload.bin"
    };

}


/* ============================================================
 * SAFE PATH
 * ============================================================ */

function sanitizeRiderXPath(path) {

    return String(
        path || ""
    )
        .trim()
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
 * BUILD UPLOAD PATH
 * ============================================================ */

function buildRiderXUploadPath(
    category,
    filename
) {

    const safeCategory =
        sanitizeRiderXPath(
            category ||
            "general"
        );


    const safeFilename =
        String(
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


    return (
        "riderx2/" +
        safeCategory +
        "/" +
        Date.now() +
        "-" +
        crypto.randomUUID() +
        "-" +
        safeFilename
    );

}


/* ============================================================
 * UPLOAD FILE
 * ============================================================ */

async function uploadToRiderXStorage(
    file,
    options = {}
) {

    const fileInfo =
        validateRiderXFile(
            file
        );


    const endpoint =
        options.endpoint ||
        RIDERX_STORAGE_CONFIG.uploadEndpoint;


    const uploadPath =
        options.path ||
        buildRiderXUploadPath(
            options.category ||
            "general",
            fileInfo.name
        );


    const controller =
        new AbortController();


    const timeout =
        Number(
            options.timeout ||
            120000
        );


    const timeoutId =
        setTimeout(
            () => {
                controller.abort();
            },
            timeout
        );


    try {

        const response =
            await fetch(
                endpoint,
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            fileInfo.contentType,

                        "X-Filename":
                            fileInfo.name,

                        "X-Upload-Path":
                            uploadPath
                    },

                    body:
                        file,

                    signal:
                        controller.signal
                }
            );


        const raw =
            await response.text();


        let data;

        try {

            data =
                raw
                    ? JSON.parse(raw)
                    : {};

        } catch (error) {

            throw new RiderXStorageError(
                "Storage server returned invalid JSON.",
                {
                    status:
                        response.status,

                    statusText:
                        response.statusText,

                    raw:
                        raw.slice(
                            0,
                            4000
                        )
                }
            );

        }


        if (!response.ok) {

            throw new RiderXStorageError(
                data.error ||
                "File upload failed.",
                {
                    status:
                        response.status,

                    statusText:
                        response.statusText,

                    response:
                        data
                }
            );

        }


        if (
            data.ok !== true
        ) {

            throw new RiderXStorageError(
                data.error ||
                "Storage upload was not successful.",
                {
                    response:
                        data
                }
            );

        }


        return {

            ok:
                true,

            provider:
                "backblaze-b2",

            storage:
                data.storage ||
                "Backblaze B2",

            bucket:
                data.bucket ||
                "",

            bucketId:
                data.bucketId ||
                "",

            key:
                data.key ||
                "",

            fileId:
                data.fileId ||
                "",

            contentType:
                data.contentType ||
                fileInfo.contentType,

            size:
                Number(
                    data.size ||
                    fileInfo.size
                ),

            sha1:
                data.sha1 ||
                "",

            originalName:
                fileInfo.name
        };


    } catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            throw new RiderXStorageError(
                "File upload timed out."
            );

        }


        if (
            error instanceof
            RiderXStorageError
        ) {

            throw error;

        }


        throw new RiderXStorageError(
            "Could not connect to RiderX storage service.",
            {
                originalError:
                    error?.message ||
                    String(error)
            }
        );

    } finally {

        clearTimeout(
            timeoutId
        );

    }

}


/* ============================================================
 * UPLOAD IMAGE
 * ============================================================ */

async function uploadRiderXImage(
    file,
    options = {}
) {

    return uploadToRiderXStorage(
        file,
        {
            ...options,

            category:
                options.category ||
                "images"
        }
    );

}


/* ============================================================
 * UPLOAD PROFILE PHOTO
 * ============================================================ */

async function uploadRiderXProfilePhoto(
    file,
    options = {}
) {

    return uploadToRiderXStorage(
        file,
        {
            ...options,

            category:
                options.category ||
                "profile"
        }
    );

}


/* ============================================================
 * UPLOAD RIDER DOCUMENT
 * ============================================================ */

async function uploadRiderXRiderDocument(
    file,
    options = {}
) {

    return uploadToRiderXStorage(
        file,
        {
            ...options,

            category:
                options.category ||
                "rider-documents"
        }
    );

}


/* ============================================================
 * UPLOAD CUSTOMER DOCUMENT
 * ============================================================ */

async function uploadRiderXCustomerDocument(
    file,
    options = {}
) {

    return uploadToRiderXStorage(
        file,
        {
            ...options,

            category:
                options.category ||
                "customer-documents"
        }
    );

}


/* ============================================================
 * UPLOAD VEHICLE DOCUMENT
 * ============================================================ */

async function uploadRiderXVehicleDocument(
    file,
    options = {}
) {

    return uploadToRiderXStorage(
        file,
        {
            ...options,

            category:
                options.category ||
                "vehicle-documents"
        }
    );

}


/* ============================================================
 * DELETE PLACEHOLDER
 * ============================================================
 *
 * Actual deletion should be implemented through the Worker.
 * Browser ko B2 credentials ya direct B2 API access nahi dena.
 *
 * ============================================================ */

async function deleteRiderXStorageFile() {

    throw new RiderXStorageError(
        "Direct browser-side B2 deletion is disabled. Use the RiderX Worker deletion API."
    );

}


/* ============================================================
 * STORAGE HEALTH CHECK
 * ============================================================ */

async function checkRiderXStorage() {

    try {

        const response =
            await fetch(
                "/api/health",
                {
                    method:
                        "GET",

                    cache:
                        "no-store"
                }
            );


        const data =
            await response.json();


        return {

            ok:
                response.ok &&
                data.ok === true,

            configured:
                data.storageConfigured === true,

            storage:
                data.storage ||
                "",

            missing:
                Array.isArray(
                    data.missing
                )
                    ? data.missing
                    : [],

            response:
                data
        };


    } catch (error) {

        return {

            ok:
                false,

            configured:
                false,

            storage:
                "",

            missing:
                [],

            error:
                error?.message ||
                String(error)
        };

    }

}


/* ============================================================
 * GLOBAL EXPORT
 * ============================================================
 *
 * Works with normal <script> loading.
 * Also exposes the API through window.RiderXStorage.
 *
 * ============================================================ */

window.RiderXStorage =
    Object.freeze({

        config:
            RIDERX_STORAGE_CONFIG,

        getConfig:
            getRiderXStorageConfig,

        validateFile:
            validateRiderXFile,

        upload:
            uploadToRiderXStorage,

        uploadImage:
            uploadRiderXImage,

        uploadProfilePhoto:
            uploadRiderXProfilePhoto,

        uploadRiderDocument:
            uploadRiderXRiderDocument,

        uploadCustomerDocument:
            uploadRiderXCustomerDocument,

        uploadVehicleDocument:
            uploadRiderXVehicleDocument,

        deleteFile:
            deleteRiderXStorageFile,

        health:
            checkRiderXStorage
    });


/* ============================================================
 * END
 * ============================================================ */
