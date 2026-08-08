/* ============================================================
   RIDERX - RIDER PROFILE
   File: js/rider-profile.js

   Handles:
   - Rider profile
   - Edit profile
   - Phone/email/name
   - Vehicle information
   - Profile photo
   - Documents/status
   - Firebase synchronization
   - Local fallback
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Profile = RX.riderProfile =
        RX.riderProfile || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Profile.config = {

        ridersPath:
            "riders",

        storagePath:
            "riderProfiles",

        cacheKey:
            "riderx_rider_profile",

        maxPhotoSize:
            5 * 1024 * 1024
    };


    /* ========================================================
       STATE
       ======================================================== */

    Profile.state = {

        initialized:
            false,

        riderId:
            null,

        rider:
            null,

        loading:
            false,

        saving:
            false,

        photo:
            null,

        dirty:
            false
    };


    /* ========================================================
       FIREBASE
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


    Profile.getStorage =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.storage
                ) {

                    return RX.firebase.storage;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.storage ===
                    "function"
                ) {

                    return firebase.storage();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       AUTH USER
       ======================================================== */

    Profile.getUser =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth.currentUser;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth().currentUser;
                }

            } catch (error) {}


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       RIDER ID
       ======================================================== */

    Profile.getRiderId =
        function () {

            if (
                Profile.state.riderId
            ) {

                return Profile.state.riderId;
            }


            const user =
                Profile.getUser() ||
                {};


            const id =
                user.uid ||
                user.id ||
                user.riderId ||
                user.driverId ||
                localStorage.getItem(
                    "riderx_uid"
                );


            if (
                id
            ) {

                Profile.state.riderId =
                    id;
            }


            return id || null;
        };


    /* ========================================================
       LOAD PROFILE
       ======================================================== */

    Profile.load =
        async function () {

            if (
                Profile.state.loading
            ) {

                return Profile.state.rider;
            }


            Profile.state.loading =
                true;


            try {

                const riderId =
                    Profile.getRiderId();


                if (
                    !riderId
                ) {

                    Profile.loadCache();

                    Profile.render(
                        Profile.state.rider
                    );

                    return Profile.state.rider;
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
                                    Profile.config
                                        .ridersPath +
                                    "/" +
                                    riderId
                                )
                                .once(
                                    "value"
                                );


                        const data =
                            snapshot.val();


                        if (
                            data
                        ) {

                            Profile.state.rider =
                                Profile.normalize(
                                    data
                                );


                            Profile.saveCache();

                            Profile.render(
                                Profile.state.rider
                            );


                            return Profile.state.rider;
                        }

                    } catch (error) {

                        console.warn(
                            "Rider profile load failed:",
                            error
                        );
                    }
                }


                Profile.loadCache();


                if (
                    !Profile.state.rider
                ) {

                    const user =
                        Profile.getUser();


                    if (
                        user
                    ) {

                        Profile.state.rider =
                            Profile.normalize(
                                user
                            );
                    }
                }


                Profile.render(
                    Profile.state.rider
                );


                return Profile.state.rider;

            } finally {

                Profile.state.loading =
                    false;
            }
        };


    /* ========================================================
       NORMALIZE
       ======================================================== */

    Profile.normalize =
        function (
            rider
        ) {

            if (
                !rider
            ) {

                return null;
            }


            return {

                ...rider,

                uid:
                    rider.uid ||
                    Profile.getRiderId(),

                name:
                    rider.name ||
                    rider.displayName ||
                    "",

                firstName:
                    rider.firstName ||
                    "",

                lastName:
                    rider.lastName ||
                    "",

                phone:
                    rider.phone ||
                    rider.mobile ||
                    "",

                email:
                    rider.email ||
                    "",

                photoURL:
                    rider.photoURL ||
                    rider.photo ||
                    "",

                gender:
                    rider.gender ||
                    "",

                city:
                    rider.city ||
                    "Chandigarh",

                vehicleType:
                    rider.vehicleType ||
                    rider.vehicle?.type ||
                    "Bike",

                vehicleMake:
                    rider.vehicleMake ||
                    rider.vehicle?.make ||
                    "",

                vehicleModel:
                    rider.vehicleModel ||
                    rider.vehicle?.model ||
                    "",

                vehicleNumber:
                    rider.vehicleNumber ||
                    rider.vehicle?.number ||
                    rider.vehicle?.registration ||
                    "",

                vehicleColor:
                    rider.vehicleColor ||
                    rider.vehicle?.color ||
                    "",

                licenseNumber:
                    rider.licenseNumber ||
                    rider.license?.number ||
                    "",

                rating:
                    Number(
                        rider.rating ??
                        rider.averageRating ??
                        5
                    ),

                totalRides:
                    Number(
                        rider.totalRides ??
                        rider.completedRides ??
                        0
                    ),

                online:
                    Boolean(
                        rider.online ??
                        rider.isOnline ??
                        false
                    ),

                approved:
                    Boolean(
                        rider.approved ??
                        rider.isApproved ??
                        false
                    ),

                verificationStatus:
                    rider.verificationStatus ||
                    (
                        rider.approved
                            ? "approved"
                            : "pending"
                    )
            };
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Profile.saveCache =
        function () {

            if (
                !Profile.state.rider
            ) {

                return;
            }


            try {

                localStorage.setItem(
                    Profile.config.cacheKey,
                    JSON.stringify(
                        Profile.state.rider
                    )
                );

            } catch (error) {}
        };


    Profile.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Profile.config.cacheKey
                    );


                if (
                    saved
                ) {

                    Profile.state.rider =
                        Profile.normalize(
                            JSON.parse(
                                saved
                            )
                        );
                }

            } catch (error) {

                Profile.state.rider =
                    null;
            }
        };


    /* ========================================================
       GET PROFILE
       ======================================================== */

    Profile.get =
        function () {

            return Profile.state.rider;
        };


    /* ========================================================
       VALIDATE
       ======================================================== */

    Profile.validate =
        function (
            data
        ) {

            const errors =
                [];


            const name =
                String(
                    data.name ||
                    ""
                ).trim();


            const phone =
                String(
                    data.phone ||
                    ""
                ).replace(
                    /\D/g,
                    ""
                );


            if (
                name.length <
                2
            ) {

                errors.push(
                    "Please enter your full name."
                );
            }


            if (
                phone &&
                phone.length <
                10
            ) {

                errors.push(
                    "Please enter a valid phone number."
                );
            }


            if (
                data.email
            ) {

                const email =
                    String(
                        data.email
                    )
                    .trim();


                if (
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                        .test(
                            email
                        )
                ) {

                    errors.push(
                        "Please enter a valid email address."
                    );
                }
            }


            if (
                data.vehicleNumber
            ) {

                const vehicleNumber =
                    String(
                        data.vehicleNumber
                    )
                    .trim();


                if (
                    vehicleNumber.length <
                    4
                ) {

                    errors.push(
                        "Please enter a valid vehicle number."
                    );
                }
            }


            return {

                valid:
                    errors.length === 0,

                errors:
                    errors
            };
        };


    /* ========================================================
       UPDATE PROFILE
       ======================================================== */

    Profile.update =
        async function (
            updates
        ) {

            if (
                !updates ||
                typeof updates !==
                "object"
            ) {

                return {

                    success:
                        false,

                    errors:
                        [
                            "Invalid profile data."
                        ]
                };
            }


            const validation =
                Profile.validate(
                    updates
                );


            if (
                !validation.valid
            ) {

                Profile.showMessage(
                    validation.errors[0],
                    "error"
                );


                return {

                    success:
                        false,

                    errors:
                        validation.errors
                };
            }


            const riderId =
                Profile.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    errors:
                        [
                            "Rider login required."
                        ]
                };
            }


            Profile.state.saving =
                true;


            try {

                const cleaned =
                    Profile.cleanUpdates(
                        updates
                    );


                cleaned.updatedAt =
                    Date.now();


                const database =
                    Profile.getDatabase();


                if (
                    database
                ) {

                    await database
                        .ref(
                            Profile.config
                                .ridersPath +
                            "/" +
                            riderId
                        )
                        .update(
                            cleaned
                        );
                }


                Profile.state.rider =
                    Profile.normalize(
                        {

                            ...(Profile.state.rider ||
                            {}),

                            ...cleaned
                        }
                    );


                Profile.saveCache();


                Profile.render(
                    Profile.state.rider
                );


                Profile.state.dirty =
                    false;


                Profile.showMessage(
                    "Profile updated successfully.",
                    "success"
                );


                Profile.emit(
                    "updated",
                    {

                        rider:
                            Profile.state.rider,

                        updates:
                            cleaned
                    }
                );


                return {

                    success:
                        true,

                    rider:
                        Profile.state.rider
                };

            } catch (error) {

                console.error(
                    "Profile update failed:",
                    error
                );


                Profile.showMessage(
                    error.message ||
                    "Unable to update profile.",
                    "error"
                );


                return {

                    success:
                        false,

                    errors:
                        [
                            error.message ||
                            "Profile update failed."
                        ]
                };

            } finally {

                Profile.state.saving =
                    false;
            }
        };


    /* ========================================================
       CLEAN UPDATES
       ======================================================== */

    Profile.cleanUpdates =
        function (
            updates
        ) {

            const allowed =
                [

                    "name",

                    "firstName",

                    "lastName",

                    "phone",

                    "email",

                    "gender",

                    "city",

                    "photoURL",

                    "vehicleType",

                    "vehicleMake",

                    "vehicleModel",

                    "vehicleNumber",

                    "vehicleColor",

                    "licenseNumber"

                ];


            const result =
                {};


            allowed.forEach(
                function (
                    key
                ) {

                    if (
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                updates,
                                key
                            )
                    ) {

                        result[key] =
                            String(
                                updates[key] ??
                                ""
                            ).trim();
                    }

                }
            );


            /*
             * Keep vehicle object synchronized.
             */

            const current =
                Profile.state.rider ||
                {};


            const vehicle =
                {

                    ...(current.vehicle ||
                    {})
                };


            if (
                result.vehicleType !==
                undefined
            ) {

                vehicle.type =
                    result.vehicleType;
            }


            if (
                result.vehicleMake !==
                undefined
            ) {

                vehicle.make =
                    result.vehicleMake;
            }


            if (
                result.vehicleModel !==
                undefined
            ) {

                vehicle.model =
                    result.vehicleModel;
            }


            if (
                result.vehicleNumber !==
                undefined
            ) {

                vehicle.number =
                    result.vehicleNumber
                        .toUpperCase();
            }


            if (
                result.vehicleColor !==
                undefined
            ) {

                vehicle.color =
                    result.vehicleColor;
            }


            if (
                Object.keys(
                    vehicle
                ).length
            ) {

                result.vehicle =
                    vehicle;
            }


            return result;
        };


    /* ========================================================
       PHOTO VALIDATION
       ======================================================== */

    Profile.validatePhoto =
        function (
            file
        ) {

            if (
                !file
            ) {

                return {

                    valid:
                        false,

                    error:
                        "Please select an image."
                };
            }


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                return {

                    valid:
                        false,

                    error:
                        "Only image files are allowed."
                };
            }


            if (
                file.size >
                Profile.config
                    .maxPhotoSize
            ) {

                return {

                    valid:
                        false,

                    error:
                        "Profile photo must be smaller than 5 MB."
                };
            }


            return {

                valid:
                    true,

                error:
                    null
            };
        };


    /* ========================================================
       UPLOAD PHOTO
       ======================================================== */

    Profile.uploadPhoto =
        async function (
            file
        ) {

            const validation =
                Profile.validatePhoto(
                    file
                );


            if (
                !validation.valid
            ) {

                Profile.showMessage(
                    validation.error,
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        validation.error
                };
            }


            const riderId =
                Profile.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rider login required."
                };
            }


            const storage =
                Profile.getStorage();


            /*
             * Firebase Storage available.
             */

            if (
                storage
            ) {

                try {

                    const ref =
                        storage
                            .ref()
                            .child(
                                Profile.config
                                    .storagePath +
                                "/" +
                                riderId +
                                "/profile.jpg"
                            );


                    await ref.put(
                        file
                    );


                    const url =
                        await ref
                            .getDownloadURL();


                    await Profile.update(
                        {

                            photoURL:
                                url
                        }
                    );


                    Profile.state.photo =
                        url;


                    return {

                        success:
                            true,

                        url:
                            url
                    };

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

            try {

                const dataUrl =
                    await Profile.fileToDataURL(
                        file
                    );


                await Profile.update(
                    {

                        photoURL:
                            dataUrl
                    }
                );


                Profile.state.photo =
                    dataUrl;


                return {

                    success:
                        true,

                    url:
                        dataUrl
                };

            } catch (error) {

                return {

                    success:
                        false,

                    error:
                        error.message ||
                        "Unable to upload profile photo."
                };
            }
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
                        reject;


                    reader.readAsDataURL(
                        file
                    );
                }
            );
        };


    /* ========================================================
       RENDER
       ======================================================== */

    Profile.render =
        function (
            rider
        ) {

            if (
                !rider
            ) {

                return;
            }


            const values =
                {

                    name:
                        rider.name,

                    firstName:
                        rider.firstName,

                    lastName:
                        rider.lastName,

                    phone:
                        rider.phone,

                    email:
                        rider.email,

                    gender:
                        rider.gender,

                    city:
                        rider.city,

                    vehicleType:
                        rider.vehicleType,

                    vehicleMake:
                        rider.vehicleMake,

                    vehicleModel:
                        rider.vehicleModel,

                    vehicleNumber:
                        rider.vehicleNumber,

                    vehicleColor:
                        rider.vehicleColor,

                    licenseNumber:
                        rider.licenseNumber
                };


            Object.entries(
                values
            )
            .forEach(
                function (
                    [
                        key,
                        value
                    ]
                ) {

                    Profile.setField(
                        key,
                        value ??
                        ""
                    );

                }
            );


            /*
             * Text elements.
             */

            document
                .querySelectorAll(
                    "[data-rider-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rider.name ||
                            "Rider";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-phone]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rider.phone ||
                            "—";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-email]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rider.email ||
                            "—";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-rating]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Number(
                                rider.rating ||
                                5
                            ).toFixed(
                                1
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-total-rides]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rider.totalRides ||
                            0;
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-approval]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Profile.statusLabel(
                                rider
                                    .verificationStatus
                            );
                    }
                );


            /*
             * Photo.
             */

            const photo =
                rider.photoURL ||
                rider.photo ||
                "";


            document
                .querySelectorAll(
                    "[data-rider-photo]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            photo
                        ) {

                            element.src =
                                photo;

                            element.hidden =
                                false;
                        }

                    }
                );


            /*
             * Online state.
             */

            document
                .querySelectorAll(
                    "[data-rider-online]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rider.online
                                ? "Online"
                                : "Offline";
                    }
                );
        };


    /* ========================================================
       SET FORM FIELD
       ======================================================== */

    Profile.setField =
        function (
            key,
            value
        ) {

            const selectors = [

                `[name="${key}"]`,

                `[data-profile-field="${key}"]`,

                `#rider-${key}`

            ];


            selectors.forEach(
                function (
                    selector
                ) {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            function (
                                element
                            ) {

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
                }
            );
        };


    /* ========================================================
       GET FORM DATA
       ======================================================== */

    Profile.getFormData =
        function (
            form
        ) {

            if (
                !form
            ) {

                return {};
            }


            const formData =
                new FormData(
                    form
                );


            const data =
                {};


            formData.forEach(
                function (
                    value,
                    key
                ) {

                    if (
                        typeof value ===
                        "string"
                    ) {

                        data[key] =
                            value.trim();

                    }

                }
            );


            return data;
        };


    /* ========================================================
       FORM SUBMIT
       ======================================================== */

    Profile.handleSubmit =
        async function (
            form
        ) {

            const data =
                Profile.getFormData(
                    form
                );


            return Profile.update(
                data
            );
        };


    /* ========================================================
       STATUS
       ======================================================== */

    Profile.statusLabel =
        function (
            status
        ) {

            const labels =
                {

                    approved:
                        "Approved",

                    pending:
                        "Pending approval",

                    rejected:
                        "Rejected",

                    suspended:
                        "Suspended",

                    blocked:
                        "Blocked"
                };


            return (
                labels[
                    String(
                        status ||
                        ""
                    ).toLowerCase()
                ] ||
                "Pending"
            );
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Profile.showMessage =
        function (
            message,
            type
        ) {

            try {

                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        message,
                        type
                    );

                    return;
                }

            } catch (error) {}


            document
                .querySelectorAll(
                    "[data-profile-message]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            message;

                        element.dataset.type =
                            type ||
                            "info";

                        element.hidden =
                            false;
                    }
                );
        };


    /* ========================================================
       EVENT EMITTER
       ======================================================== */

    Profile.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-profile-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    Profile.bindEvents =
        function () {

            /*
             * Profile forms.
             */

            document.addEventListener(
                "submit",
                function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-rider-profile-form]"
                        );


                    if (
                        !form
                    ) {

                        return;
                    }


                    event.preventDefault();


                    Profile.handleSubmit(
                        form
                    );
                }
            );


            /*
             * Profile photo.
             */

            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const input =
                        event.target.closest(
                            "[data-rider-photo-input]"
                        );


                    if (
                        !input
                    ) {

                        return;
                    }


                    const file =
                        input.files &&
                        input.files[0];


                    if (
                        file
                    ) {

                        Profile.uploadPhoto(
                            file
                        );
                    }
                }
            );


            /*
             * Refresh profile.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const refresh =
                        event.target.closest(
                            "[data-refresh-profile]"
                        );


                    if (
                        refresh
                    ) {

                        Profile.load();
                    }

                }
            );


            /*
             * Mark form dirty.
             */

            document.addEventListener(
                "input",
                function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-rider-profile-form]"
                        );


                    if (
                        form
                    ) {

                        Profile.state.dirty =
                            true;
                    }

                }
            );


            /*
             * External profile updates.
             */

            window.addEventListener(
                "riderx-auth-user-changed",
                function () {

                    Profile.state.riderId =
                        null;

                    Profile.load();

                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.getRiderProfile =
        Profile.get;


    RX.loadRiderProfile =
        Profile.load;


    RX.updateRiderProfile =
        Profile.update;


    RX.uploadRiderPhoto =
        Profile.uploadPhoto;


    RX.validateRiderProfile =
        Profile.validate;


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


            Profile.bindEvents();


            await Profile.load();


            console.log(
                "RiderX rider-profile.js loaded."
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
