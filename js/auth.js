/* ============================================================
   RIDERX
   AUTHENTICATION ENGINE
   File: js/auth.js

   Firebase v10 MODULAR compatible
   Customer / Rider / Admin / Superadmin
   Email Login / Register / Phone OTP
   Session / Guards / Logout / Profile
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

        initialized: false,

        initializing: false,

        loading: false,

        user: null,

        role: null,

        firebaseUser: null,

        unsubscribe: null,

        logoutBound: false

    };


    AUTH.phoneConfirmation = null;

    let Firebase = null;


    /* =========================================================
       FIREBASE
    ========================================================= */

    async function loadFirebase() {

        if (Firebase) {

            return Firebase;

        }

        try {

            Firebase = await import(
                "../firebase/firebase-config.js"
            );

            if (!Firebase.auth) {

                throw new Error(
                    "Firebase Auth is not exported."
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
       HELPERS
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
                value
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

        try {

            const raw =
                safeStorageGet(key);

            if (!raw) {

                return null;

            }

            const parsed =
                JSON.parse(raw);

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

            safeStorageRemove(key);

        }

        return null;

    }


    /* =========================================================
       ROLE NORMALIZATION
    ========================================================= */

    AUTH.normalizeRole = function (role) {

        const value =
            safeLower(role)
                .replace(/[\s-]+/g, "_");


        if (!value) {

            return "";

        }


        if (
            value === "driver" ||
            value === "drivers" ||
            value === "partner" ||
            value === "driver_partner"
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
            value === "super_admin"
        ) {

            return ROLES.SUPERADMIN;

        }


        return "";

    };


    AUTH.isAdminRole = function (role) {

        const normalized =
            AUTH.normalizeRole(role);

        return (
            normalized === ROLES.ADMIN ||
            normalized === ROLES.SUPERADMIN
        );

    };


    AUTH.isRiderRole = function (role) {

        return (
            AUTH.normalizeRole(role) ===
            ROLES.RIDER
        );

    };


    AUTH.isCustomerRole = function (role) {

        return (
            AUTH.normalizeRole(role) ===
            ROLES.CUSTOMER
        );

    };


    /* =========================================================
       GET STORED USER
    ========================================================= */

    AUTH.getStoredUser = function () {

        const mainUser =
            parseStorageUser(
                STORAGE.user
            );


        if (mainUser) {

            return mainUser;

        }


        const rider =
            parseStorageUser(
                STORAGE.rider
            );


        const customer =
            parseStorageUser(
                STORAGE.customer
            );


        const role =
            AUTH.getStoredRole();


        if (
            role === ROLES.RIDER &&
            rider
        ) {

            return rider;

        }


        if (
            role === ROLES.CUSTOMER &&
            customer
        ) {

            return customer;

        }


        return rider || customer || null;

    };


    /* =========================================================
       GET STORED ROLE
    ========================================================= */

    AUTH.getStoredRole = function () {

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

            const userRole =
                AUTH.normalizeRole(
                    user.role ||
                    user.userRole ||
                    user.accountType
                );


            if (userRole) {

                return userRole;

            }

        }


        const rider =
            parseStorageUser(
                STORAGE.rider
            );


        if (rider) {

            const riderRole =
                AUTH.normalizeRole(
                    rider.role ||
                    rider.userRole ||
                    rider.accountType
                );


            if (riderRole) {

                return riderRole;

            }

        }


        const customer =
            parseStorageUser(
                STORAGE.customer
            );


        if (customer) {

            const customerRole =
                AUTH.normalizeRole(
                    customer.role ||
                    customer.userRole ||
                    customer.accountType
                );


            if (customerRole) {

                return customerRole;

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

    AUTH.getUser = function () {

        return (
            AUTH.state.user ||
            AUTH.getStoredUser() ||
            null
        );

    };


    AUTH.getRole = function () {

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


    AUTH.getUid = function () {

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


    AUTH.getEmail = function () {

        return (
            AUTH.getUser()?.email ||
            ""
        );

    };


    /* =========================================================
       SESSION SAVE
    ========================================================= */

    AUTH.saveSession = function (
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


        const sessionUser = {

            uid:
                user.uid ||
                user.id ||
                user.userId ||
                "",

            id:
                user.id ||
                user.uid ||
                user.userId ||
                "",

            email:
                user.email ||
                "",

            displayName:
                user.displayName ||
                user.name ||
                "",

            name:
                user.name ||
                user.displayName ||
                "",

            phone:
                user.phone ||
                user.phoneNumber ||
                "",

            photoURL:
                user.photoURL ||
                user.photo ||
                "",

            role:
                normalizedRole,

            userRole:
                normalizedRole,

            accountType:
                normalizedRole,

            status:
                user.status ||
                "active",

            online:
                user.online === true,

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


        /* Clear role-specific stale sessions */

        safeStorageRemove(
            STORAGE.customer
        );

        safeStorageRemove(
            STORAGE.rider
        );

        safeStorageRemove(
            STORAGE.admin
        );


        /* Save correct role session */

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

    AUTH.clearSession = function () {

        AUTH.state.user = null;

        AUTH.state.role = null;

        AUTH.state.firebaseUser = null;


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

    AUTH.getProfile = async function (
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

            photoURL:
                firebaseUser.photoURL ||
                ""

        };


        const FB =
            await loadFirebase();


        if (!FB || !FB.db) {

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

                return {

                    ...baseProfile,

                    ...snapshot.data(),

                    uid:
                        firebaseUser.uid,

                    email:
                        snapshot.data().email ||
                        baseProfile.email,

                    phone:
                        snapshot.data().phone ||
                        baseProfile.phone

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
       IMPORTANT:
       Never trust only localStorage for an existing Firebase
       account. Firestore profile is authoritative.
    ========================================================= */

    AUTH.resolveRole = async function (
        user
    ) {

        if (!user) {

            return "";

        }


        const directRole =
            AUTH.normalizeRole(
                user.role ||
                user.userRole ||
                user.accountType
            );


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
                        snapshot.data();


                    const firestoreRole =
                        AUTH.normalizeRole(
                            data.role ||
                            data.userRole ||
                            data.accountType
                        );


                    if (firestoreRole) {

                        return firestoreRole;

                    }

                }

            } catch (error) {

                console.warn(
                    "RiderX role lookup failed:",
                    error
                );

            }

        }


        /*
         * For a newly registered account where the profile has
         * already supplied a valid role, use it.
         */

        if (directRole) {

            return directRole;

        }


        /*
         * Local selected role is only a fallback for a new
         * phone-OTP flow, never preferred over Firestore.
         */

        const selectedRole =
            AUTH.normalizeRole(
                safeStorageGet(
                    STORAGE.selectedRole
                )
            );


        if (
            selectedRole ===
            ROLES.CUSTOMER ||
            selectedRole ===
            ROLES.RIDER
        ) {

            return selectedRole;

        }


        return "";

    };


    /* =========================================================
       ACCOUNT STATUS
    ========================================================= */

    AUTH.isAccountBlocked = function (
        user
    ) {

        const status =
            safeLower(
                user?.status
            );


        return [
            "blocked",
            "suspended",
            "disabled",
            "banned",
            "deactivated"
        ].includes(status);

    };


    /* =========================================================
       EMAIL LOGIN
    ========================================================= */

    AUTH.loginEmail = async function (
        email,
        password
    ) {

        email =
            cleanString(email)
                .toLowerCase();

        password =
            String(password || "");


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
            !FB.auth
        ) {

            throw new Error(
                "Firebase Authentication is not available."
            );

        }


        AUTH.state.loading = true;


        try {

            const result =
                await FB.signInWithEmailAndPassword(
                    FB.auth,
                    email,
                    password
                );


            const firebaseUser =
                result.user;


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
       REGISTER
    ========================================================= */

    AUTH.register = async function (
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
            cleanString(
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
            ].includes(role)
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
            !FB.db
        ) {

            throw new Error(
                "Firebase is not configured correctly."
            );

        }


        AUTH.state.loading = true;


        try {

            const result =
                await FB.createUserWithEmailAndPassword(
                    FB.auth,
                    email,
                    password
                );


            const firebaseUser =
                result.user;


            if (name) {

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

                displayName:
                    name,

                phone:
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
                        profile,

                    role:
                        role

                }
            );


            return {

                user:
                    profile,

                role:
                    role,

                firebaseUser:
                    firebaseUser

            };

        } catch (error) {

            /*
             * If Firebase Auth account was created but Firestore
             * profile creation failed, do not silently pretend
             * registration succeeded.
             */

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
       NORMALIZE PHONE
    ========================================================= */

    AUTH.normalizePhone = function (
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

            return "+" +
                phone
                    .slice(1)
                    .replace(
                        /\D/g,
                        ""
                    );

        }


        const digits =
            phone.replace(
                /\D/g,
                ""
            );


        if (
            digits.length === 10
        ) {

            return "+91" + digits;

        }


        if (
            digits.startsWith("91") &&
            digits.length === 12
        ) {

            return "+" + digits;

        }


        return "+" + digits;

    };


    /* =========================================================
       SEND OTP
    ========================================================= */

    AUTH.sendOtp = async function (
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
            !/^\+\d{10,15}$/.test(phone)
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
         * Re-use an existing verifier when supplied.
         */

        let verifier =
            null;


        if (
            typeof container === "object"
        ) {

            verifier =
                container;

        } else {

            verifier =
                new FB.RecaptchaVerifier(
                    FB.auth,
                    container,
                    {
                        size:
                            "invisible"
                    }
                );

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


            try {

                if (
                    verifier &&
                    typeof verifier.clear ===
                    "function"
                ) {

                    verifier.clear();

                }

            } catch (_) {}


            throw error;

        }

    };


    /* =========================================================
       VERIFY OTP
    ========================================================= */

    AUTH.verifyOtp = async function (
        otp,
        role
    ) {

        otp =
            cleanString(otp);


        if (
            !/^\d{6}$/.test(otp)
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


        if (!FB) {

            throw new Error(
                "Firebase could not be loaded."
            );

        }


        const result =
            await AUTH.phoneConfirmation.confirm(
                otp
            );


        const firebaseUser =
            result.user;


        AUTH.phoneConfirmation =
            null;


        const profile =
            await AUTH.getProfile(
                firebaseUser
            );


        /*
         * Existing user role must come from Firestore.
         */

        let resolvedRole =
            await AUTH.resolveRole(
                profile
            );


        /*
         * Only if this is a genuinely new phone account,
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

            /*
             * Do NOT silently turn an unknown account into a
             * customer. That caused role/session corruption.
             */

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
            firebaseUser.phoneNumber ||
            safeStorageGet(
                STORAGE.otpPhone
            ) ||
            "";


        profile.phone =
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
         * Save/update Firestore profile.
         */

        if (
            FB.db
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


        return {

            user:
                savedUser,

            role:
                resolvedRole,

            firebaseUser:
                firebaseUser

        };

    };


    /* =========================================================
       LOGOUT
    ========================================================= */

    AUTH.logout = async function () {

        try {

            const FB =
                await loadFirebase();


            if (
                FB &&
                FB.auth
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

    AUTH.startListener = async function () {

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
                             * Firebase is authenticated but the
                             * application role is missing.
                             */

                            AUTH.state.user =
                                null;

                            AUTH.state.role =
                                null;

                        }


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

                        console.error(
                            "RiderX auth state error:",
                            error
                        );

                    }

                }
            );


        return AUTH.state.unsubscribe;

    };


    /* =========================================================
       LOGIN STATE
    ========================================================= */

    AUTH.isLoggedIn = function () {

        return Boolean(
            AUTH.state.firebaseUser &&
            AUTH.getUid()
        );

    };


    AUTH.hasRole = function (
        role
    ) {

        return (
            AUTH.getRole() ===
            AUTH.normalizeRole(role)
        );

    };


    /* =========================================================
       ROLE GUARD
    ========================================================= */

    AUTH.requireRole = function (
        roles,
        options
    ) {

        options =
            options || {};


        const allowed =
            Array.isArray(roles)

                ? roles
                    .map(
                        AUTH.normalizeRole
                    )
                    .filter(Boolean)

                : [
                    AUTH.normalizeRole(
                        roles
                    )
                ].filter(Boolean);


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

    AUTH.redirectByRole = function (
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
       PROFILE UPDATE
    ========================================================= */

    AUTH.updateProfile = async function (
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


        if (
            !FB
        ) {

            throw new Error(
                "Firebase could not be loaded."
            );

        }


        if (
            FB.auth?.currentUser
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
         * Never allow a normal profile update to change the
         * user's security role from the client.
         */

        delete firestoreUpdates.role;
        delete firestoreUpdates.userRole;
        delete firestoreUpdates.accountType;
        delete firestoreUpdates.uid;


        if (FB.db) {

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
            AUTH.getUser() || {};


        const updated =
            {

                ...current,

                ...firestoreUpdates,

                uid:
                    current.uid ||
                    uid,

                role:
                    AUTH.getRole(),

                userRole:
                    AUTH.getRole(),

                accountType:
                    AUTH.getRole()

            };


        const saved =
            AUTH.saveSession(
                updated,
                AUTH.getRole()
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

    AUTH.resetPassword = async function (
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

    AUTH.emit = function (
        name,
        detail
    ) {

        if (!isBrowser()) {

            return;

        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-auth-" + name,
                {
                    detail:
                        detail || {}
                }
            )
        );

    };


    AUTH.on = function (
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
            "riderx-auth-" + name,
            handler
        );


        /*
         * Return unsubscribe helper.
         */

        return function () {

            window.removeEventListener(
                "riderx-auth-" + name,
                handler
            );

        };

    };


    /* =========================================================
       RENDER USER
    ========================================================= */

    AUTH.renderUser = function () {

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
       LOGOUT BUTTONS
    ========================================================= */

    AUTH.bindLogout = function () {

        if (
            AUTH.state.logoutBound
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


                AUTH.logout();

            }
        );

    };


    /* =========================================================
       INIT
    ========================================================= */

    AUTH.init = async function () {

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
        function () {

            return AUTH.redirectByRole();

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
