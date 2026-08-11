/* ============================================================
   RIDERX 2.0
   AUTHENTICATION ENGINE
   File: js/auth.js

   RESPONSIBILITIES:
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
   - Compatibility API

   SECURITY:
   Firebase Authentication + Firestore Security Rules are
   the real security authority.

   localStorage is ONLY a UI/session cache.

   IMPORTANT:
   Firebase is initialized ONLY by:
       firebase/firebase-config.js

   This file NEVER initializes Firebase itself.
============================================================ */

"use strict";

(function () {

    /* =========================================================
       RIDERX GLOBAL NAMESPACE
    ========================================================= */

    if (
        typeof window === "undefined" ||
        typeof document === "undefined"
    ) {
        return;
    }

    window.RiderX =
        window.RiderX ||
        {};

    const RX =
        window.RiderX;

    const AUTH =
        RX.auth =
        RX.auth ||
        {};

    /* =========================================================
       STORAGE KEYS
    ========================================================= */

    const STORAGE =
        Object.freeze({

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

    /* =========================================================
       ROLES
    ========================================================= */

    const ROLES =
        Object.freeze({

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

    /* =========================================================
       ROUTES
    ========================================================= */

    const ROUTES =
        Object.freeze({

            customer:
                "customer/home.html",

            rider:
                "rider/home.html",

            admin:
                "admin/dashboard.html",

            auth:
                "auth/role.html"

        });

    /* =========================================================
       AUTH STATE
    ========================================================= */

    AUTH.state =
        AUTH.state ||
        {

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

            logoutBound:
                false,

            authError:
                null,

            listenerStarted:
                false,

            authEventVersion:
                0,

            readyPromise:
                null

        };

    AUTH.phoneConfirmation =
        null;

    AUTH.phoneVerifier =
        null;

    /* =========================================================
       FIREBASE MODULE
    ========================================================= */

    let Firebase =
        null;

    let firebaseLoadPromise =
        null;

    /* =========================================================
       BASIC HELPERS
    ========================================================= */

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

    function isBrowser() {

        return (
            typeof window !== "undefined" &&
            typeof document !== "undefined"
        );

    }

    function isObject(value) {

        return Boolean(
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        );

    }

    /* =========================================================
       SAFE STORAGE
    ========================================================= */

    function safeStorageGet(key) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (error) {

            console.warn(
                "RiderX storage read failed:",
                error
            );

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

            console.warn(
                "RiderX storage write failed:",
                error
            );

            return false;

        }

    }

    function safeStorageRemove(key) {

        try {

            localStorage.removeItem(
                key
            );

        } catch (error) {

            console.warn(
                "RiderX storage remove failed:",
                error
            );

        }

    }

    function parseStorageUser(key) {

        const raw =
            safeStorageGet(
                key
            );

        if (!raw) {
            return null;
        }

        try {

            const parsed =
                JSON.parse(
                    raw
                );

            if (
                isObject(parsed)
            ) {

                return parsed;

            }

        } catch (error) {

            console.warn(
                "Invalid RiderX stored session:",
                key
            );

        }

        safeStorageRemove(
            key
        );

        return null;

    }

    /* =========================================================
       FIREBASE ERROR NORMALIZATION
    ========================================================= */

    function firebaseError(error) {

        const code =
            safeLower(
                error?.code || ""
            );

        const rawMessage =
            cleanString(
                error?.message
            );

        const messages =
            {

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
                    "Security verification failed. Please try again.",

                "auth/missing-phone-number":
                    "Phone number is required.",

                "auth/session-expired":
                    "Your session has expired. Please login again.",

                "auth/user-disabled":
                    "This Firebase account has been disabled.",

                "auth/operation-not-allowed":
                    "This authentication method is not enabled in Firebase.",

                "auth/requires-recent-login":
                    "Please login again before changing this account information.",

                "auth/credential-already-in-use":
                    "This authentication account is already linked to another RiderX account.",

                "auth/provider-already-linked":
                    "This authentication method is already linked.",

                "auth/permission-denied":
                    "You do not have permission to access this RiderX profile.",

                "permission-denied":
                    "You do not have permission to access this RiderX profile.",

                "failed-precondition":
                    "RiderX profile service is temporarily unavailable.",

                "unavailable":
                    "RiderX service is temporarily unavailable. Please try again.",

                "deadline-exceeded":
                    "The request took too long. Please try again.",

                "not-found":
                    "The requested RiderX profile was not found."

            };

        if (
            messages[code]
        ) {

            return messages[code];

        }

        if (
            rawMessage &&
            !rawMessage.toLowerCase().includes(
                "firebase"
            )
        ) {

            return rawMessage;

        }

        return (
            rawMessage ||
            "RiderX authentication failed."
        );

    }

    /* =========================================================
       FIREBASE MODULE LOADER
       ---------------------------------------------------------
       firebase/firebase-config.js remains the ONLY Firebase
       initialization point.
    ========================================================= */

    function loadFirebase() {

        if (Firebase) {

            return Promise.resolve(
                Firebase
            );

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

                        const required =
                            [

                                "auth",
                                "db",

                                "doc",
                                "getDoc",
                                "setDoc",

                                "onAuthStateChanged",

                                "signInWithEmailAndPassword",
                                "createUserWithEmailAndPassword",

                                "signOut",

                                "updateProfile",

                                "sendPasswordResetEmail"

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
       APPLICATION ROOT DETECTION
    ========================================================= */

    function getApplicationRoot() {

        if (!isBrowser()) {
            return "";
        }

        const pathname =
            window.location.pathname ||
            "/";

        const normalizedPath =
            pathname
                .replace(
                    /\/+/g,
                    "/"
                );

        const knownFolders =
            [
                "/auth/",
                "/customer/",
                "/rider/",
                "/admin/"
            ];

        for (
            const folder of knownFolders
        ) {

            const index =
                normalizedPath.indexOf(
                    folder
                );

            if (
                index !== -1
            ) {

                return normalizedPath.slice(
                    0,
                    index
                );

            }

        }

        if (
            normalizedPath === "/" ||
            normalizedPath.endsWith(
                "/index.html"
            )
        ) {

            if (
                normalizedPath.endsWith(
                    "/index.html"
                )
            ) {

                return normalizedPath
                    .slice(
                        0,
                        normalizedPath.length -
                        "index.html".length
                    )
                    .replace(
                        /\/$/,
                        ""
                    );

            }

            return "";

        }

        const lastSlash =
            normalizedPath.lastIndexOf(
                "/"
            );

        if (
            lastSlash <= 0
        ) {

            return "";

        }

        return normalizedPath.slice(
            0,
            lastSlash
        );

    }

    /* =========================================================
       ROUTE URL
    ========================================================= */

    function routeUrl(route) {

        const path =
            cleanString(
                route
            )
                .replace(
                    /^\/+/,
                    ""
                );

        if (!isBrowser()) {
            return path;
        }

        const root =
            getApplicationRoot();

        const normalizedRoot =
            root
                ? root.replace(
                    /\/+$/,
                    ""
                ) + "/"
                : "/";

        return (
            normalizedRoot +
            path
        );

    }

    /* =========================================================
       ROLE NORMALIZATION
    ========================================================= */

    AUTH.normalizeRole =
        function (role) {

            const value =
                safeLower(
                    role
                )
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
                ].includes(
                    value
                )
            ) {

                return ROLES.RIDER;

            }

            if (
                [
                    "customer",
                    "customers",
                    "user",
                    "users"
                ].includes(
                    value
                )
            ) {

                return ROLES.CUSTOMER;

            }

            if (
                [
                    "admin",
                    "administrator"
                ].includes(
                    value
                )
            ) {

                return ROLES.ADMIN;

            }

            if (
                [
                    "superadmin",
                    "super_admin",
                    "superadministrator"
                ].includes(
                    value
                )
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

    /* =========================================================
       STORED ROLE
       ---------------------------------------------------------
       ONLY UI FALLBACK.
       NEVER considered Firebase authentication authority.
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
                    AUTH.isAdminRole(
                        role
                    )
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
       ---------------------------------------------------------
       While Firebase auth is active, state.role is preferred.
       Stored role is only a UI fallback when auth state has not
       yet completed.
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

            if (
                !AUTH.state.authReady
            ) {

                return AUTH.getStoredRole();

            }

            /*
             * Once Firebase auth is ready and no authoritative
             * role exists, do not continue trusting cached role.
             */

            if (
                AUTH.state.firebaseUser
            ) {

                return "";

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
                !isObject(user)
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

            const sessionUser =
                {

                    uid:
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

                    uid:
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

                        uid:
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

            AUTH.state.authError =
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

            const baseProfile =
                {

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

            const userRef =
                FB.doc(
                    FB.db,
                    "users",
                    firebaseUser.uid
                );

            try {

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
                        cleanString(
                            data.email
                        ) ||
                        baseProfile.email,

                    displayName:
                        cleanString(
                            data.displayName
                        ) ||
                        baseProfile.displayName,

                    name:
                        cleanString(
                            data.name
                        ) ||
                        cleanString(
                            data.displayName
                        ) ||
                        baseProfile.name,

                    phone:
                        cleanString(
                            data.phone
                        ) ||
                        cleanString(
                            data.phoneNumber
                        ) ||
                        baseProfile.phone,

                    phoneNumber:
                        cleanString(
                            data.phoneNumber
                        ) ||
                        cleanString(
                            data.phone
                        ) ||
                        baseProfile.phoneNumber,

                    photoURL:
                        cleanString(
                            data.photoURL
                        ) ||
                        baseProfile.photoURL

                };

            } catch (error) {

                console.error(
                    "RiderX user profile read failed:",
                    error
                );

                throw error;

            }

        };

    /* =========================================================
       ROLE RESOLUTION
       ---------------------------------------------------------
       RETURN VALUES:
         ""      = profile exists but no role configured
         role    = valid role
         null    = Firebase/Firestore read failed

       This distinction prevents a temporary Firestore/network
       failure from being incorrectly treated as "no role".
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

                return null;

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
                ].includes(
                    status
                )
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
                    result?.user;

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

                    await safeFirebaseSignOut(
                        FB
                    );

                    throw new Error(
                        "This RiderX account has been disabled."
                    );

                }

                const role =
                    await AUTH.resolveRole(
                        firebaseUser
                    );

                if (
                    role === null
                ) {

                    await safeFirebaseSignOut(
                        FB
                    );

                    AUTH.clearSession();

                    throw new Error(
                        "Unable to verify your RiderX profile. Please check your connection and try again."
                    );

                }

                if (!role) {

                    await safeFirebaseSignOut(
                        FB
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
                    firebaseError(
                        error
                    )
                );

            } finally {

                AUTH.state.loading =
                    false;

            }

        };

    /* =========================================================
       EMAIL REGISTRATION
    ========================================================= */

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
                    result?.user;

                if (!createdUser) {

                    throw new Error(
                        "Firebase registration failed."
                    );

                }

                if (
                    name &&
                    typeof FB.updateProfile ===
                    "function"
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

                const profile =
                    {

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

                if (
                    createdUser &&
                    typeof FB.signOut ===
                    "function"
                ) {

                    try {

                        await FB.signOut(
                            FB.auth
                        );

                    } catch (
                        signOutError
                    ) {

                        console.warn(
                            "RiderX registration cleanup failed:",
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
                    firebaseError(
                        error
                    )
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

                return "+" +
                    digits;

            }

            const digits =
                phone.replace(
                    /\D/g,
                    ""
                );

            if (
                digits.length === 10
            ) {

                return (
                    "+91" +
                    digits
                );

            }

            if (
                digits.startsWith("91") &&
                digits.length === 12
            ) {

                return (
                    "+" +
                    digits
                );

            }

            if (
                digits.length >= 10 &&
                digits.length <= 15
            ) {

                return "+" +
                    digits;

            }

            return "";

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

            if (
                !container
            ) {

                throw new Error(
                    "OTP verification container is required."
                );

            }

            const FB =
                await loadFirebase();

            /*
             * A previous verifier/confirmation must never remain
             * active when requesting another OTP.
             */

            AUTH.phoneConfirmation =
                null;

            AUTH.clearOtpVerifier();

            let verifier =
                null;

            try {

                /*
                 * Compatibility:
                 * If caller supplies an already-created verifier,
                 * use it directly.
                 */

                if (
                    typeof container === "object" &&
                    typeof container.verify ===
                    "function"
                ) {

                    verifier =
                        container;

                } else {

                    if (
                        typeof FB.RecaptchaVerifier !==
                        "function"
                    ) {

                        throw new Error(
                            "Firebase phone verification is not configured correctly."
                        );

                    }

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

                if (
                    verifier &&
                    typeof verifier.render ===
                    "function"
                ) {

                    try {

                        await verifier.render();

                    } catch (renderError) {

                        console.warn(
                            "RiderX reCAPTCHA render warning:",
                            renderError
                        );

                    }

                }

                if (
                    typeof FB.signInWithPhoneNumber !==
                    "function"
                ) {

                    throw new Error(
                        "Firebase phone authentication is not available in firebase-config.js."
                    );

                }

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

                AUTH.clearOtpVerifier();

                console.error(
                    "RiderX OTP send failed:",
                    error
                );

                throw new Error(
                    firebaseError(
                        error
                    )
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

                const confirmation =
                    AUTH.phoneConfirmation;

                const result =
                    await confirmation.confirm(
                        otp
                    );

                const firebaseUser =
                    result?.user;

                const isNewPhoneUser =
                    Boolean(
                        result?.additionalUserInfo?.isNewUser
                    );

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

                    await safeFirebaseSignOut(
                        FB
                    );

                    throw new Error(
                        "This RiderX account has been disabled."
                    );

                }

                let resolvedRole =
                    await AUTH.resolveRole(
                        firebaseUser
                    );

                /*
                 * A temporary Firestore failure must NOT be treated
                 * as a missing role.
                 */

                if (
                    resolvedRole === null
                ) {

                    await safeFirebaseSignOut(
                        FB
                    );

                    AUTH.clearSession();

                    throw new Error(
                        "Unable to verify your RiderX profile. Please check your connection and try again."
                    );

                }

                /*
                 * Only a genuinely new phone account may use the
                 * requested/selected normal-user role.
                 */

                if (
                    !resolvedRole &&
                    isNewPhoneUser
                ) {

                    const requestedRole =
                        AUTH.normalizeRole(
                            role
                        );

                    if (
                        NORMAL_USER_ROLES.includes(
                            requestedRole
                        )
                    ) {

                        resolvedRole =
                            requestedRole;

                    }

                }

                if (
                    !resolvedRole &&
                    isNewPhoneUser
                ) {

                    const selectedRole =
                        AUTH.normalizeRole(
                            safeStorageGet(
                                STORAGE.selectedRole
                            )
                        );

                    if (
                        NORMAL_USER_ROLES.includes(
                            selectedRole
                        )
                    ) {

                        resolvedRole =
                            selectedRole;

                    }

                }

                if (!resolvedRole) {

                    await safeFirebaseSignOut(
                        FB
                    );

                    AUTH.clearSession();

                    throw new Error(
                        "Your RiderX role is not configured. Please select Customer or Rider during registration."
                    );

                }

                const phone =
                    AUTH.normalizePhone(
                        profile.phone ||
                        profile.phoneNumber ||
                        firebaseUser.phoneNumber ||
                        safeStorageGet(
                            STORAGE.otpPhone
                        ) ||
                        ""
                    );

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

                /*
                 * New profile defaults.
                 * Existing fields are preserved through merge.
                 */

                const profileUpdate =
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

                        status:
                            profile.status ||
                            "active",

                        updatedAt:
                            Date.now()

                    };

                if (
                    !profile.createdAt
                ) {

                    profileUpdate.createdAt =
                        Date.now();

                }

                if (
                    !profile.city
                ) {

                    profileUpdate.city =
                        "Chandigarh";

                }

                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    ),
                    profileUpdate,
                    {
                        merge:
                            true
                    }
                );

                AUTH.state.firebaseUser =
                    firebaseUser;

                const savedUser =
                    AUTH.saveSession(
                        profileUpdate,
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
                    firebaseError(
                        error
                    )
                );

            } finally {

                AUTH.state.loading =
                    false;

            }

        };

    /* =========================================================
       FIREBASE SAFE SIGN OUT
    ========================================================= */

    async function safeFirebaseSignOut(FB) {

        if (
            !FB ||
            !FB.auth ||
            typeof FB.signOut !==
            "function"
        ) {

            return false;

        }

        try {

            await FB.signOut(
                FB.auth
            );

            return true;

        } catch (error) {

            console.warn(
                "RiderX Firebase sign-out failed:",
                error
            );

            return false;

        }

    }

    /* =========================================================
       LOGOUT
    ========================================================= */

    AUTH.logout =
        async function () {

            AUTH.state.loading =
                true;

            let firebaseLogoutSucceeded =
                false;

            try {

                const FB =
                    await loadFirebase();

                firebaseLogoutSucceeded =
                    await safeFirebaseSignOut(
                        FB
                    );

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

                AUTH.state.authError =
                    null;

                AUTH.state.loading =
                    false;

                AUTH.emit(
                    "logout"
                );

                if (
                    isBrowser()
                ) {

                    const destination =
                        routeUrl(
                            ROUTES.auth
                        );

                    let destinationPath =
                        destination;

                    try {

                        destinationPath =
                            new URL(
                                destination,
                                window.location.origin
                            ).pathname;

                    } catch (error) {

                        console.warn(
                            "RiderX logout destination normalization failed:",
                            error
                        );

                    }

                    if (
                        window.location.pathname !==
                        destinationPath
                    ) {

                        window.location.replace(
                            destination
                        );

                    }

                }

            }

            return firebaseLogoutSucceeded;

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

            if (
                typeof FB.onAuthStateChanged !==
                "function"
            ) {

                throw new Error(
                    "Firebase auth-state listener is not available."
                );

            }

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

                        AUTH.state.firebaseUser =
                            firebaseUser;

                        if (!firebaseUser) {

                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;

                            AUTH.state.authError =
                                null;

                            AUTH.state.authReady =
                                true;

                            AUTH.emit(
                                "signed-out"
                            );

                            AUTH.emit(
                                "ready"
                            );

                            return;

                        }

                        try {

                            const profile =
                                await AUTH.getProfile(
                                    firebaseUser
                                );

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }

                            if (
                                AUTH.isAccountBlocked(
                                    profile
                                )
                            ) {

                                await safeFirebaseSignOut(
                                    FB
                                );

                                if (
                                    eventVersion !==
                                    AUTH.state.authEventVersion
                                ) {

                                    return;

                                }

                                AUTH.clearSession();

                                AUTH.state.authReady =
                                    true;

                                AUTH.emit(
                                    "signed-out"
                                );

                                AUTH.emit(
                                    "ready"
                                );

                                return;

                            }

                            const role =
                                await AUTH.resolveRole(
                                    firebaseUser
                                );

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }

                            /*
                             * Firestore/network error:
                             * keep Firebase authentication known, but do
                             * NOT trust cached role as authoritative.
                             */

                            if (
                                role === null
                            ) {

                                AUTH.state.authError =
                                    new Error(
                                        "Unable to verify the RiderX profile."
                                    );

                                AUTH.state.authReady =
                                    true;

                                AUTH.state.user =
                                    null;

                                AUTH.state.role =
                                    null;

                                AUTH.emit(
                                    "auth-error",
                                    {
                                        error:
                                            AUTH.state.authError
                                    }
                                );

                                AUTH.emit(
                                    "ready"
                                );

                                return;

                            }

                            /*
                             * Firebase user exists but no role exists.
                             */

                            if (!role) {

                                AUTH.state.user =
                                    null;

                                AUTH.state.role =
                                    null;

                                AUTH.state.authError =
                                    new Error(
                                        "RiderX account role is not configured."
                                    );

                                AUTH.state.authReady =
                                    true;

                                AUTH.emit(
                                    "auth-error",
                                    {
                                        error:
                                            AUTH.state.authError
                                    }
                                );

                                await safeFirebaseSignOut(
                                    FB
                                );

                                if (
                                    eventVersion !==
                                    AUTH.state.authEventVersion
                                ) {

                                    return;

                                }

                                AUTH.clearSession();

                                AUTH.emit(
                                    "signed-out"
                                );

                                AUTH.emit(
                                    "ready"
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

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }

                            AUTH.state.firebaseUser =
                                firebaseUser;

                            AUTH.state.authError =
                                null;

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

                            AUTH.emit(
                                "ready"
                            );

                            AUTH.renderUser();

                        } catch (error) {

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }

                            AUTH.state.authReady =
                                true;

                            AUTH.state.authError =
                                error;

                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;

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

                            /*
                             * Never silently use an old cached role
                             * after Firebase profile verification failed.
                             */

                            AUTH.emit(
                                "ready"
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

            if (
                AUTH.state.readyPromise
            ) {

                return AUTH.state.readyPromise;

            }

            const waitTime =
                Math.max(
                    1000,
                    Number(
                        timeout
                    ) ||
                    10000
                );

            AUTH.state.readyPromise =
                new Promise(
                    function (
                        resolve
                    ) {

                        let finished =
                            false;

                        let timer =
                            null;

                        const complete =
                            function () {

                                if (
                                    finished
                                ) {

                                    return;

                                }

                                finished =
                                    true;

                                window.removeEventListener(
                                    "riderx-auth-ready",
                                    readyHandler
                                );

                                if (timer) {

                                    clearTimeout(
                                        timer
                                    );

                                }

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
                            readyHandler
                        );

                        /*
                         * Check once more after attaching the
                         * listener to close the event-registration
                         * race.
                         */

                        if (
                            AUTH.state.authReady
                        ) {

                            complete();

                            return;

                        }

                        timer =
                            setTimeout(
                                complete,
                                waitTime
                            );

                    }
                )
                    .finally(
                        function () {

                            AUTH.state.readyPromise =
                                null;

                        }
                    );

            return AUTH.state.readyPromise;

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
                AUTH.getRole() === wanted &&
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
                isObject(options)
                    ? options
                    : {};

            const allowed =
                Array.isArray(
                    roles
                )
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

            if (
                !allowed.length
            ) {

                if (
                    options.redirect !== false
                ) {

                    AUTH.redirectByRole(
                        options.fallback
                    );

                }

                return false;

            }

            try {

                await AUTH.waitForAuth(
                    options.timeout ||
                    10000
                );

            } catch (error) {

                console.error(
                    "RiderX auth guard failed:",
                    error
                );

            }

            const current =
                AUTH.normalizeRole(
                    AUTH.state.role
                );

            if (
                AUTH.isLoggedIn() &&
                allowed.includes(
                    current
                )
            ) {

                return true;

            }

            if (
                options.redirect !== false
            ) {

                /*
                 * If a Firebase user exists but role/profile
                 * verification failed, never redirect using a
                 * stale cached role.
                 */

                if (
                    AUTH.state.firebaseUser &&
                    !current
                ) {

                    AUTH.redirectByRole(
                        ROUTES.auth
                    );

                } else {

                    AUTH.redirectByRole(
                        options.fallback
                    );

                }

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
                    AUTH.state.role
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

            if (
                !isBrowser()
            ) {

                return routeUrl(
                    target
                );

            }

            const destination =
                routeUrl(
                    target
                );

            let destinationPath =
                destination;

            try {

                destinationPath =
                    new URL(
                        destination,
                        window.location.origin
                    ).pathname;

            } catch (error) {

                console.warn(
                    "RiderX destination URL normalization failed:",
                    error
                );

            }

            const currentPath =
                window.location.pathname;

            if (
                currentPath !==
                destinationPath
            ) {

                window.location.replace(
                    destination
                );

            }

            return destination;

        };

    /* =========================================================
       UPDATE PROFILE
    ========================================================= */

    AUTH.updateProfile =
        async function (
            updates
        ) {

            updates =
                isObject(updates)
                    ? {
                        ...updates
                    }
                    : {};

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
                typeof FB.updateProfile ===
                "function"
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

            const firestoreUpdates =
                {
                    ...updates,

                    updatedAt:
                        Date.now()
                };

            /*
             * These fields are protected from normal client-side
             * profile updates.
             */

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
                "adminApproved",
                "createdAt"
            ].forEach(
                function (key) {

                    delete firestoreUpdates[
                        key
                    ];

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
                AUTH.state.role ||
                "";

            const updated =
                {

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

                console.error(
                    "RiderX password reset failed:",
                    error
                );

                throw new Error(
                    firebaseError(
                        error
                    )
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

            if (
                !isBrowser()
            ) {

                return;

            }

            const eventName =
                "riderx-auth-" +
                cleanString(
                    name
                );

            window.dispatchEvent(
                new CustomEvent(
                    eventName,
                    {
                        detail:
                            detail ||
                            {}
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
                ].includes(
                    name
                )
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

            const eventName =
                "riderx-auth-" +
                cleanString(
                    name
                );

            const handler =
                function (
                    event
                ) {

                    callback(
                        event.detail ||
                        {}
                    );

                };

            window.addEventListener(
                eventName,
                handler
            );

            return function () {

                window.removeEventListener(
                    eventName,
                    handler
                );

            };

        };

    /* =========================================================
       RENDER USER
    ========================================================= */

    AUTH.renderUser =
        function () {

            if (
                !isBrowser()
            ) {

                return;

            }

            const user =
                AUTH.getUser();

            if (!user) {
                return;
            }

            const role =
                AUTH.getRole();

            const displayName =
                cleanString(
                    user.name ||
                    user.displayName ||
                    user.fullName
                ) ||
                "User";

            document
                .querySelectorAll(
                    "[data-user-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            displayName;

                    }
                );

            document
                .querySelectorAll(
                    "[data-user-email]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            cleanString(
                                user.email
                            );

                    }
                );

            document
                .querySelectorAll(
                    "[data-user-phone]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            cleanString(
                                user.phone ||
                                user.phoneNumber
                            );

                    }
                );

            document
                .querySelectorAll(
                    "[data-user-role]"
                )
                .forEach(
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

                        if (
                            user.photoURL
                        ) {

                            if (
                                "src" in element
                            ) {

                                element.src =
                                    user.photoURL;

                            } else {

                                element.style.backgroundImage =
                                    "url(\"" +
                                    user.photoURL.replace(
                                        /"/g,
                                        "%22"
                                    ) +
                                    "\")";

                            }

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
                function (
                    event
                ) {

                    const target =
                        event.target;

                    if (
                        !target ||
                        typeof target.closest !==
                        "function"
                    ) {

                        return;

                    }

                    const button =
                        target.closest(
                            "[data-logout]"
                        );

                    if (!button) {
                        return;
                    }

                    event.preventDefault();

                    /*
                     * Prevent accidental double logout clicks.
                     */

                    if (
                        button.dataset.riderxLogoutBusy ===
                        "true"
                    ) {

                        return;

                    }

                    button.dataset.riderxLogoutBusy =
                        "true";

                    Promise.resolve(
                        AUTH.logout()
                    )
                        .catch(
                            function (error) {

                                console.error(
                                    "RiderX logout error:",
                                    error
                                );

                            }
                        )
                        .finally(
                            function () {

                                button.dataset.riderxLogoutBusy =
                                    "false";

                            }
                        );

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

                return AUTH.state;

            }

            if (
                AUTH.state.initializing
            ) {

                return AUTH.state;

            }

            AUTH.state.initializing =
                true;

            try {

                AUTH.bindLogout();

                /*
                 * Cached profile is rendered only for UI continuity.
                 * It never authenticates or authorizes the user.
                 */

                AUTH.renderUser();

                await AUTH.startListener();

                AUTH.state.initialized =
                    true;

                console.info(
                    "RiderX authentication engine initialized."
                );

            } catch (error) {

                AUTH.state.authReady =
                    true;

                AUTH.state.authError =
                    error;

                AUTH.state.user =
                    null;

                AUTH.state.role =
                    null;

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

                AUTH.emit(
                    "ready"
                );

            } finally {

                AUTH.state.initializing =
                    false;

            }

            return AUTH.state;

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
       ADDITIONAL COMPATIBILITY METHODS
    ========================================================= */

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

    RX.hasRole =
        function (
            role
        ) {

            return AUTH.hasRole(
                role
            );

        };

    RX.normalizePhone =
        function (
            phone
        ) {

            return AUTH.normalizePhone(
                phone
            );

        };

    RX.normalizeRole =
        function (
            role
        ) {

            return AUTH.normalizeRole(
                role
            );

        };

    /* =========================================================
       PUBLIC CONSTANTS
    ========================================================= */

    AUTH.ROLES =
        ROLES;

    AUTH.STORAGE_KEYS =
        STORAGE;

    AUTH.ROUTES =
        ROUTES;

    RX.auth.ROLES =
        ROLES;

    RX.auth.STORAGE_KEYS =
        STORAGE;

    RX.auth.ROUTES =
        ROUTES;

    /* =========================================================
       AUTO INITIALIZATION
    ========================================================= */

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

})();
