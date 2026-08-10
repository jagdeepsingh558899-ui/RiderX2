/* ============================================================
   RIDERX 2.0
   AUTHENTICATION ENGINE
   File: js/auth.js

   Responsibilities:
   - Firebase Authentication
   - Customer / Rider / Admin role resolution
   - Email login / registration
   - Phone OTP
   - Firestore user profiles
   - Firebase auth-state listener
   - Session cache for UI only
   - Route guards
   - Logout
   - Password reset
   - Profile update
   - User rendering

   SECURITY:
   Firebase Authentication and Firebase Security Rules are the
   authority. localStorage is only a UI/session cache.

   IMPORTANT:
   Firebase is initialized ONLY by:
       firebase/firebase-config.js
============================================================ */

"use strict";

(function () {

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;
    const AUTH = RX.auth = RX.auth || {};

    const STORAGE = Object.freeze({
        user: "riderx_user",
        role: "riderx_role",
        session: "riderx_session",
        customer: "riderx_customer",
        rider: "riderx_rider",
        admin: "riderx_admin_session",
        selectedRole: "riderx_selected_role",
        legacyRole: "userRole",
        otpPhone: "riderx_otp_phone"
    });

    const ROLES = Object.freeze({
        CUSTOMER: "customer",
        RIDER: "rider",
        ADMIN: "admin",
        SUPERADMIN: "superadmin"
    });

    const ROUTES = Object.freeze({
        customer: "customer/home.html",
        rider: "rider/home.html",
        admin: "admin/dashboard.html",
        auth: "auth/role.html"
    });

    AUTH.state = AUTH.state || {
        initialized: false,
        initializing: false,
        loading: false,
        authReady: false,
        user: null,
        role: null,
        firebaseUser: null,
        unsubscribe: null,
        logoutBound: false
    };

    AUTH.phoneConfirmation = null;
    AUTH.phoneVerifier = null;

    let Firebase = null;
    let firebaseLoadPromise = null;


    /* =========================================================
       BASIC HELPERS
    ========================================================= */

    function cleanString(value) {
        return String(value ?? "").trim();
    }


    function safeLower(value) {
        return cleanString(value).toLowerCase();
    }


    function isBrowser() {
        return (
            typeof window !== "undefined" &&
            typeof document !== "undefined"
        );
    }


    /* =========================================================
       SAFE STORAGE
    ========================================================= */

    function safeStorageGet(key) {

        try {
            return localStorage.getItem(key);

        } catch (error) {

            console.warn(
                "RiderX storage read failed:",
                error
            );

            return null;
        }
    }


    function safeStorageSet(key, value) {

        try {

            localStorage.setItem(
                key,
                String(value)
            );

            return true;

        } catch (error) {

            console.warn(
                "RiderX storage write failed:",
                error
            );

            return false;
        }
    }


    function safeStorageRemove(key) {

        try {

            localStorage.removeItem(key);

        } catch (error) {

            console.warn(
                "RiderX storage remove failed:",
                error
            );
        }
    }


    function parseStorageUser(key) {

        const raw =
            safeStorageGet(key);

        if (!raw) {
            return null;
        }

        try {

            const parsed =
                JSON.parse(raw);

            return (
                parsed &&
                typeof parsed === "object"
            )
                ? parsed
                : null;

        } catch (error) {

            console.warn(
                "Invalid RiderX stored session:",
                key
            );

            safeStorageRemove(key);

            return null;
        }
    }


    /* =========================================================
       FIREBASE ERROR NORMALIZATION
    ========================================================= */

    function firebaseError(error) {

        const code =
            safeLower(
                error?.code || ""
            );

        const messages = {

            "auth/invalid-email":
                "Please enter a valid email address.",

            "auth/user-not-found":
                "No RiderX account was found with this email.",

            "auth/wrong-password":
                "Incorrect password.",

            "auth/invalid-credential":
                "Incorrect email or password.",

            "auth/email-already-in-use":
                "An account with this email already exists.",

            "auth/weak-password":
                "Password must contain at least 6 characters.",

            "auth/too-many-requests":
                "Too many attempts. Please wait and try again.",

            "auth/network-request-failed":
                "Network error. Please check your internet connection.",

            "auth/popup-closed-by-user":
                "Google sign-in was cancelled.",

            "auth/popup-blocked":
                "Your browser blocked the Google sign-in window.",

            "auth/invalid-verification-code":
                "The OTP is incorrect.",

            "auth/code-expired":
                "The OTP has expired. Please request a new OTP.",

            "auth/invalid-phone-number":
                "Please enter a valid phone number.",

            "auth/quota-exceeded":
                "OTP service limit reached. Please try again later.",

            "auth/captcha-check-failed":
                "Security verification failed. Please try again."
        };

        return (
            messages[code] ||
            cleanString(error?.message) ||
            "RiderX authentication failed."
        );
    }


    /* =========================================================
       FIREBASE MODULE LOADER
       ---------------------------------------------------------
       firebase-config.js is the ONLY Firebase initialization
       point in RiderX.
    ========================================================= */

    function loadFirebase() {

        if (Firebase) {
            return Promise.resolve(Firebase);
        }

        if (firebaseLoadPromise) {
            return firebaseLoadPromise;
        }

        firebaseLoadPromise =
            import(
                "../firebase/firebase-config.js"
            )
                .then(
                    function (module) {

                        if (
                            !module ||
                            !module.auth ||
                            !module.db
                        ) {

                            throw new Error(
                                "RiderX Firebase services are not available."
                            );
                        }

                        Firebase =
                            module;

                        return Firebase;
                    }
                )
                .catch(
                    function (error) {

                        firebaseLoadPromise =
                            null;

                        console.error(
                            "RiderX Firebase module load failed:",
                            error
                        );

                        throw error;
                    }
                );

        return firebaseLoadPromise;
    }


    /* =========================================================
       ROUTE RESOLVER
    ========================================================= */

    function routeUrl(route) {

        const path =
            cleanString(route)
                .replace(/^\/+/, "");

        if (!isBrowser()) {
            return path;
        }

        const pathname =
            window.location.pathname || "";

        const markers = [
            "/auth/",
            "/customer/",
            "/rider/",
            "/admin/"
        ];

        let base =
            pathname;

        for (
            const marker of markers
        ) {

            const index =
                pathname.indexOf(marker);

            if (index !== -1) {

                base =
                    pathname.slice(
                        0,
                        index + 1
                    );

                break;
            }
        }

        if (!base.endsWith("/")) {
            base += "/";
        }

        return base + path;
    }


    /* =========================================================
       ROLE NORMALIZATION
    ========================================================= */

    AUTH.normalizeRole =
        function (role) {

            const value =
                safeLower(role)
                    .replace(
                        /[\s-]+/g,
                        "_"
                    );

            if (!value) {
                return "";
            }

            if (
                [
                    "rider",
                    "riders",
                    "driver",
                    "drivers",
                    "partner",
                    "driver_partner",
                    "driverpartner",
                    "captain"
                ].includes(value)
            ) {

                return ROLES.RIDER;
            }

            if (
                [
                    "customer",
                    "customers",
                    "user",
                    "users"
                ].includes(value)
            ) {

                return ROLES.CUSTOMER;
            }

            if (
                [
                    "admin",
                    "administrator"
                ].includes(value)
            ) {

                return ROLES.ADMIN;
            }

            if (
                [
                    "superadmin",
                    "super_admin",
                    "superadministrator"
                ].includes(value)
            ) {

                return ROLES.SUPERADMIN;
            }

            return "";
        };


    AUTH.isAdminRole =
        function (role) {

            const normalized =
                AUTH.normalizeRole(role);

            return (
                normalized === ROLES.ADMIN ||
                normalized === ROLES.SUPERADMIN
            );
        };


    AUTH.isRiderRole =
        function (role) {

            return (
                AUTH.normalizeRole(role) ===
                ROLES.RIDER
            );
        };


    AUTH.isCustomerRole =
        function (role) {

            return (
                AUTH.normalizeRole(role) ===
                ROLES.CUSTOMER
            );
        };


    /* =========================================================
       STORED ROLE
    ========================================================= */

    AUTH.getStoredRole =
        function () {

            const direct =
                AUTH.normalizeRole(
                    safeStorageGet(
                        STORAGE.role
                    )
                );

            if (direct) {
                return direct;
            }

            const user =
                parseStorageUser(
                    STORAGE.user
                );

            if (user) {

                const role =
                    AUTH.normalizeRole(
                        user.role ||
                        user.userRole ||
                        user.accountType
                    );

                if (role) {
                    return role;
                }
            }

            const rider =
                parseStorageUser(
                    STORAGE.rider
                );

            if (rider) {

                const role =
                    AUTH.normalizeRole(
                        rider.role ||
                        rider.userRole ||
                        rider.accountType
                    );

                if (
                    role === ROLES.RIDER
                ) {

                    return role;
                }
            }

            const customer =
                parseStorageUser(
                    STORAGE.customer
                );

            if (customer) {

                const role =
                    AUTH.normalizeRole(
                        customer.role ||
                        customer.userRole ||
                        customer.accountType
                    );

                if (
                    role === ROLES.CUSTOMER
                ) {

                    return role;
                }
            }

            const admin =
                parseStorageUser(
                    STORAGE.admin
                );

            if (admin) {

                const role =
                    AUTH.normalizeRole(
                        admin.role
                    );

                if (
                    AUTH.isAdminRole(role)
                ) {

                    return role;
                }
            }

            return AUTH.normalizeRole(
                safeStorageGet(
                    STORAGE.legacyRole
                ) ||
                safeStorageGet(
                    STORAGE.selectedRole
                )
            );
        };


    /* =========================================================
       STORED USER
    ========================================================= */

    AUTH.getStoredUser =
        function () {

            const main =
                parseStorageUser(
                    STORAGE.user
                );

            if (main) {
                return main;
            }

            const role =
                AUTH.getStoredRole();

            if (
                role === ROLES.RIDER
            ) {

                return parseStorageUser(
                    STORAGE.rider
                );
            }

            if (
                role === ROLES.CUSTOMER
            ) {

                return parseStorageUser(
                    STORAGE.customer
                );
            }

            if (
                AUTH.isAdminRole(role)
            ) {

                return parseStorageUser(
                    STORAGE.admin
                );
            }

            return null;
        };


    /* =========================================================
       CURRENT USER
    ========================================================= */

    AUTH.getUser =
        function () {

            return (
                AUTH.state.user ||
                AUTH.getStoredUser() ||
                null
            );
        };


    /* =========================================================
       CURRENT ROLE
    ========================================================= */

    AUTH.getRole =
        function () {

            const stateRole =
                AUTH.normalizeRole(
                    AUTH.state.role
                );

            if (stateRole) {
                return stateRole;
            }

            return AUTH.getStoredRole();
        };


    /* =========================================================
       UID
    ========================================================= */

    AUTH.getUid =
        function () {

            const firebaseUser =
                AUTH.state.firebaseUser;

            if (
                firebaseUser?.uid
            ) {

                return firebaseUser.uid;
            }

            const user =
                AUTH.getUser();

            return (
                user?.uid ||
                user?.id ||
                user?.userId ||
                null
            );
        };


    /* =========================================================
       EMAIL
    ========================================================= */

    AUTH.getEmail =
        function () {

            return (
                AUTH.state.firebaseUser?.email ||
                AUTH.getUser()?.email ||
                ""
            );
        };


    /* =========================================================
       SAVE SESSION
    ========================================================= */

    AUTH.saveSession =
        function (
            user,
            role
        ) {

            if (
                !user ||
                typeof user !== "object"
            ) {

                return null;
            }

            const normalizedRole =
                AUTH.normalizeRole(
                    role ||
                    user.role ||
                    user.userRole ||
                    user.accountType
                );

            const uid =
                cleanString(
                    user.uid ||
                    user.id ||
                    user.userId
                );

            if (!uid) {

                throw new Error(
                    "RiderX user profile does not contain a UID."
                );
            }

            const sessionUser = {

                uid,

                id:
                    uid,

                userId:
                    uid,

                email:
                    cleanString(
                        user.email
                    ),

                displayName:
                    cleanString(
                        user.displayName ||
                        user.name
                    ),

                name:
                    cleanString(
                        user.name ||
                        user.displayName
                    ),

                fullName:
                    cleanString(
                        user.fullName ||
                        user.name ||
                        user.displayName
                    ),

                firstName:
                    cleanString(
                        user.firstName
                    ),

                lastName:
                    cleanString(
                        user.lastName
                    ),

                phone:
                    cleanString(
                        user.phone ||
                        user.phoneNumber
                    ),

                phoneNumber:
                    cleanString(
                        user.phoneNumber ||
                        user.phone
                    ),

                photoURL:
                    cleanString(
                        user.photoURL ||
                        user.photo
                    ),

                role:
                    normalizedRole,

                userRole:
                    normalizedRole,

                accountType:
                    normalizedRole,

                status:
                    cleanString(
                        user.status
                    ) ||
                    "active",

                online:
                    user.online === true,

                city:
                    cleanString(
                        user.city
                    ) ||
                    "Chandigarh",

                createdAt:
                    user.createdAt ||
                    null,

                updatedAt:
                    Date.now()
            };

            AUTH.state.user =
                sessionUser;

            AUTH.state.role =
                normalizedRole;

            safeStorageSet(
                STORAGE.user,
                JSON.stringify(
                    sessionUser
                )
            );

            if (normalizedRole) {

                safeStorageSet(
                    STORAGE.role,
                    normalizedRole
                );
            }

            safeStorageSet(
                STORAGE.session,
                JSON.stringify({
                    uid,
                    role:
                        normalizedRole,
                    loginAt:
                        Date.now()
                })
            );

            safeStorageRemove(
                STORAGE.customer
            );

            safeStorageRemove(
                STORAGE.rider
            );

            safeStorageRemove(
                STORAGE.admin
            );

            if (
                normalizedRole ===
                ROLES.CUSTOMER
            ) {

                safeStorageSet(
                    STORAGE.customer,
                    JSON.stringify(
                        sessionUser
                    )
                );
            }

            if (
                normalizedRole ===
                ROLES.RIDER
            ) {

                safeStorageSet(
                    STORAGE.rider,
                    JSON.stringify(
                        sessionUser
                    )
                );
            }

            if (
                AUTH.isAdminRole(
                    normalizedRole
                )
            ) {

                safeStorageSet(
                    STORAGE.admin,
                    JSON.stringify({
                        uid,
                        email:
                            sessionUser.email,
                        role:
                            normalizedRole,
                        loginAt:
                            Date.now()
                    })
                );
            }

            return sessionUser;
        };


    /* =========================================================
       CLEAR SESSION
    ========================================================= */

    AUTH.clearSession =
        function () {

            AUTH.state.user =
                null;

            AUTH.state.role =
                null;

            AUTH.state.firebaseUser =
                null;

            safeStorageRemove(
                STORAGE.user
            );

            safeStorageRemove(
                STORAGE.role
            );

            safeStorageRemove(
                STORAGE.session
            );

            safeStorageRemove(
                STORAGE.customer
            );

            safeStorageRemove(
                STORAGE.rider
            );

            safeStorageRemove(
                STORAGE.admin
            );
        };


    /* =========================================================
       FIRESTORE USER PROFILE
    ========================================================= */

    AUTH.getProfile =
        async function (
            firebaseUser
        ) {

            if (
                !firebaseUser?.uid
            ) {

                return null;
            }

            const baseProfile = {

                uid:
                    firebaseUser.uid,

                email:
                    firebaseUser.email ||
                    "",

                displayName:
                    firebaseUser.displayName ||
                    "",

                name:
                    firebaseUser.displayName ||
                    "",

                phone:
                    firebaseUser.phoneNumber ||
                    "",

                phoneNumber:
                    firebaseUser.phoneNumber ||
                    "",

                photoURL:
                    firebaseUser.photoURL ||
                    ""
            };

            const FB =
                await loadFirebase();

            try {

                const userRef =
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    );

                const snapshot =
                    await FB.getDoc(
                        userRef
                    );

                if (
                    !snapshot.exists()
                ) {

                    return baseProfile;
                }

                const data =
                    snapshot.data() ||
                    {};

                return {

                    ...baseProfile,

                    ...data,

                    uid:
                        firebaseUser.uid,

                    email:
                        data.email ||
                        baseProfile.email,

                    phone:
                        data.phone ||
                        data.phoneNumber ||
                        baseProfile.phone,

                    phoneNumber:
                        data.phoneNumber ||
                        data.phone ||
                        baseProfile.phoneNumber
                };

            } catch (error) {

                /*
                 * IMPORTANT:
                 * Do not silently trust localStorage if Firestore
                 * cannot be read.
                 */
                console.error(
                    "RiderX user profile read failed:",
                    error
                );

                throw new Error(
                    "Unable to load your RiderX profile. Please check your connection and try again."
                );
            }
        };


    /* =========================================================
       ROLE RESOLUTION
       ---------------------------------------------------------
       Firestore users/{uid} is authoritative.
       localStorage can NEVER grant a privileged role.
    ========================================================= */

    AUTH.resolveRole =
        async function (
            user
        ) {

            if (
                !user?.uid
            ) {

                return "";
            }

            const FB =
                await loadFirebase();

            try {

                const userRef =
                    FB.doc(
                        FB.db,
                        "users",
                        user.uid
                    );

                const snapshot =
                    await FB.getDoc(
                        userRef
                    );

                if (
                    !snapshot.exists()
                ) {

                    return "";
                }

                const data =
                    snapshot.data() ||
                    {};

                return AUTH.normalizeRole(
                    data.role ||
                    data.userRole ||
                    data.accountType
                );

            } catch (error) {

                console.error(
                    "RiderX role resolution failed:",
                    error
                );

                /*
                 * Fail closed.
                 */
                return "";
            }
        };


    /* =========================================================
       ACCOUNT STATUS
    ========================================================= */

    AUTH.isAccountBlocked =
        function (
            user
        ) {

            if (!user) {
                return false;
            }

            const status =
                safeLower(
                    user.status ||
                    user.accountStatus ||
                    user.userStatus
                );

            return (
                user.blocked === true ||
                user.disabled === true ||
                [
                    "blocked",
                    "suspended",
                    "disabled",
                    "banned",
                    "deactivated"
                ].includes(status)
            );
        };


    /* =========================================================
       EMAIL LOGIN
    ========================================================= */

    AUTH.loginEmail =
        async function (
            email,
            password
        ) {

            email =
                cleanString(
                    email
                ).toLowerCase();

            password =
                String(
                    password || ""
                );

            if (!email) {

                throw new Error(
                    "Email is required."
                );
            }

            if (!password) {

                throw new Error(
                    "Password is required."
                );
            }

            const FB =
                await loadFirebase();

            AUTH.state.loading =
                true;

            try {

                const result =
                    await FB.signInWithEmailAndPassword(
                        FB.auth,
                        email,
                        password
                    );

                const firebaseUser =
                    result.user;

                if (!firebaseUser) {

                    throw new Error(
                        "Firebase authentication failed."
                    );
                }

                const profile =
                    await AUTH.getProfile(
                        firebaseUser
                    );

                if (
                    AUTH.isAccountBlocked(
                        profile
                    )
                ) {

                    await FB.signOut(
                        FB.auth
                    );

                    throw new Error(
                        "This RiderX account has been disabled."
                    );
                }

                const role =
                    await AUTH.resolveRole(
                        profile
                    );

                if (!role) {

                    await FB.signOut(
                        FB.auth
                    );

                    AUTH.clearSession();

                    throw new Error(
                        "Your RiderX role is not configured. Please contact support."
                    );
                }

                profile.role =
                    role;

                profile.userRole =
                    role;

                profile.accountType =
                    role;

                AUTH.state.firebaseUser =
                    firebaseUser;

                const savedUser =
                    AUTH.saveSession(
                        profile,
                        role
                    );

                AUTH.emit(
                    "login",
                    {
                        user:
                            savedUser,

                        role:
                            role,

                        method:
                            "email"
                    }
                );

                AUTH.renderUser();

                return {

                    user:
                        savedUser,

                    role:
                        role,

                    firebaseUser:
                        firebaseUser
                };

            } catch (error) {

                console.error(
                    "RiderX email login failed:",
                    error
                );

                throw new Error(
                    firebaseError(error)
                );

            } finally {

                AUTH.state.loading =
                    false;
            }
        };


    /* =========================================================
       REGISTRATION
    ========================================================= */

    AUTH.register =
        async function (
            data
        ) {

            data =
                data || {};

            const email =
                cleanString(
                    data.email
                ).toLowerCase();

            const password =
                String(
                    data.password || ""
                );

            const role =
                AUTH.normalizeRole(
                    data.role
                );

            const name =
                cleanString(
                    data.name ||
                    data.fullName
                );

            const phone =
                AUTH.normalizePhone(
                    data.phone ||
                    data.mobile
                );

            if (!email) {

                throw new Error(
                    "Email is required."
                );
            }

            if (
                password.length < 6
            ) {

                throw new Error(
                    "Password must contain at least 6 characters."
                );
            }

            /*
             * Public registration may create only customer
             * or rider accounts.
             */
            if (
                ![
                    ROLES.CUSTOMER,
                    ROLES.RIDER
                ].includes(role)
            ) {

                throw new Error(
                    "Please select Customer or Rider."
                );
            }

            const FB =
                await loadFirebase();

            AUTH.state.loading =
                true;

            let createdUser =
                null;

            try {

                const result =
                    await FB.createUserWithEmailAndPassword(
                        FB.auth,
                        email,
                        password
                    );

                createdUser =
                    result.user;

                if (!createdUser) {

                    throw new Error(
                        "Firebase registration failed."
                    );
                }

                if (
                    name &&
                    FB.updateProfile
                ) {

                    await FB.updateProfile(
                        createdUser,
                        {
                            displayName:
                                name
                        }
                    );
                }

                const now =
                    Date.now();

                const profile = {

                    uid:
                        createdUser.uid,

                    email:
                        email,

                    name:
                        name,

                    fullName:
                        name,

                    displayName:
                        name,

                    phone:
                        phone,

                    phoneNumber:
                        phone,

                    role:
                        role,

                    userRole:
                        role,

                    accountType:
                        role,

                    status:
                        "active",

                    online:
                        false,

                    city:
                        cleanString(
                            data.city
                        ) ||
                        "Chandigarh",

                    rating:
                        5,

                    totalRides:
                        0,

                    completedRides:
                        0,

                    cancelledRides:
                        0,

                    walletBalance:
                        0,

                    createdAt:
                        now,

                    updatedAt:
                        now
                };

                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        "users",
                        createdUser.uid
                    ),
                    profile,
                    {
                        merge:
                            true
                    }
                );

                AUTH.state.firebaseUser =
                    createdUser;

                const savedUser =
                    AUTH.saveSession(
                        profile,
                        role
                    );

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                AUTH.emit(
                    "register",
                    {
                        user:
                            savedUser,

                        role:
                            role
                    }
                );

                AUTH.renderUser();

                return {

                    user:
                        savedUser,

                    role:
                        role,

                    firebaseUser:
                        createdUser
                };

            } catch (error) {

                /*
                 * If Firebase Auth account was created but the
                 * application profile failed, do not leave a
                 * fake RiderX session in the browser.
                 */
                if (
                    createdUser &&
                    FB.signOut
                ) {

                    try {

                        await FB.signOut(
                            FB.auth
                        );

                    } catch (signOutError) {

                        console.warn(
                            "RiderX cleanup sign-out failed:",
                            signOutError
                        );
                    }
                }

                AUTH.clearSession();

                console.error(
                    "RiderX registration failed:",
                    error
                );

                throw new Error(
                    firebaseError(error)
                );

            } finally {

                AUTH.state.loading =
                    false;
            }
        };


    /* =========================================================
       PHONE NORMALIZATION
    ========================================================= */

    AUTH.normalizePhone =
        function (
            phoneNumber
        ) {

            let phone =
                cleanString(
                    phoneNumber
                );

            if (!phone) {
                return "";
            }

            if (
                phone.startsWith("+")
            ) {

                const digits =
                    phone
                        .slice(1)
                        .replace(
                            /\D/g,
                            ""
                        );

                return "+" + digits;
            }

            const digits =
                phone.replace(
                    /\D/g,
                    ""
                );

            if (
                digits.length === 10
            ) {

                return "+91" +
                    digits;
            }

            if (
                digits.startsWith("91") &&
                digits.length === 12
            ) {

                return "+" +
                    digits;
            }

            return "+" +
                digits;
        };


    /* =========================================================
       CLEAR OTP VERIFIER
    ========================================================= */

    AUTH.clearOtpVerifier =
        function () {

            try {

                if (
                    AUTH.phoneVerifier &&
                    typeof AUTH.phoneVerifier.clear ===
                    "function"
                ) {

                    AUTH.phoneVerifier.clear();
                }

            } catch (error) {

                console.warn(
                    "RiderX OTP verifier cleanup failed:",
                    error
                );
            }

            AUTH.phoneVerifier =
                null;
        };


    /* =========================================================
       SEND PHONE OTP
    ========================================================= */

    AUTH.sendOtp =
        async function (
            phoneNumber,
            container
        ) {

            const phone =
                AUTH.normalizePhone(
                    phoneNumber
                );

            if (
                !/^\+\d{10,15}$/.test(
                    phone
                )
            ) {

                throw new Error(
                    "Enter a valid phone number."
                );
            }

            const FB =
                await loadFirebase();

            if (!container) {

                throw new Error(
                    "OTP verification container is required."
                );
            }

            let verifier =
                null;

            /*
             * Existing RecaptchaVerifier can be supplied
             * by the auth page.
             */
            if (
                typeof container === "object" &&
                typeof container.verify ===
                    "function"
            ) {

                verifier =
                    container;

            } else {

                AUTH.clearOtpVerifier();

                verifier =
                    new FB.RecaptchaVerifier(
                        FB.auth,
                        container,
                        {
                            size:
                                "invisible"
                        }
                    );

                AUTH.phoneVerifier =
                    verifier;
            }

            try {

                AUTH.phoneConfirmation =
                    await FB.signInWithPhoneNumber(
                        FB.auth,
                        phone,
                        verifier
                    );

                safeStorageSet(
                    STORAGE.otpPhone,
                    phone
                );

                return {

                    phone:
                        phone
                };

            } catch (error) {

                AUTH.phoneConfirmation =
                    null;

                if (
                    verifier ===
                    AUTH.phoneVerifier
                ) {

                    AUTH.clearOtpVerifier();
                }

                console.error(
                    "RiderX OTP send failed:",
                    error
                );

                throw new Error(
                    firebaseError(error)
                );
            }
        };


    /* =========================================================
       VERIFY PHONE OTP
    ========================================================= */

    AUTH.verifyOtp =
        async function (
            otp,
            role
        ) {

            otp =
                cleanString(
                    otp
                );

            if (
                !/^\d{6}$/.test(
                    otp
                )
            ) {

                throw new Error(
                    "Enter the 6-digit OTP."
                );
            }

            if (
                !AUTH.phoneConfirmation
            ) {

                throw new Error(
                    "Please request a new OTP."
                );
            }

            const FB =
                await loadFirebase();

            AUTH.state.loading =
                true;

            try {

                const result =
                    await AUTH.phoneConfirmation.confirm(
                        otp
                    );

                const firebaseUser =
                    result.user;

                AUTH.phoneConfirmation =
                    null;

                AUTH.clearOtpVerifier();

                if (!firebaseUser) {

                    throw new Error(
                        "Phone authentication failed."
                    );
                }

                const profile =
                    await AUTH.getProfile(
                        firebaseUser
                    );

                if (
                    AUTH.isAccountBlocked(
                        profile
                    )
                ) {

                    await FB.signOut(
                        FB.auth
                    );

                    throw new Error(
                        "This RiderX account has been disabled."
                    );
                }

                let resolvedRole =
                    await AUTH.resolveRole(
                        profile
                    );

                /*
                 * Existing Firestore role always wins.
                 *
                 * If the user is genuinely new and does not
                 * have a role yet, only Customer/Rider can be
                 * selected.
                 */
                if (!resolvedRole) {

                    const requestedRole =
                        AUTH.normalizeRole(
                            role
                        );

                    if (
                        [
                            ROLES.CUSTOMER,
                            ROLES.RIDER
                        ].includes(
                            requestedRole
                        )
                    ) {

                        resolvedRole =
                            requestedRole;
                    }
                }

                if (!resolvedRole) {

                    const selectedRole =
                        AUTH.normalizeRole(
                            safeStorageGet(
                                STORAGE.selectedRole
                            )
                        );

                    if (
                        [
                            ROLES.CUSTOMER,
                            ROLES.RIDER
                        ].includes(
                            selectedRole
                        )
                    ) {

                        resolvedRole =
                            selectedRole;
                    }
                }

                if (!resolvedRole) {

                    await FB.signOut(
                        FB.auth
                    );

                    throw new Error(
                        "Please select Customer or Rider before completing OTP verification."
                    );
                }

                const phone =
                    profile.phone ||
                    profile.phoneNumber ||
                    firebaseUser.phoneNumber ||
                    safeStorageGet(
                        STORAGE.otpPhone
                    ) ||
                    "";

                profile.uid =
                    firebaseUser.uid;

                profile.phone =
                    phone;

                profile.phoneNumber =
                    phone;

                profile.role =
                    resolvedRole;

                profile.userRole =
                    resolvedRole;

                profile.accountType =
                    resolvedRole;

                profile.status =
                    profile.status ||
                    "active";

                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    ),
                    {

                        ...profile,

                        uid:
                            firebaseUser.uid,

                        role:
                            resolvedRole,

                        userRole:
                            resolvedRole,

                        accountType:
                            resolvedRole,

                        updatedAt:
                            Date.now()

                    },
                    {
                        merge:
                            true
                    }
                );

                AUTH.state.firebaseUser =
                    firebaseUser;

                const savedUser =
                    AUTH.saveSession(
                        profile,
                        resolvedRole
                    );

                safeStorageRemove(
                    STORAGE.otpPhone
                );

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                AUTH.emit(
                    "login",
                    {

                        user:
                            savedUser,

                        role:
                            resolvedRole,

                        method:
                            "phone"
                    }
                );

                AUTH.renderUser();

                return {

                    user:
                        savedUser,

                    role:
                        resolvedRole,

                    firebaseUser:
                        firebaseUser
                };

            } catch (error) {

                console.error(
                    "RiderX OTP verification failed:",
                    error
                );

                throw new Error(
                    firebaseError(error)
                );

            } finally {

                AUTH.state.loading =
                    false;
            }
        };


    /* =========================================================
       LOGOUT
    ========================================================= */

    AUTH.logout =
        async function () {

            try {

                const FB =
                    await loadFirebase();

                if (
                    FB &&
                    FB.auth &&
                    FB.signOut
                ) {

                    await FB.signOut(
                        FB.auth
                    );
                }

            } catch (error) {

                console.warn(
                    "RiderX Firebase logout failed:",
                    error
                );

            } finally {

                AUTH.phoneConfirmation =
                    null;

                AUTH.clearOtpVerifier();

                AUTH.clearSession();

                safeStorageRemove(
                    STORAGE.legacyRole
                );

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                safeStorageRemove(
                    STORAGE.otpPhone
                );

                AUTH.state.authReady =
                    true;

                AUTH.emit(
                    "logout"
                );

                if (isBrowser()) {

                    window.location.replace(
                        routeUrl(
                            ROUTES.auth
                        )
                    );
                }
            }
        };


    /* =========================================================
       FIREBASE AUTH STATE LISTENER
    ========================================================= */

    AUTH.startListener =
        async function () {

            if (
                AUTH.state.unsubscribe
            ) {

                return AUTH.state.unsubscribe;
            }

            const FB =
                await loadFirebase();

            AUTH.state.unsubscribe =
                FB.onAuthStateChanged(
                    FB.auth,
                    async function (
                        firebaseUser
                    ) {

                        AUTH.state.firebaseUser =
                            firebaseUser;

                        if (!firebaseUser) {

                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;

                            AUTH.state.authReady =
                                true;

                            AUTH.emit(
                                "signed-out"
                            );

                            return;
                        }

                        try {

                            const profile =
                                await AUTH.getProfile(
                                    firebaseUser
                                );

                            if (
                                AUTH.isAccountBlocked(
                                    profile
                                )
                            ) {

                                await FB.signOut(
                                    FB.auth
                                );

                                AUTH.clearSession();

                                AUTH.state.authReady =
                                    true;

                                AUTH.emit(
                                    "signed-out"
                                );

                                return;
                            }

                            const role =
                                await AUTH.resolveRole(
                                    profile
                                );

                            if (!role) {

                                AUTH.state.user =
                                    null;

                                AUTH.state.role =
                                    null;

                                AUTH.state.authReady =
                                    true;

                                AUTH.emit(
                                    "auth-error",
                                    {
                                        error:
                                            new Error(
                                                "RiderX account role is not configured."
                                            )
                                    }
                                );

                                return;
                            }

                            profile.role =
                                role;

                            profile.userRole =
                                role;

                            profile.accountType =
                                role;

                            const savedUser =
                                AUTH.saveSession(
                                    profile,
                                    role
                                );

                            AUTH.state.firebaseUser =
                                firebaseUser;

                            AUTH.state.authReady =
                                true;

                            AUTH.emit(
                                "signed-in",
                                {

                                    user:
                                        savedUser,

                                    role:
                                        role
                                }
                            );

                            AUTH.renderUser();

                        } catch (error) {

                            AUTH.state.authReady =
                                true;

                            console.error(
                                "RiderX auth state error:",
                                error
                            );

                            AUTH.emit(
                                "auth-error",
                                {
                                    error:
                                        error
                                }
                            );
                        }
                    }
                );

            return AUTH.state.unsubscribe;
        };


    /* =========================================================
       AUTH READY
    ========================================================= */

    AUTH.waitForAuth =
        async function (
            timeout = 10000
        ) {

            if (
                AUTH.state.authReady
            ) {

                return AUTH.state.firebaseUser;
            }

            await AUTH.startListener();

            if (
                AUTH.state.authReady
            ) {

                return AUTH.state.firebaseUser;
            }

            if (!isBrowser()) {
                return null;
            }

            return new Promise(
                function (resolve) {

                    let finished =
                        false;

                    const complete =
                        function () {

                            if (finished) {
                                return;
                            }

                            finished =
                                true;

                            window.removeEventListener(
                                "riderx-auth-ready",
                                readyHandler
                            );

                            clearTimeout(
                                timer
                            );

                            resolve(
                                AUTH.state.firebaseUser
                            );
                        };

                    const readyHandler =
                        function () {

                            complete();
                        };

                    window.addEventListener(
                        "riderx-auth-ready",
                        readyHandler,
                        {
                            once:
                                true
                        }
                    );

                    const timer =
                        setTimeout(
                            complete,
                            Math.max(
                                1000,
                                Number(timeout) ||
                                    10000
                            )
                        );
                }
            );
        };


    /* =========================================================
       LOGIN STATE
    ========================================================= */

    AUTH.isLoggedIn =
        function () {

            return Boolean(
                AUTH.state.authReady &&
                AUTH.state.firebaseUser?.uid
            );
        };


    /* =========================================================
       ROLE CHECK
    ========================================================= */

    AUTH.hasRole =
        function (
            role
        ) {

            const wanted =
                AUTH.normalizeRole(
                    role
                );

            return Boolean(
                wanted &&
                AUTH.getRole() ===
                    wanted &&
                AUTH.isLoggedIn()
            );
        };


    /* =========================================================
       ROLE GUARD
    ========================================================= */

    AUTH.requireRole =
        async function (
            roles,
            options
        ) {

            options =
                options || {};

            const allowed =
                Array.isArray(roles)

                    ? roles
                        .map(
                            function (role) {

                                return AUTH.normalizeRole(
                                    role
                                );
                            }
                        )
                        .filter(Boolean)

                    : [
                        AUTH.normalizeRole(
                            roles
                        )
                    ].filter(Boolean);

            if (!allowed.length) {

                if (
                    options.redirect !== false
                ) {

                    AUTH.redirectByRole(
                        options.fallback
                    );
                }

                return false;
            }

            await AUTH.waitForAuth(
                options.timeout ||
                10000
            );

            const current =
                AUTH.normalizeRole(
                    AUTH.getRole()
                );

            if (
                AUTH.isLoggedIn() &&
                allowed.includes(current)
            ) {

                return true;
            }

            if (
                options.redirect !== false
            ) {

                AUTH.redirectByRole(
                    options.fallback
                );
            }

            return false;
        };


    /* =========================================================
       REDIRECT BY ROLE
    ========================================================= */

    AUTH.redirectByRole =
        function (
            fallback
        ) {

            const role =
                AUTH.normalizeRole(
                    AUTH.getRole()
                );

            let target =
                fallback;

            if (
                role === ROLES.ADMIN ||
                role === ROLES.SUPERADMIN
            ) {

                target =
                    ROUTES.admin;

            } else if (
                role === ROLES.RIDER
            ) {

                target =
                    ROUTES.rider;

            } else if (
                role === ROLES.CUSTOMER
            ) {

                target =
                    ROUTES.customer;
            }

            if (!target) {
                target =
                    ROUTES.auth;
            }

            if (isBrowser()) {

                window.location.replace(
                    routeUrl(target)
                );
            }
        };


    /* =========================================================
       UPDATE PROFILE
    ========================================================= */

    AUTH.updateProfile =
        async function (
            updates
        ) {

            updates =
                updates || {};

            if (
                !AUTH.isLoggedIn()
            ) {

                throw new Error(
                    "User is not logged in."
                );
            }

            const uid =
                AUTH.getUid();

            if (!uid) {

                throw new Error(
                    "User ID is missing."
                );
            }

            const FB =
                await loadFirebase();

            if (
                FB.auth.currentUser &&
                FB.updateProfile
            ) {

                const firebaseUpdates =
                    {};

                if (
                    updates.displayName !==
                    undefined
                ) {

                    firebaseUpdates.displayName =
                        cleanString(
                            updates.displayName
                        );
                }

                if (
                    updates.photoURL !==
                    undefined
                ) {

                    firebaseUpdates.photoURL =
                        cleanString(
                            updates.photoURL
                        );
                }

                if (
                    Object.keys(
                        firebaseUpdates
                    ).length
                ) {

                    await FB.updateProfile(
                        FB.auth.currentUser,
                        firebaseUpdates
                    );
                }
            }

            const firestoreUpdates = {
                ...updates,
                updatedAt:
                    Date.now()
            };

            [
                "role",
                "userRole",
                "accountType",
                "isAdmin",
                "uid",
                "id",
                "userId",
                "status",
                "blocked",
                "disabled",
                "approvalStatus",
                "approved",
                "adminApproved"
            ].forEach(
                function (key) {

                    delete firestoreUpdates[key];
                }
            );

            await FB.setDoc(
                FB.doc(
                    FB.db,
                    "users",
                    uid
                ),
                firestoreUpdates,
                {
                    merge:
                        true
                }
            );

            const current =
                AUTH.getUser() ||
                {};

            const role =
                AUTH.getRole();

            const updated = {

                ...current,

                ...firestoreUpdates,

                uid:
                    uid,

                id:
                    uid,

                userId:
                    uid,

                role:
                    role,

                userRole:
                    role,

                accountType:
                    role
            };

            const saved =
                AUTH.saveSession(
                    updated,
                    role
                );

            AUTH.emit(
                "profile-updated",
                {
                    user:
                        saved
                }
            );

            AUTH.renderUser();

            return saved;
        };


    /* =========================================================
       PASSWORD RESET
    ========================================================= */

    AUTH.resetPassword =
        async function (
            email
        ) {

            email =
                cleanString(
                    email
                ).toLowerCase();

            if (!email) {

                throw new Error(
                    "Email is required."
                );
            }

            const FB =
                await loadFirebase();

            try {

                await FB.sendPasswordResetEmail(
                    FB.auth,
                    email
                );

                return true;

            } catch (error) {

                throw new Error(
                    firebaseError(error)
                );
            }
        };


    /* =========================================================
       EVENTS
    ========================================================= */

    AUTH.emit =
        function (
            name,
            detail
        ) {

            if (!isBrowser()) {
                return;
            }

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-auth-" +
                    name,
                    {
                        detail:
                            detail || {}
                    }
                )
            );

            if (
                [
                    "ready",
                    "signed-in",
                    "signed-out",
                    "login",
                    "logout",
                    "register"
                ].includes(name)
            ) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-auth-ready"
                    )
                );
            }
        };


    AUTH.on =
        function (
            name,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                return function () {};
            }

            const handler =
                function (event) {

                    callback(
                        event.detail || {}
                    );
                };

            window.addEventListener(
                "riderx-auth-" +
                name,
                handler
            );

            return function () {

                window.removeEventListener(
                    "riderx-auth-" +
                    name,
                    handler
                );
            };
        };


    /* =========================================================
       RENDER USER
    ========================================================= */

    AUTH.renderUser =
        function () {

            if (!isBrowser()) {
                return;
            }

            const user =
                AUTH.getUser();

            if (!user) {
                return;
            }

            const role =
                AUTH.getRole();

            document
                .querySelectorAll(
                    "[data-user-name]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            user.name ||
                            user.displayName ||
                            user.fullName ||
                            "User";
                    }
                );

            document
                .querySelectorAll(
                    "[data-user-email]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            user.email ||
                            "";
                    }
                );

            document
                .querySelectorAll(
                    "[data-user-phone]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            user.phone ||
                            user.phoneNumber ||
                            "";
                    }
                );

            document
                .querySelectorAll(
                    "[data-user-role]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            role ||
                            "";
                    }
                );

            document
                .querySelectorAll(
                    "[data-user-avatar]"
                )
                .forEach(
                    function (element) {

                        if (
                            user.photoURL
                        ) {

                            element.src =
                                user.photoURL;
                        }
                    }
                );
        };


    /* =========================================================
       LOGOUT BUTTON BINDING
    ========================================================= */

    AUTH.bindLogout =
        function () {

            if (
                AUTH.state.logoutBound ||
                !isBrowser()
            ) {

                return;
            }

            AUTH.state.logoutBound =
                true;

            document.addEventListener(
                "click",
                function (event) {

                    const button =
                        event.target.closest(
                            "[data-logout]"
                        );

                    if (!button) {
                        return;
                    }

                    event.preventDefault();

                    if (
                        AUTH.state.loading
                    ) {

                        return;
                    }

                    AUTH.logout();
                }
            );
        };


    /* =========================================================
       INIT
    ========================================================= */

    AUTH.init =
        async function () {

            if (
                AUTH.state.initialized
            ) {

                return;
            }

            if (
                AUTH.state.initializing
            ) {

                return;
            }

            AUTH.state.initializing =
                true;

            try {

                AUTH.bindLogout();

                AUTH.renderUser();

                await AUTH.startListener();

                AUTH.state.initialized =
                    true;

                AUTH.emit(
                    "ready"
                );

                console.info(
                    "RiderX authentication engine initialized."
                );

            } catch (error) {

                AUTH.state.authReady =
                    true;

                console.error(
                    "RiderX authentication initialization failed:",
                    error
                );

                AUTH.emit(
                    "auth-error",
                    {
                        error:
                            error
                    }
                );

            } finally {

                AUTH.state.initializing =
                    false;
            }
        };


    /* =========================================================
       PUBLIC COMPATIBILITY API
    ========================================================= */

    RX.login =
        function (
            email,
            password
        ) {

            return AUTH.loginEmail(
                email,
                password
            );
        };


    RX.registerUser =
        function (
            data
        ) {

            return AUTH.register(
                data
            );
        };


    RX.sendOtp =
        function (
            phone,
            container
        ) {

            return AUTH.sendOtp(
                phone,
                container
            );
        };


    RX.verifyOtp =
        function (
            otp,
            role
        ) {

            return AUTH.verifyOtp(
                otp,
                role
            );
        };


    RX.logout =
        function () {

            return AUTH.logout();
        };


    RX.getCurrentUser =
        function () {

            return AUTH.getUser();
        };


    RX.getCurrentRole =
        function () {

            return AUTH.getRole();
        };


    RX.isLoggedIn =
        function () {

            return AUTH.isLoggedIn();
        };


    RX.requireRole =
        function (
            roles,
            options
        ) {

            return AUTH.requireRole(
                roles,
                options
            );
        };


    RX.redirectByRole =
        function (
            fallback
        ) {

            return AUTH.redirectByRole(
                fallback
            );
        };


    /* =========================================================
       PUBLIC CONSTANTS
    ========================================================= */

    RX.auth.ROLES =
        ROLES;

    RX.auth.STORAGE_KEYS =
        STORAGE;


    /* =========================================================
       AUTO INITIALIZATION
    ========================================================= */

    if (
        isBrowser()
    ) {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                function () {

                    AUTH.init();

                },
                {
                    once:
                        true
                }
            );

        } else {

            AUTH.init();
        }
    }

})();
