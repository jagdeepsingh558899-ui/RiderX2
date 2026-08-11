/* ============================================================
RIDERX 2.0
AUTHENTICATION ENGINE
File: js/auth.js

FINAL CUSTOMER/RIDER AUTH FLOW

- Firebase Authentication
- Customer / Rider / Admin role resolution
- Email login / registration
- Phone OTP
- Firestore user profiles
- Firebase auth-state listener
- UI-only localStorage cache
- Route guards
- Logout
- Password reset
- Profile update
- User rendering
- Compatibility API

SECURITY:
Firebase Authentication + Firestore Security Rules remain
the real security authority.

localStorage is ONLY a UI/session cache.
============================================================ */

"use strict";

(function () {

    if (
        typeof window === "undefined" ||
        typeof document === "undefined"
    ) {
        return;
    }

    /* =========================================================
       GLOBAL NAMESPACE
    ========================================================= */

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;
    const AUTH = RX.auth = RX.auth || {};

    /* =========================================================
       STORAGE
    ========================================================= */

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

    /* =========================================================
       ROLES
    ========================================================= */

    const ROLES = Object.freeze({

        CUSTOMER: "customer",
        RIDER: "rider",
        ADMIN: "admin",
        SUPERADMIN: "superadmin"

    });

    const NORMAL_USER_ROLES = Object.freeze([

        ROLES.CUSTOMER,
        ROLES.RIDER

    ]);

    /* =========================================================
       ROUTES
    ========================================================= */

    const ROUTES = Object.freeze({

        customer: "customer/home.html",
        rider: "rider/home.html",
        admin: "admin/dashboard.html",
        superadmin: "admin/dashboard.html",
        auth: "auth/role.html",
        login: "auth/login.html",
        pendingRider: "rider/pending.html"

    });

    /* =========================================================
       AUTH STATE
    ========================================================= */

    AUTH.state = AUTH.state || {

        initialized: false,
        initializing: false,
        loading: false,

        authReady: false,

        user: null,
        role: null,
        firebaseUser: null,

        unsubscribe: null,

        logoutBound: false,

        authError: null,

        listenerStarted: false,

        authEventVersion: 0,

        readyPromise: null,

        lastResolvedUid: null

    };

    /* =========================================================
       FIREBASE REFERENCES
    ========================================================= */

    let Firebase = null;
    let firebaseLoadPromise = null;

    AUTH.phoneConfirmation = null;
    AUTH.phoneVerifier = null;

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

    function isObject(value) {

        return Boolean(
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        );

    }

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

            if (isObject(parsed)) {

                return parsed;

            }

        } catch (error) {

            console.warn(
                "Invalid RiderX stored session:",
                key
            );

        }

        safeStorageRemove(key);

        return null;

    }

    /* =========================================================
       ERROR NORMALIZATION
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

        if (messages[code]) {

            return messages[code];

        }

        if (
            rawMessage &&
            !rawMessage
                .toLowerCase()
                .includes("firebase")
        ) {

            return rawMessage;

        }

        return (
            rawMessage ||
            "RiderX authentication failed."
        );

    }

    /* =========================================================
       FIREBASE LOADER
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
                .then(function (module) {

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

                        "signOut",

                        "updateProfile",
                        "sendPasswordResetEmail"

                    ];

                    const missing =
                        required.filter(
                            function (name) {

                                return typeof module[name] ===
                                    "undefined";

                            }
                        );

                    if (missing.length) {

                        throw new Error(
                            "RiderX Firebase module is missing: " +
                            missing.join(", ")
                        );

                    }

                    Firebase =
                        module;

                    return Firebase;

                })
                .catch(function (error) {

                    firebaseLoadPromise =
                        null;

                    console.error(
                        "RiderX Firebase module load failed:",
                        error
                    );

                    throw error;

                });

        return firebaseLoadPromise;

    }

    /* =========================================================
       APPLICATION ROOT
    ========================================================= */

    function getApplicationRoot() {

        if (!isBrowser()) {
            return "";
        }

        const pathname =
            window.location.pathname || "/";

        const normalized =
            pathname.replace(
                /\/+/g,
                "/"
            );

        const knownFolders = [

            "/auth/",
            "/customer/",
            "/rider/",
            "/admin/"

        ];

        for (const folder of knownFolders) {

            const index =
                normalized.indexOf(folder);

            if (index !== -1) {

                return normalized.slice(
                    0,
                    index
                );

            }

        }

        if (
            normalized === "/" ||
            normalized.endsWith("/index.html")
        ) {

            if (
                normalized.endsWith("/index.html")
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

        return "";

    }

    function absoluteRoute(route) {

        const root =
            getApplicationRoot();

        const cleanRoute =
            cleanString(route)
                .replace(/^\/+/, "");

        if (!cleanRoute) {

            return (
                root
                    ? "/" + root
                    : "/"
            );

        }

        return (
            root
                ? "/" + root + "/" + cleanRoute
                : "/" + cleanRoute
        );

    }

    function currentPath() {

        if (!isBrowser()) {
            return "";
        }

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

    /* =========================================================
       ROLE NORMALIZATION
    ========================================================= */

    AUTH.normalizeRole =
        function (role) {

            const value =
                safeLower(role)
                    .replace(
                        /[\s_-]+/g,
                        ""
                    );

            if (
                value === "customer" ||
                value === "user" ||
                value === "passenger" ||
                value === "client"
            ) {

                return ROLES.CUSTOMER;

            }

            if (
                value === "rider" ||
                value === "driver" ||
                value === "captain"
            ) {

                return ROLES.RIDER;

            }

            if (
                value === "admin" ||
                value === "administrator"
            ) {

                return ROLES.ADMIN;

            }

            if (
                value === "superadmin" ||
                value === "superadministrator"
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
                normalized ===
                    ROLES.ADMIN ||
                normalized ===
                    ROLES.SUPERADMIN
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

            const legacy =
                AUTH.normalizeRole(
                    safeStorageGet(
                        STORAGE.legacyRole
                    )
                );

            if (legacy) {

                return legacy;

            }

            const storedUser =
                AUTH.getStoredUser();

            return AUTH.normalizeRole(
                storedUser?.role ||
                storedUser?.userRole ||
                storedUser?.accountType
            );

        };

    /* =========================================================
       STORED USER
    ========================================================= */

    AUTH.getStoredUser =
        function () {

            const primary =
                parseStorageUser(
                    STORAGE.user
                );

            if (primary) {

                return primary;

            }

            const role =
                AUTH.getStoredRole();

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
                role === ROLES.ADMIN ||
                role === ROLES.SUPERADMIN
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
                (
                    !AUTH.state.authReady
                        ? AUTH.getStoredUser()
                        : null
                ) ||
                null
            );

        };

    /* =========================================================
       CURRENT ROLE
    ========================================================= */

    AUTH.getRole =
        function () {

            return (
                AUTH.state.role ||
                AUTH.normalizeRole(
                    AUTH.state.user?.role
                ) ||
                (
                    !AUTH.state.authReady
                        ? AUTH.getStoredRole()
                        : ""
                ) ||
                ""
            );

        };

    /* =========================================================
       CURRENT UID
    ========================================================= */

    AUTH.getUid =
        function () {

            return (
                AUTH.state.firebaseUser?.uid ||
                AUTH.state.user?.uid ||
                AUTH.state.user?.id ||
                AUTH.state.user?.userId ||
                (
                    !AUTH.state.authReady
                        ? (
                            AUTH.getStoredUser()?.uid ||
                            AUTH.getStoredUser()?.id ||
                            AUTH.getStoredUser()?.userId ||
                            ""
                        )
                        : ""
                ) ||
                ""
            );

        };

    /* =========================================================
       EMAIL
    ========================================================= */

    AUTH.getEmail =
        function () {

            return (
                AUTH.state.firebaseUser?.email ||
                (
                    !AUTH.state.authReady
                        ? AUTH.getUser()?.email
                        : ""
                ) ||
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

            if (!isObject(user)) {

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

                uid: uid,
                id: uid,
                userId: uid,

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

            safeStorageSet(
                STORAGE.role,
                normalizedRole
            );

            safeStorageSet(
                STORAGE.session,
                JSON.stringify({

                    uid:
                        sessionUser.uid,

                    role:
                        normalizedRole,

                    email:
                        sessionUser.email,

                    timestamp:
                        Date.now()

                })
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

                safeStorageRemove(
                    STORAGE.rider
                );

                safeStorageRemove(
                    STORAGE.admin
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

                safeStorageRemove(
                    STORAGE.customer
                );

                safeStorageRemove(
                    STORAGE.admin
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
                            sessionUser.uid,

                        email:
                            sessionUser.email,

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
       GET FIRESTORE USER PROFILE
    ========================================================= */

    AUTH.getProfile =
        async function (
            firebaseUser
        ) {

            if (!firebaseUser?.uid) {

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
                    snapshot.data() || {};

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
       ROLE COLLECTION LOOKUP
    ========================================================= */

    async function readRoleFromCollection(
        collectionName,
        uid
    ) {

        if (!uid) {

            return null;

        }

        const FB =
            await loadFirebase();

        try {

            const ref =
                FB.doc(
                    FB.db,
                    collectionName,
                    uid
                );

            const snapshot =
                await FB.getDoc(
                    ref
                );

            if (
                !snapshot.exists()
            ) {

                return null;

            }

            const data =
                snapshot.data() || {};

            const role =
                AUTH.normalizeRole(
                    data.role ||
                    data.userRole ||
                    data.accountType ||
                    (
                        collectionName ===
                        "customers"
                            ? ROLES.CUSTOMER
                            : ""
                    ) ||
                    (
                        collectionName ===
                        "riders"
                            ? ROLES.RIDER
                            : ""
                    ) ||
                    (
                        collectionName ===
                        "admins"
                            ? ROLES.ADMIN
                            : ""
                    )
                );

            if (role) {

                return {

                    role:
                        role,

                    data:
                        data

                };

            }

        } catch (error) {

            console.warn(
                "RiderX role collection lookup skipped:",
                collectionName,
                error
            );

        }

        return null;

    }

    /* =========================================================
       RESOLVE ROLE
    ========================================================= */

    AUTH.resolveRole =
        async function (
            user,
            options
        ) {

            options =
                isObject(options)
                    ? options
                    : {};

            if (!user?.uid) {

                return "";

            }

            const FB =
                await loadFirebase();

            const uid =
                user.uid;

            try {

                const userRef =
                    FB.doc(
                        FB.db,
                        "users",
                        uid
                    );

                const snapshot =
                    await FB.getDoc(
                        userRef
                    );

                if (
                    snapshot.exists()
                ) {

                    const data =
                        snapshot.data() ||
                        {};

                    const role =
                        AUTH.normalizeRole(
                            data.role ||
                            data.userRole ||
                            data.accountType
                        );

                    if (role) {

                        return role;

                    }

                }

            } catch (error) {

                console.error(
                    "RiderX primary role resolution failed:",
                    error
                );

                return null;

            }

            const customerProfile =
                await readRoleFromCollection(
                    "customers",
                    uid
                );

            if (
                customerProfile?.role
            ) {

                return customerProfile.role;

            }

            const riderProfile =
                await readRoleFromCollection(
                    "riders",
                    uid
                );

            if (
                riderProfile?.role
            ) {

                return riderProfile.role;

            }

            const adminProfile =
                await readRoleFromCollection(
                    "admins",
                    uid
                );

            if (
                adminProfile?.role
            ) {

                return adminProfile.role;

            }

            if (
                options.allowSelectedRoleFallback ===
                true
            ) {

                return AUTH.normalizeRole(
                    options.selectedRole ||
                    safeStorageGet(
                        STORAGE.selectedRole
                    )
                );

            }

            return "";

        };

    /* =========================================================
       ACCOUNT STATUS
    ========================================================= */

    AUTH.getAccountStatus =
        function (
            user
        ) {

            if (!user) {

                return "";

            }

            return safeLower(
                user.status ||
                user.accountStatus ||
                user.approvalStatus ||
                ""
            );

        };

    AUTH.isAccountBlocked =
        function (
            user
        ) {

            const status =
                AUTH.getAccountStatus(
                    user
                );

            return [

                "blocked",
                "disabled",
                "suspended",
                "banned",
                "rejected"

            ].includes(
                status
            );

        };

    AUTH.isAccountPending =
        function (
            user
        ) {

            if (!user) {

                return false;

            }

            const role =
                AUTH.normalizeRole(
                    user.role
                );

            if (
                role !==
                ROLES.RIDER
            ) {

                return false;

            }

            const status =
                AUTH.getAccountStatus(
                    user
                )
                    .replace(
                        /[\s_-]+/g,
                        ""
                    );

            return [

                "pending",
                "pendingapproval",
                "underreview",
                "waiting"

            ].includes(
                status
            );

        };

    AUTH.isRiderApproved =
        function (
            user
        ) {

            if (!user) {

                return false;

            }

            if (
                AUTH.normalizeRole(
                    user.role
                ) !==
                ROLES.RIDER
            ) {

                return false;

            }

            const status =
                AUTH.getAccountStatus(
                    user
                );

            if (
                [
                    "approved",
                    "active",
                    "verified"
                ].includes(
                    status
                )
            ) {

                return true;

            }

            if (
                [
                    "pending",
                    "rejected",
                    "blocked",
                    "suspended"
                ].includes(
                    status
                )
            ) {

                return false;

            }

            if (
                user.approved === true ||
                user.isApproved === true ||
                user.verified === true
            ) {

                return true;

            }

            return false;

        };

    /* =========================================================
       PHONE NORMALIZATION
    ========================================================= */

    AUTH.normalizePhone =
        function (
            phone
        ) {

            let value =
                cleanString(
                    phone
                )
                    .replace(
                        /[^\d+]/g,
                        ""
                    );

            if (!value) {

                return "";

            }

            if (
                value.startsWith("00")
            ) {

                value =
                    "+" +
                    value.slice(2);

            }

            if (
                value.startsWith("0") &&
                value.length === 10
            ) {

                value =
                    "+91" +
                    value.slice(1);

            }

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

    /* =========================================================
       UID HELPER
    ========================================================= */

    AUTH.getUserId =
        function (
            user
        ) {

            return (
                user?.uid ||
                user?.id ||
                user?.userId ||
                null
            );

        };

    /* =========================================================
       CURRENT LOGIN STATE
    ========================================================= */

    AUTH.isLoggedIn =
        function () {

            return Boolean(
                AUTH.state.firebaseUser &&
                AUTH.state.user
            );

        };

    /* =========================================================
       AUTH EVENT EMITTER
    ========================================================= */

    AUTH.emit =
        function (
            eventName,
            detail
        ) {

            if (!isBrowser()) {

                return;

            }

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

                console.warn(
                    "RiderX auth event failed:",
                    error
                );

            }

        };

    /* =========================================================
       AUTH READY
    ========================================================= */

    AUTH.waitForAuth =
        function () {

            if (
                AUTH.state.authReady
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
                            handler
                        );

                    }
                );

            return AUTH.state.readyPromise;

        };

    /* =========================================================
       FINALIZE AUTHENTICATED USER
    ========================================================= */

    async function finalizeAuthenticatedUser(
        firebaseUser,
        options
    ) {

        options =
            isObject(options)
                ? options
                : {};

        if (!firebaseUser?.uid) {

            throw new Error(
                "Firebase authentication failed."
            );

        }

        const FB =
            await loadFirebase();

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

            AUTH.clearSession();

            throw new Error(
                "This RiderX account has been disabled."
            );

        }

        const role =
            await AUTH.resolveRole(
                firebaseUser,
                {
                    allowSelectedRoleFallback:
                        options.allowSelectedRoleFallback ===
                        true,

                    selectedRole:
                        options.selectedRole
                }
            );

        if (
            role === null
        ) {

            AUTH.clearSession();

            throw new Error(
                "Unable to verify your RiderX profile. Please check your connection and try again."
            );

        }

        if (!role) {

            AUTH.clearSession();

            await safeFirebaseSignOut(
                FB
            );

            throw new Error(
                "Your RiderX role is not configured. Please select Customer or Rider during registration."
            );

        }

        /*
         * Never trust a client-selected role when Firebase
         * already has a different role.
         *
         * The resolved Firestore role is authoritative.
         */

        profile.role =
            role;

        profile.userRole =
            role;

        profile.accountType =
            role;

        profile.uid =
            firebaseUser.uid;

        AUTH.state.firebaseUser =
            firebaseUser;

        const savedUser =
            AUTH.saveSession(
                profile,
                role
            );

        AUTH.state.authError =
            null;

        AUTH.state.authReady =
            true;

        AUTH.state.lastResolvedUid =
            firebaseUser.uid;

        return {

            user:
                savedUser,

            role:
                role,

            firebaseUser:
                firebaseUser

        };

    }

    /* =========================================================
       EMAIL LOGIN
    ========================================================= */

    AUTH.loginEmail =
        async function (
            email,
            password,
            selectedRole
        ) {

            email =
                cleanString(
                    email
                ).toLowerCase();

            password =
                String(
                    password || ""
                );

            const requestedRole =
                AUTH.normalizeRole(
                    selectedRole ||
                    safeStorageGet(
                        STORAGE.selectedRole
                    )
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

                /*
                 * First resolve the real Firebase/Firestore role.
                 *
                 * selectedRole is only a compatibility fallback
                 * for an account whose profile has no role.
                 */

                const authResult =
                    await finalizeAuthenticatedUser(
                        firebaseUser,
                        {
                            allowSelectedRoleFallback:
                                Boolean(
                                    requestedRole
                                ),

                            selectedRole:
                                requestedRole
                        }
                    );

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                AUTH.emit(
                    "login",
                    {
                        user:
                            authResult.user,

                        role:
                            authResult.role,

                        method:
                            "email"
                    }
                );

                AUTH.emit(
                    "signed-in",
                    {
                        user:
                            authResult.user,

                        role:
                            authResult.role
                    }
                );

                AUTH.renderUser();

                return authResult;

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
                    data.role ||
                    safeStorageGet(
                        STORAGE.selectedRole
                    )
                );

            const name =
                cleanString(
                    data.name ||
                    data.fullName ||
                    data.displayName
                );

            const phone =
                AUTH.normalizePhone(
                    data.phone ||
                    data.phoneNumber
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

            if (
                password.length <
                6
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

            if (!name) {

                throw new Error(
                    "Full name is required."
                );

            }

            if (
                role ===
                ROLES.RIDER &&
                !phone
            ) {

                throw new Error(
                    "Rider phone number is required."
                );

            }

            const FB =
                await loadFirebase();

            AUTH.state.loading =
                true;

            try {

                const result =
                    await FB.createUserWithEmailAndPassword(
                        FB.auth,
                        email,
                        password
                    );

                const firebaseUser =
                    result?.user;

                if (!firebaseUser) {

                    throw new Error(
                        "Firebase registration failed."
                    );

                }

                if (
                    name ||
                    phone
                ) {

                    await FB.updateProfile(
                        firebaseUser,
                        {
                            displayName:
                                name || null
                        }
                    );

                }

                /*
                 * Rider accounts start in pending state.
                 * Customer accounts start active.
                 */

                const initialStatus =
                    role ===
                    ROLES.RIDER
                        ? "pending"
                        : "active";

                const profile = {

                    uid:
                        firebaseUser.uid,

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
                        initialStatus,

                    approvalStatus:
                        role === ROLES.RIDER
                            ? "pending"
                            : "approved",

                    approved:
                        role === ROLES.RIDER
                            ? false
                            : true,

                    isApproved:
                        role === ROLES.RIDER
                            ? false
                            : true,

                    city:
                        cleanString(
                            data.city
                        ) ||
                        "Chandigarh",

                    online:
                        false,

                    createdAt:
                        Date.now(),

                    updatedAt:
                        Date.now()

                };

                const userRef =
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    );

                await FB.setDoc(
                    userRef,
                    profile,
                    {
                        merge:
                            true
                    }
                );

                /*
                 * Keep role-specific profile collections for
                 * compatibility with existing RiderX pages.
                 */

                const collectionName =
                    role ===
                    ROLES.RIDER
                        ? "riders"
                        : "customers";

                const roleRef =
                    FB.doc(
                        FB.db,
                        collectionName,
                        firebaseUser.uid
                    );

                await FB.setDoc(
                    roleRef,
                    profile,
                    {
                        merge:
                            true
                    }
                );

                const savedUser =
                    AUTH.saveSession(
                        profile,
                        role
                    );

                AUTH.state.firebaseUser =
                    firebaseUser;

                AUTH.state.user =
                    savedUser;

                AUTH.state.role =
                    role;

                AUTH.state.authReady =
                    true;

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

                AUTH.emit(
                    "signed-in",
                    {
                        user:
                            savedUser,

                        role:
                            role
                    }
                );

                return {

                    success:
                        true,

                    user:
                        savedUser,

                    role:
                        role,

                    redirect:
                        AUTH.getRouteForUser(
                            savedUser,
                            role
                        )

                };

            } catch (error) {

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

                AUTH.emit(
                    "password-reset-sent",
                    {
                        email:
                            email
                    }
                );

                return {

                    success:
                        true

                };

            } catch (error) {

                console.error(
                    "RiderX password reset failed:",
                    error
                );

                throw new Error(
                    firebaseError(error)
                );

            }

        };

    /* =========================================================
       PHONE OTP
    ========================================================= */

    AUTH.clearOtpVerifier =
        function () {

            if (
                AUTH.phoneVerifier
            ) {

                try {

                    if (
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

            }

            AUTH.phoneVerifier =
                null;

        };

    /* =========================================================
       OTP SEND
    ========================================================= */

    AUTH.sendOtp =
        async function (
            phone,
            recaptchaContainer
        ) {

            const normalizedPhone =
                AUTH.normalizePhone(
                    phone
                );

            if (!normalizedPhone) {

                throw new Error(
                    "Valid phone number is required."
                );

            }

            const FB =
                await loadFirebase();

            if (
                typeof FB.RecaptchaVerifier !==
                "function"
            ) {

                throw new Error(
                    "Firebase phone authentication is not available in firebase-config.js."
                );

            }

            if (
                typeof FB.signInWithPhoneNumber !==
                "function"
            ) {

                throw new Error(
                    "Firebase phone authentication is not available in firebase-config.js."
                );

            }

            AUTH.clearOtpVerifier();

            let container =
                recaptchaContainer;

            if (
                typeof container ===
                "string"
            ) {

                container =
                    document.getElementById(
                        container
                    );

            }

            if (!container) {

                container =
                    document.getElementById(
                        "recaptcha-container"
                    );

            }

            if (!container) {

                throw new Error(
                    "OTP security verification container is missing."
                );

            }

            AUTH.phoneVerifier =
                new FB.RecaptchaVerifier(
                    FB.auth,
                    container,
                    {
                        size:
                            "invisible",

                        callback:
                            function () {

                                AUTH.emit(
                                    "otp-recaptcha-verified"
                                );

                            },

                        "expired-callback":
                            function () {

                                AUTH.emit(
                                    "otp-recaptcha-expired"
                                );

                            }

                    }
                );

            try {

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

                AUTH.clearOtpVerifier();

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
       OTP VERIFY
    ========================================================= */

    AUTH.verifyOtp =
        async function (
            otp,
            selectedRole
        ) {

            otp =
                cleanString(
                    otp
                );

            if (!otp) {

                throw new Error(
                    "OTP is required."
                );

            }

            if (
                !AUTH.phoneConfirmation ||
                typeof AUTH.phoneConfirmation.confirm !==
                "function"
            ) {

                throw new Error(
                    "Please request a new OTP first."
                );

            }

            const requestedRole =
                AUTH.normalizeRole(
                    selectedRole ||
                    safeStorageGet(
                        STORAGE.selectedRole
                    )
                );

            AUTH.state.loading =
                true;

            try {

                const result =
                    await AUTH.phoneConfirmation.confirm(
                        otp
                    );

                const firebaseUser =
                    result?.user;

                if (!firebaseUser) {

                    throw new Error(
                        "OTP verification failed."
                    );

                }

                /*
                 * Existing users resolve their actual Firestore role.
                 *
                 * For a brand-new phone account, selectedRole is
                 * allowed as the initial role so the profile can be
                 * created correctly.
                 */

                let profile =
                    await AUTH.getProfile(
                        firebaseUser
                    );

                let role =
                    await AUTH.resolveRole(
                        firebaseUser,
                        {
                            allowSelectedRoleFallback:
                                Boolean(
                                    requestedRole
                                ),

                            selectedRole:
                                requestedRole
                        }
                    );

                if (!role) {

                    if (
                        !NORMAL_USER_ROLES.includes(
                            requestedRole
                        )
                    ) {

                        await safeFirebaseSignOut(
                            await loadFirebase()
                        );

                        throw new Error(
                            "Please select Customer or Rider before verifying your phone."
                        );

                    }

                    const FB =
                        await loadFirebase();

                    const initialStatus =
                        requestedRole ===
                        ROLES.RIDER
                            ? "pending"
                            : "active";

                    profile = {

                        ...profile,

                        uid:
                            firebaseUser.uid,

                        phone:
                            firebaseUser.phoneNumber ||
                            safeStorageGet(
                                STORAGE.otpPhone
                            ) ||
                            "",

                        phoneNumber:
                            firebaseUser.phoneNumber ||
                            safeStorageGet(
                                STORAGE.otpPhone
                            ) ||
                            "",

                        role:
                            requestedRole,

                        userRole:
                            requestedRole,

                        accountType:
                            requestedRole,

                        status:
                            initialStatus,

                        approvalStatus:
                            requestedRole ===
                            ROLES.RIDER
                                ? "pending"
                                : "approved",

                        approved:
                            requestedRole ===
                            ROLES.RIDER
                                ? false
                                : true,

                        isApproved:
                            requestedRole ===
                            ROLES.RIDER
                                ? false
                                : true,

                        city:
                            "Chandigarh",

                        online:
                            false,

                        createdAt:
                            Date.now(),

                        updatedAt:
                            Date.now()

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
                        requestedRole ===
                        ROLES.RIDER
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

                    role =
                        requestedRole;

                }

                if (
                    AUTH.isAccountBlocked(
                        profile
                    )
                ) {

                    await safeFirebaseSignOut(
                        await loadFirebase()
                    );

                    throw new Error(
                        "This RiderX account has been disabled."
                    );

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

                AUTH.state.user =
                    savedUser;

                AUTH.state.role =
                    role;

                AUTH.state.authReady =
                    true;

                AUTH.state.authError =
                    null;

                safeStorageRemove(
                    STORAGE.otpPhone
                );

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                AUTH.phoneConfirmation =
                    null;

                AUTH.clearOtpVerifier();

                AUTH.emit(
                    "otp-verified",
                    {
                        user:
                            savedUser,

                        role:
                            role
                    }
                );

                AUTH.emit(
                    "signed-in",
                    {
                        user:
                            savedUser,

                        role:
                            role
                    }
                );

                return {

                    success:
                        true,

                    user:
                        savedUser,

                    role:
                        role,

                    redirect:
                        AUTH.getRouteForUser(
                            savedUser,
                            role
                        )

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
       FIREBASE SIGN OUT HELPER
    ========================================================= */

    async function safeFirebaseSignOut(
        FB
    ) {

        try {

            if (
                FB?.auth &&
                typeof FB.signOut ===
                "function"
            ) {

                await FB.signOut(
                    FB.auth
                );

                return true;

            }

        } catch (error) {

            console.warn(
                "RiderX Firebase sign-out failed:",
                error
            );

        }

        return false;

    }

    /* =========================================================
       LOGOUT
    ========================================================= */

    AUTH.logout =
        async function (
            options
        ) {

            options =
                isObject(options)
                    ? options
                    : {};

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

                console.error(
                    "RiderX logout error:",
                    error
                );

            } finally {

                AUTH.phoneConfirmation =
                    null;

                AUTH.clearOtpVerifier();

                safeStorageRemove(
                    STORAGE.otpPhone
                );

                safeStorageRemove(
                    STORAGE.selectedRole
                );

                AUTH.clearSession();

                AUTH.state.firebaseUser =
                    null;

                AUTH.state.authReady =
                    true;

                AUTH.emit(
                    "logout",
                    {
                        firebase:
                            firebaseLogoutSucceeded
                    }
                );

                AUTH.renderUser();

                if (
                    options.redirect !==
                    false &&
                    isBrowser()
                ) {

                    const target =
                        absoluteRoute(
                            options.route ||
                            ROUTES.auth
                        );

                    if (
                        window.location.href !==
                        window.location.origin +
                        target
                    ) {

                        window.location.replace(
                            target
                        );

                    }

                }

            }

            return firebaseLogoutSucceeded;

        };

    /* =========================================================
       AUTH STATE LISTENER
    ========================================================= */

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

                        AUTH.state.firebaseUser =
                            firebaseUser || null;

                        if (!firebaseUser) {

                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;

                            AUTH.state.authReady =
                                true;

                            AUTH.clearSession();

                            AUTH.emit(
                                "signed-out"
                            );

                            AUTH.emit(
                                "ready"
                            );

                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx:auth-ready"
                                )
                            );

                            return;

                        }

                        try {

                            const result =
                                await finalizeAuthenticatedUser(
                                    firebaseUser,
                                    {
                                        allowSelectedRoleFallback:
                                            false
                                    }
                                );

                            /*
                             * Ignore stale async auth events.
                             * Firebase can fire multiple state changes while
                             * a previous profile lookup is still running.
                             */

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }

                            AUTH.state.firebaseUser =
                                firebaseUser;

                            AUTH.state.user =
                                result.user;

                            AUTH.state.role =
                                result.role;

                            AUTH.state.authReady =
                                true;

                            AUTH.state.authError =
                                null;

                            AUTH.emit(
                                "state-changed",
                                {
                                    user:
                                        result.user,

                                    role:
                                        result.role,

                                    firebaseUser:
                                        firebaseUser
                                }
                            );

                            AUTH.emit(
                                "ready",
                                {
                                    user:
                                        result.user,

                                    role:
                                        result.role
                                }
                            );

                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx:auth-ready",
                                    {
                                        detail:
                                            result
                                    }
                                )
                            );

                            AUTH.renderUser();

                            AUTH.autoGuard();

                        } catch (error) {

                            if (
                                eventVersion !==
                                AUTH.state.authEventVersion
                            ) {

                                return;

                            }

                            AUTH.state.firebaseUser =
                                firebaseUser;

                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;

                            AUTH.state.authReady =
                                true;

                            AUTH.state.authError =
                                error;

                            AUTH.clearSession();

                            AUTH.emit(
                                "auth-error",
                                {
                                    error:
                                        error,

                                    firebaseUser:
                                        firebaseUser
                                }
                            );

                            AUTH.emit(
                                "ready",
                                {
                                    error:
                                        error
                                }
                            );

                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx:auth-ready",
                                    {
                                        detail: {
                                            error:
                                                error
                                        }
                                    }
                                )
                            );

                            AUTH.autoGuard();

                        }

                    }
                );

            return AUTH.state;

        };

    /* =========================================================
       ROUTE RESOLUTION
    ========================================================= */

    AUTH.getRouteForUser =
        function (
            user,
            role
        ) {

            const normalizedRole =
                AUTH.normalizeRole(
                    role ||
                    user?.role ||
                    user?.userRole ||
                    user?.accountType
                );

            if (
                AUTH.isAdminRole(
                    normalizedRole
                )
            ) {

                return ROUTES.admin;

            }

            if (
                normalizedRole ===
                ROLES.RIDER
            ) {

                if (
                    AUTH.isAccountPending(
                        user
                    )
                ) {

                    return ROUTES.pendingRider;

                }

                if (
                    !AUTH.isRiderApproved(
                        user
                    )
                ) {

                    return ROUTES.pendingRider;

                }

                return ROUTES.rider;

            }

            if (
                normalizedRole ===
                ROLES.CUSTOMER
            ) {

                return ROUTES.customer;

            }

            return ROUTES.auth;

        };

    /* =========================================================
       REDIRECT BY ROLE
    ========================================================= */

    AUTH.redirectByRole =
        function (
            fallback
        ) {

            if (!isBrowser()) {

                return false;

            }

            const user =
                AUTH.getUser();

            const role =
                AUTH.getRole();

            const route =
                AUTH.getRouteForUser(
                    user,
                    role
                );

            const target =
                route === ROUTES.auth
                    ? (
                        fallback ||
                        ROUTES.auth
                    )
                    : route;

            const absolute =
                absoluteRoute(
                    target
                );

            if (
                window.location.pathname ===
                absolute
            ) {

                return true;

            }

            window.location.replace(
                absolute
            );

            return true;

        };

    /* =========================================================
       REQUIRE AUTH
    ========================================================= */

    AUTH.requireAuth =
        async function (
            options
        ) {

            options =
                isObject(options)
                    ? options
                    : {};

            await AUTH.waitForAuth();

            if (
                AUTH.isLoggedIn()
            ) {

                return true;

            }

            if (
                options.redirect !==
                false
            ) {

                const target =
                    absoluteRoute(
                        options.route ||
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

            }

            return false;

        };

    /* =========================================================
       REQUIRE ROLE
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

            await AUTH.waitForAuth();

            const allowed =
                Array.isArray(roles)
                    ? roles
                    : [roles];

            const normalized =
                allowed
                    .map(
                        function (role) {

                            return AUTH.normalizeRole(
                                role
                            );

                        }
                    )
                    .filter(Boolean);

            const currentRole =
                AUTH.getRole();

            if (
                AUTH.isLoggedIn() &&
                normalized.includes(
                    currentRole
                )
            ) {

                return true;

            }

            if (
                options.redirect !==
                false
            ) {

                if (
                    AUTH.isLoggedIn()
                ) {

                    AUTH.redirectByRole(
                        options.fallback ||
                        ROUTES.auth
                    );

                } else {

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

                }

            }

            return false;

        };

    /* =========================================================
       AUTO GUARD
    ========================================================= */

    AUTH.autoGuard =
        function () {

            if (!isBrowser()) {

                return;

            }

            if (!AUTH.state.authReady) {

                return;

            }

            const user =
                AUTH.state.user;

            const role =
                AUTH.state.role;

            const path =
                currentPath();

            /*
             * Do not interfere with public authentication pages
             * when there is no authenticated Firebase user.
             */

            if (
                !AUTH.state.firebaseUser
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
             * Firebase user exists but profile/role resolution failed.
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
             * Admin can access admin only.
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
             * Rider access.
             */

            if (
                role ===
                ROLES.RIDER
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

                    if (
                        isRiderPage() &&
                        !path.endsWith(
                            "/pending.html"
                        )
                    ) {

                        window.location.replace(
                            absoluteRoute(
                                ROUTES.pendingRider
                            )
                        );

                    } else if (
                        isCustomerPage() ||
                        isAdminPage()
                    ) {

                        window.location.replace(
                            absoluteRoute(
                                ROUTES.pendingRider
                            )
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
             * Customer access.
             */

            if (
                role ===
                ROLES.CUSTOMER
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

                return;

            }

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

            const role =
                AUTH.getRole();

            const name =
                cleanString(
                    user?.name ||
                    user?.displayName ||
                    user?.fullName
                );

            const email =
                cleanString(
                    user?.email
                );

            const phone =
                cleanString(
                    user?.phone ||
                    user?.phoneNumber
                );

            const photo =
                cleanString(
                    user?.photoURL
                );

            const selectors = [

                "[data-riderx-user-name]",
                "[data-user-name]",
                ".user-name",
                "#userName",
                "#profileName"

            ];

            selectors.forEach(
                function (selector) {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            function (element) {

                                if (name) {

                                    element.textContent =
                                        name;

                                }

                            }
                        );

                }
            );

            document
                .querySelectorAll(
                    "[data-riderx-user-email], [data-user-email], #userEmail"
                )
                .forEach(
                    function (element) {

                        if (email) {

                            element.textContent =
                                email;

                        }

                    }
                );

            document
                .querySelectorAll(
                    "[data-riderx-user-phone], [data-user-phone], #userPhone"
                )
                .forEach(
                    function (element) {

                        if (phone) {

                            element.textContent =
                                phone;

                        }

                    }
                );

            document
                .querySelectorAll(
                    "[data-riderx-user-role], [data-user-role], #userRole"
                )
                .forEach(
                    function (element) {

                        if (role) {

                            element.textContent =
                                role;

                        }

                    }
                );

            if (photo) {

                document
                    .querySelectorAll(
                        "[data-riderx-user-photo], [data-user-photo], #userPhoto"
                    )
                    .forEach(
                        function (element) {

                            if (
                                element instanceof
                                HTMLImageElement
                            ) {

                                element.src =
                                    photo;

                                element.alt =
                                    name ||
                                    "RiderX user";

                            }

                        }
                    );

            }

            document
                .querySelectorAll(
                    "[data-riderx-auth-only]"
                )
                .forEach(
                    function (element) {

                        element.hidden =
                            !Boolean(
                                AUTH.isLoggedIn()
                            );

                    }
                );

            document
                .querySelectorAll(
                    "[data-riderx-guest-only]"
                )
                .forEach(
                    function (element) {

                        element.hidden =
                            Boolean(
                                AUTH.isLoggedIn()
                            );

                    }
                );

            document
                .querySelectorAll(
                    "[data-riderx-role]"
                )
                .forEach(
                    function (element) {

                        const required =
                            AUTH.normalizeRole(
                                element.dataset
                                    .riderxRole
                            );

                        element.hidden =
                            !(
                                role &&
                                role ===
                                required
                            );

                    }
                );

        };

    /* =========================================================
       LOGOUT BUTTON BINDING
    ========================================================= */

    AUTH.bindLogout =
        function () {

            if (
                AUTH.state.logoutBound
            ) {

                return;

            }

            document.addEventListener(
                "click",
                function (event) {

                    const button =
                        event.target?.closest?.(
                            "[data-riderx-logout], #logoutBtn, .logout-btn, .logout-button"
                        );

                    if (!button) {

                        return;

                    }

                    event.preventDefault();

                    if (
                        button.dataset
                            .riderxLogoutBusy ===
                        "true"
                    ) {

                        return;

                    }

                    button.dataset
                        .riderxLogoutBusy =
                        "true";

                    AUTH.logout()
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

                                button.dataset
                                    .riderxLogoutBusy =
                                    "false";

                            }
                        );

                }
            );

            AUTH.state.logoutBound =
                true;

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

            const firebaseUser =
                AUTH.state.firebaseUser;

            if (!firebaseUser) {

                throw new Error(
                    "Please login first."
                );

            }

            const FB =
                await loadFirebase();

            try {

                const firebaseUpdates = {};

                if (
                    Object.prototype.hasOwnProperty.call(
                        updates,
                        "displayName"
                    )
                ) {

                    firebaseUpdates.displayName =
                        cleanString(
                            updates.displayName
                        );

                } else if (
                    Object.prototype.hasOwnProperty.call(
                        updates,
                        "name"
                    )
                ) {

                    firebaseUpdates.displayName =
                        cleanString(
                            updates.name
                        );

                }

                if (
                    Object.prototype.hasOwnProperty.call(
                        updates,
                        "photoURL"
                    )
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
                        firebaseUser,
                        firebaseUpdates
                    );

                }

                const currentUser =
                    AUTH.getUser() || {};

                const updatedProfile = {

                    ...currentUser,
                    ...updates,

                    uid:
                        firebaseUser.uid,

                    email:
                        firebaseUser.email ||
                        currentUser.email ||
                        "",

                    displayName:
                        firebaseUpdates.displayName ||
                        currentUser.displayName ||
                        currentUser.name ||
                        "",

                    photoURL:
                        firebaseUpdates.photoURL ||
                        currentUser.photoURL ||
                        "",

                    updatedAt:
                        Date.now()

                };

                const userRef =
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    );

                await FB.setDoc(
                    userRef,
                    updatedProfile,
                    {
                        merge:
                            true
                    }
                );

                const role =
                    AUTH.getRole();

                if (
                    role ===
                    ROLES.CUSTOMER ||
                    role ===
                    ROLES.RIDER
                ) {

                    const collectionName =
                        role ===
                        ROLES.RIDER
                            ? "riders"
                            : "customers";

                    await FB.setDoc(
                        FB.doc(
                            FB.db,
                            collectionName,
                            firebaseUser.uid
                        ),
                        updatedProfile,
                        {
                            merge:
                                true
                        }
                    );

                }

                const savedUser =
                    AUTH.saveSession(
                        updatedProfile,
                        role
                    );

                AUTH.state.user =
                    savedUser;

                AUTH.emit(
                    "profile-updated",
                    {
                        user:
                            savedUser
                    }
                );

                AUTH.renderUser();

                return savedUser;

            } catch (error) {

                console.error(
                    "RiderX profile update failed:",
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
       CHANGE PASSWORD
    ========================================================= */

    AUTH.changePassword =
        async function (
            currentPassword,
            newPassword
        ) {

            const email =
                AUTH.getEmail();

            if (!email) {

                throw new Error(
                    "Please login with your email account first."
                );

            }

            if (
                !newPassword ||
                String(
                    newPassword
                ).length < 6
            ) {

                throw new Error(
                    "New password must contain at least 6 characters."
                );

            }

            const FB =
                await loadFirebase();

            try {

                const credential =
                    await FB.EmailAuthProvider.credential(
                        email,
                        String(
                            currentPassword || ""
                        )
                    );

                await FB.reauthenticateWithCredential(
                    FB.auth.currentUser,
                    credential
                );

                await FB.updatePassword(
                    FB.auth.currentUser,
                    String(
                        newPassword
                    )
                );

                AUTH.emit(
                    "password-changed"
                );

                return true;

            } catch (error) {

                console.error(
                    "RiderX password change failed:",
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
       PHONE OTP VERIFIER CLEANUP
    ========================================================= */

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

    /* =========================================================
       SELECT ROLE
    ========================================================= */

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
                 * Cached data is only for temporary UI rendering.
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

                AUTH.state.firebaseUser =
                    null;

                AUTH.clearSession();

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
       COMPATIBILITY API
    ========================================================= */

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

    /* =========================================================
       GLOBAL INITIALIZATION
    ========================================================= */

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
