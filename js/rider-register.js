/* ============================================================
   RIDERX - RIDER REGISTER
   File: js/rider-register.js

   Handles:
   - Rider registration
   - Firebase Authentication
   - Rider profile creation
   - Vehicle details
   - Document information
   - Approval status
   - Local fallback
   - Registration events
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Register = RX.riderRegister =
        RX.riderRegister || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Register.config = {

        ridersPath:
            "riders",

        usersPath:
            "users",

        cacheKey:
            "riderx_rider_profile",

        defaultCity:
            "Chandigarh",

        defaultVehicle:
            "Bike",

        approvalStatus:
            "pending"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Register.state = {

        initialized:
            false,

        loading:
            false,

        registered:
            false,

        riderId:
            null,

        error:
            null
    };


    /* ========================================================
       FIREBASE AUTH
       ======================================================== */

    Register.getAuth =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       FIREBASE DATABASE
       ======================================================== */

    Register.getDatabase =
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
       FIREBASE STORAGE
       ======================================================== */

    Register.getStorage =
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
       NORMALIZE PHONE
       ======================================================== */

    Register.normalizePhone =
        function (
            phone
        ) {

            let value =
                String(
                    phone ||
                    ""
                )
                .trim();


            value =
                value.replace(
                    /[\s()-]/g,
                    ""
                );


            /*
             * Indian 10 digit number.
             */

            if (
                /^\d{10}$/.test(
                    value
                )
            ) {

                value =
                    "+91" +
                    value;
            }


            return value;
        };


    /* ========================================================
       NORMALIZE VEHICLE NUMBER
       ======================================================== */

    Register.normalizeVehicleNumber =
        function (
            number
        ) {

            return String(
                number ||
                ""
            )
            .trim()
            .toUpperCase()
            .replace(
                /\s+/g,
                ""
            );
        };


    /* ========================================================
       VALIDATE
       ======================================================== */

    Register.validate =
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
                Register.normalizePhone(
                    data.phone
                );


            const email =
                String(
                    data.email ||
                    ""
                ).trim()
                .toLowerCase();


            const password =
                String(
                    data.password ||
                    ""
                );


            const vehicleType =
                String(
                    data.vehicleType ||
                    Register.config
                        .defaultVehicle
                ).trim();


            const vehicleNumber =
                Register.normalizeVehicleNumber(
                    data.vehicleNumber
                );


            const licenseNumber =
                String(
                    data.licenseNumber ||
                    ""
                ).trim()
                .toUpperCase();


            if (
                name.length <
                2
            ) {

                errors.push(
                    "Please enter your full name."
                );
            }


            if (
                !/^\+91\d{10}$/.test(
                    phone
                )
            ) {

                errors.push(
                    "Please enter a valid 10 digit Indian mobile number."
                );
            }


            if (
                !email
            ) {

                errors.push(
                    "Please enter your email address."
                );

            } else if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(
                        email
                    )
            ) {

                errors.push(
                    "Please enter a valid email address."
                );
            }


            if (
                password.length <
                6
            ) {

                errors.push(
                    "Password must be at least 6 characters."
                );
            }


            const allowedVehicles =
                [
                    "Bike",
                    "Scooter",
                    "Auto",
                    "Cab",
                    "Car"
                ];


            if (
                !allowedVehicles.includes(
                    vehicleType
                )
            ) {

                errors.push(
                    "Please select a valid vehicle type."
                );
            }


            if (
                vehicleNumber.length <
                4
            ) {

                errors.push(
                    "Please enter your vehicle registration number."
                );
            }


            if (
                licenseNumber.length <
                4
            ) {

                errors.push(
                    "Please enter your driving licence number."
                );
            }


            return {

                valid:
                    errors.length === 0,

                errors:
                    errors,

                data:
                    {

                        ...data,

                        name:
                            name,

                        phone:
                            phone,

                        email:
                            email,

                        password:
                            password,

                        vehicleType:
                            vehicleType,

                        vehicleNumber:
                            vehicleNumber,

                        licenseNumber:
                            licenseNumber
                    }
            };
        };


    /* ========================================================
       GET FORM DATA
       ======================================================== */

    Register.getFormData =
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
       CREATE AUTH ACCOUNT
       ======================================================== */

    Register.createAccount =
        async function (
            data
        ) {

            const auth =
                Register.getAuth();


            if (
                !auth
            ) {

                throw new Error(
                    "Firebase Authentication is not available."
                );
            }


            if (
                !auth.createUserWithEmailAndPassword
            ) {

                throw new Error(
                    "Email/password authentication is not enabled."
                );
            }


            const result =
                await auth
                    .createUserWithEmailAndPassword(
                        data.email,
                        data.password
                    );


            return result.user;
        };


    /* ========================================================
       CREATE PROFILE
       ======================================================== */

    Register.createProfile =
        async function (
            user,
            data
        ) {

            const riderId =
                user.uid;


            const database =
                Register.getDatabase();


            const profile =
                {

                    uid:
                        riderId,

                    id:
                        riderId,

                    role:
                        "rider",

                    name:
                        data.name,

                    firstName:
                        data.firstName ||
                        "",

                    lastName:
                        data.lastName ||
                        "",

                    phone:
                        data.phone,

                    email:
                        data.email,

                    gender:
                        data.gender ||
                        "",

                    city:
                        data.city ||
                        Register.config
                            .defaultCity,

                    vehicleType:
                        data.vehicleType ||
                        Register.config
                            .defaultVehicle,

                    vehicleMake:
                        data.vehicleMake ||
                        "",

                    vehicleModel:
                        data.vehicleModel ||
                        "",

                    vehicleNumber:
                        data.vehicleNumber,

                    vehicleColor:
                        data.vehicleColor ||
                        "",

                    licenseNumber:
                        data.licenseNumber,

                    vehicle:
                        {

                            type:
                                data.vehicleType ||
                                Register.config
                                    .defaultVehicle,

                            make:
                                data.vehicleMake ||
                                "",

                            model:
                                data.vehicleModel ||
                                "",

                            number:
                                data.vehicleNumber,

                            color:
                                data.vehicleColor ||
                                ""
                        },

                    rating:
                        5,

                    totalRides:
                        0,

                    completedRides:
                        0,

                    cancelledRides:
                        0,

                    totalEarnings:
                        0,

                    walletBalance:
                        0,

                    online:
                        false,

                    isOnline:
                        false,

                    availability:
                        "offline",

                    approved:
                        false,

                    isApproved:
                        false,

                    verificationStatus:
                        Register.config
                            .approvalStatus,

                    documentsStatus:
                        "pending",

                    accountStatus:
                        "active",

                    createdAt:
                        Date.now(),

                    updatedAt:
                        Date.now()
                };


            /*
             * Save locally even if database
             * is temporarily unavailable.
             */

            Register.saveCache(
                profile
            );


            if (
                !database
            ) {

                return profile;
            }


            /*
             * Rider profile.
             */

            await database
                .ref(
                    Register.config
                        .ridersPath +
                    "/" +
                    riderId
                )
                .set(
                    profile
                );


            /*
             * Generic user profile.
             */

            await database
                .ref(
                    Register.config
                        .usersPath +
                    "/" +
                    riderId
                )
                .update(
                    {

                        uid:
                            riderId,

                        role:
                            "rider",

                        name:
                            data.name,

                        phone:
                            data.phone,

                        email:
                            data.email,

                        status:
                            "active",

                        createdAt:
                            profile.createdAt,

                        updatedAt:
                            profile.updatedAt
                    }
                );


            return profile;
        };


    /* ========================================================
       UPDATE AUTH PROFILE
       ======================================================== */

    Register.updateAuthProfile =
        async function (
            user,
            data
        ) {

            if (
                !user
            ) {

                return;
            }


            try {

                if (
                    user.updateProfile
                ) {

                    await user.updateProfile(
                        {

                            displayName:
                                data.name
                        }
                    );
                }

            } catch (error) {

                console.warn(
                    "Auth profile update failed:",
                    error
                );
            }
        };


    /* ========================================================
       REGISTER
       ======================================================== */

    Register.register =
        async function (
            data
        ) {

            if (
                Register.state.loading
            ) {

                return {

                    success:
                        false,

                    error:
                        "Registration already in progress."
                };
            }


            const validation =
                Register.validate(
                    data
                );


            if (
                !validation.valid
            ) {

                Register.showMessage(
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


            Register.state.loading =
                true;


            Register.state.error =
                null;


            try {

                const clean =
                    validation.data;


                const user =
                    await Register
                        .createAccount(
                            clean
                        );


                Register.state.riderId =
                    user.uid;


                await Register
                    .updateAuthProfile(
                        user,
                        clean
                    );


                const profile =
                    await Register
                        .createProfile(
                            user,
                            clean
                        );


                Register.state.registered =
                    true;


                Register.saveCache(
                    profile
                );


                try {

                    localStorage.setItem(
                        "riderx_uid",
                        user.uid
                    );


                    localStorage.setItem(
                        "riderx_role",
                        "rider"
                    );


                    localStorage.setItem(
                        "riderx_user",
                        JSON.stringify(
                            {

                                uid:
                                    user.uid,

                                id:
                                    user.uid,

                                role:
                                    "rider",

                                name:
                                    clean.name,

                                email:
                                    clean.email,

                                phone:
                                    clean.phone
                            }
                        )
                    );

                } catch (error) {}


                Register.showMessage(
                    "Registration successful. Your rider account is pending approval.",
                    "success"
                );


                Register.emit(
                    "registered",
                    {

                        riderId:
                            user.uid,

                        profile:
                            profile
                    }
                );


                return {

                    success:
                        true,

                    riderId:
                        user.uid,

                    profile:
                        profile,

                    pendingApproval:
                        true
                };

            } catch (error) {

                console.error(
                    "Rider registration failed:",
                    error
                );


                Register.state.error =
                    error;


                let message =
                    "Unable to create rider account.";


                if (
                    error &&
                    error.code
                ) {

                    switch (
                        error.code
                    ) {

                        case "auth/email-already-in-use":

                            message =
                                "This email is already registered.";

                            break;


                        case "auth/invalid-email":

                            message =
                                "Please enter a valid email address.";

                            break;


                        case "auth/weak-password":

                            message =
                                "Password is too weak. Use at least 6 characters.";

                            break;


                        case "auth/network-request-failed":

                            message =
                                "Network error. Please check your internet connection.";

                            break;


                        case "auth/operation-not-allowed":

                            message =
                                "Email/password registration is disabled in Firebase.";

                            break;


                        default:

                            message =
                                error.message ||
                                message;
                    }
                }


                Register.showMessage(
                    message,
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        message,

                    firebaseError:
                        error
                };

            } finally {

                Register.state.loading =
                    false;
            }
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Register.saveCache =
        function (
            profile
        ) {

            try {

                localStorage.setItem(
                    Register.config.cacheKey,
                    JSON.stringify(
                        profile
                    )
                );

            } catch (error) {}
        };


    Register.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Register.config.cacheKey
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
       SHOW MESSAGE
       ======================================================== */

    Register.showMessage =
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
                    "[data-register-message]"
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
       REDIRECT
       ======================================================== */

    Register.redirectAfterRegistration =
        function (
            result
        ) {

            if (
                !result ||
                !result.success
            ) {

                return;
            }


            /*
             * Prefer existing role page.
             */

            const candidates =
                [

                    "../rider/pending.html",

                    "/rider/pending.html",

                    "pending.html"

                ];


            /*
             * Avoid redirect if page has
             * a custom registration handler.
             */

            const custom =
                document
                    .querySelector(
                        "[data-registration-success]"
                    );


            if (
                custom
            ) {

                return;
            }


            setTimeout(
                function () {

                    /*
                     * Relative path first.
                     */

                    if (
                        location.pathname
                            .includes(
                                "/auth/"
                            )
                    ) {

                        location.href =
                            "../rider/pending.html";

                    } else {

                        location.href =
                            "/rider/pending.html";
                    }

                },
                900
            );
        };


    /* ========================================================
       FORM SUBMIT
       ======================================================== */

    Register.handleSubmit =
        async function (
            form
        ) {

            const data =
                Register.getFormData(
                    form
                );


            const result =
                await Register.register(
                    data
                );


            if (
                result.success
            ) {

                Register.redirectAfterRegistration(
                    result
                );
            }


            return result;
        };


    /* ========================================================
       EVENT
       ======================================================== */

    Register.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-register-" +
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

    Register.bindEvents =
        function () {

            document.addEventListener(
                "submit",
                function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-rider-register-form]"
                        );


                    if (
                        !form
                    ) {

                        return;
                    }


                    event.preventDefault();


                    Register.handleSubmit(
                        form
                    );
                }
            );


            /*
             * Password visibility.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-toggle-password]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    const selector =
                        button.dataset
                            .togglePassword;


                    const input =
                        document.querySelector(
                            selector
                        );


                    if (
                        !input
                    ) {

                        return;
                    }


                    input.type =
                        input.type ===
                        "password"
                            ? "text"
                            : "password";


                    button.setAttribute(
                        "aria-label",
                        input.type ===
                        "password"
                            ? "Show password"
                            : "Hide password"
                    );
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.registerRider =
        Register.register;


    RX.validateRiderRegistration =
        Register.validate;


    RX.getRiderRegistrationState =
        function () {

            return {
                ...Register.state
            };
        };


    /* ========================================================
       INIT
       ======================================================== */

    Register.init =
        function () {

            if (
                Register.state.initialized
            ) {

                return;
            }


            Register.state.initialized =
                true;


            Register.bindEvents();


            console.log(
                "RiderX rider-register.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Register.init
        );

    } else {

        Register.init();

    }

})();
