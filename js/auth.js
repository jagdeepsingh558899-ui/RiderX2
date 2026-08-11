/* ============================================================
   RIDERX 2.0
   AUTHENTICATION ENGINE
   File: js/auth.js

   Canonical authentication layer.

   Supports:
   - Firebase Authentication
   - Email login
   - Email registration
   - Phone OTP
   - Customer / Rider roles
   - Admin / Superadmin roles from Firestore only
   - Rider approval
   - Firestore profiles
   - Session cache for UI only
   - Route guards
   - Password reset
   - Profile update
   - Logout
   - OTP cleanup
   - Compatibility API
============================================================ */

"use strict";

(function () {

    if (
        typeof window === "undefined" ||
        typeof document === "undefined"
    ) {
        return;
    }


    /* ========================================================
       GLOBAL NAMESPACE
    ======================================================== */

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const AUTH =
        RX.auth = RX.auth || {};


    /* ========================================================
       STORAGE
    ======================================================== */

    const STORAGE = Object.freeze({

        user:
            "riderx_user",

        role:
            "riderx_role",

        session:
            "riderx_session",

        customer:
            "riderx_customer",

        rider:
            "riderx_rider",

        admin:
            "riderx_admin_session",

        selectedRole:
            "riderx_selected_role",

        legacyRole:
            "userRole",

        otpPhone:
            "riderx_otp_phone"

    });


    /* ========================================================
       ROLES
    ======================================================== */

    const ROLES = Object.freeze({

        CUSTOMER:
            "customer",

        RIDER:
            "rider",

        ADMIN:
            "admin",

        SUPERADMIN:
            "superadmin"

    });


    const NORMAL_USER_ROLES =
        Object.freeze([
            ROLES.CUSTOMER,
            ROLES.RIDER
        ]);


    /* ========================================================
       ROUTES
    ======================================================== */

    const ROUTES = Object.freeze({

        customer:
            "customer/home.html",

        rider:
            "rider/home.html",

        admin:
            "admin/dashboard.html",

        superadmin:
            "admin/dashboard.html",

        auth:
            "auth/role.html",

        login:
            "auth/login.html",

        pendingRider:
            "rider/pending.html"

    });


    /* ========================================================
       STATE
    ======================================================== */

    AUTH.state =
        AUTH.state || {

            initialized:
                false,

            initializing:
                false,

            loading:
                false,

            authReady:
                false,

            user:
                null,

            role:
                null,

            firebaseUser:
                null,

            unsubscribe:
                null,

            authError:
                null,

            listenerStarted:
                false,

            readyPromise:
                null,

            readyResolved:
                false,

            authEventVersion:
                0

        };


    let Firebase =
        null;

    let firebaseLoadPromise =
        null;


    AUTH.phoneConfirmation =
        null;

    AUTH.phoneVerifier =
        null;


    /* ========================================================
       BASIC HELPERS
    ======================================================== */

    function cleanString(value) {

        return String(
            value ?? ""
        ).trim();

    }


    function safeLower(value) {

        return cleanString(
            value
        ).toLowerCase();

    }


    function isObject(value) {

        return Boolean(
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        );

    }


    function safeStorageGet(key) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (error) {

            return null;

        }

    }


    function safeStorageSet(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                String(value)
            );

            return true;

        } catch (error) {

            return false;

        }

    }


    function safeStorageRemove(key) {

        try {

            localStorage.removeItem(
                key
            );

        } catch (error) {
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

            return isObject(
                parsed
            )
                ? parsed
                : null;

        } catch (error) {

            safeStorageRemove(
                key
            );

            return null;

        }

    }


    /* ========================================================
       ERROR NORMALIZATION
    ======================================================== */

    function firebaseError(error) {

        const code =
            safeLower(
                error?.code
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

            "auth/invalid-login-credentials":
                "Incorrect email or password.",

            "auth/email-already-in-use":
                "An account with this email already exists.",

            "auth/weak-password":
                "Password must contain at least 6 characters.",

            "auth/password-does-not-meet-requirements":
                "Password does not meet the required security requirements.",

            "auth/too-many-requests":
                "Too many attempts. Please wait and try again.",

            "auth/network-request-failed":
                "Network error. Please check your internet connection.",

            "auth/invalid-verification-code":
                "The OTP is incorrect.",

            "auth/code-expired":
                "The OTP has expired. Please request a new OTP.",

            "auth/invalid-phone-number":
                "Please enter a valid phone number.",

            "auth/quota-exceeded":
                "OTP service limit reached. Please try again later.",

            "auth/captcha-check-failed":
                "Security verification failed. Please try again.",

            "auth/missing-phone-number":
                "Phone number is required.",

            "auth/user-disabled":
                "This Firebase account has been disabled.",

            "auth/operation-not-allowed":
                "This authentication method is not enabled in Firebase.",

            "auth/requires-recent-login":
                "Please login again before changing this account information.",

            "auth/popup-closed-by-user":
                "Google sign-in was cancelled.",

            "auth/popup-blocked":
                "Your browser blocked the Google sign-in window.",

            "permission-denied":
                "You do not have permission to access this RiderX profile.",

            "not-found":
                "The requested RiderX profile was not found.",

            "unavailable":
                "RiderX service is temporarily unavailable.",

            "deadline-exceeded":
                "The request took too long. Please try again."

        };


        if (
            messages[code]
        ) {

            return messages[code];

        }


        const raw =
            cleanString(
                error?.message
            );


        return (
            raw ||
            "RiderX authentication failed."
        );

    }


    /* ========================================================
       FIREBASE LOADER
       --------------------------------------------------------
       Only imports the central RiderX Firebase module.
       No second initializeApp() is performed here.
    ======================================================== */

    function loadFirebase() {

        if (Firebase) {

            return Promise.resolve(
                Firebase
            );

        }


        if (
            firebaseLoadPromise
        ) {

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


                    const required = [

                        "auth",
                        "db",

                        "doc",
                        "getDoc",
                        "setDoc",

                        "onAuthStateChanged",

                        "signInWithEmailAndPassword",
                        "createUserWithEmailAndPassword",

                        "signInWithPhoneNumber",
                        "signOut",

                        "updateProfile",

                        "sendPasswordResetEmail",

                        "RecaptchaVerifier"

                    ];


                    const missing =
                        required.filter(
                            function (name) {

                                return (
                                    typeof module[name] ===
                                    "undefined"
                                );

                            }
                        );


                    if (
                        missing.length
                    ) {

                        throw new Error(
                            "RiderX Firebase module is missing: " +
                            missing.join(", ")
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

                    throw error;

                }
            );


        return firebaseLoadPromise;

    }


    /* ========================================================
       PATH HELPERS
    ======================================================== */

    function getApplicationRoot() {

        const pathname =
            window.location.pathname ||
            "/";

        const normalized =
            pathname.replace(
                /\/+/g,
                "/"
            );


        const folders = [

            "/auth/",
            "/customer/",
            "/rider/",
            "/admin/"

        ];


        for (
            const folder of folders
        ) {

            const index =
                normalized.indexOf(
                    folder
                );


            if (
                index !== -1
            ) {

                return normalized.slice(
                    0,
                    index
                );

            }

        }


        if (
            normalized.endsWith(
                "/index.html"
            )
        ) {

            return normalized
                .slice(
                    0,
                    normalized.length -
                    "index.html".length
                )
                .replace(
                    /\/$/,
                    ""
                );

        }


        return "";

    }


    function absoluteRoute(route) {

        const root =
            getApplicationRoot();


        const cleanRoute =
            cleanString(
                route
            )
            .replace(
                /^\/+/,
                ""
            );


        if (
            !cleanRoute
        ) {

            return root
                ? "/" + root
                : "/";

        }


        return root
            ? "/" + root + "/" + cleanRoute
            : "/" + cleanRoute;

    }


    function currentPath() {

        return (
            window.location.pathname ||
            ""
        );

    }


    function isAuthPage() {

        const path =
            currentPath();

        return (
            path.includes("/auth/") ||
            path.endsWith("/login.html") ||
            path.endsWith("/register.html")
        );

    }


    function isCustomerPage() {

        return currentPath()
            .includes("/customer/");

    }


    function isRiderPage() {

        return currentPath()
            .includes("/rider/");

    }


    function isAdminPage() {

        return currentPath()
            .includes("/admin/");

    }


    /* ========================================================
       ROLE NORMALIZATION
    ======================================================== */

    AUTH.normalizeRole =
        function (role) {

            const value =
                safeLower(
                    role
                )
                .replace(
                    /[\s_-]+/g,
                    ""
                );


            if (
                [
                    "customer",
                    "user",
                    "passenger",
                    "client"
                ].includes(value)
            ) {

                return ROLES.CUSTOMER;

            }


            if (
                [
                    "rider",
                    "driver",
                    "captain"
                ].includes(value)
            ) {

                return ROLES.RIDER;

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
                AUTH.normalizeRole(
                    role
                );

            return (
                normalized === ROLES.ADMIN ||
                normalized === ROLES.SUPERADMIN
            );

        };


    AUTH.isRiderRole =
        function (role) {

            return (
                AUTH.normalizeRole(
                    role
                ) === ROLES.RIDER
            );

        };


    AUTH.isCustomerRole =
        function (role) {

            return (
                AUTH.normalizeRole(
                    role
                ) === ROLES.CUSTOMER
            );

        };


    /* ========================================================
       STORED SESSION
       --------------------------------------------------------
       UI cache only.
       Never treated as authenticated Firebase state.
    ======================================================== */

    AUTH.getStoredUser =
        function () {

            const primary =
                parseStorageUser(
                    STORAGE.user
                );


            if (
                primary
            ) {

                return primary;

            }


            const role =
                AUTH.normalizeRole(
                    safeStorageGet(
                        STORAGE.role
                    )
                );


            if (
                role === ROLES.CUSTOMER
            ) {

                return parseStorageUser(
                    STORAGE.customer
                );

            }


            if (
                role === ROLES.RIDER
            ) {

                return parseStorageUser(
                    STORAGE.rider
                );

            }


            if (
                AUTH.isAdminRole(
                    role
                )
            ) {

                return parseStorageUser(
                    STORAGE.admin
                );

            }


            return null;

        };


    AUTH.getStoredRole =
        function () {

            return (
                AUTH.normalizeRole(
                    safeStorageGet(
                        STORAGE.role
                    )
                )
                ||
                AUTH.normalizeRole(
                    safeStorageGet(
                        STORAGE.legacyRole
                    )
                )
                ||
                AUTH.normalizeRole(
                    AUTH.getStoredUser()?.role
                )
            );

        };


    /* ========================================================
       CURRENT USER
    ======================================================== */

    AUTH.getUser =
        function () {

            if (
                AUTH.state.user
            ) {

                return AUTH.state.user;

            }


            if (
                !AUTH.state.authReady
            ) {

                return AUTH.getStoredUser();

            }


            return null;

        };


    AUTH.getRole =
        function () {

            if (
                AUTH.state.role
            ) {

                return AUTH.state.role;

            }


            if (
                AUTH.state.user?.role
            ) {

                return AUTH.normalizeRole(
                    AUTH.state.user.role
                );

            }


            if (
                !AUTH.state.authReady
            ) {

                return AUTH.getStoredRole();

            }


            return "";

        };


    AUTH.getUid =
        function () {

            return (
                AUTH.state.firebaseUser?.uid ||
                AUTH.state.user?.uid ||
                AUTH.state.user?.id ||
                AUTH.state.user?.userId ||
                ""
            );

        };


    AUTH.getUserId =
        function (user) {

            return (
                user?.uid ||
                user?.id ||
                user?.userId ||
                null
            );

        };


    AUTH.getEmail =
        function () {

            return (
                AUTH.state.firebaseUser?.email ||
                AUTH.state.user?.email ||
                ""
            );

        };


    AUTH.isLoggedIn =
        function () {

            return Boolean(
                AUTH.state.firebaseUser &&
                AUTH.state.user
            );

        };


    /* ========================================================
       SESSION SAVE
    ======================================================== */

    AUTH.saveSession =
        function (
            user,
            role
        ) {

            if (
                !isObject(user)
            ) {

                return null;

            }


            const uid =
                cleanString(
                    user.uid ||
                    user.id ||
                    user.userId
                );


            if (
                !uid
            ) {

                throw new Error(
                    "RiderX user profile does not contain a UID."
                );

            }


            const normalizedRole =
                AUTH.normalizeRole(
                    role ||
                    user.role ||
                    user.userRole ||
                    user.accountType
                );


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

                name:
                    cleanString(
                        user.name ||
                        user.displayName ||
                        user.fullName
                    ),

                fullName:
                    cleanString(
                        user.fullName ||
                        user.name ||
                        user.displayName
                    ),

                displayName:
                    cleanString(
                        user.displayName ||
                        user.name
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

                approvalStatus:
                    cleanString(
                        user.approvalStatus
                    ),

                approved:
                    user.approved === true,

                isApproved:
                    user.isApproved === true,

                city:
                    cleanString(
                        user.city
                    ) ||
                    "Chandigarh",

                updatedAt:
                    Date.now()

            };


            safeStorageSet(
                STORAGE.user,
                JSON.stringify(
                    sessionUser
                )
            );


            safeStorageSet(
                STORAGE.session,
                JSON.stringify(
                    sessionUser
                )
            );


            safeStorageSet(
                STORAGE.role,
                normalizedRole
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
                    JSON.stringify(
                        sessionUser
                    )
                );

            }


            return sessionUser;

        };


    /* ========================================================
       SESSION CLEAR
    ======================================================== */

    AUTH.clearSession =
        function () {

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

            safeStorageRemove(
                STORAGE.legacyRole
            );

        };


    /* ========================================================
       EVENTS
    ======================================================== */

    AUTH.emit =
        function (
            eventName,
            detail
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:auth:" +
                        eventName,
                        {
                            detail:
                                detail || {}
                        }
                    )
                );

            } catch (error) {
            }

        };


    /* ========================================================
       PROFILE FETCH
    ======================================================== */

    AUTH.getProfile =
        async function (
            firebaseUser
        ) {

            const user =
                firebaseUser ||
                AUTH.state.firebaseUser;


            if (
                !user?.uid
            ) {

                return null;

            }


            const FB =
                await loadFirebase();


            const snapshot =
                await FB.getDoc(
                    FB.doc(
                        FB.db,
                        "users",
                        user.uid
                    )
                );


            if (
                !snapshot.exists()
            ) {

                return null;

            }


            return {

                ...snapshot.data(),

                uid:
                    user.uid

            };

        };


    /* ========================================================
       ROLE RESOLUTION
    ======================================================== */

    async function resolveProfile(
        firebaseUser
    ) {

        const profile =
            await AUTH.getProfile(
                firebaseUser
            );


        if (
            !profile
        ) {

            return null;

        }


        const role =
            AUTH.normalizeRole(
                profile.role ||
                profile.userRole ||
                profile.accountType
            );


        if (
            !role
        ) {

            return null;

        }


        return {

            ...profile,

            uid:
                firebaseUser.uid,

            email:
                profile.email ||
                firebaseUser.email ||
                "",

            phone:
                profile.phone ||
                profile.phoneNumber ||
                firebaseUser.phoneNumber ||
                "",

            role,

            userRole:
                role,

            accountType:
                role

        };

    }


    /* ========================================================
       ACCOUNT STATUS
    ======================================================== */

    AUTH.isAccountBlocked =
        function (user) {

            const status =
                safeLower(
                    user?.status
                );


            return Boolean(
                user?.blocked === true ||
                user?.disabled === true ||
                user?.suspended === true ||
                [
                    "blocked",
                    "disabled",
                    "suspended",
                    "banned"
                ].includes(status)
            );

        };


    AUTH.isAccountPending =
        function (user) {

            if (
                AUTH.normalizeRole(
                    user?.role
                ) !==
                ROLES.RIDER
            ) {

                return false;

            }


            const status =
                safeLower(
                    user?.status
                );

            const approval =
                safeLower(
                    user?.approvalStatus
                );


            return (
                status === "pending" ||
                status === "waiting" ||
                status === "awaiting" ||
                approval === "pending" ||
                approval === "waiting" ||
                approval === "awaiting"
            );

        };


    AUTH.isRiderApproved =
        function (user) {

            if (
                AUTH.normalizeRole(
                    user?.role
                ) !==
                ROLES.RIDER
            ) {

                return false;

            }


            if (
                AUTH.isAccountBlocked(
                    user
                )
            ) {

                return false;

            }


            if (
                user?.approved === true ||
                user?.isApproved === true ||
                user?.adminApproved === true
            ) {

                return true;

            }


            const approval =
                safeLower(
                    user?.approvalStatus
                );

            const status =
                safeLower(
                    user?.status
                );


            return (
                approval === "approved" ||
                approval === "active" ||
                status === "approved" ||
                status === "active"
            );

        };


    /* ========================================================
       ROUTE FOR USER
    ======================================================== */

    AUTH.getRouteForUser =
        function (
            user,
            fallback
        ) {

            if (
                !user
            ) {

                return (
                    fallback ||
                    ROUTES.login
                );

            }


            const role =
                AUTH.normalizeRole(
                    user.role ||
                    user.userRole ||
                    user.accountType
                );


            if (
                AUTH.isAdminRole(
                    role
                )
            ) {

                return ROUTES.admin;

            }


            if (
                role === ROLES.RIDER
            ) {

                if (
                    AUTH.isAccountBlocked(
                        user
                    )
                ) {

                    return ROUTES.auth;

                }


                if (
                    AUTH.isAccountPending(
                        user
                    ) ||
                    !AUTH.isRiderApproved(
                        user
                    )
                ) {

                    return ROUTES.pendingRider;

                }


                return ROUTES.rider;

            }


            if (
                role === ROLES.CUSTOMER
            ) {

                return ROUTES.customer;

            }


            return (
                fallback ||
                ROUTES.auth
            );

        };


    /* ========================================================
       REDIRECT
    ======================================================== */

    AUTH.redirectByRole =
        function (
            fallback
        ) {

            const user =
                AUTH.state.user ||
                AUTH.getUser();


            const route =
                AUTH.getRouteForUser(
                    user,
                    fallback
                );


            const target =
                absoluteRoute(
                    route
                );


            if (
                window.location.pathname !==
                target
            ) {

                window.location.replace(
                    target
                );

            }


            return target;

        };


    /* ========================================================
       READY STATE
    ======================================================== */

    function resolveAuthReady() {

        if (
            AUTH.state.readyResolved
        ) {

            return;

        }


        AUTH.state.readyResolved =
            true;

        AUTH.state.authReady =
            true;


        AUTH.emit(
            "ready",
            {
                user:
                    AUTH.state.user,

                role:
                    AUTH.state.role,

                firebaseUser:
                    AUTH.state.firebaseUser
            }
        );


        try {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx:auth-ready",
                    {
                        detail: {
                            user:
                                AUTH.state.user,

                            role:
                                AUTH.state.role,

                            firebaseUser:
                                AUTH.state.firebaseUser
                        }
                    }
                )
            );

        } catch (error) {
        }

    }


    AUTH.waitForAuth =
        function () {

            if (
                AUTH.state.authReady &&
                AUTH.state.readyResolved
            ) {

                return Promise.resolve(
                    AUTH.state
                );

            }


            if (
                AUTH.state.readyPromise
            ) {

                return AUTH.state.readyPromise;

            }


            AUTH.state.readyPromise =
                new Promise(
                    function (resolve) {

                        if (
                            AUTH.state.authReady &&
                            AUTH.state.readyResolved
                        ) {

                            resolve(
                                AUTH.state
                            );

                            return;

                        }


                        const handler =
                            function () {

                                window.removeEventListener(
                                    "riderx:auth-ready",
                                    handler
                                );


                                resolve(
                                    AUTH.state
                                );

                            };


                        window.addEventListener(
                            "riderx:auth-ready",
                            handler,
                            {
                                once:
                                    true
                            }
                        );

                    }
                );


            return AUTH.state.readyPromise;

        };


    /* ========================================================
       AUTH STATE LISTENER
    ======================================================== */

    AUTH.startListener =
        async function () {

            if (
                AUTH.state.listenerStarted
            ) {

                return AUTH.state;

            }


            const FB =
                await loadFirebase();


            AUTH.state.listenerStarted =
                true;


            AUTH.state.unsubscribe =
                FB.onAuthStateChanged(
                    FB.auth,
                    async function (
                        firebaseUser
                    ) {

                        const eventVersion =
                            ++AUTH.state.authEventVersion;


                        AUTH.state.loading =
                            true;


                        try {

                            if (
                                !firebaseUser
                            ) {

                                AUTH.state.firebaseUser =
                                    null;

                                AUTH.state.user =
                                    null;

                                AUTH.state.role =
                                    null;

                                AUTH.clearSession();

                                return;

                            }


                            AUTH.state.firebaseUser =
                                firebaseUser;


                            const profile =
                                await resolveProfile(
                                    firebaseUser
                                );


                            /*
                             * Ignore stale async profile results.
                             */

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }


                            if (
                                !profile
                            ) {

                                AUTH.state.user =
                                    null;

                                AUTH.state.role =
                                    null;

                                AUTH.emit(
                                    "profile-missing",
                                    {
                                        firebaseUser
                                    }
                                );

                                return;

                            }


                            AUTH.state.user =
                                AUTH.saveSession(
                                    profile,
                                    profile.role
                                );


                            AUTH.state.role =
                                AUTH.normalizeRole(
                                    profile.role
                                );


                            AUTH.emit(
                                "login",
                                {
                                    user:
                                        AUTH.state.user,

                                    role:
                                        AUTH.state.role
                                }
                            );


                        } catch (error) {

                            AUTH.state.authError =
                                error;


                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;


                            AUTH.emit(
                                "auth-error",
                                {
                                    error
                                }
                            );


                        } finally {

                            if (
                                eventVersion ===
                                AUTH.state.authEventVersion
                            ) {

                                AUTH.state.loading =
                                    false;

                                resolveAuthReady();

                                AUTH.autoGuard();

                            }

                        }

                    }
                );


            return AUTH.state;

        };


    /* ========================================================
       EMAIL LOGIN
    ======================================================== */

    AUTH.loginEmail =
        async function (
            email,
            password,
            selectedRole
        ) {

            email =
                cleanString(
                    email
                )
                .toLowerCase();

            password =
                String(
                    password || ""
                );


            if (
                !email ||
                !password
            ) {

                throw new Error(
                    "Email and password are required."
                );

            }


            const requestedRole =
                AUTH.normalizeRole(
                    selectedRole
                );


            if (
                selectedRole &&
                !NORMAL_USER_ROLES.includes(
                    requestedRole
                )
            ) {

                throw new Error(
                    "Please select Customer or Rider."
                );

            }


            const FB =
                await loadFirebase();


            try {

                const credential =
                    await FB.signInWithEmailAndPassword(
                        FB.auth,
                        email,
                        password
                    );


                const profile =
                    await resolveProfile(
                        credential.user
                    );


                if (
                    !profile
                ) {

                    await FB.signOut(
                        FB.auth
                    );

                    throw new Error(
                        "Your RiderX profile was not found."
                    );

                }


                const actualRole =
                    AUTH.normalizeRole(
                        profile.role
                    );


                /*
                 * Selected role is only a UI expectation.
                 * Existing Firebase account role remains authoritative.
                 */

                if (
                    requestedRole &&
                    actualRole !== requestedRole &&
                    !AUTH.isAdminRole(
                        actualRole
                    )
                ) {

                    await FB.signOut(
                        FB.auth
                    );

                    throw new Error(
                        `This account is registered as ${actualRole}.`
                    );

                }


                if (
                    AUTH.isAccountBlocked(
                        profile
                    )
                ) {

                    await FB.signOut(
                        FB.auth
                    );

                    throw new Error(
                        "Your RiderX account is blocked or suspended."
                    );

                }


                AUTH.state.firebaseUser =
                    credential.user;


                AUTH.state.user =
                    AUTH.saveSession(
                        profile,
                        actualRole
                    );


                AUTH.state.role =
                    actualRole;


                return {

                    success:
                        true,

                    user:
                        AUTH.state.user,

                    role:
                        actualRole,

                    firebaseUser:
                        credential.user

                };

            } catch (error) {

                throw new Error(
                    firebaseError(
                        error
                    )
                );

            }

        };


    /* ========================================================
       REGISTER
    ======================================================== */

    AUTH.register =
        async function (
            data
        ) {

            data =
                isObject(data)
                    ? data
                    : {};


            const email =
                cleanString(
                    data.email
                )
                .toLowerCase();


            const password =
                String(
                    data.password || ""
                );


            const role =
                AUTH.normalizeRole(
                    data.role ||
                    data.selectedRole
                );


            if (
                !email
            ) {

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


            if (
                !NORMAL_USER_ROLES.includes(
                    role
                )
            ) {

                throw new Error(
                    "Please select Customer or Rider."
                );

            }


            const FB =
                await loadFirebase();


            let credential =
                null;


            try {

                credential =
                    await FB.createUserWithEmailAndPassword(
                        FB.auth,
                        email,
                        password
                    );


                const firebaseUser =
                    credential.user;


                const name =
                    cleanString(
                        data.name ||
                        data.fullName ||
                        data.displayName
                    );


                if (
                    name &&
                    typeof FB.updateProfile ===
                    "function"
                ) {

                    try {

                        await FB.updateProfile(
                            firebaseUser,
                            {
                                displayName:
                                    name
                            }
                        );

                    } catch (error) {
                    }

                }


                const isRider =
                    role === ROLES.RIDER;


                const now =
                    Date.now();


                const profile = {

                    uid:
                        firebaseUser.uid,

                    email,

                    name,

                    fullName:
                        name,

                    displayName:
                        name,

                    phone:
                        cleanString(
                            data.phone ||
                            data.phoneNumber
                        ),

                    phoneNumber:
                        cleanString(
                            data.phoneNumber ||
                            data.phone
                        ),

                    role,

                    userRole:
                        role,

                    accountType:
                        role,

                    status:
                        isRider
                            ? "pending"
                            : "active",

                    approvalStatus:
                        isRider
                            ? "pending"
                            : "approved",

                    approved:
                        !isRider,

                    isApproved:
                        !isRider,

                    city:
                        cleanString(
                            data.city
                        ) ||
                        "Chandigarh",

                    online:
                        false,

                    createdAt:
                        now,

                    updatedAt:
                        now

                };


                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    ),
                    profile,
                    {
                        merge:
                            true
                    }
                );


                const collectionName =
                    isRider
                        ? "riders"
                        : "customers";


                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        collectionName,
                        firebaseUser.uid
                    ),
                    profile,
                    {
                        merge:
                            true
                    }
                );


                AUTH.state.firebaseUser =
                    firebaseUser;


                AUTH.state.user =
                    AUTH.saveSession(
                        profile,
                        role
                    );


                AUTH.state.role =
                    role;


                AUTH.emit(
                    "registered",
                    {
                        user:
                            AUTH.state.user,

                        role
                    }
                );


                return {

                    success:
                        true,

                    user:
                        AUTH.state.user,

                    role,

                    firebaseUser

                };

            } catch (error) {

                /*
                 * If profile creation fails after Firebase account
                 * creation, do not silently create another account.
                 * The account remains in Firebase and can be completed
                 * through the profile flow.
                 */

                throw new Error(
                    firebaseError(
                        error
                    )
                );

            }

        };


    /* ========================================================
       PHONE NORMALIZATION
    ======================================================== */

    AUTH.normalizePhone =
        function (phone) {

            let value =
                cleanString(
                    phone
                )
                .replace(
                    /[\s()-]/g,
                    ""
                );


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
       CLEAR OTP
    ======================================================== */

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
            }


            AUTH.phoneVerifier =
                null;

        };


    /* ========================================================
       SEND OTP
    ======================================================== */

    AUTH.sendOtp =
        async function (
            phone,
            container
        ) {

            const normalizedPhone =
                AUTH.normalizePhone(
                    phone
                );


            if (
                !/^\+?[1-9]\d{7,14}$/.test(
                    normalizedPhone
                )
            ) {

                throw new Error(
                    "Please enter a valid phone number."
                );

            }


            const FB =
                await loadFirebase();


            AUTH.clearOtpVerifier();


            let element =
                container;


            if (
                typeof container ===
                "string"
            ) {

                element =
                    document.getElementById(
                        container
                    ) ||
                    document.querySelector(
                        container
                    );

            }


            if (
                !element
            ) {

                element =
                    document.body;

            }


            try {

                AUTH.phoneVerifier =
                    new FB.RecaptchaVerifier(
                        FB.auth,
                        element,
                        {

                            size:
                                "invisible",

                            callback:
                                function () {

                                    AUTH.emit(
                                        "otp-recaptcha-success"
                                    );

                                },

                            "expired-callback":
                                function () {

                                    AUTH.clearOtpVerifier();

                                    AUTH.emit(
                                        "otp-recaptcha-expired"
                                    );

                                }

                        }
                    );


                await AUTH.phoneVerifier
                    .render();


                AUTH.phoneConfirmation =
                    await FB.signInWithPhoneNumber(
                        FB.auth,
                        normalizedPhone,
                        AUTH.phoneVerifier
                    );


                safeStorageSet(
                    STORAGE.otpPhone,
                    normalizedPhone
                );


                AUTH.emit(
                    "otp-sent",
                    {
                        phone:
                            normalizedPhone
                    }
                );


                return {

                    success:
                        true,

                    phone:
                        normalizedPhone

                };

            } catch (error) {

                AUTH.phoneConfirmation =
                    null;

                AUTH.clearOtpVerifier();

                throw new Error(
                    firebaseError(
                        error
                    )
                );

            }

        };


    /* ========================================================
       CREATE PHONE PROFILE
    ======================================================== */

    async function createPhoneProfile(
        firebaseUser,
        role,
        phone,
        extraData
    ) {

        const FB =
            await loadFirebase();


        const normalizedRole =
            AUTH.normalizeRole(
                role
            );


        if (
            !NORMAL_USER_ROLES.includes(
                normalizedRole
            )
        ) {

            throw new Error(
                "Please select Customer or Rider."
            );

        }


        extraData =
            isObject(extraData)
                ? extraData
                : {};


        const name =
            cleanString(
                extraData.name ||
                extraData.fullName ||
                firebaseUser.displayName
            );


        const isRider =
            normalizedRole ===
            ROLES.RIDER;


        const now =
            Date.now();


        const profile = {

            uid:
                firebaseUser.uid,

            email:
                firebaseUser.email ||
                "",

            name,

            fullName:
                name,

            displayName:
                name,

            phone:
                firebaseUser.phoneNumber ||
                phone ||
                "",

            phoneNumber:
                firebaseUser.phoneNumber ||
                phone ||
                "",

            role:
                normalizedRole,

            userRole:
                normalizedRole,

            accountType:
                normalizedRole,

            status:
                isRider
                    ? "pending"
                    : "active",

            approvalStatus:
                isRider
                    ? "pending"
                    : "approved",

            approved:
                !isRider,

            isApproved:
                !isRider,

            city:
                cleanString(
                    extraData.city
                ) ||
                "Chandigarh",

            online:
                false,

            createdAt:
                now,

            updatedAt:
                now

        };


        if (
            name &&
            typeof FB.updateProfile ===
            "function"
        ) {

            try {

                await FB.updateProfile(
                    firebaseUser,
                    {
                        displayName:
                            name
                    }
                );

            } catch (error) {
            }

        }


        await FB.setDoc(
            FB.doc(
                FB.db,
                "users",
                firebaseUser.uid
            ),
            profile,
            {
                merge:
                    true
            }
        );


        await FB.setDoc(
            FB.doc(
                FB.db,
                isRider
                    ? "riders"
                    : "customers",
                firebaseUser.uid
            ),
            profile,
            {
                merge:
                    true
            }
        );


        return profile;

    }


    /* ========================================================
       VERIFY OTP
    ======================================================== */

    AUTH.verifyOtp =
        async function (
            otp,
            role,
            extraData
        ) {

            const code =
                cleanString(
                    otp
                );


            if (
                !/^\d{6}$/.test(
                    code
                )
            ) {

                throw new Error(
                    "Please enter the 6-digit OTP."
                );

            }


            if (
                !AUTH.phoneConfirmation
            ) {

                throw new Error(
                    "Please request a new OTP."
                );

            }


            const selectedRole =
                AUTH.normalizeRole(
                    role
                );


            if (
                !NORMAL_USER_ROLES.includes(
                    selectedRole
                )
            ) {

                throw new Error(
                    "Please select Customer or Rider."
                );

            }


            try {

                const credential =
                    await AUTH.phoneConfirmation
                        .confirm(
                            code
                        );


                const firebaseUser =
                    credential.user;


                let profile =
                    await AUTH.getProfile(
                        firebaseUser
                    );


                /*
                 * Existing phone account:
                 *
                 * NEVER overwrite its role from the login UI.
                 */

                if (
                    profile
                ) {

                    const actualRole =
                        AUTH.normalizeRole(
                            profile.role ||
                            profile.userRole ||
                            profile.accountType
                        );


                    if (
                        !actualRole
                    ) {

                        throw new Error(
                            "Your RiderX profile has no valid role."
                        );

                    }


                    if (
                        AUTH.isAccountBlocked(
                            profile
                        )
                    ) {

                        const FB =
                            await loadFirebase();

                        await FB.signOut(
                            FB.auth
                        );

                        throw new Error(
                            "Your RiderX account is blocked or suspended."
                        );

                    }


                    AUTH.state.firebaseUser =
                        firebaseUser;

                    AUTH.state.user =
                        AUTH.saveSession(
                            {
                                ...profile,
                                uid:
                                    firebaseUser.uid
                            },
                            actualRole
                        );

                    AUTH.state.role =
                        actualRole;


                } else {

                    /*
                     * New phone account:
                     * selected role can be used exactly once
                     * to create the profile.
                     */

                    profile =
                        await createPhoneProfile(
                            firebaseUser,
                            selectedRole,
                            safeStorageGet(
                                STORAGE.otpPhone
                            ),
                            extraData
                        );


                    AUTH.state.firebaseUser =
                        firebaseUser;

                    AUTH.state.user =
                        AUTH.saveSession(
                            profile,
                            selectedRole
                        );

                    AUTH.state.role =
                        selectedRole;

                }


                safeStorageRemove(
                    STORAGE.otpPhone
                );


                AUTH.phoneConfirmation =
                    null;


                AUTH.clearOtpVerifier();


                AUTH.emit(
                    "otp-verified",
                    {
                        user:
                            AUTH.state.user,

                        role:
                            AUTH.state.role
                    }
                );


                return {

                    success:
                        true,

                    user:
                        AUTH.state.user,

                    role:
                        AUTH.state.role,

                    firebaseUser

                };

            } catch (error) {

                throw new Error(
                    firebaseError(
                        error
                    )
                );

            }

        };


    /* ========================================================
       LOGOUT
    ======================================================== */

    AUTH.logout =
        async function (
            options
        ) {

            options =
                isObject(options)
                    ? options
                    : {};


            const FB =
                await loadFirebase();


            AUTH.cancelOtp();


            try {

                await FB.signOut(
                    FB.auth
                );

            } catch (error) {

                console.warn(
                    "RiderX sign-out failed:",
                    error
                );

            }


            AUTH.state.firebaseUser =
                null;

            AUTH.state.user =
                null;

            AUTH.state.role =
                null;


            AUTH.clearSession();


            AUTH.emit(
                "logout"
            );


            if (
                options.route !== false
            ) {

                const route =
                    options.route ||
                    ROUTES.auth;


                window.location.replace(
                    absoluteRoute(
                        route
                    )
                );

            }


            return true;

        };


    /* ========================================================
       PASSWORD RESET
    ======================================================== */

    AUTH.resetPassword =
        async function (
            email
        ) {

            email =
                cleanString(
                    email
                )
                .toLowerCase();


            if (
                !email
            ) {

                throw new Error(
                    "Email address is required."
                );

            }


            const FB =
                await loadFirebase();


            try {

                await FB.sendPasswordResetEmail(
                    FB.auth,
                    email
                );


                AUTH.emit(
                    "password-reset-sent",
                    {
                        email
                    }
                );


                return true;

            } catch (error) {

                throw new Error(
                    firebaseError(
                        error
                    )
                );

            }

        };


    /* ========================================================
       UPDATE PROFILE
       --------------------------------------------------------
       Uses only functions exported by firebase-config.js.
    ======================================================== */

    AUTH.updateProfile =
        async function (
            updates
        ) {

            updates =
                isObject(updates)
                    ? updates
                    : {};


            const firebaseUser =
                AUTH.state.firebaseUser;


            if (
                !firebaseUser
            ) {

                throw new Error(
                    "Please login first."
                );

            }


            const FB =
                await loadFirebase();


            const uid =
                firebaseUser.uid;


            const allowed = {

                name:
                    cleanString(
                        updates.name
                    ),

                fullName:
                    cleanString(
                        updates.fullName
                    ),

                phone:
                    cleanString(
                        updates.phone
                    ),

                phoneNumber:
                    cleanString(
                        updates.phoneNumber
                    ),

                city:
                    cleanString(
                        updates.city
                    ),

                photoURL:
                    cleanString(
                        updates.photoURL
                    )

            };


            const firestoreUpdates = {

                updatedAt:
                    Date.now()

            };


            if (
                allowed.name
            ) {

                firestoreUpdates.name =
                    allowed.name;

                firestoreUpdates.fullName =
                    allowed.name;

                firestoreUpdates.displayName =
                    allowed.name;

            }


            if (
                allowed.fullName
            ) {

                firestoreUpdates.fullName =
                    allowed.fullName;

            }


            if (
                allowed.phone
            ) {

                firestoreUpdates.phone =
                    allowed.phone;

            }


            if (
                allowed.phoneNumber
            ) {

                firestoreUpdates.phoneNumber =
                    allowed.phoneNumber;

            }


            if (
                allowed.city
            ) {

                firestoreUpdates.city =
                    allowed.city;

            }


            if (
                allowed.photoURL
            ) {

                firestoreUpdates.photoURL =
                    allowed.photoURL;

            }


            if (
                typeof FB.updateProfile ===
                "function"
            ) {

                const authUpdates = {};


                if (
                    firestoreUpdates.displayName
                ) {

                    authUpdates.displayName =
                        firestoreUpdates.displayName;

                }


                if (
                    firestoreUpdates.photoURL
                ) {

                    authUpdates.photoURL =
                        firestoreUpdates.photoURL;

                }


                if (
                    Object.keys(
                        authUpdates
                    ).length
                ) {

                    try {

                        await FB.updateProfile(
                            firebaseUser,
                            authUpdates
                        );

                    } catch (error) {

                        throw new Error(
                            firebaseError(
                                error
                            )
                        );

                    }

                }

            }


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


            const role =
                AUTH.getRole();


            const collectionName =
                role === ROLES.RIDER
                    ? "riders"
                    : role === ROLES.CUSTOMER
                        ? "customers"
                        : "";


            if (
                collectionName
            ) {

                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        collectionName,
                        uid
                    ),
                    firestoreUpdates,
                    {
                        merge:
                            true
                    }
                );

            }


            AUTH.state.user = {

                ...(AUTH.state.user || {}),

                ...firestoreUpdates,

                uid

            };


            AUTH.saveSession(
                AUTH.state.user,
                role
            );


            AUTH.emit(
                "profile-updated",
                {
                    user:
                        AUTH.state.user
                }
            );


            return AUTH.state.user;

        };


    /* ========================================================
       CHANGE PASSWORD
       --------------------------------------------------------
       The current firebase-config.js does not export
       EmailAuthProvider / reauthenticateWithCredential /
       updatePassword.

       Do not make the entire auth engine fail because of that.
       Tell the caller exactly what dependency is missing.
    ======================================================== */

    AUTH.changePassword =
        async function (
            currentPassword,
            newPassword
        ) {

            const firebaseUser =
                AUTH.state.firebaseUser;


            if (
                !firebaseUser
            ) {

                throw new Error(
                    "Please login first."
                );

            }


            if (
                !currentPassword
            ) {

                throw new Error(
                    "Current password is required."
                );

            }


            if (
                String(
                    newPassword || ""
                ).length < 6
            ) {

                throw new Error(
                    "New password must contain at least 6 characters."
                );

            }


            const FB =
                await loadFirebase();


            if (
                typeof FB.EmailAuthProvider !==
                "function" ||
                typeof FB.reauthenticateWithCredential !==
                "function" ||
                typeof FB.updatePassword !==
                "function"
            ) {

                throw new Error(
                    "Password change service is not available in the current Firebase configuration."
                );

            }


            const email =
                firebaseUser.email;


            if (
                !email
            ) {

                throw new Error(
                    "Password change is available only for email accounts."
                );

            }


            try {

                const credential =
                    FB.EmailAuthProvider.credential(
                        email,
                        String(
                            currentPassword
                        )
                    );


                await FB.reauthenticateWithCredential(
                    firebaseUser,
                    credential
                );


                await FB.updatePassword(
                    firebaseUser,
                    String(
                        newPassword
                    )
                );


                AUTH.emit(
                    "password-changed"
                );


                return true;

            } catch (error) {

                throw new Error(
                    firebaseError(
                        error
                    )
                );

            }

        };


    /* ========================================================
       REQUIRE AUTH
    ======================================================== */

    AUTH.requireAuth =
        async function (
            options
        ) {

            options =
                isObject(options)
                    ? options
                    : {};


            await AUTH.waitForAuth();


            const firebaseUser =
                AUTH.state.firebaseUser;


            const user =
                AUTH.state.user;


            if (
                !firebaseUser ||
                !user
            ) {

                const target =
                    absoluteRoute(
                        options.loginRoute ||
                        ROUTES.login
                    );


                if (
                    window.location.pathname !==
                    target
                ) {

                    window.location.replace(
                        target
                    );

                }


                return false;

            }


            if (
                AUTH.isAccountBlocked(
                    user
                )
            ) {

                await AUTH.logout({

                    route:
                        options.blockedRoute ||
                        ROUTES.auth

                });


                return false;

            }


            return true;

        };


    /* ========================================================
       REQUIRE ROLE
    ======================================================== */

    AUTH.requireRole =
        async function (
            roles,
            options
        ) {

            options =
                isObject(options)
                    ? options
                    : {};


            await AUTH.waitForAuth();


            if (
                !AUTH.state.firebaseUser ||
                !AUTH.state.user
            ) {

                const target =
                    absoluteRoute(
                        options.loginRoute ||
                        ROUTES.login
                    );


                window.location.replace(
                    target
                );


                return false;

            }


            const allowedRoles =
                Array.isArray(
                    roles
                )
                    ? roles
                    : [roles];


            const normalizedAllowed =
                allowedRoles
                    .map(
                        role =>
                            AUTH.normalizeRole(
                                role
                            )
                    )
                    .filter(Boolean);


            const actualRole =
                AUTH.normalizeRole(
                    AUTH.state.role
                );


            if (
                !normalizedAllowed.includes(
                    actualRole
                )
            ) {

                const fallback =
                    options.fallback ||
                    AUTH.getRouteForUser(
                        AUTH.state.user,
                        ROUTES.auth
                    );


                window.location.replace(
                    absoluteRoute(
                        fallback
                    )
                );


                return false;

            }


            if (
                actualRole ===
                ROLES.RIDER
            ) {

                if (
                    AUTH.isAccountBlocked(
                        AUTH.state.user
                    )
                ) {

                    await AUTH.logout({

                        route:
                            ROUTES.auth

                    });


                    return false;

                }


                if (
                    AUTH.isAccountPending(
                        AUTH.state.user
                    ) ||
                    !AUTH.isRiderApproved(
                        AUTH.state.user
                    )
                ) {

                    const pending =
                        absoluteRoute(
                            ROUTES.pendingRider
                        );


                    if (
                        window.location.pathname !==
                        pending
                    ) {

                        window.location.replace(
                            pending
                        );

                    }


                    return false;

                }

            }


            return true;

        };


    /* ========================================================
       AUTO GUARD
    ======================================================== */

    AUTH.autoGuard =
        function () {

            if (
                !AUTH.state.authReady
            ) {

                return;

            }


            const firebaseUser =
                AUTH.state.firebaseUser;


            const user =
                AUTH.state.user;


            const role =
                AUTH.state.role;


            const path =
                currentPath();


            /*
             * Public pages.
             */

            if (
                !firebaseUser
            ) {

                if (
                    isCustomerPage() ||
                    isRiderPage() ||
                    isAdminPage()
                ) {

                    const target =
                        absoluteRoute(
                            ROUTES.login
                        );


                    if (
                        path !== target
                    ) {

                        window.location.replace(
                            target
                        );

                    }

                }


                return;

            }


            /*
             * Authenticated Firebase user without a valid
             * Firestore profile.
             */

            if (
                !user ||
                !role
            ) {

                if (
                    isCustomerPage() ||
                    isRiderPage() ||
                    isAdminPage()
                ) {

                    window.location.replace(
                        absoluteRoute(
                            ROUTES.auth
                        )
                    );

                }


                return;

            }


            /*
             * Admin.
             */

            if (
                AUTH.isAdminRole(
                    role
                )
            ) {

                if (
                    isCustomerPage() ||
                    isRiderPage()
                ) {

                    window.location.replace(
                        absoluteRoute(
                            ROUTES.admin
                        )
                    );

                }


                return;

            }


            /*
             * Rider.
             */

            if (
                role === ROLES.RIDER
            ) {

                if (
                    AUTH.isAccountBlocked(
                        user
                    )
                ) {

                    AUTH.logout({

                        route:
                            ROUTES.auth

                    });

                    return;

                }


                if (
                    AUTH.isAccountPending(
                        user
                    ) ||
                    !AUTH.isRiderApproved(
                        user
                    )
                ) {

                    const pending =
                        absoluteRoute(
                            ROUTES.pendingRider
                        );


                    if (
                        isRiderPage() &&
                        path !== pending
                    ) {

                        window.location.replace(
                            pending
                        );

                    } else if (
                        isCustomerPage() ||
                        isAdminPage()
                    ) {

                        window.location.replace(
                            pending
                        );

                    }


                    return;

                }


                if (
                    isCustomerPage() ||
                    isAdminPage()
                ) {

                    window.location.replace(
                        absoluteRoute(
                            ROUTES.rider
                        )
                    );

                }


                return;

            }


            /*
             * Customer.
             */

            if (
                role === ROLES.CUSTOMER
            ) {

                if (
                    isRiderPage() ||
                    isAdminPage()
                ) {

                    window.location.replace(
                        absoluteRoute(
                            ROUTES.customer
                        )
                    );

                }

            }

        };


    /* ========================================================
       SELECTED ROLE
    ======================================================== */

    AUTH.setSelectedRole =
        function (
            role
        ) {

            const normalized =
                AUTH.normalizeRole(
                    role
                );


            if (
                !NORMAL_USER_ROLES.includes(
                    normalized
                )
            ) {

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                return "";

            }


            safeStorageSet(
                STORAGE.selectedRole,
                normalized
            );


            AUTH.emit(
                "role-selected",
                {
                    role:
                        normalized
                }
            );


            return normalized;

        };


    AUTH.getSelectedRole =
        function () {

            return AUTH.normalizeRole(
                safeStorageGet(
                    STORAGE.selectedRole
                )
            );

        };


    /* ========================================================
       CANCEL OTP
    ======================================================== */

    AUTH.cancelOtp =
        function () {

            AUTH.phoneConfirmation =
                null;


            AUTH.clearOtpVerifier();


            safeStorageRemove(
                STORAGE.otpPhone
            );


            AUTH.emit(
                "otp-cancelled"
            );

        };


    /* ========================================================
       LOGOUT BUTTON BINDING
    ======================================================== */

    AUTH.bindLogout =
        function () {

            if (
                AUTH.state.logoutBound
            ) {

                return;

            }


            const selectors = [

                "[data-riderx-logout]",

                "#logoutBtn",

                "#logoutButton",

                ".logout-btn",

                ".logout-button"

            ];


            const buttons =
                document.querySelectorAll(
                    selectors.join(",")
                );


            buttons.forEach(
                function (button) {

                    if (
                        button.dataset.riderxLogoutBound ===
                        "true"
                    ) {

                        return;

                    }


                    button.dataset.riderxLogoutBound =
                        "true";


                    button.addEventListener(
                        "click",
                        async function (event) {

                            event.preventDefault();


                            try {

                                await AUTH.logout();

                            } catch (error) {

                                console.error(
                                    "RiderX logout failed:",
                                    error
                                );

                            }

                        }
                    );

                }
            );


            AUTH.state.logoutBound =
                true;

        };


    /* ========================================================
       RENDER USER
    ======================================================== */

    AUTH.renderUser =
        function () {

            const user =
                AUTH.getUser();


            if (
                !user
            ) {

                return null;

            }


            const name =
                cleanString(
                    user.name ||
                    user.fullName ||
                    user.displayName
                );


            const email =
                cleanString(
                    user.email
                );


            const phone =
                cleanString(
                    user.phone ||
                    user.phoneNumber
                );


            document
                .querySelectorAll(
                    "[data-riderx-user-name], [data-user-name], .user-name"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            name ||
                            "RiderX User";

                    }
                );


            document
                .querySelectorAll(
                    "[data-riderx-user-email], [data-user-email], .user-email"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            email;

                    }
                );


            document
                .querySelectorAll(
                    "[data-riderx-user-phone], [data-user-phone], .user-phone"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            phone;

                    }
                );


            return user;

        };


    /* ========================================================
       DESTROY
    ======================================================== */

    AUTH.destroy =
        function () {

            try {

                if (
                    typeof AUTH.state.unsubscribe ===
                    "function"
                ) {

                    AUTH.state.unsubscribe();

                }

            } catch (error) {
            }


            AUTH.state.unsubscribe =
                null;

            AUTH.state.listenerStarted =
                false;


            AUTH.cancelOtp();

        };


    /* ========================================================
       INIT
    ======================================================== */

    AUTH.init =
        async function () {

            if (
                AUTH.state.initialized
            ) {

                return AUTH.state;

            }


            if (
                AUTH.state.initializing
            ) {

                return (
                    AUTH.state.readyPromise ||
                    AUTH.state
                );

            }


            AUTH.state.initializing =
                true;


            try {

                /*
                 * Cached profile is only for immediate UI.
                 * It does not establish authentication.
                 */

                AUTH.renderUser();


                await AUTH.startListener();


                AUTH.state.initialized =
                    true;


                AUTH.bindLogout();


                return AUTH.state;

            } catch (error) {

                AUTH.state.authError =
                    error;


                AUTH.state.firebaseUser =
                    null;

                AUTH.state.user =
                    null;

                AUTH.state.role =
                    null;


                AUTH.clearSession();


                resolveAuthReady();


                AUTH.emit(
                    "auth-error",
                    {
                        error
                    }
                );


                /*
                 * Do not automatically redirect here.
                 * The page guard decides what to do.
                 */

                return AUTH.state;

            } finally {

                AUTH.state.initializing =
                    false;

            }

        };


    /* ========================================================
       COMPATIBILITY API
    ======================================================== */

    RX.login =
        function (
            email,
            password,
            selectedRole
        ) {

            return AUTH.loginEmail(
                email,
                password,
                selectedRole
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
            role,
            extraData
        ) {

            return AUTH.verifyOtp(
                otp,
                role,
                extraData
            );

        };


    RX.logout =
        function (
            options
        ) {

            return AUTH.logout(
                options
            );

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


    RX.requireAuth =
        function (
            options
        ) {

            return AUTH.requireAuth(
                options
            );

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


    RX.getProfile =
        function (
            firebaseUser
        ) {

            return AUTH.getProfile(
                firebaseUser ||
                AUTH.state.firebaseUser
            );

        };


    RX.updateProfile =
        function (
            updates
        ) {

            return AUTH.updateProfile(
                updates
            );

        };


    RX.resetPassword =
        function (
            email
        ) {

            return AUTH.resetPassword(
                email
            );

        };


    RX.changePassword =
        function (
            currentPassword,
            newPassword
        ) {

            return AUTH.changePassword(
                currentPassword,
                newPassword
            );

        };


    /* ========================================================
       GLOBAL INITIALIZATION
    ======================================================== */

    function boot() {

        AUTH.init()
            .catch(
                function (error) {

                    console.error(
                        "RiderX auth boot failed:",
                        error
                    );

                }
            );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once:
                    true
            }
        );

    } else {

        boot();

    }

})();
