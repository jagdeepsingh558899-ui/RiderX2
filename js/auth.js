/* ============================================================
   RIDERX
   AUTHENTICATION ENGINE
   File: js/auth.js

   Firebase v10 MODULAR compatible
   Customer / Rider / Admin
   Login / Register / OTP
   Session / Guards / Logout
============================================================ */

"use strict";

(function () {

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AUTH = RX.auth = RX.auth || {};

    /* =========================================================
       STORAGE
    ========================================================= */

    const STORAGE = {

        user: "riderx_user",
        role: "riderx_role",
        session: "riderx_session",

        customer: "riderx_customer",
        rider: "riderx_rider",

        admin: "riderx_admin_session",

        selectedRole: "riderx_selected_role"

    };


    const ROLES = {

        CUSTOMER: "customer",
        RIDER: "rider",
        ADMIN: "admin",
        SUPERADMIN: "superadmin"

    };


    /* =========================================================
       STATE
    ========================================================= */

    AUTH.state = {

        initialized: false,

        loading: false,

        user: null,

        role: null,

        firebaseUser: null,

        unsubscribe: null

    };


    AUTH.phoneConfirmation = null;


    /* =========================================================
       FIREBASE MODULAR IMPORT
    ========================================================= */

    let Firebase = null;


    async function loadFirebase() {

        if (Firebase) {

            return Firebase;

        }


        try {

            Firebase =
                await import(
                    "../firebase/firebase-config.js"
                );


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

    AUTH.normalizeRole = function (role) {

        const value =
            String(role || "")
                .trim()
                .toLowerCase();


        if (value === "driver") {

            return ROLES.RIDER;

        }


        if (
            value === "customer" ||
            value === "rider" ||
            value === "admin" ||
            value === "superadmin" ||
            value === "super_admin"
        ) {

            return value === "super_admin"
                ? ROLES.SUPERADMIN
                : value;

        }


        return "";

    };


    AUTH.isAdminRole = function (role) {

        role =
            AUTH.normalizeRole(role);


        return (
            role === ROLES.ADMIN ||
            role === ROLES.SUPERADMIN
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
       STORAGE HELPERS
    ========================================================= */

    AUTH.getStoredUser = function () {

        const keys = [

            STORAGE.user,
            STORAGE.customer,
            STORAGE.rider

        ];


        for (const key of keys) {

            try {

                const raw =
                    localStorage.getItem(key);


                if (!raw) {

                    continue;

                }


                const user =
                    JSON.parse(raw);


                if (
                    user &&
                    typeof user === "object"
                ) {

                    return user;

                }

            } catch (error) {

                console.warn(
                    "Invalid RiderX session:",
                    key
                );

            }

        }


        return null;

    };


    AUTH.getStoredRole = function () {

        const role =
            localStorage.getItem(
                STORAGE.role
            );


        if (role) {

            return AUTH.normalizeRole(
                role
            );

        }


        const user =
            AUTH.getStoredUser();


        if (user && user.role) {

            return AUTH.normalizeRole(
                user.role
            );

        }


        return AUTH.normalizeRole(
            localStorage.getItem(
                "userRole"
            ) ||
            localStorage.getItem(
                STORAGE.selectedRole
            )
        );

    };


    AUTH.getUser = function () {

        return (
            AUTH.state.user ||
            AUTH.getStoredUser() ||
            null
        );

    };


    AUTH.getRole = function () {

        return (
            AUTH.state.role ||
            AUTH.getStoredRole() ||
            AUTH.normalizeRole(
                AUTH.getUser()?.role
            )
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

        const user =
            AUTH.getUser();


        return user?.email || "";

    };


    /* =========================================================
       SAVE SESSION
    ========================================================= */

    AUTH.saveSession = function (
        user,
        role
    ) {

        if (!user) {

            return null;

        }


        role =
            AUTH.normalizeRole(role);


        const sessionUser = {

            uid:
                user.uid ||
                user.id ||
                user.userId ||
                "",

            id:
                user.id ||
                user.uid ||
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

                role ||
                AUTH.normalizeRole(
                    user.role
                ),

            userRole:

                role ||
                AUTH.normalizeRole(
                    user.role
                ),

            status:
                user.status ||
                "active",

            online:
                user.online === true,

            updatedAt:
                Date.now()

        };


        AUTH.state.user =
            sessionUser;


        AUTH.state.role =
            sessionUser.role;


        localStorage.setItem(
            STORAGE.user,
            JSON.stringify(
                sessionUser
            )
        );


        localStorage.setItem(
            STORAGE.role,
            sessionUser.role
        );


        localStorage.setItem(
            STORAGE.session,
            JSON.stringify({

                uid:
                    sessionUser.uid,

                role:
                    sessionUser.role,

                loginAt:
                    Date.now()

            })
        );


        if (
            sessionUser.role ===
            ROLES.CUSTOMER
        ) {

            localStorage.setItem(
                STORAGE.customer,
                JSON.stringify(
                    sessionUser
                )
            );

        }


        if (
            sessionUser.role ===
            ROLES.RIDER
        ) {

            localStorage.setItem(
                STORAGE.rider,
                JSON.stringify(
                    sessionUser
                )
            );

        }


        if (
            AUTH.isAdminRole(
                sessionUser.role
            )
        ) {

            localStorage.setItem(
                STORAGE.admin,
                JSON.stringify({

                    uid:
                        sessionUser.uid,

                    email:
                        sessionUser.email,

                    role:
                        sessionUser.role,

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


        localStorage.removeItem(
            STORAGE.user
        );

        localStorage.removeItem(
            STORAGE.role
        );

        localStorage.removeItem(
            STORAGE.session
        );

        localStorage.removeItem(
            STORAGE.customer
        );

        localStorage.removeItem(
            STORAGE.rider
        );

        localStorage.removeItem(
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


        const profile = {

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


        if (!FB) {

            return profile;

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

                    ...profile,

                    ...snapshot.data()

                };

            }

        } catch (error) {

            console.warn(
                "RiderX profile read failed:",
                error
            );

        }


        return profile;

    };


    /* =========================================================
       RESOLVE ROLE
    ========================================================= */

    AUTH.resolveRole = async function (
        user
    ) {

        if (!user) {

            return "";

        }


        let role =
            AUTH.normalizeRole(
                user.role ||
                user.userRole ||
                user.accountType
            );


        if (role) {

            return role;

        }


        const selectedRole =
            AUTH.normalizeRole(
                localStorage.getItem(
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


        const FB =
            await loadFirebase();


        if (!FB || !user.uid) {

            return "";

        }


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


                role =
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

            console.warn(
                "RiderX role lookup failed:",
                error
            );

        }


        return "";

    };


    /* =========================================================
       EMAIL LOGIN
    ========================================================= */

    AUTH.loginEmail = async function (
        email,
        password
    ) {

        email =
            String(
                email || ""
            )
            .trim()
            .toLowerCase();


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


        if (!FB) {

            throw new Error(
                "Firebase could not be loaded."
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


            const role =
                await AUTH.resolveRole(
                    profile
                );


            if (!role) {

                await FB.signOut(
                    FB.auth
                );


                throw new Error(
                    "Account role is not configured. Please contact RiderX support."
                );

            }


            if (
                [
                    "blocked",
                    "suspended",
                    "disabled"
                ].includes(
                    String(
                        profile.status ||
                        ""
                    ).toLowerCase()
                )
            ) {

                await FB.signOut(
                    FB.auth
                );


                throw new Error(
                    "This RiderX account has been disabled."
                );

            }


            profile.role =
                role;

            profile.userRole =
                role;


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
            String(
                data.email || ""
            )
            .trim()
            .toLowerCase();


        const password =
            String(
                data.password || ""
            );


        const role =
            AUTH.normalizeRole(
                data.role
            );


        const name =
            String(
                data.name ||
                data.fullName ||
                ""
            )
            .trim();


        const phone =
            String(
                data.phone ||
                data.mobile ||
                ""
            )
            .trim();


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


        if (!FB) {

            throw new Error(
                "Firebase could not be loaded."
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


            AUTH.saveSession(
                profile,
                role
            );


            AUTH.state.firebaseUser =
                firebaseUser;


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

        } finally {

            AUTH.state.loading =
                false;

        }

    };


    /* =========================================================
       SEND OTP
    ========================================================= */

    AUTH.sendOtp = async function (
        phoneNumber,
        container
    ) {

        phoneNumber =
            String(
                phoneNumber || ""
            )
            .trim();


        if (
            !phoneNumber.startsWith("+")
        ) {

            phoneNumber =
                "+91" +
                phoneNumber.replace(
                    /\D/g,
                    ""
                );

        }


        const FB =
            await loadFirebase();


        if (!FB) {

            throw new Error(
                "Firebase could not be loaded."
            );

        }


        if (!container) {

            throw new Error(
                "OTP verification container is required."
            );

        }


        let verifier;


        if (
            typeof container ===
            "object"
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
                    phoneNumber,
                    verifier
                );


            AUTH.phoneConfirmation =
                confirmation;


            localStorage.setItem(
                "riderx_otp_phone",
                phoneNumber
            );


            return {

                phone:
                    phoneNumber

            };

        } catch (error) {

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
            String(
                otp || ""
            )
            .trim();


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


        const result =
            await AUTH
                .phoneConfirmation
                .confirm(
                    otp
                );


        const firebaseUser =
            result.user;


        const profile =
            await AUTH.getProfile(
                firebaseUser
            );


        let resolvedRole =
            await AUTH.resolveRole(
                profile
            );


        if (!resolvedRole) {

            resolvedRole =
                AUTH.normalizeRole(
                    role
                );

        }


        if (!resolvedRole) {

            resolvedRole =
                AUTH.normalizeRole(
                    localStorage.getItem(
                        STORAGE.selectedRole
                    )
                );

        }


        if (!resolvedRole) {

            resolvedRole =
                ROLES.CUSTOMER;

        }


        profile.phone =
            profile.phone ||
            firebaseUser.phoneNumber ||
            localStorage.getItem(
                "riderx_otp_phone"
            ) ||
            "";


        profile.role =
            resolvedRole;


        profile.userRole =
            resolvedRole;


        profile.status =
            profile.status ||
            "active";


        const FB =
            await loadFirebase();


        if (FB) {

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

                        updatedAt:
                            Date.now()

                    },
                    {
                        merge:
                            true
                    }
                );

            } catch (error) {

                console.warn(
                    "OTP profile save failed:",
                    error
                );

            }

        }


        AUTH.saveSession(
            profile,
            resolvedRole
        );


        AUTH.state.firebaseUser =
            firebaseUser;


        AUTH.phoneConfirmation =
            null;


        AUTH.emit(
            "login",
            {

                user:
                    profile,

                role:
                    resolvedRole,

                method:
                    "phone"

            }
        );


        return {

            user:
                profile,

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

            AUTH.clearSession();


            localStorage.removeItem(
                "userRole"
            );


            localStorage.removeItem(
                "riderx_selected_role"
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

            return;

        }


        const FB =
            await loadFirebase();


        if (!FB) {

            return;

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


                        const role =
                            await AUTH.resolveRole(
                                profile
                            );


                        if (role) {

                            profile.role =
                                role;

                            profile.userRole =
                                role;


                            AUTH.saveSession(
                                profile,
                                role
                            );

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

                        console.warn(
                            "RiderX auth state error:",
                            error
                        );

                    }

                }
            );

    };


    /* =========================================================
       LOGIN STATE
    ========================================================= */

    AUTH.isLoggedIn = function () {

        return Boolean(
            AUTH.state.firebaseUser ||
            AUTH.getUser()
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

                ? roles.map(
                    AUTH.normalizeRole
                )

                : [
                    AUTH.normalizeRole(
                        roles
                    )
                ];


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

            AUTH.redirectByRole();

        }


        return false;

    };


    /* =========================================================
       REDIRECT
    ========================================================= */

    AUTH.redirectByRole = function () {

        const role =
            AUTH.normalizeRole(
                AUTH.getRole()
            );


        if (
            role === ROLES.ADMIN ||
            role === ROLES.SUPERADMIN
        ) {

            window.location.replace(
                "../admin/dashboard.html"
            );

            return;

        }


        if (
            role === ROLES.RIDER
        ) {

            window.location.replace(
                "../rider/home.html"
            );

            return;

        }


        if (
            role === ROLES.CUSTOMER
        ) {

            window.location.replace(
                "../customer/home.html"
            );

            return;

        }


        window.location.replace(
            "../auth/role.html"
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
            FB &&
            FB.auth.currentUser
        ) {

            const firebaseUpdates = {};


            if (
                updates.displayName !==
                undefined
            ) {

                firebaseUpdates.displayName =
                    updates.displayName;

            }


            if (
                updates.photoURL !==
                undefined
            ) {

                firebaseUpdates.photoURL =
                    updates.photoURL;

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


        updates.updatedAt =
            Date.now();


        if (FB) {

            const userRef =
                FB.doc(
                    FB.db,
                    "users",
                    uid
                );


            await FB.setDoc(
                userRef,
                updates,
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

                ...updates,

                uid:
                    current.uid ||
                    uid,

                role:
                    AUTH.getRole()

            };


        AUTH.saveSession(
            updated,
            AUTH.getRole()
        );


        AUTH.emit(
            "profile-updated",
            {
                user:
                    updated
            }
        );


        AUTH.renderUser();


        return updated;

    };


    /* =========================================================
       PASSWORD RESET
    ========================================================= */

    AUTH.resetPassword = async function (
        email
    ) {

        email =
            String(
                email || ""
            )
            .trim()
            .toLowerCase();


        if (!email) {

            throw new Error(
                "Email is required."
            );

        }


        const FB =
            await loadFirebase();


        if (!FB) {

            throw new Error(
                "Firebase could not be loaded."
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

            return;

        }


        window.addEventListener(
            "riderx-auth-" + name,
            function (event) {

                callback(
                    event.detail || {}
                );

            }
        );

    };


    /* =========================================================
       RENDER USER
    ========================================================= */

    AUTH.renderUser = function () {

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


        AUTH.state.initialized =
            true;


        AUTH.bindLogout();

        AUTH.renderUser();


        await AUTH.startListener();


        AUTH.emit(
            "ready"
        );


        console.log(
            "RiderX modular auth engine loaded."
        );

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
