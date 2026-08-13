/* ============================================================
   RIDERX - PROFILE CONTROLLER
   File: js/profile.js

   Handles:
   - Customer profile
   - Rider profile
   - Profile loading
   - Profile editing
   - Profile saving
   - Profile photo
   - Backblaze B2 photo upload through Cloudflare Worker
   - Firebase profile sync
   - Rider vehicle information
   - Rating display
   - Logout integration
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       GLOBAL NAMESPACE
       ======================================================== */

    window.RiderX =
        window.RiderX || {};


    const RX =
        window.RiderX;


    const Profile =
        RX.profile ||
        (RX.profile = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Profile.config = {

        storageKey:
            "riderx_profile",

        imageStorageKey:
            "riderx_profile_image",

        /*
         * Maximum profile photo size.
         *
         * Worker itself supports 10 MB,
         * but profile photos are intentionally
         * restricted to 2 MB.
         */
        maxImageSize:
            2 * 1024 * 1024,

        /*
         * Worker upload endpoint.
         *
         * Empty string means same-origin.
         *
         * Example:
         *
         * https://api.example.com/api/storage/upload
         *
         * can also be configured here if API is hosted
         * separately from the RiderX website.
         */
        storageUploadEndpoint:
            "/api/storage/upload",

        /*
         * Worker storage-file endpoint.
         *
         * This endpoint can be used by the Worker as a
         * secure proxy for private B2 objects.
         *
         * If the Worker does not currently expose this route,
         * the B2 public URL returned by the upload API will
         * be preferred.
         */
        storageFileEndpoint:
            "/api/storage/file",

        defaultAvatar:
            "assets/logo.svg"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Profile.state = {

        initialized:
            false,

        loading:
            false,

        saving:
            false,

        uploading:
            false,

        profile:
            null,

        role:
            "customer",

        userId:
            null
    };


    /* ========================================================
       GET FIREBASE USER
       ======================================================== */

    Profile.getFirebaseUser =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth()
                        .currentUser;
                }

            } catch (error) {

                console.warn(
                    "Could not get Firebase user:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       GET USER ID
       ======================================================== */

    Profile.getUserId =
        function () {

            const user =
                Profile.getFirebaseUser();


            if (
                user &&
                user.uid
            ) {

                return user.uid;
            }


            try {

                return (
                    localStorage.getItem(
                        "riderx_uid"
                    ) ||
                    localStorage.getItem(
                        "uid"
                    ) ||
                    null
                );

            } catch (error) {

                return null;
            }
        };


    /* ========================================================
       GET ROLE
       ======================================================== */

    Profile.getRole =
        function () {

            try {

                const savedRole =
                    localStorage.getItem(
                        "riderx_role"
                    );


                if (
                    savedRole
                ) {

                    const role =
                        String(
                            savedRole
                        )
                            .toLowerCase()
                            .trim();


                    if (
                        role === "rider" ||
                        role === "customer" ||
                        role === "admin"
                    ) {

                        return role;
                    }
                }

            } catch (error) {

                console.warn(
                    "Could not read saved role:",
                    error
                );
            }


            try {

                if (
                    RX.auth &&
                    typeof RX.auth.getRole ===
                    "function"
                ) {

                    const role =
                        RX.auth.getRole();


                    if (
                        role
                    ) {

                        return String(
                            role
                        )
                            .toLowerCase()
                            .trim();
                    }
                }

            } catch (error) {

                console.warn(
                    "Could not get role from auth:",
                    error
                );
            }


            return "customer";
        };


    /* ========================================================
       DATABASE
       ======================================================== */

    Profile.getDatabase =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.database
                ) {

                    return RX.firebase.database;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       FIRESTORE
       ======================================================== */

    Profile.getFirestore =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.firestore
                ) {

                    return RX.firebase.firestore;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       PROFILE PATH COLLECTION
       ======================================================== */

    Profile.getCollection =
        function () {

            const role =
                Profile.state.role;


            if (
                role === "rider"
            ) {

                return "riders";
            }


            if (
                role === "admin"
            ) {

                return "admins";
            }


            return "customers";
        };


    /* ========================================================
       DATABASE PATH
       ======================================================== */

    Profile.getDatabasePath =
        function () {

            const uid =
                Profile.state.userId;


            if (
                !uid
            ) {

                return null;
            }


            return (
                Profile.getCollection() +
                "/" +
                uid
            );
        };


    /* ========================================================
       DEFAULT PROFILE
       ======================================================== */

    Profile.getDefault =
        function () {

            const user =
                Profile.getFirebaseUser();


            const email =
                user?.email ||
                "";


            const displayName =
                user?.displayName ||
                "";


            const phone =
                user?.phoneNumber ||
                "";


            const role =
                Profile.state.role;


            return {

                uid:
                    Profile.state.userId ||
                    "",

                role:
                    role,

                name:
                    displayName,

                fullName:
                    displayName,

                firstName:
                    displayName
                        .split(" ")[0] ||
                    "",

                lastName:
                    displayName
                        .split(" ")
                        .slice(1)
                        .join(" "),

                email:
                    email,

                phone:
                    phone,

                photoURL:
                    user?.photoURL ||
                    Profile.config.defaultAvatar,

                photoKey:
                    "",

                photoFileId:
                    "",

                city:
                    "Chandigarh",

                language:
                    "en",

                gender:
                    "",

                dateOfBirth:
                    "",

                address:
                    "",

                bio:
                    "",

                rating:
                    role === "rider"
                        ? 5
                        : 0,

                totalRatings:
                    0,

                totalRides:
                    0,

                completedRides:
                    0,

                cancelledRides:
                    0,

                walletBalance:
                    0,

                online:
                    false,

                verified:
                    false,

                phoneVerified:
                    false,

                emailVerified:
                    Boolean(
                        user?.emailVerified
                    ),

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now(),

                vehicle: {

                    type:
                        "bike",

                    brand:
                        "",

                    model:
                        "",

                    color:
                        "",

                    number:
                        "",

                    year:
                        "",

                    licenseNumber:
                        "",

                    rcNumber:
                        "",

                    insuranceNumber:
                        "",

                    verified:
                        false
                }
            };
        };


    /* ========================================================
       LOCAL PROFILE LOAD
       ======================================================== */

    Profile.loadLocal =
        function () {

            try {

                const raw =
                    localStorage.getItem(
                        Profile.config.storageKey
                    );


                if (
                    raw
                ) {

                    const saved =
                        JSON.parse(
                            raw
                        );


                    if (
                        saved &&
                        typeof saved ===
                        "object"
                    ) {

                        return saved;
                    }
                }

            } catch (error) {

                console.warn(
                    "Profile local load failed:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       LOCAL PROFILE SAVE
       ======================================================== */

    Profile.saveLocal =
        function (
            profile
        ) {

            try {

                localStorage.setItem(
                    Profile.config.storageKey,
                    JSON.stringify(
                        profile
                    )
                );


                return true;

            } catch (error) {

                console.warn(
                    "Profile local save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       LOAD PROFILE
       ======================================================== */

    Profile.load =
        async function () {

            Profile.state.loading =
                true;


            try {

                Profile.state.userId =
                    Profile.getUserId();


                Profile.state.role =
                    Profile.getRole();


                const defaults =
                    Profile.getDefault();


                const local =
                    Profile.loadLocal();


                Profile.state.profile = {

                    ...defaults,

                    ...(local || {}),

                    uid:
                        Profile.state.userId ||
                        local?.uid ||
                        defaults.uid,

                    role:
                        Profile.state.role
                };


                /*
                 * Firebase profile.
                 */

                try {

                    const remote =
                        await Profile.loadRemote();


                    if (
                        remote
                    ) {

                        Profile.state.profile = {

                            ...Profile.state.profile,

                            ...remote,

                            uid:
                                Profile.state.userId,

                            role:
                                Profile.state.role
                        };


                        Profile.saveLocal(
                            Profile.state.profile
                        );
                    }

                } catch (error) {

                    console.warn(
                        "Remote profile load failed:",
                        error
                    );
                }


                Profile.render(
                    Profile.state.profile
                );


                Profile.emit(
                    "loaded",
                    {
                        profile:
                            Profile.state.profile
                    }
                );


                return Profile.state.profile;

            } finally {

                Profile.state.loading =
                    false;
            }
        };


    /* ========================================================
       LOAD REMOTE PROFILE
       ======================================================== */

    Profile.loadRemote =
        async function () {

            const uid =
                Profile.state.userId;


            if (
                !uid
            ) {

                return null;
            }


            /*
             * Realtime Database first.
             */

            const database =
                Profile.getDatabase();


            if (
                database
            ) {

                try {

                    const path =
                        Profile.getDatabasePath();


                    if (
                        path
                    ) {

                        const snapshot =
                            await database
                                .ref(
                                    path
                                )
                                .once(
                                    "value"
                                );


                        const data =
                            snapshot.val();


                        if (
                            data
                        ) {

                            return data;
                        }
                    }

                } catch (error) {

                    console.warn(
                        "Realtime Database profile load failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            const firestore =
                Profile.getFirestore();


            if (
                firestore
            ) {

                try {

                    const snapshot =
                        await firestore
                            .collection(
                                Profile.getCollection()
                            )
                            .doc(
                                uid
                            )
                            .get();


                    if (
                        snapshot.exists
                    ) {

                        return snapshot.data();
                    }

                } catch (error) {

                    console.warn(
                        "Firestore profile load failed:",
                        error
                    );
                }
            }


            return null;
        };


    /* ========================================================
       GET PROFILE
       ======================================================== */

    Profile.get =
        function (
            key
        ) {

            if (
                !Profile.state.profile
            ) {

                return key
                    ? null
                    : {};
            }


            if (
                key
            ) {

                return Profile.state.profile[
                    key
                ];
            }


            return {
                ...Profile.state.profile
            };
        };


    /* ========================================================
       UPDATE PROFILE
       ======================================================== */

    Profile.update =
        async function (
            values,
            options
        ) {

            if (
                !values ||
                typeof values !==
                "object"
            ) {

                return false;
            }


            if (
                !Profile.state.profile
            ) {

                await Profile.load();
            }


            const oldProfile = {

                ...Profile.state.profile
            };


            const clean =
                Profile.sanitize(
                    values
                );


            Profile.state.profile = {

                ...Profile.state.profile,

                ...clean,

                updatedAt:
                    Date.now()
            };


            Profile.normalizeName();


            Profile.saveLocal(
                Profile.state.profile
            );


            if (
                !options ||
                options.remote !== false
            ) {

                await Profile.saveRemote();
            }


            Profile.render(
                Profile.state.profile
            );


            Profile.emit(
                "updated",
                {

                    profile:
                        Profile.state.profile,

                    oldProfile:
                        oldProfile
                }
            );


            return true;
        };


    /* ========================================================
       SANITIZE
       ======================================================== */

    Profile.sanitize =
        function (
            values
        ) {

            const result =
                {};


            const allowed = [

                "name",

                "fullName",

                "firstName",

                "lastName",

                "phone",

                "email",

                "gender",

                "dateOfBirth",

                "address",

                "city",

                "language",

                "bio",

                "photoURL",

                "photoKey",

                "photoFileId",

                "vehicle"

            ];


            allowed.forEach(
                function (
                    key
                ) {

                    if (
                        values[key] !==
                        undefined
                    ) {

                        result[key] =
                            values[key];
                    }
                }
            );


            /*
             * Vehicle fields.
             */

            if (
                values.vehicle &&
                typeof values.vehicle ===
                "object"
            ) {

                result.vehicle = {

                    ...(
                        Profile.state
                            .profile
                            ?.vehicle ||
                        {}
                    ),

                    ...values.vehicle
                };
            }


            return result;
        };


    /* ========================================================
       NORMALIZE NAME
       ======================================================== */

    Profile.normalizeName =
        function () {

            const profile =
                Profile.state.profile;


            if (
                !profile
            ) {

                return;
            }


            if (
                profile.fullName
            ) {

                const parts =
                    String(
                        profile.fullName
                    )
                        .trim()
                        .split(
                            /\s+/
                        );


                profile.firstName =
                    parts.shift() ||
                    "";


                profile.lastName =
                    parts.join(
                        " "
                    );


                profile.name =
                    profile.fullName;
            }


            if (
                !profile.fullName &&
                profile.name
            ) {

                profile.fullName =
                    profile.name;
            }


            if (
                !profile.name &&
                profile.firstName
            ) {

                profile.name =
                    (
                        profile.firstName +
                        " " +
                        (
                            profile.lastName ||
                            ""
                        )
                    )
                        .trim();


                profile.fullName =
                    profile.name;
            }
        };


    /* ========================================================
       SAVE PROFILE
       ======================================================== */

    Profile.save =
        async function (
            values
        ) {

            Profile.state.saving =
                true;


            try {

                if (
                    values
                ) {

                    Profile.state.profile = {

                        ...Profile.state.profile,

                        ...Profile.sanitize(
                            values
                        ),

                        updatedAt:
                            Date.now()
                    };


                    Profile.normalizeName();
                }


                Profile.saveLocal(
                    Profile.state.profile
                );


                const remoteSaved =
                    await Profile.saveRemote();


                Profile.render(
                    Profile.state.profile
                );


                Profile.emit(
                    "saved",
                    {

                        profile:
                            Profile.state.profile,

                        remote:
                            remoteSaved
                    }
                );


                return true;

            } catch (error) {

                console.error(
                    "Profile save failed:",
                    error
                );


                return false;

            } finally {

                Profile.state.saving =
                    false;
            }
        };


    /* ========================================================
       SAVE REMOTE
       ======================================================== */

    Profile.saveRemote =
        async function () {

            const uid =
                Profile.state.userId;


            if (
                !uid
            ) {

                return false;
            }


            const profile =
                Profile.state.profile;


            /*
             * Realtime Database.
             */

            const database =
                Profile.getDatabase();


            if (
                database
            ) {

                try {

                    const path =
                        Profile.getDatabasePath();


                    if (
                        path
                    ) {

                        await database
                            .ref(
                                path
                            )
                            .update(
                                profile
                            );


                        return true;
                    }

                } catch (error) {

                    console.warn(
                        "Realtime Database profile save failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            const firestore =
                Profile.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Profile.getCollection()
                        )
                        .doc(
                            uid
                        )
                        .set(
                            profile,
                            {
                                merge:
                                    true
                            }
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore profile save failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       STORAGE UPLOAD ENDPOINT
       ======================================================== */

    Profile.getStorageUploadEndpoint =
        function () {

            const configured =
                Profile.config
                    .storageUploadEndpoint;


            if (
                configured
            ) {

                return configured;
            }


            return "/api/storage/upload";
        };


    /* ========================================================
       STORAGE FILE URL
       ======================================================== */

    Profile.getStorageFileURL =
        function (
            key
        ) {

            if (
                !key
            ) {

                return "";
            }


            const endpoint =
                Profile.config
                    .storageFileEndpoint;


            if (
                !endpoint
            ) {

                return "";
            }


            try {

                return (
                    endpoint +
                    "?key=" +
                    encodeURIComponent(
                        key
                    )
                );

            } catch (error) {

                return "";
            }
        };


    /* ========================================================
       UPLOAD IMAGE TO RIDERX WORKER
       ======================================================== */

    Profile.uploadPhotoToWorker =
        async function (
            file
        ) {

            if (
                !file
            ) {

                throw new Error(
                    "No image selected."
                );
            }


            /*
             * Content type.
             */

            const contentType =
                String(
                    file.type ||
                    ""
                )
                    .split(";")[0]
                    .trim()
                    .toLowerCase();


            const allowedTypes = [

                "image/jpeg",

                "image/png",

                "image/webp"

            ];


            if (
                !allowedTypes.includes(
                    contentType
                )
            ) {

                throw new Error(
                    "Profile photo must be JPG, PNG or WebP."
                );
            }


            /*
             * Size.
             */

            if (
                file.size <= 0
            ) {

                throw new Error(
                    "Selected image is empty."
                );
            }


            if (
                file.size >
                Profile.config.maxImageSize
            ) {

                throw new Error(
                    "Profile photo must be smaller than 2 MB."
                );
            }


            const endpoint =
                Profile.getStorageUploadEndpoint();


            /*
             * Filename.
             */

            const originalName =
                String(
                    file.name ||
                    "profile-photo"
                );


            const safeName =
                originalName
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    )
                    .slice(
                        0,
                        120
                    ) ||
                "profile-photo";


            /*
             * User-specific folder.
             *
             * Worker also sanitizes this path.
             */

            const uid =
                Profile.state.userId ||
                Profile.getUserId();


            const pathPrefix =
                uid
                    ? (
                        "riderx2/profiles/" +
                        uid +
                        "/"
                    )
                    : "riderx2/profiles/";


            const uploadPath =
                pathPrefix +
                Date.now() +
                "-" +
                safeName;


            /*
             * Upload directly as binary body.
             *
             * DO NOT use FormData.
             */

            const response =
                await fetch(
                    endpoint,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                contentType,

                            "X-Filename":
                                safeName,

                            "X-Upload-Path":
                                uploadPath
                        },

                        body:
                            file
                    }
                );


            /*
             * Always read response as text first.
             *
             * This prevents JSON.parse errors when Cloudflare
             * returns an HTML error page.
             */

            const raw =
                await response.text();


            let data;


            try {

                data =
                    JSON.parse(
                        raw
                    );

            } catch (error) {

                throw new Error(
                    "Storage server returned invalid response (" +
                    response.status +
                    ")."
                );
            }


            if (
                !response.ok ||
                !data ||
                data.ok !== true
            ) {

                const message =
                    data?.error ||
                    "Profile photo upload failed.";


                throw new Error(
                    message
                );
            }


            /*
             * Worker returns:
             *
             * key
             * contentType
             * size
             * sha256
             *
             * Newer Worker versions may additionally return:
             *
             * url
             * fileId
             */

            const key =
                data.key ||
                "";


            if (
                !key
            ) {

                throw new Error(
                    "Storage upload succeeded but no file key was returned."
                );
            }


            let photoURL =
                data.url ||
                data.publicUrl ||
                data.downloadURL ||
                "";


            /*
             * If Worker supplied a file URL, use it.
             */

            if (
                !photoURL
            ) {

                photoURL =
                    Profile.getStorageFileURL(
                        key
                    );
            }


            /*
             * If no proxy URL exists, save the key.
             *
             * The render function will use the key only when
             * a usable URL exists. This avoids accidentally
             * displaying an invalid URL.
             */

            return {

                ok:
                    true,

                key:
                    key,

                url:
                    photoURL,

                fileId:
                    data.fileId ||
                    "",

                contentType:
                    data.contentType ||
                    contentType,

                size:
                    Number(
                        data.size ||
                        file.size
                    ),

                sha256:
                    data.sha256 ||
                    ""
            };
        };


    /* ========================================================
       PROFILE PHOTO
       ======================================================== */

    Profile.setPhoto =
        async function (
            file
        ) {

            if (
                !file
            ) {

                return false;
            }


            if (
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                throw new Error(
                    "Please select an image."
                );
            }


            if (
                file.size >
                Profile.config.maxImageSize
            ) {

                throw new Error(
                    "Profile photo must be smaller than 2 MB."
                );
            }


            Profile.state.uploading =
                true;


            try {

                /*
                 * ------------------------------------------------
                 * FIRST:
                 * Upload to RiderX Cloudflare Worker → B2.
                 * ------------------------------------------------
                 */

                try {

                    const upload =
                        await Profile.uploadPhotoToWorker(
                            file
                        );


                    if (
                        upload &&
                        upload.ok
                    ) {

                        /*
                         * Prefer URL.
                         */

                        const photoURL =
                            upload.url ||
                            "";


                        /*
                         * Save B2 key and metadata.
                         *
                         * If URL is available, use it.
                         * If not, retain the previous URL instead
                         * of replacing it with an invalid value.
                         */

                        const values = {

                            photoKey:
                                upload.key,

                            photoFileId:
                                upload.fileId ||
                                "",

                            photoURL:
                                photoURL ||
                                Profile.get(
                                    "photoURL"
                                ) ||
                                Profile.config
                                    .defaultAvatar
                        };


                        /*
                         * Save profile remotely.
                         */

                        await Profile.update(
                            values
                        );


                        /*
                         * Keep local image preview/cache.
                         *
                         * This is only a local display cache.
                         * The actual uploaded file is in B2.
                         */

                        try {

                            const dataURL =
                                await Profile.fileToDataURL(
                                    file
                                );


                            localStorage.setItem(
                                Profile.config
                                    .imageStorageKey,
                                dataURL
                            );

                        } catch (cacheError) {

                            /*
                             * Local cache is optional.
                             */
                        }


                        return (
                            photoURL ||
                            upload.key
                        );
                    }

                } catch (storageError) {

                    console.error(
                        "RiderX B2 photo upload failed:",
                        storageError
                    );


                    /*
                     * Do NOT silently upload the same photo to
                     * Firebase Storage.
                     *
                     * B2 is now the primary RiderX storage.
                     *
                     * We only use a local preview fallback.
                     */
                }


                /*
                 * ------------------------------------------------
                 * LOCAL FALLBACK
                 * ------------------------------------------------
                 *
                 * If B2 upload fails, do not pretend that the
                 * upload succeeded remotely.
                 *
                 * Save local preview only.
                 * ------------------------------------------------
                 */

                const dataURL =
                    await Profile.fileToDataURL(
                        file
                    );


                try {

                    localStorage.setItem(
                        Profile.config
                            .imageStorageKey,
                        dataURL
                    );

                } catch (error) {

                    console.warn(
                        "Could not save local profile image:",
                        error
                    );
                }


                await Profile.update(
                    {

                        photoURL:
                            dataURL

                    },
                    {

                        remote:
                            false
                    }
                );


                /*
                 * Inform caller that this was only a local
                 * fallback.
                 */

                Profile.emit(
                    "photo-local-fallback",
                    {
                        profile:
                            Profile.state.profile
                    }
                );


                return dataURL;

            } finally {

                Profile.state.uploading =
                    false;
            }
        };


    /* ========================================================
       GET FIREBASE STORAGE
       ========================================================
       Kept for backward compatibility with old RiderX code.
       It is NOT used by setPhoto().
       ======================================================== */

    Profile.getStorage =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.storage ===
                    "function"
                ) {

                    return firebase.storage();
                }

            } catch (error) {}


            try {

                if (
                    RX.firebase &&
                    RX.firebase.storage
                ) {

                    return RX.firebase.storage;
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       FILE TO DATA URL
       ======================================================== */

    Profile.fileToDataURL =
        function (
            file
        ) {

            return new Promise(
                function (
                    resolve,
                    reject
                ) {

                    const reader =
                        new FileReader();


                    reader.onload =
                        function () {

                            resolve(
                                reader.result
                            );
                        };


                    reader.onerror =
                        function () {

                            reject(
                                reader.error
                            );
                        };


                    reader.readAsDataURL(
                        file
                    );
                }
            );
        };


    /* ========================================================
       GET CACHED LOCAL IMAGE
       ======================================================== */

    Profile.getLocalImage =
        function () {

            try {

                return localStorage.getItem(
                    Profile.config
                        .imageStorageKey
                );

            } catch (error) {

                return null;
            }
        };


    /* ========================================================
       RATING
       ======================================================== */

    Profile.getRating =
        function () {

            return Number(
                Profile.get(
                    "rating"
                ) ||
                0
            );
        };


    Profile.setRating =
        async function (
            rating
        ) {

            rating =
                Number(
                    rating
                );


            if (
                !Number.isFinite(
                    rating
                )
            ) {

                rating =
                    0;
            }


            rating =
                Math.max(
                    0,
                    Math.min(
                        5,
                        rating
                    )
                );


            return Profile.update(
                {

                    rating:
                        rating
                }
            );
        };


    Profile.getRatingText =
        function () {

            return Profile
                .getRating()
                .toFixed(
                    1
                );
        };


    /* ========================================================
       RIDER VEHICLE
       ======================================================== */

    Profile.getVehicle =
        function () {

            return {

                ...(
                    Profile.get(
                        "vehicle"
                    ) ||
                    {}
                )
            };
        };


    Profile.updateVehicle =
        async function (
            values
        ) {

            if (
                Profile.state.role !==
                "rider"
            ) {

                return false;
            }


            const vehicle = {

                ...Profile.getVehicle(),

                ...(values || {})
            };


            return Profile.update(
                {

                    vehicle:
                        vehicle
                }
            );
        };


    /* ========================================================
       PROFILE COMPLETION
       ======================================================== */

    Profile.getCompletion =
        function () {

            const profile =
                Profile.state.profile;


            if (
                !profile
            ) {

                return 0;
            }


            const fields = [

                "name",

                "phone",

                "email",

                "city",

                "photoURL"

            ];


            let completed =
                0;


            fields.forEach(
                function (
                    field
                ) {

                    if (
                        profile[field] &&
                        String(
                            profile[field]
                        ).trim()
                    ) {

                        completed++;
                    }
                }
            );


            if (
                Profile.state.role ===
                "rider"
            ) {

                const vehicle =
                    profile.vehicle ||
                    {};


                if (
                    vehicle.number
                ) {

                    completed++;
                }


                if (
                    vehicle.model
                ) {

                    completed++;
                }


                return Math.round(
                    completed /
                    7 *
                    100
                );
            }


            return Math.round(
                completed /
                fields.length *
                100
            );
        };


    /* ========================================================
       FORM HELPERS
       ======================================================== */

    Profile.collectForm =
        function (
            form
        ) {

            if (
                !form
            ) {

                return {};
            }


            const data =
                {};


            form.querySelectorAll(
                "[name]"
            )
                .forEach(
                    function (
                        input
                    ) {

                        if (
                            input.disabled
                        ) {

                            return;
                        }


                        const name =
                            input.name;


                        if (
                            input.type ===
                            "checkbox"
                        ) {

                            data[name] =
                                input.checked;

                        } else {

                            data[name] =
                                input.value;
                        }
                    }
                );


            return data;
        };


    /* ========================================================
       RENDER PROFILE
       ======================================================== */

    Profile.render =
        function (
            profile
        ) {

            profile =
                profile ||
                Profile.state.profile;


            if (
                !profile
            ) {

                return;
            }


            /*
             * Generic data-profile fields.
             */

            document
                .querySelectorAll(
                    "[data-profile]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const key =
                            element.dataset
                                .profile;


                        let value =
                            profile[key];


                        if (
                            value ===
                            undefined ||
                            value ===
                            null
                        ) {

                            value =
                                "";
                        }


                        if (
                            element.tagName ===
                                "INPUT" ||
                            element.tagName ===
                                "TEXTAREA" ||
                            element.tagName ===
                                "SELECT"
                        ) {

                            element.value =
                                value;

                        } else {

                            element.textContent =
                                value;
                        }
                    }
                );


            /*
             * Name.
             */

            document
                .querySelectorAll(
                    "[data-profile-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            profile.name ||
                            profile.fullName ||
                            "RiderX User";
                    }
                );


            /*
             * First name.
             */

            document
                .querySelectorAll(
                    "[data-profile-first-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            profile.firstName ||
                            "";
                    }
                );


            /*
             * Email.
             */

            document
                .querySelectorAll(
                    "[data-profile-email]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            profile.email ||
                            "";
                    }
                );


            /*
             * Phone.
             */

            document
                .querySelectorAll(
                    "[data-profile-phone]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            profile.phone ||
                            "";
                    }
                );


            /*
             * Avatar.
             *
             * Priority:
             *
             * 1. photoURL
             * 2. local cached image
             * 3. default avatar
             */

            let image =
                profile.photoURL ||
                "";


            if (
                !image
            ) {

                image =
                    Profile.getLocalImage() ||
                    "";
            }


            if (
                !image
            ) {

                image =
                    Profile.config.defaultAvatar;
            }


            document
                .querySelectorAll(
                    "[data-profile-photo]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.tagName ===
                            "IMG"
                        ) {

                            element.src =
                                image;

                            element.alt =
                                profile.name ||
                                "RiderX";

                            element.loading =
                                "lazy";

                        } else {

                            element.style
                                .backgroundImage =
                                'url("' +
                                String(
                                    image
                                )
                                    .replace(
                                        /"/g,
                                        '\\"'
                                    ) +
                                '")';
                        }
                    }
                );


            /*
             * Rating.
             */

            document
                .querySelectorAll(
                    "[data-profile-rating]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Profile
                                .getRatingText();
                    }
                );


            /*
             * Completion.
             */

            document
                .querySelectorAll(
                    "[data-profile-completion]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Profile
                                .getCompletion() +
                            "%";
                    }
                );


            /*
             * Vehicle.
             */

            const vehicle =
                profile.vehicle ||
                {};


            document
                .querySelectorAll(
                    "[data-vehicle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const key =
                            element.dataset
                                .vehicle;


                        element.textContent =
                            vehicle[key] ||
                            "";
                    }
                );


            /*
             * Role.
             */

            document
                .querySelectorAll(
                    "[data-profile-role]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            profile.role ||
                            "customer";
                    }
                );
        };


    /* ========================================================
       FORM BINDING
       ======================================================== */

    Profile.bindForms =
        function () {

            document.addEventListener(
                "submit",
                async function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-profile-form]"
                        );


                    if (
                        !form
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const data =
                        Profile.collectForm(
                            form
                        );


                    /*
                     * Rider vehicle fields.
                     */

                    if (
                        Profile.state.role ===
                        "rider"
                    ) {

                        const vehicle =
                            Profile.getVehicle();


                        const vehicleFields = [

                            "type",

                            "brand",

                            "model",

                            "color",

                            "number",

                            "year",

                            "licenseNumber",

                            "rcNumber",

                            "insuranceNumber"

                        ];


                        vehicleFields.forEach(
                            function (
                                field
                            ) {

                                if (
                                    data[field] !==
                                    undefined
                                ) {

                                    vehicle[field] =
                                        data[field];

                                    delete data[field];
                                }
                            }
                        );


                        data.vehicle =
                            vehicle;
                    }


                    const success =
                        await Profile.save(
                            data
                        );


                    if (
                        success
                    ) {

                        Profile.showMessage(
                            form,
                            "Profile updated successfully."
                        );
                    }
                }
            );
        };


    /* ========================================================
       PHOTO INPUT
       ======================================================== */

    Profile.bindPhoto =
        function () {

            document.addEventListener(
                "change",
                async function (
                    event
                ) {

                    const input =
                        event.target.closest(
                            "[data-profile-photo-input]"
                        );


                    if (
                        !input ||
                        !input.files ||
                        !input.files[0]
                    ) {

                        return;
                    }


                    try {

                        const url =
                            await Profile.setPhoto(
                                input.files[0]
                            );


                        if (
                            url
                        ) {

                            Profile.render();


                            /*
                             * If URL is a data URL, this was
                             * local fallback.
                             */

                            const isLocal =
                                String(
                                    url
                                ).startsWith(
                                    "data:"
                                );


                            Profile.showMessage(
                                null,
                                isLocal
                                    ? "Photo saved locally. Cloud storage upload failed."
                                    : "Profile photo uploaded successfully."
                            );
                        }

                    } catch (error) {

                        console.error(
                            "Profile photo error:",
                            error
                        );


                        Profile.showMessage(
                            null,
                            error.message ||
                            "Unable to update profile photo."
                        );

                    } finally {

                        input.value =
                            "";
                    }
                }
            );
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Profile.showMessage =
        function (
            container,
            message
        ) {

            let target =
                container
                    ?.querySelector(
                        "[data-profile-message]"
                    );


            if (
                !target
            ) {

                target =
                    document.querySelector(
                        "[data-profile-message]"
                    );
            }


            if (
                target
            ) {

                target.textContent =
                    message;


                target.classList.add(
                    "show"
                );


                setTimeout(
                    function () {

                        target.classList.remove(
                            "show"
                        );

                    },
                    3000
                );


                return;
            }


            console.log(
                "RiderX:",
                message
            );
        };


    /* ========================================================
       LOGOUT
       ======================================================== */

    Profile.logout =
        async function () {

            try {

                if (
                    RX.auth &&
                    typeof RX.auth.logout ===
                    "function"
                ) {

                    await RX.auth.logout();

                    return true;
                }

            } catch (error) {

                console.warn(
                    "RiderX auth logout failed:",
                    error
                );
            }


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    await firebase.auth()
                        .signOut();

                    return true;
                }

            } catch (error) {

                console.error(
                    "Firebase logout failed:",
                    error
                );
            }


            try {

                localStorage.removeItem(
                    "riderx_uid"
                );


                localStorage.removeItem(
                    "uid"
                );


                localStorage.removeItem(
                    "riderx_role"
                );


                window.location.href =
                    "../auth/login.html";


                return true;

            } catch (error) {

                return false;
            }
        };


    /* ========================================================
       EVENT EMITTER
       ======================================================== */

    Profile.emit =
        function (
            name,
            detail
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-profile-" +
                        name,
                        {

                            detail:
                                detail ||
                                {}
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "Profile event failed:",
                    error
                );
            }
        };


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    Profile.bindEvents =
        function () {

            Profile.bindForms();

            Profile.bindPhoto();


            /*
             * Save button.
             */

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-profile-save]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const form =
                        button.closest(
                            "form"
                        ) ||
                        document.querySelector(
                            "[data-profile-form]"
                        );


                    if (
                        !form
                    ) {

                        Profile.showMessage(
                            null,
                            "Profile form not found."
                        );

                        return;
                    }


                    const data =
                        Profile.collectForm(
                            form
                        );


                    /*
                     * Rider vehicle fields.
                     */

                    if (
                        Profile.state.role ===
                        "rider"
                    ) {

                        const vehicle =
                            Profile.getVehicle();


                        const vehicleFields = [

                            "type",

                            "brand",

                            "model",

                            "color",

                            "number",

                            "year",

                            "licenseNumber",

                            "rcNumber",

                            "insuranceNumber"

                        ];


                        vehicleFields.forEach(
                            function (
                                field
                            ) {

                                if (
                                    data[field] !==
                                    undefined
                                ) {

                                    vehicle[field] =
                                        data[field];

                                    delete data[field];
                                }
                            }
                        );


                        data.vehicle =
                            vehicle;
                    }


                    const success =
                        await Profile.save(
                            data
                        );


                    if (
                        success
                    ) {

                        Profile.showMessage(
                            form,
                            "Profile saved successfully."
                        );
                    }
                }
            );


            /*
             * Logout.
             */

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-profile-logout]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const confirmed =
                        window.confirm(
                            "Are you sure you want to logout?"
                        );


                    if (
                        confirmed
                    ) {

                        await Profile.logout();
                    }
                }
            );


            /*
             * Edit profile.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-profile-edit]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    document
                        .querySelectorAll(
                            "[data-profile-form] input, [data-profile-form] textarea, [data-profile-form] select"
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.disabled =
                                    false;
                            }
                        );


                    document
                        .querySelectorAll(
                            "[data-profile-edit]"
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.classList.add(
                                    "editing"
                                );
                            }
                        );
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.profileController =
        Profile;


    RX.getProfile =
        Profile.get;


    RX.updateProfile =
        Profile.update;


    RX.saveProfile =
        Profile.save;


    RX.setProfilePhoto =
        Profile.setPhoto;


    RX.getProfileRating =
        Profile.getRating;


    RX.getProfileCompletion =
        Profile.getCompletion;


    /* ========================================================
       INIT
       ======================================================== */

    Profile.init =
        async function () {

            if (
                Profile.state.initialized
            ) {

                return;
            }


            Profile.state.initialized =
                true;


            try {

                await Profile.load();

            } catch (error) {

                console.error(
                    "Profile initialization load failed:",
                    error
                );
            }


            Profile.bindEvents();


            Profile.render();


            console.log(
                "RiderX profile.js loaded. B2 storage enabled."
            );
        };


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Profile.init
        );

    } else {

        Profile.init();
    }

})();
