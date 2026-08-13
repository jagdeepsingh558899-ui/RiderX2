/* ============================================================
   RIDERX - PROFILE CONTROLLER
   File: js/profile.js

   Handles:
   - Customer profile
   - Rider profile
   - Admin profile
   - Profile loading
   - Profile editing
   - Profile saving
   - Profile photo
   - Cloudflare Worker
   - Backblaze B2
   - Firebase profile sync
   - Rider vehicle information
   - Rating display
   - Logout integration
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       GLOBAL RIDERX OBJECT
       ======================================================== */

    window.RiderX =
        window.RiderX ||
        {};

    const RX =
        window.RiderX;

    const Profile =
        RX.profile ||
        (RX.profile = {});


    /* ========================================================
       CONFIGURATION
       ======================================================== */

    Profile.config = {

        /*
         * Local profile cache.
         */

        storageKey:
            "riderx_profile",


        /*
         * Kept only for migration/cleanup of old versions.
         *
         * New profile photos are NOT stored as base64
         * in localStorage.
         */

        imageStorageKey:
            "riderx_profile_image",


        /*
         * Maximum profile image size.
         *
         * Worker currently supports up to 10 MB,
         * but profile images are limited to 2 MB.
         */

        maxImageSize:
            2 * 1024 * 1024,


        /*
         * Default avatar.
         */

        defaultAvatar:
            "assets/logo.svg",


        /*
         * Cloudflare Worker upload endpoint.
         *
         * Same-origin is preferred because RiderX and
         * the Worker can use the same domain.
         */

        storageUploadEndpoint:
            "/api/storage/upload",


        /*
         * Cloudflare Worker file-read endpoint.
         *
         * Worker must expose:
         *
         * GET /api/storage/file/<object-key>
         *
         */

        storageFileEndpoint:
            "/api/storage/file",


        /*
         * Optional explicit Worker base URL.
         *
         * Leave empty when RiderX is served from the
         * same Cloudflare Worker/domain.
         *
         * Example:
         *
         * https://api.example.com
         */

        storageWorkerBaseUrl:
            ""
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
       UTILITY
       ======================================================== */

    Profile.getWorkerBaseUrl =
        function () {

            const configured =
                String(
                    Profile.config
                        .storageWorkerBaseUrl ||
                    ""
                )
                .trim()
                .replace(
                    /\/+$/,
                    ""
                );


            if (
                configured
            ) {

                return configured;
            }


            return window.location.origin;
        };


    Profile.getStorageFileUrl =
        function (
            key
        ) {

            if (
                !key
            ) {

                return "";
            }


            const cleanKey =
                String(
                    key
                )
                .replace(
                    /^\/+/,
                    ""
                );


            const encodedKey =
                cleanKey
                    .split("/")
                    .map(
                        function (
                            part
                        ) {

                            return encodeURIComponent(
                                part
                            );
                        }
                    )
                    .join("/");


            return (
                Profile.getWorkerBaseUrl() +
                Profile.config.storageFileEndpoint +
                "/" +
                encodedKey
            );
        };


    Profile.safeString =
        function (
            value,
            fallback = ""
        ) {

            if (
                value ===
                undefined ||
                value ===
                null
            ) {

                return fallback;
            }


            return String(
                value
            );
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
                    "Firebase auth user lookup failed:",
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

            } catch (error) {}


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

            } catch (error) {}


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
       PROFILE COLLECTION
       ======================================================== */

    Profile.getCollection =
        function () {

            const role =
                Profile.state.role;


            if (
                role ===
                "rider"
            ) {

                return "riders";
            }


            if (
                role ===
                "admin"
            ) {

                return "admins";
            }


            return "customers";
        };


    /* ========================================================
       PROFILE DATABASE PATH
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


            const nameParts =
                displayName
                    .trim()
                    .split(
                        /\s+/
                    )
                    .filter(
                        Boolean
                    );


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
                    nameParts[0] ||
                    "",

                lastName:
                    nameParts
                        .slice(1)
                        .join(" "),

                email:
                    email,

                phone:
                    phone,

                photoURL:
                    user?.photoURL ||
                    Profile.config.defaultAvatar,

                photoStorage:
                    "",

                photoKey:
                    "",

                photoFileId:
                    "",

                photoContentType:
                    "",

                photoSize:
                    0,

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

                vehicle:
                    {

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
       LOCAL PROFILE
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
       SAVE LOCAL PROFILE
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


                Profile.state.profile =
                    {

                        ...defaults,

                        ...(local || {}),

                        uid:
                            Profile.state.userId ||
                            local?.uid ||
                            defaults.uid,

                        role:
                            Profile.state.role
                    };


                try {

                    const remote =
                        await Profile.loadRemote();


                    if (
                        remote
                    ) {

                        Profile.state.profile =
                            {

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


            /* ------------------------------------------------
               FIRESTORE FALLBACK
               ------------------------------------------------ */

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


            const oldProfile =
                {
                    ...Profile.state.profile
                };


            const clean =
                Profile.sanitize(
                    values
                );


            Profile.state.profile =
                {

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
       SANITIZE PROFILE DATA
       ======================================================== */

    Profile.sanitize =
        function (
            values
        ) {

            const result =
                {};


            const allowed =
                [

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
                    "photoStorage",
                    "photoKey",
                    "photoFileId",
                    "photoContentType",
                    "photoSize",
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


            if (
                values.vehicle &&
                typeof values.vehicle ===
                "object"
            ) {

                result.vehicle =
                    {

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

            if (
                Profile.state.saving
            ) {

                return false;
            }


            Profile.state.saving =
                true;


            try {

                if (
                    values
                ) {

                    Profile.state.profile =
                        {

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
       SAVE REMOTE PROFILE
       ======================================================== */

    Profile.saveRemote =
        async function () {

            const uid =
                Profile.state.userId ||
                Profile.getUserId();


            if (
                !uid
            ) {

                console.warn(
                    "Cannot save profile: user ID missing."
                );


                return false;
            }


            Profile.state.userId =
                uid;


            const profile =
                Profile.state.profile;


            if (
                !profile
            ) {

                return false;
            }


            /* ------------------------------------------------
               REALTIME DATABASE
               ------------------------------------------------ */

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


            /* ------------------------------------------------
               FIRESTORE FALLBACK
               ------------------------------------------------ */

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
       PROFILE PHOTO — BACKBLAZE B2
       ======================================================== */

    Profile.setPhoto =
        async function (
            file
        ) {

            if (
                Profile.state.uploading
            ) {

                throw new Error(
                    "Profile photo is already uploading."
                );
            }


            if (
                !file
            ) {

                return false;
            }


            /* ------------------------------------------------
               FILE TYPE
               ------------------------------------------------ */

            const allowedTypes =
                [

                    "image/jpeg",
                    "image/png",
                    "image/webp"

                ];


            const contentType =
                String(
                    file.type ||
                    ""
                )
                .split(";")[0]
                .trim()
                .toLowerCase();


            if (
                !allowedTypes.includes(
                    contentType
                )
            ) {

                throw new Error(
                    "Please select a JPG, PNG or WebP image."
                );
            }


            /* ------------------------------------------------
               FILE SIZE
               ------------------------------------------------ */

            if (
                file.size >
                Profile.config.maxImageSize
            ) {

                throw new Error(
                    "Profile photo must be smaller than 2 MB."
                );
            }


            if (
                file.size <= 0
            ) {

                throw new Error(
                    "Selected image is empty."
                );
            }


            /* ------------------------------------------------
               USER ID
               ------------------------------------------------ */

            Profile.state.userId =
                Profile.state.userId ||
                Profile.getUserId();


            if (
                !Profile.state.userId
            ) {

                throw new Error(
                    "User is not authenticated."
                );
            }


            Profile.state.uploading =
                true;


            try {

                /* --------------------------------------------
                   SAFE FILE NAME
                   -------------------------------------------- */

                const filename =
                    String(
                        file.name ||
                        "profile-photo"
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


                /* --------------------------------------------
                   UNIQUE B2 OBJECT PATH
                   -------------------------------------------- */

                const objectPath =
                    "riderx2/profiles/" +
                    Profile.state.userId +
                    "/avatar-" +
                    Date.now() +
                    "-" +
                    crypto.randomUUID() +
                    "-" +
                    filename;


                /* --------------------------------------------
                   UPLOAD ENDPOINT
                   -------------------------------------------- */

                const uploadEndpoint =
                    Profile.getWorkerBaseUrl() +
                    Profile.config
                        .storageUploadEndpoint;


                /* --------------------------------------------
                   UPLOAD TO CLOUDFLARE WORKER
                   -------------------------------------------- */

                const response =
                    await fetch(
                        uploadEndpoint,
                        {
                            method:
                                "POST",

                            headers:
                                {

                                    "Content-Type":
                                        contentType,

                                    "X-Filename":
                                        filename,

                                    "X-Upload-Path":
                                        objectPath

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

                    console.error(
                        "Storage server raw response:",
                        raw
                    );


                    throw new Error(
                        "Storage server returned an invalid response."
                    );
                }


                /* --------------------------------------------
                   SERVER ERROR
                   -------------------------------------------- */

                if (
                    !response.ok ||
                    !data ||
                    data.ok !== true
                ) {

                    let message =
                        data?.error ||
                        "Profile photo upload failed.";


                    if (
                        data?.details
                    ) {

                        message +=
                            " " +
                            data.details;
                    }


                    if (
                        data?.b2Response
                    ) {

                        message +=
                            " " +
                            data.b2Response;
                    }


                    throw new Error(
                        message
                    );
                }


                /* --------------------------------------------
                   VALIDATE SUCCESS RESPONSE
                   -------------------------------------------- */

                const key =
                    String(
                        data.key ||
                        ""
                    )
                    .trim();


                if (
                    !key
                ) {

                    throw new Error(
                        "Upload succeeded but storage key was not returned."
                    );
                }


                /* --------------------------------------------
                   BUILD WORKER FILE URL
                   -------------------------------------------- */

                const photoURL =
                    Profile.getStorageFileUrl(
                        key
                    );


                /* --------------------------------------------
                   SAVE B2 INFORMATION IN PROFILE
                   -------------------------------------------- */

                const photoData =
                    {

                        photoURL:
                            photoURL,

                        photoStorage:
                            "backblaze-b2",

                        photoKey:
                            key,

                        photoFileId:
                            data.fileId ||
                            "",

                        photoContentType:
                            data.contentType ||
                            contentType,

                        photoSize:
                            Number(
                                data.size ||
                                file.size
                            )

                    };


                const updated =
                    await Profile.update(
                        photoData
                    );


                if (
                    !updated
                ) {

                    throw new Error(
                        "Photo uploaded, but profile could not be updated."
                    );
                }


                /* --------------------------------------------
                   REMOVE OLD BASE64 PHOTO
                   -------------------------------------------- */

                try {

                    localStorage.removeItem(
                        Profile.config
                            .imageStorageKey
                    );

                } catch (error) {}


                /* --------------------------------------------
                   RENDER
                   -------------------------------------------- */

                Profile.render();


                Profile.emit(
                    "photo-uploaded",
                    {

                        url:
                            photoURL,

                        key:
                            key,

                        fileId:
                            data.fileId ||
                            "",

                        size:
                            Number(
                                data.size ||
                                file.size
                            )

                    }
                );


                return photoURL;


            } catch (error) {

                console.error(
                    "Backblaze B2 profile photo upload failed:",
                    error
                );


                throw error;

            } finally {

                Profile.state.uploading =
                    false;
            }
        };


    /* ========================================================
       OPTIONAL FIREBASE STORAGE ACCESS
       ========================================================
       Kept for compatibility with old RiderX code.

       Profile photos no longer use Firebase Storage.
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
       DATA URL HELPER
       ========================================================
       Kept only for compatibility with old code.
       New profile photos must NOT use this function.
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

                    if (
                        !file
                    ) {

                        reject(
                            new Error(
                                "No file provided."
                            )
                        );

                        return;
                    }


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
       RATING
       ======================================================== */

    Profile.getRating =
        function () {

            const rating =
                Number(
                    Profile.get(
                        "rating"
                    ) ||
                    0
                );


            if (
                !Number.isFinite(
                    rating
                )
            ) {

                return 0;
            }


            return Math.max(
                0,
                Math.min(
                    5,
                    rating
                )
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


            const vehicle =
                {

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


            const fields =
                [

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

                    const value =
                        profile[field];


                    if (
                        value !==
                        undefined &&
                        value !==
                        null &&
                        String(
                            value
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
                        !name
                    ) {

                        return;
                    }


                    if (
                        input.type ===
                        "checkbox"
                    ) {

                        data[name] =
                            input.checked;

                    } else if (
                        input.type ===
                        "radio"
                    ) {

                        if (
                            input.checked
                        ) {

                            data[name] =
                                input.value;
                        }

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


            /* -----------------------------------------------
               GENERIC DATA PROFILE
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               NAME
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               FIRST NAME
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               EMAIL
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               PHONE
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               AVATAR
               ----------------------------------------------- */

            const image =
                profile.photoURL ||
                Profile.config.defaultAvatar;


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

                            element.onerror =
                                function () {

                                    if (
                                        element.src !==
                                        Profile.config.defaultAvatar
                                    ) {

                                        element.src =
                                            Profile.config.defaultAvatar;
                                    }
                                };

                        } else {

                            element.style
                                .backgroundImage =
                                `url("${image}")`;
                        }
                    }
                );


            /* -----------------------------------------------
               RATING
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               COMPLETION
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               VEHICLE
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               ROLE
               ----------------------------------------------- */

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


                    /* ----------------------------------------
                       RIDER VEHICLE FIELDS
                       ---------------------------------------- */

                    if (
                        Profile.state.role ===
                        "rider"
                    ) {

                        const vehicle =
                            Profile.getVehicle();


                        const vehicleFields =
                            [

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


                            Profile.showMessage(
                                null,
                                "Profile photo uploaded successfully."
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
                            "Unable to upload profile photo."
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
                    "Profile event emit failed:",
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


            /* -----------------------------------------------
               SAVE BUTTON
               ----------------------------------------------- */

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


                    const data =
                        Profile.collectForm(
                            form
                        );


                    /* ----------------------------------------
                       RIDER VEHICLE FIELDS
                       ---------------------------------------- */

                    if (
                        Profile.state.role ===
                        "rider"
                    ) {

                        const vehicle =
                            Profile.getVehicle();


                        const vehicleFields =
                            [

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


            /* -----------------------------------------------
               LOGOUT
               ----------------------------------------------- */

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


            /* -----------------------------------------------
               EDIT PROFILE
               ----------------------------------------------- */

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
                    "RiderX profile initialization failed:",
                    error
                );
            }


            Profile.bindEvents();


            Profile.render();


            console.log(
                "RiderX profile.js loaded."
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
