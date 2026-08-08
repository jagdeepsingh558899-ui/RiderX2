/* ============================================================
   RIDERX
   AUTHENTICATION ENGINE
   File: js/auth.js

   Handles:
   - Firebase Authentication
   - Customer / Rider / Admin roles
   - Login state
   - Logout
   - Session storage
   - Auth guards
   - Role guards
   - Redirects
   - Auth state events
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AUTH =
        RX.auth =
        RX.auth || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    const STORAGE = {

        user:
            "riderx_user",

        role:
            "riderx_role",

        session:
            "riderx_session",

        adminSession:
            "riderx_admin_session"
    };


    const ROLES = {

        CUSTOMER:
            "customer",

        RIDER:
            "rider",

        ADMIN:
            "admin",

        SUPERADMIN:
            "superadmin"
    };


    /* ========================================================
       STATE
       ======================================================== */

    AUTH.state = {

        initialized:
            false,

        loading:
            false,

        user:
            null,

        role:
            null,

        firebaseUser:
            null,

        unsubscribe:
            null
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    AUTH.firebaseAuth = function () {

        try {

            if (
                window.firebase &&
                typeof firebase.auth ===
                "function"
            ) {

                return firebase.auth();
            }

        } catch (error) {

            console.warn(
                "RiderX Firebase Auth error:",
                error
            );
        }

        return null;
    };


    AUTH.firestore = function () {

        try {

            if (
                window.firebase &&
                typeof firebase.firestore ===
                "function"
            ) {

                return firebase.firestore();
            }

        } catch (error) {

            console.warn(
                "RiderX Firestore error:",
                error
            );
        }

        return null;
    };


    AUTH.database = function () {

        try {

            if (
                window.firebase &&
                typeof firebase.database ===
                "function"
            ) {

                return firebase.database();
            }

        } catch (error) {

            console.warn(
                "RiderX RTDB error:",
                error
            );
        }

        return null;
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    AUTH.normalizeRole = function (
        role
    ) {

        role =
            String(
                role || ""
            )
            .trim()
            .toLowerCase();


        if (
            role ===
            "customer"
        ) {

            return ROLES.CUSTOMER;
        }


        if (
            role ===
            "rider"
        ) {

            return ROLES.RIDER;
        }


        if (
            role ===
            "driver"
        ) {

            return ROLES.RIDER;
        }


        if (
            role ===
            "admin"
        ) {

            return ROLES.ADMIN;
        }


        if (
            role ===
            "super_admin" ||
            role ===
            "superadmin"
        ) {

            return ROLES.SUPERADMIN;
        }


        return "";
    };


    AUTH.isAdminRole = function (
        role
    ) {

        role =
            AUTH.normalizeRole(
                role
            );


        return (
            role === ROLES.ADMIN ||
            role === ROLES.SUPERADMIN
        );
    };


    AUTH.isRiderRole = function (
        role
    ) {

        return (
            AUTH.normalizeRole(
                role
            ) === ROLES.RIDER
        );
    };


    AUTH.isCustomerRole = function (
        role
    ) {

        return (
            AUTH.normalizeRole(
                role
            ) === ROLES.CUSTOMER
        );
    };


    AUTH.getStoredUser = function () {

        try {

            const data =
                localStorage.getItem(
                    STORAGE.user
                );


            if (!data) {
                return null;
            }


            return JSON.parse(
                data
            );

        } catch (error) {

            console.warn(
                "RiderX stored user error:",
                error
            );

            return null;
        }
    };


    AUTH.getStoredRole = function () {

        return AUTH.normalizeRole(
            localStorage.getItem(
                STORAGE.role
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


        return (
            user?.email ||
            ""
        );
    };


    /* ========================================================
       SAVE SESSION
       ======================================================== */

    AUTH.saveSession = function (
        user,
        role
    ) {

        role =
            AUTH.normalizeRole(
                role
            );


        if (!user) {
            return;
        }


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
                role,

            online:
                user.online === true,

            updatedAt:
                Date.now()
        };


        AUTH.state.user =
            sessionUser;

        AUTH.state.role =
            role;


        localStorage.setItem(
            STORAGE.user,
            JSON.stringify(
                sessionUser
            )
        );


        localStorage.setItem(
            STORAGE.role,
            role
        );


        localStorage.setItem(
            STORAGE.session,
            JSON.stringify(
                {
                    uid:
                        sessionUser.uid,

                    role:
                        role,

                    loginAt:
                        Date.now()
                }
            )
        );


        if (
            AUTH.isAdminRole(
                role
            )
        ) {

            localStorage.setItem(
                STORAGE.adminSession,
                JSON.stringify(
                    {
                        uid:
                            sessionUser.uid,

                        email:
                            sessionUser.email,

                        role:
                            role,

                        loginAt:
                            Date.now()
                    }
                )
            );
        }
    };


    /* ========================================================
       CLEAR SESSION
       ======================================================== */

    AUTH.clearSession = function () {

        AUTH.state.user =
            null;

        AUTH.state.role =
            null;

        AUTH.state.firebaseUser =
            null;


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
            STORAGE.adminSession
        );
    };


    /* ========================================================
       FIREBASE USER -> PROFILE
       ======================================================== */

    AUTH.firebaseUserProfile =
        async function (
            firebaseUser
        ) {

            if (
                !firebaseUser
            ) {
                return null;
            }


            let profile = {

                uid:
                    firebaseUser.uid,

                email:
                    firebaseUser.email ||
                    "",

                displayName:
                    firebaseUser.displayName ||
                    "",

                phone:
                    firebaseUser.phoneNumber ||
                    "",

                photoURL:
                    firebaseUser.photoURL ||
                    ""
            };


            /*
             * Firestore profile.
             */

            const firestore =
                AUTH.firestore();


            if (firestore) {

                try {

                    const doc =
                        await firestore
                            .collection(
                                "users"
                            )
                            .doc(
                                firebaseUser.uid
                            )
                            .get();


                    if (
                        doc.exists
                    ) {

                        profile = {

                            ...profile,

                            ...doc.data()
                        };
                    }

                } catch (error) {

                    console.warn(
                        "RiderX Firestore profile error:",
                        error
                    );
                }
            }


            /*
             * Realtime Database fallback.
             */

            const database =
                AUTH.database();


            if (
                database &&
                !profile.role
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                "users/" +
                                firebaseUser.uid
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val();


                    if (data) {

                        profile = {

                            ...profile,

                            ...data
                        };
                    }

                } catch (error) {

                    console.warn(
                        "RiderX RTDB profile error:",
                        error
                    );
                }
            }


            return profile;
        };


    /* ========================================================
       GET ROLE FROM USER
       ======================================================== */

    AUTH.resolveRole =
        async function (
            user
        ) {

            if (!user) {
                return "";
            }


            /*
             * Existing profile role.
             */

            let role =
                AUTH.normalizeRole(
                    user.role ||
                    user.userRole ||
                    user.accountType
                );


            if (role) {
                return role;
            }


            /*
             * Firestore.
             */

            const firestore =
                AUTH.firestore();


            if (firestore) {

                try {

                    const doc =
                        await firestore
                            .collection(
                                "users"
                            )
                            .doc(
                                user.uid
                            )
                            .get();


                    if (
                        doc.exists
                    ) {

                        const data =
                            doc.data() ||
                            {};


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
                        "Role Firestore lookup failed:",
                        error
                    );
                }
            }


            /*
             * Realtime Database.
             */

            const database =
                AUTH.database();


            if (database) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                "users/" +
                                user.uid
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val() ||
                        {};


                    role =
                        AUTH.normalizeRole(
                            data.role ||
                            data.userRole ||
                            data.accountType
                        );


                    if (role) {
                        return role;
                    }

                } catch (error) {

                    console.warn(
                        "Role RTDB lookup failed:",
                        error
                    );
                }
            }


            return "";
        };


    /* ========================================================
       EMAIL LOGIN
       ======================================================== */

    AUTH.loginEmail = async function (
        email,
        password
    ) {

        email =
            String(
                email || ""
            )
            .trim();


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


        const auth =
            AUTH.firebaseAuth();


        if (!auth) {

            throw new Error(
                "Firebase Authentication is not available."
            );
        }


        AUTH.state.loading =
            true;


        try {

            const result =
                await auth
                    .signInWithEmailAndPassword(
                        email,
                        password
                    );


            const profile =
                await AUTH
                    .firebaseUserProfile(
                        result.user
                    );


            const role =
                await AUTH.resolveRole(
                    profile
                );


            if (!role) {

                await auth.signOut();


                throw new Error(
                    "Your RiderX account role is not configured."
                );
            }


            AUTH.saveSession(
                profile,
                role
            );


            AUTH.state.firebaseUser =
                result.user;


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
                    result.user
            };

        } finally {

            AUTH.state.loading =
                false;
        }
    };


    /* ========================================================
       REGISTER
       ======================================================== */

    AUTH.register = async function (
        data
    ) {

        data =
            data || {};


        const email =
            String(
                data.email || ""
            )
            .trim();


        const password =
            String(
                data.password || ""
            );


        const role =
            AUTH.normalizeRole(
                data.role
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
            !role ||
            ![
                ROLES.CUSTOMER,
                ROLES.RIDER
            ].includes(
                role
            )
        ) {

            throw new Error(
                "A valid customer or rider role is required."
            );
        }


        const auth =
            AUTH.firebaseAuth();


        if (!auth) {

            throw new Error(
                "Firebase Authentication is not available."
            );
        }


        AUTH.state.loading =
            true;


        try {

            const result =
                await auth
                    .createUserWithEmailAndPassword(
                        email,
                        password
                    );


            const uid =
                result.user.uid;


            const profile = {

                uid:
                    uid,

                email:
                    email,

                name:
                    data.name ||
                    "",

                displayName:
                    data.name ||
                    "",

                phone:
                    data.phone ||
                    "",

                role:
                    role,

                userRole:
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


            /*
             * Firebase profile.
             */

            try {

                await result.user
                    .updateProfile(
                        {
                            displayName:
                                profile.name
                        }
                    );

            } catch (error) {

                console.warn(
                    "Firebase display profile failed:",
                    error
                );
            }


            /*
             * Firestore.
             */

            const firestore =
                AUTH.firestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            "users"
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

                } catch (error) {

                    console.warn(
                        "Firestore registration profile failed:",
                        error
                    );
                }
            }


            /*
             * Realtime Database.
             */

            const database =
                AUTH.database();


            if (database) {

                try {

                    await database
                        .ref(
                            "users/" +
                            uid
                        )
                        .update(
                            profile
                        );

                } catch (error) {

                    console.warn(
                        "RTDB registration profile failed:",
                        error
                    );
                }
            }


            AUTH.saveSession(
                profile,
                role
            );


            AUTH.state.firebaseUser =
                result.user;


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
                    result.user
            };

        } finally {

            AUTH.state.loading =
                false;
        }
    };


    /* ========================================================
       PHONE OTP
       ======================================================== */

    AUTH.phoneConfirmation =
        null;


    AUTH.sendOtp = async function (
        phoneNumber,
        recaptchaContainer
    ) {

        phoneNumber =
            String(
                phoneNumber || ""
            )
            .trim();


        if (!phoneNumber) {

            throw new Error(
                "Phone number is required."
            );
        }


        const auth =
            AUTH.firebaseAuth();


        if (!auth) {

            throw new Error(
                "Firebase Authentication is not available."
            );
        }


        if (
            !recaptchaContainer
        ) {

            throw new Error(
                "OTP verification container is required."
            );
        }


        let verifier;


        if (
            typeof recaptchaContainer ===
            "object" &&
            recaptchaContainer.verify
        ) {

            verifier =
                recaptchaContainer;

        } else {

            verifier =
                new firebase.auth
                    .RecaptchaVerifier(
                        recaptchaContainer,
                        {
                            size:
                                "invisible"
                        }
                    );
        }


        const provider =
            new firebase.auth
                .PhoneAuthProvider();


        const verificationId =
            await provider
                .verifyPhoneNumber(
                    phoneNumber,
                    verifier
                );


        AUTH.phoneConfirmation = {

            verificationId:
                verificationId,

            phone:
                phoneNumber,

            createdAt:
                Date.now()
        };


        return {

            verificationId:
                verificationId,

            phone:
                phoneNumber
        };
    };


    /* ========================================================
       VERIFY OTP
       ======================================================== */

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
            otp.length !== 6
        ) {

            throw new Error(
                "Enter the 6-digit OTP."
            );
        }


        const confirmation =
            AUTH.phoneConfirmation;


        if (
            !confirmation
        ) {

            throw new Error(
                "Please request a new OTP."
            );
        }


        const auth =
            AUTH.firebaseAuth();


        if (!auth) {

            throw new Error(
                "Firebase Authentication is not available."
            );
        }


        const credential =
            firebase.auth
                .PhoneAuthProvider
                .credential(
                    confirmation.verificationId,
                    otp
                );


        AUTH.state.loading =
            true;


        try {

            const result =
                await auth
                    .signInWithCredential(
                        credential
                    );


            const profile =
                await AUTH
                    .firebaseUserProfile(
                        result.user
                    );


            let resolvedRole =
                await AUTH.resolveRole(
                    profile
                );


            /*
             * For a brand-new phone account,
             * use selected customer/rider role.
             */

            if (
                !resolvedRole
            ) {

                resolvedRole =
                    AUTH.normalizeRole(
                        role
                    );
            }


            if (
                !resolvedRole
            ) {

                resolvedRole =
                    ROLES.CUSTOMER;
            }


            profile.phone =
                profile.phone ||
                confirmation.phone;


            profile.role =
                resolvedRole;


            profile.userRole =
                resolvedRole;


            /*
             * Save user profile if this is
             * a newly created phone account.
             */

            const firestore =
                AUTH.firestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            "users"
                        )
                        .doc(
                            result.user.uid
                        )
                        .set(
                            {
                                ...profile,

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
                        "OTP Firestore profile failed:",
                        error
                    );
                }
            }


            const database =
                AUTH.database();


            if (database) {

                try {

                    await database
                        .ref(
                            "users/" +
                            result.user.uid
                        )
                        .update(
                            {
                                ...profile,

                                updatedAt:
                                    Date.now()
                            }
                        );

                } catch (error) {

                    console.warn(
                        "OTP RTDB profile failed:",
                        error
                    );
                }
            }


            AUTH.saveSession(
                profile,
                resolvedRole
            );


            AUTH.state.firebaseUser =
                result.user;


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
                    result.user
            };

        } finally {

            AUTH.state.loading =
                false;
        }
    };


    /* ========================================================
       LOGOUT
       ======================================================== */

    AUTH.logout = async function () {

        try {

            const user =
                AUTH.getUser();


            /*
             * Rider offline state.
             */

            if (
                user &&
                AUTH.isRiderRole(
                    AUTH.getRole()
                )
            ) {

                const database =
                    AUTH.database();


                if (database) {

                    try {

                        await database
                            .ref(
                                "users/" +
                                AUTH.getUid()
                            )
                            .update(
                                {
                                    online:
                                        false,

                                    lastSeen:
                                        Date.now()
                                }
                            );

                    } catch (error) {

                        console.warn(
                            "Rider offline update failed:",
                            error
                        );
                    }
                }
            }


            const auth =
                AUTH.firebaseAuth();


            if (auth) {

                await auth.signOut();
            }

        } catch (error) {

            console.warn(
                "Firebase logout failed:",
                error
            );

        } finally {

            AUTH.clearSession();


            AUTH.emit(
                "logout"
            );
        }
    };


    /* ========================================================
       AUTH STATE
       ======================================================== */

    AUTH.startListener = function () {

        if (
            AUTH.state.unsubscribe
        ) {

            return;
        }


        const auth =
            AUTH.firebaseAuth();


        if (!auth) {

            return;
        }


        AUTH.state.unsubscribe =
            auth.onAuthStateChanged(
                async function (
                    firebaseUser
                ) {

                    AUTH.state.firebaseUser =
                        firebaseUser;


                    if (
                        !firebaseUser
                    ) {

                        AUTH.emit(
                            "signed-out"
                        );

                        return;
                    }


                    try {

                        const profile =
                            await AUTH
                                .firebaseUserProfile(
                                    firebaseUser
                                );


                        const role =
                            await AUTH
                                .resolveRole(
                                    profile
                                );


                        if (
                            role
                        ) {

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

                    } catch (error) {

                        console.warn(
                            "Auth state profile error:",
                            error
                        );
                    }
                }
            );
    };


    /* ========================================================
       CHECK LOGIN
       ======================================================== */

    AUTH.isLoggedIn = function () {

        if (
            AUTH.state.firebaseUser
        ) {

            return true;
        }


        return Boolean(
            AUTH.getUser()
        );
    };


    /* ========================================================
       CHECK ROLE
       ======================================================== */

    AUTH.hasRole = function (
        role
    ) {

        const current =
            AUTH.normalizeRole(
                AUTH.getRole()
            );


        const wanted =
            AUTH.normalizeRole(
                role
            );


        return (
            current !== "" &&
            current === wanted
        );
    };


    AUTH.requireRole = function (
        roles,
        options
    ) {

        options =
            options || {};


        const allowed =
            Array.isArray(
                roles
            )
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
            allowed.includes(
                current
            )
        ) {

            return true;
        }


        if (
            options.redirect !==
            false
        ) {

            AUTH.redirectByRole();
        }


        return false;
    };


    /* ========================================================
       REDIRECT BY ROLE
       ======================================================== */

    AUTH.redirectByRole = function () {

        const role =
            AUTH.normalizeRole(
                AUTH.getRole()
            );


        if (
            role ===
            ROLES.ADMIN ||
            role ===
            ROLES.SUPERADMIN
        ) {

            window.location.replace(
                "../admin/dashboard.html"
            );

            return;
        }


        if (
            role ===
            ROLES.RIDER
        ) {

            window.location.replace(
                "../rider/home.html"
            );

            return;
        }


        if (
            role ===
            ROLES.CUSTOMER
        ) {

            window.location.replace(
                "../customer/home.html"
            );

            return;
        }


        window.location.replace(
            "../auth/login.html"
        );
    };


    /* ========================================================
       CURRENT USER UPDATE
       ======================================================== */

    AUTH.updateProfile = async function (
        updates
    ) {

        const uid =
            AUTH.getUid();


        if (!uid) {

            throw new Error(
                "User is not logged in."
            );
        }


        updates =
            updates || {};


        updates.updatedAt =
            Date.now();


        const auth =
            AUTH.firebaseAuth();


        if (
            auth &&
            auth.currentUser
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

                try {

                    await auth.currentUser
                        .updateProfile(
                            firebaseUpdates
                        );

                } catch (error) {

                    console.warn(
                        "Firebase profile update failed:",
                        error
                    );
                }
            }
        }


        const firestore =
            AUTH.firestore();


        if (firestore) {

            try {

                await firestore
                    .collection(
                        "users"
                    )
                    .doc(
                        uid
                    )
                    .set(
                        updates,
                        {
                            merge:
                                true
                        }
                    );

            } catch (error) {

                console.warn(
                    "Firestore profile update failed:",
                    error
                );
            }
        }


        const database =
            AUTH.database();


        if (database) {

            try {

                await database
                    .ref(
                        "users/" +
                        uid
                    )
                    .update(
                        updates
                    );

            } catch (error) {

                console.warn(
                    "RTDB profile update failed:",
                    error
                );
            }
        }


        const current =
            AUTH.getUser() ||
            {};


        const updatedUser = {

            ...current,

            ...updates,

            uid:
                current.uid ||
                uid,

            role:
                AUTH.getRole()
        };


        AUTH.saveSession(
            updatedUser,
            AUTH.getRole()
        );


        AUTH.emit(
            "profile-updated",
            {
                user:
                    updatedUser
            }
        );


        return updatedUser;
    };


    /* ========================================================
       PASSWORD RESET
       ======================================================== */

    AUTH.resetPassword =
        async function (
            email
        ) {

            email =
                String(
                    email || ""
                )
                .trim();


            if (!email) {

                throw new Error(
                    "Email is required."
                );
            }


            const auth =
                AUTH.firebaseAuth();


            if (!auth) {

                throw new Error(
                    "Firebase Authentication is not available."
                );
            }


            await auth
                .sendPasswordResetEmail(
                    email
                );


            return true;
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    AUTH.emit = function (
        eventName,
        detail
    ) {

        try {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-auth-" +
                    eventName,
                    {
                        detail:
                            detail ||
                            {}
                    }
                )
            );

        } catch (error) {

            console.warn(
                "RiderX auth event error:",
                error
            );
        }
    };


    AUTH.on = function (
        eventName,
        callback
    ) {

        if (
            typeof callback !==
            "function"
        ) {

            return;
        }


        window.addEventListener(
            "riderx-auth-" +
            eventName,
            function (
                event
            ) {

                callback(
                    event.detail ||
                    {}
                );
            }
        );
    };


    /* ========================================================
       AUTH UI
       ======================================================== */

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
                function (
                    element
                ) {

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
                        role;
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


    /* ========================================================
       LOGOUT BUTTONS
       ======================================================== */

    AUTH.bindLogout =
        function () {

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


                    AUTH.logout();
                }
            );
        };


    /* ========================================================
       INIT
       ======================================================== */

    AUTH.init = function () {

        if (
            AUTH.state.initialized
        ) {

            return;
        }


        AUTH.startListener();

        AUTH.bindLogout();

        AUTH.renderUser();


        AUTH.state.initialized =
            true;


        AUTH.emit(
            "ready"
        );


        console.log(
            "RiderX auth.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

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


    /* ========================================================
       AUTO INIT
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            AUTH.init
        );

    } else {

        AUTH.init();
    }

})();
