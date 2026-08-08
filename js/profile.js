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
   - Firebase sync
   - Rider vehicle information
   - Rating display
   - Logout integration
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

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

        maxImageSize:
            1024 * 1024 * 2,

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
       GET USER
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

            } catch (error) {}

            return null;
        };


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
                        .toLowerCase();


                    if (
                        role === "rider" ||
                        role === "customer" ||
                        role === "admin"
                    ) {

                        return role;
                    }
                }

            } catch (error) {}


            /*
             * Existing RiderX role systems.
             */

            try {

                if (
                    RX.auth &&
                    typeof RX.auth.getRole ===
                    "function"
                ) {

                    return RX.auth.getRole();
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
       PROFILE PATH
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


            /*
             * Load Firebase profile.
             */

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


            Profile.state.loading =
                false;


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

                    const snapshot =
                        await database
                            .ref(
                                Profile.getDatabasePath()
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
       SANITIZE
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
             * Vehicle fields are kept
             * together for rider profiles.
             */

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

                    await database
                        .ref(
                            Profile.getDatabasePath()
                        )
                        .update(
                            profile
                        );


                    return true;

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
                 * Firebase Storage.
                 */

                const storage =
                    Profile.getStorage();


                if (
                    storage &&
                    Profile.state.userId
                ) {

                    try {

                        const reference =
                            storage.ref(
                                "profiles/" +
                                Profile.state.userId +
                                "/avatar"
                            );


                        await reference.put(
                            file
                        );


                        const url =
                            await reference
                                .getDownloadURL();


                        await Profile.update(
                            {

                                photoURL:
                                    url
                            }
                        );


                        return url;

                    } catch (error) {

                        console.warn(
                            "Firebase photo upload failed:",
                            error
                        );
                    }
                }


                /*
                 * Local fallback.
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

                    /*
                     * If localStorage is full,
                     * still render the image.
                     */
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


                return dataURL;

            } finally {

                Profile.state.uploading =
                    false;
            }
        };


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
                Math.max(
                    0,
                    Math.min(
                        5,
                        Number(
                            rating
                        )
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
             */

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

                        } else {

                            element.style
                                .backgroundImage =
                                `url("${image}")`;
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
                                "Profile photo updated."
                            );
                        }

                    } catch (error) {

                        Profile.showMessage(
                            null,
                            error.message ||
                            "Unable to update profile photo."
                        );
                    }


                    input.value =
                        "";
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


                    const data =
                        Profile.collectForm(
                            form
                        );


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


            await Profile.load();


            Profile.bindEvents();


            Profile.render();


            console.log(
                "RiderX profile.js loaded."
            );
        };


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
