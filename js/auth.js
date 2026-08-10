/* ============================================================
   RIDERX
   AUTHENTICATION ENGINE
   File: js/auth.js

   Firebase v10 MODULAR compatible

   Supports:
   - Customer
   - Rider
   - Admin
   - Superadmin
   - Email login
   - Email registration
   - Phone OTP
   - Firebase Auth state
   - Firestore user profiles
   - Role resolution
   - Session management
   - Route guards
   - Logout
   - Password reset
   - Profile update
   - UI user rendering

   IMPORTANT:
   Security roles must be controlled by Firebase/Firestore
   Security Rules. localStorage is only a client-side session
   cache and is never treated as the security authority.
============================================================ */

"use strict";

(function () {

    /* =========================================================
       GLOBAL
    ========================================================= */

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AUTH = RX.auth = RX.auth || {};


    /* =========================================================
       STORAGE KEYS
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


    /* =========================================================
       ROUTES
    ========================================================= */

    const ROUTES = Object.freeze({

        customer:
            "../customer/home.html",

        rider:
            "../rider/home.html",

        admin:
            "../admin/dashboard.html",

        auth:
            "../auth/role.html"

    });


    /* =========================================================
       STATE
    ========================================================= */

    AUTH.state = AUTH.state || {

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
            false

    };


    AUTH.phoneConfirmation =
        null;


    AUTH.phoneVerifier =
        null;


    let Firebase =
        null;


    /* =========================================================
       FIREBASE MODULE LOADER
    ========================================================= */

    async function loadFirebase() {

        if (Firebase) {

            return Firebase;

        }


        try {

            Firebase =
                await import(
                    "../firebase/firebase-config.js"
                );


            if (
                !Firebase ||
                !Firebase.auth
            ) {

                throw new Error(
                    "Firebase Auth is not exported from firebase-config.js."
                );

            }


            return Firebase;

        } catch (error) {

            console.error(
                "RiderX Firebase module load failed:",
                error
            );


            return null;

        }

    }


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

        try {

            const raw =
                safeStorageGet(
                    key
                );


            if (!raw) {

                return null;

            }


            const parsed =
                JSON.parse(
                    raw
                );


            if (
                parsed &&
                typeof parsed === "object"
            ) {

                return parsed;

            }

        } catch (error) {

            console.warn(
                "Invalid RiderX stored session:",
                key
            );


            safeStorageRemove(
                key
            );

        }


        return null;

    }


    function numberValue(
        value,
        fallback = 0
    ) {

        const number =
            Number(
                value
            );


        return Number.isFinite(
            number
        )
            ? number
            : fallback;

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
                value === "rider" ||
                value === "riders" ||
                value === "driver" ||
                value === "drivers" ||
                value === "partner" ||
                value === "driver_partner" ||
                value === "driverpartner" ||
                value === "captain"
            ) {

                return ROLES.RIDER;

            }


            if (
                value === "customer" ||
                value === "customers" ||
                value === "user" ||
                value === "users"
            ) {

                return ROLES.CUSTOMER;

            }


            if (
                value === "admin" ||
                value === "administrator"
            ) {

                return ROLES.ADMIN;

            }


            if (
                value === "superadmin" ||
                value === "super_admin" ||
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
       GET STORED USER
    ========================================================= */

    AUTH.getStoredUser =
        function () {

            const mainUser =
                parseStorageUser(
                    STORAGE.user
                );


            if (mainUser) {

                return mainUser;

            }


            const role =
                AUTH.getStoredRole();


            const rider =
                parseStorageUser(
                    STORAGE.rider
                );


            const customer =
                parseStorageUser(
                    STORAGE.customer
                );


            const admin =
                parseStorageUser(
                    STORAGE.admin
                );


            if (
                AUTH.isRiderRole(
                    role
                ) &&
                rider
            ) {

                return rider;

            }


            if (
                AUTH.isCustomerRole(
                    role
                ) &&
                customer
            ) {

                return customer;

            }


            if (
                AUTH.isAdminRole(
                    role
                ) &&
                admin
            ) {

                return admin;

            }


            return (
                rider ||
                customer ||
                admin ||
                null
            );

        };


    /* =========================================================
       GET STORED ROLE
    ========================================================= */

    AUTH.getStoredRole =
        function () {

            const directRole =
                AUTH.normalizeRole(
                    safeStorageGet(
                        STORAGE.role
                    )
                );


            if (directRole) {

                return directRole;

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


                if (role) {

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


                if (role) {

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


                if (role) {

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


            const storedRole =
                AUTH.getStoredRole();


            if (storedRole) {

                return storedRole;

            }


            const user =
                AUTH.getUser();


            return AUTH.normalizeRole(
                user?.role ||
                user?.userRole ||
                user?.accountType
            );

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


            if (!user) {

                return null;

            }


            return (
                user.uid ||
                user.id ||
                user.userId ||
                null
            );

        };


    /* =========================================================
       EMAIL
    ========================================================= */

    AUTH.getEmail =
        function () {

            return (
                AUTH.getUser()?.email ||
                AUTH.state.firebaseUser?.email ||
                ""
            );

        };


    /* =========================================================
       SESSION SAVE
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


            const sessionUser = {

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
                        sessionUser.uid,

                    role:
                        normalizedRole,

                    loginAt:
                        Date.now()

                })
            );


            /*
             * Clear stale role sessions.
             */

            safeStorageRemove(
                STORAGE.customer
            );

            safeStorageRemove(
                STORAGE.rider
            );

            safeStorageRemove(
                STORAGE.admin
            );


            /*
             * Save correct role-specific session.
             */

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
                            sessionUser.uid,

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
       FIREBASE PROFILE
    ========================================================= */

    AUTH.getProfile =
        async function (
            firebaseUser
        ) {

            if (!firebaseUser) {

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


            if (
                !FB ||
                !FB.db ||
                !FB.doc ||
                !FB.getDoc
            ) {

                return baseProfile;

            }


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
                    snapshot.exists()
                ) {

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

                }

            } catch (error) {

                console.warn(
                    "RiderX profile read failed:",
                    error
                );

            }


            return baseProfile;

        };


    /* =========================================================
       RESOLVE ROLE
       Firestore users/{uid} is authoritative when available.
    ========================================================= */

    AUTH.resolveRole =
        async function (
            user
        ) {

            if (!user) {

                return "";

            }


            const FB =
                await loadFirebase();


            if (
                FB &&
                FB.db &&
                user.uid
            ) {

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
                        snapshot.exists()
                    ) {

                        const data =
                            snapshot.data() ||
                            {};


                        const firestoreRole =
                            AUTH.normalizeRole(
                                data.role ||
                                data.userRole ||
                                data.accountType
                            );


                        if (
                            firestoreRole
                        ) {

                            return firestoreRole;

                        }


                        /*
                         * Profile exists but has no valid role.
                         * Do not trust localStorage to elevate it.
                         */

                        return "";

                    }


                } catch (error) {

                    console.warn(
                        "RiderX Firestore role lookup failed:",
                        error
                    );


                    /*
                     * Existing Firebase account should not be
                     * granted a privileged role from localStorage.
                     *
                     * We may still use an explicit role already
                     * supplied by a freshly-created registration
                     * profile.
                     */

                    const directRole =
                        AUTH.normalizeRole(
                            user.role ||
                            user.userRole ||
                            user.accountType
                        );


                    return directRole;

                }

            }


            /*
             * Fallback for a profile object already supplied by
             * the registration/OTP flow.
             */

            const directRole =
                AUTH.normalizeRole(
                    user.role ||
                    user.userRole ||
                    user.accountType
                );


            if (directRole) {

                return directRole;

            }


            return "";

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


            if (
                !FB ||
                !FB.auth ||
                !FB.signInWithEmailAndPassword
            ) {

                throw new Error(
                    "Firebase Authentication is not available."
                );

            }


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


                const savedUser =
                    AUTH.saveSession(
                        profile,
                        role
                    );


                AUTH.state.firebaseUser =
                    firebaseUser;


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
                    data.password ||
                    ""
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
                ![
                    ROLES.CUSTOMER,
                    ROLES.RIDER
                ].includes(
                    role
                )
            ) {

                throw new Error(
                    "Please select Customer or Rider."
                );

            }


            const FB =
                await loadFirebase();


            if (
                !FB ||
                !FB.auth ||
                !FB.db ||
                !FB.createUserWithEmailAndPassword ||
                !FB.doc ||
                !FB.setDoc
            ) {

                throw new Error(
                    "Firebase is not configured correctly."
                );

            }


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
                    result.user;


                if (!firebaseUser) {

                    throw new Error(
                        "Firebase registration failed."
                    );

                }


                if (
                    name &&
                    FB.updateProfile
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

                        console.warn(
                            "Firebase display name update failed:",
                            error
                        );

                    }

                }


                const now =
                    Date.now();


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


                const savedUser =
                    AUTH.saveSession(
                        profile,
                        role
                    );


                AUTH.state.firebaseUser =
                    firebaseUser;


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
                        firebaseUser

                };

            } catch (error) {

                console.error(
                    "RiderX registration failed:",
                    error
                );


                throw error;

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


            if (!phone) {

                throw new Error(
                    "Phone number is required."
                );

            }


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


            if (
                !FB ||
                !FB.auth ||
                !FB.RecaptchaVerifier ||
                !FB.signInWithPhoneNumber
            ) {

                throw new Error(
                    "Firebase Phone Authentication is not configured correctly."
                );

            }


            if (!container) {

                throw new Error(
                    "OTP verification container is required."
                );

            }


            /*
             * Reuse an externally-created verifier.
             */

            let verifier =
                null;


            if (
                typeof container === "object" &&
                typeof container.verify === "function"
            ) {

                verifier =
                    container;

            } else {

                /*
                 * Always clear an old verifier before
                 * creating a new one.
                 */

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

                const confirmation =
                    await FB.signInWithPhoneNumber(
                        FB.auth,
                        phone,
                        verifier
                    );


                AUTH.phoneConfirmation =
                    confirmation;


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


                throw error;

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


            if (
                !FB ||
                !FB.auth
            ) {

                throw new Error(
                    "Firebase could not be loaded."
                );

            }


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


                /*
                 * Existing profile role has priority.
                 */

                let resolvedRole =
                    await AUTH.resolveRole(
                        profile
                    );


                /*
                 * Only a genuinely new account can
                 * use the role selected before OTP.
                 */

                if (!resolvedRole) {

                    resolvedRole =
                        AUTH.normalizeRole(
                            role
                        );

                }


                if (!resolvedRole) {

                    resolvedRole =
                        AUTH.normalizeRole(
                            safeStorageGet(
                                STORAGE.selectedRole
                            )
                        );

                }


                if (!resolvedRole) {

                    await FB.signOut(
                        FB.auth
                    );


                    throw new Error(
                        "Please select Customer or Rider before completing OTP verification."
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
                        "This RiderX account has been disabled."
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


                /*
                 * Create Firestore profile if possible.
                 */

                if (
                    FB.db &&
                    FB.doc &&
                    FB.setDoc
                ) {

                    try {

                        const userRef =
                            FB.doc(
                                FB.db,
                                "users",
                                firebaseUser.uid
                            );


                        await FB.setDoc(
                            userRef,
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

                    } catch (error) {

                        console.error(
                            "OTP profile save failed:",
                            error
                        );


                        await FB.signOut(
                            FB.auth
                        );


                        throw new Error(
                            "OTP verified, but RiderX could not save your profile. Please try again."
                        );

                    }

                }


                const savedUser =
                    AUTH.saveSession(
                        profile,
                        resolvedRole
                    );


                AUTH.state.firebaseUser =
                    firebaseUser;


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
                    "Firebase logout failed:",
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


                AUTH.emit(
                    "logout"
                );

            }

        };


    /* =========================================================
       AUTH STATE LISTENER
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
                !FB ||
                !FB.auth ||
                !FB.onAuthStateChanged
            ) {

                AUTH.state.authReady =
                    true;


                console.warn(
                    "RiderX Firebase auth listener unavailable."
                );


                return null;

            }


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


                            if (role) {

                                profile.role =
                                    role;

                                profile.userRole =
                                    role;

                                profile.accountType =
                                    role;


                                AUTH.saveSession(
                                    profile,
                                    role
                                );

                            } else {

                                /*
                                 * Firebase is authenticated but
                                 * application role is missing.
                                 */

                                AUTH.state.user =
                                    null;

                                AUTH.state.role =
                                    null;

                            }


                            AUTH.state.authReady =
                                true;


                            AUTH.emit(
                                "signed-in",
                                {

                                    user:
                                        profile,

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


            return new Promise(
                function (
                    resolve
                ) {

                    let finished =
                        false;


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
                                timeout
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
                AUTH.state.firebaseUser?.uid &&
                AUTH.state.authReady
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


            return (
                wanted &&
                AUTH.getRole() ===
                wanted
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


            /*
             * Wait for Firebase to determine the real
             * authentication state before redirecting.
             */

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
                allowed.includes(
                    current
                )
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


            if (
                role === ROLES.ADMIN ||
                role === ROLES.SUPERADMIN
            ) {

                window.location.replace(
                    ROUTES.admin
                );

                return;

            }


            if (
                role === ROLES.RIDER
            ) {

                window.location.replace(
                    ROUTES.rider
                );

                return;

            }


            if (
                role === ROLES.CUSTOMER
            ) {

                window.location.replace(
                    ROUTES.customer
                );

                return;

            }


            window.location.replace(
                fallback ||
                ROUTES.auth
            );

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


            const uid =
                AUTH.getUid();


            if (!uid) {

                throw new Error(
                    "User is not logged in."
                );

            }


            const FB =
                await loadFirebase();


            if (!FB) {

                throw new Error(
                    "Firebase could not be loaded."
                );

            }


            /*
             * Firebase Auth profile fields.
             */

            if (
                FB.auth?.currentUser &&
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


            /*
             * Never allow a normal client profile
             * update to change the security role.
             */

            const firestoreUpdates =
                {
                    ...updates,

                    updatedAt:
                        Date.now()
                };


            delete firestoreUpdates.role;

            delete firestoreUpdates.userRole;

            delete firestoreUpdates.accountType;

            delete firestoreUpdates.uid;

            delete firestoreUpdates.id;

            delete firestoreUpdates.userId;


            if (
                FB.db &&
                FB.doc &&
                FB.setDoc
            ) {

                const userRef =
                    FB.doc(
                        FB.db,
                        "users",
                        uid
                    );


                await FB.setDoc(
                    userRef,
                    firestoreUpdates,
                    {
                        merge:
                            true
                    }
                );

            }


            const current =
                AUTH.getUser() ||
                {};


            const currentRole =
                AUTH.getRole();


            const updated =
                {

                    ...current,

                    ...firestoreUpdates,

                    uid:
                        current.uid ||
                        uid,

                    role:
                        currentRole,

                    userRole:
                        currentRole,

                    accountType:
                        currentRole

                };


            const saved =
                AUTH.saveSession(
                    updated,
                    currentRole
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


            if (
                !FB ||
                !FB.auth ||
                !FB.sendPasswordResetEmail
            ) {

                throw new Error(
                    "Firebase Authentication is not available."
                );

            }


            await FB.sendPasswordResetEmail(
                FB.auth,
                email
            );


            return true;

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


            const event =
                new CustomEvent(
                    "riderx-auth-" +
                    name,
                    {

                        detail:
                            detail || {}

                    }
                );


            window.dispatchEvent(
                event
            );


            /*
             * Special ready event used by waitForAuth().
             */

            if (
                name === "ready" ||
                name === "signed-in" ||
                name === "signed-out"
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
                function (
                    event
                ) {

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
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

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
                AUTH.state.logoutBound
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


                console.log(
                    "RiderX authentication engine initialized."
                );

            } catch (error) {

                console.error(
                    "RiderX authentication initialization failed:",
                    error
                );

            } finally {

                AUTH.state.initializing =
                    false;

            }

        };


    /* =========================================================
       PUBLIC API
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
       AUTO INIT
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
