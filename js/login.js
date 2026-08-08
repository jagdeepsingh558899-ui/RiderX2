/* ============================================================
   RIDERX LOGIN CONTROLLER
   File: js/login.js

   Handles:
   - Email/password login
   - Firebase Authentication
   - Customer / Rider / Admin routing
   - Role detection
   - Session persistence
   - Login form handling
   - Error messages
   - OTP page integration hooks

   Firebase configuration is loaded from:
   firebase/firebase-config.js
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Login =
        RX.login =
        RX.login || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Login.config = {

        loginPage:
            "login.html",

        customerHome:
            "../customer/home.html",

        riderHome:
            "../rider/home.html",

        adminDashboard:
            "../admin/dashboard.html",

        rolePage:
            "role.html",

        registerPage:
            "register.html",

        otpPage:
            "otp-login.html",

        loadingTimeout:
            15000
    };


    /* ========================================================
       STATE
       ======================================================== */

    Login.state = {

        initialized:
            false,

        loading:
            false,

        user:
            null,

        role:
            null,

        error:
            null
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    Login.getElement =
        function (
            selector
        ) {

            return document.querySelector(
                selector
            );
        };


    Login.getElements =
        function (
            selector
        ) {

            return document.querySelectorAll(
                selector
            );
        };


    Login.normalizeRole =
        function (
            role
        ) {

            role =
                String(
                    role ||
                    ""
                )
                .toLowerCase()
                .trim();


            if (
                role === "user" ||
                role === "customer" ||
                role === "passenger"
            ) {

                return "customer";
            }


            if (
                role === "driver" ||
                role === "rider"
            ) {

                return "rider";
            }


            if (
                role === "admin" ||
                role === "administrator"
            ) {

                return "admin";
            }


            return null;
        };


    Login.getFirebaseAuth =
        function () {

            try {

                if (
                    RX.firebase?.auth
                ) {

                    return RX.firebase.auth;
                }


                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth();
                }

            } catch (error) {

                console.error(
                    "Firebase Auth error:",
                    error
                );
            }


            return null;
        };


    Login.getFirestore =
        function () {

            try {

                if (
                    RX.firebase?.firestore
                ) {

                    return RX.firebase.firestore;
                }


                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {

                console.error(
                    "Firestore error:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Login.showMessage =
        function (
            message,
            type
        ) {

            type =
                type ||
                "info";


            const selectors = [

                "#loginMessage",

                "#errorMessage",

                "#authMessage",

                ".login-message",

                ".auth-message"
            ];


            let element =
                null;


            for (
                const selector of selectors
            ) {

                element =
                    Login.getElement(
                        selector
                    );


                if (
                    element
                ) {

                    break;
                }
            }


            if (
                !element
            ) {

                /*
                 * Create a message box if
                 * the page doesn't already
                 * contain one.
                 */

                element =
                    document.createElement(
                        "div"
                    );


                element.id =
                    "loginMessage";


                const form =
                    Login.getElement(
                        "form"
                    );


                if (
                    form?.parentNode
                ) {

                    form.parentNode
                        .insertBefore(
                            element,
                            form
                        );

                } else {

                    document.body
                        .prepend(
                            element
                        );
                }
            }


            element.textContent =
                message || "";


            element.dataset.type =
                type;


            element.hidden =
                !message;


            return element;
        };


    Login.clearMessage =
        function () {

            Login.showMessage(
                "",
                "info"
            );
        };


    /* ========================================================
       LOADING
       ======================================================== */

    Login.setLoading =
        function (
            loading
        ) {

            Login.state.loading =
                Boolean(
                    loading
                );


            document.body.classList.toggle(
                "login-loading",
                Login.state.loading
            );


            const buttons =
                Login.getElements(
                    [
                        "#loginButton",

                        "#submitLogin",

                        "[data-login-submit]",

                        "button[type='submit']"
                    ].join(",")
                );


            buttons.forEach(
                function (
                    button
                ) {

                    button.disabled =
                        Login.state.loading;


                    if (
                        Login.state.loading
                    ) {

                        if (
                            !button
                                .dataset
                                .originalText
                        ) {

                            button.dataset
                                .originalText =
                                button
                                    .textContent;
                        }


                        const text =
                            button.dataset
                                .loadingText ||
                            "Logging in...";


                        button.textContent =
                            text;

                    } else {

                        if (
                            button.dataset
                                .originalText
                        ) {

                            button.textContent =
                                button.dataset
                                    .originalText;
                        }
                    }
                }
            );
        };


    /* ========================================================
       EMAIL VALIDATION
       ======================================================== */

    Login.isValidEmail =
        function (
            email
        ) {

            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(
                    String(
                        email ||
                        ""
                    )
                    .trim()
                );
        };


    Login.isValidPassword =
        function (
            password
        ) {

            return String(
                password ||
                ""
            ).length >= 6;
        };


    /* ========================================================
       GET FORM DATA
       ======================================================== */

    Login.getFormData =
        function (
            form
        ) {

            form =
                form ||
                Login.getElement(
                    "#loginForm"
                ) ||
                Login.getElement(
                    "form"
                );


            if (
                !form
            ) {

                return {

                    email:
                        "",

                    password:
                        "",

                    role:
                        null
                };
            }


            const emailInput =
                form.querySelector(
                    [
                        "#email",

                        "#loginEmail",

                        "[name='email']",

                        "input[type='email']"
                    ].join(",")
                );


            const passwordInput =
                form.querySelector(
                    [
                        "#password",

                        "#loginPassword",

                        "[name='password']",

                        "input[type='password']"
                    ].join(",")
                );


            const roleInput =
                form.querySelector(
                    [
                        "#role",

                        "[name='role']",

                        "[data-role]"
                    ].join(",")
                );


            return {

                email:
                    String(
                        emailInput?.value ||
                        ""
                    ).trim(),

                password:
                    String(
                        passwordInput?.value ||
                        ""
                    ),

                role:
                    Login.normalizeRole(
                        roleInput?.value ||
                        roleInput?.dataset?.role ||
                        localStorage.getItem(
                            "riderx_role"
                        )
                    )
            };
        };


    /* ========================================================
       SAVE SESSION
       ======================================================== */

    Login.saveSession =
        function (
            user,
            role,
            extra
        ) {

            role =
                Login.normalizeRole(
                    role
                );


            const session = {

                uid:
                    user?.uid ||
                    user?.id ||
                    null,

                email:
                    user?.email ||
                    null,

                phone:
                    user?.phoneNumber ||
                    user?.phone ||
                    null,

                role:
                    role,

                displayName:
                    user?.displayName ||
                    user?.name ||
                    "",

                photoURL:
                    user?.photoURL ||
                    user?.photo ||
                    "",

                loginAt:
                    Date.now(),

                ...(extra || {})
            };


            try {

                localStorage.setItem(
                    "riderx_user",
                    JSON.stringify(
                        session
                    )
                );


                if (
                    session.uid
                ) {

                    localStorage.setItem(
                        "riderx_uid",
                        session.uid
                    );
                }


                if (
                    role
                ) {

                    localStorage.setItem(
                        "riderx_role",
                        role
                    );
                }

            } catch (error) {

                console.warn(
                    "Session save failed:",
                    error
                );
            }


            Login.state.user =
                session;


            Login.state.role =
                role;


            return session;
        };


    /* ========================================================
       GET SAVED SESSION
       ======================================================== */

    Login.getSavedSession =
        function () {

            try {

                const data =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    !data
                ) {

                    return null;
                }


                return JSON.parse(
                    data
                );

            } catch (error) {

                return null;
            }
        };


    /* ========================================================
       CLEAR SESSION
       ======================================================== */

    Login.clearSession =
        function () {

            try {

                localStorage.removeItem(
                    "riderx_user"
                );

                localStorage.removeItem(
                    "riderx_uid"
                );

                localStorage.removeItem(
                    "riderx_role"
                );

            } catch (error) {}
        };


    /* ========================================================
       GET ROLE FROM FIRESTORE
       ======================================================== */

    Login.getUserRole =
        async function (
            uid
        ) {

            if (
                !uid
            ) {

                return null;
            }


            const firestore =
                Login.getFirestore();


            if (
                !firestore
            ) {

                return null;
            }


            /*
             * First check users/{uid}
             */

            try {

                const userDoc =
                    await firestore
                        .collection(
                            "users"
                        )
                        .doc(
                            uid
                        )
                        .get();


                if (
                    userDoc.exists
                ) {

                    const data =
                        userDoc.data() ||
                        {};


                    const role =
                        Login.normalizeRole(
                            data.role
                        );


                    if (
                        role
                    ) {

                        return role;
                    }
                }

            } catch (error) {

                console.warn(
                    "User role lookup failed:",
                    error
                );
            }


            /*
             * Check riders/{uid}
             */

            try {

                const riderDoc =
                    await firestore
                        .collection(
                            "riders"
                        )
                        .doc(
                            uid
                        )
                        .get();


                if (
                    riderDoc.exists
                ) {

                    return "rider";
                }

            } catch (error) {}


            /*
             * Check customers/{uid}
             */

            try {

                const customerDoc =
                    await firestore
                        .collection(
                            "customers"
                        )
                        .doc(
                            uid
                        )
                        .get();


                if (
                    customerDoc.exists
                ) {

                    return "customer";
                }

            } catch (error) {}


            /*
             * Check admins/{uid}
             */

            try {

                const adminDoc =
                    await firestore
                        .collection(
                            "admins"
                        )
                        .doc(
                            uid
                        )
                        .get();


                if (
                    adminDoc.exists
                ) {

                    return "admin";
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       ADMIN CHECK
       ======================================================== */

    Login.isAdmin =
        async function (
            user
        ) {

            if (
                !user
            ) {

                return false;
            }


            const uid =
                user.uid ||
                user.id;


            if (
                !uid
            ) {

                return false;
            }


            /*
             * Firestore admin document.
             */

            const firestore =
                Login.getFirestore();


            if (
                firestore
            ) {

                try {

                    const adminDoc =
                        await firestore
                            .collection(
                                "admins"
                            )
                            .doc(
                                uid
                            )
                            .get();


                    if (
                        adminDoc.exists
                    ) {

                        return true;
                    }

                } catch (error) {}
            }


            /*
             * Custom claim if available.
             */

            try {

                if (
                    typeof user
                        .getIdTokenResult ===
                    "function"
                ) {

                    const token =
                        await user
                            .getIdTokenResult(
                                true
                            );


                    if (
                        token.claims
                            ?.admin === true
                    ) {

                        return true;
                    }
                }

            } catch (error) {}


            return false;
        };


    /* ========================================================
       DETECT ROLE
       ======================================================== */

    Login.detectRole =
        async function (
            user,
            requestedRole
        ) {

            requestedRole =
                Login.normalizeRole(
                    requestedRole
                );


            /*
             * Admin must always be
             * verified from backend.
             */

            if (
                requestedRole ===
                "admin"
            ) {

                const admin =
                    await Login.isAdmin(
                        user
                    );


                return admin
                    ? "admin"
                    : null;
            }


            /*
             * Backend role has priority.
             */

            const backendRole =
                await Login.getUserRole(
                    user?.uid
                );


            if (
                backendRole
            ) {

                return backendRole;
            }


            /*
             * Requested role can be used
             * when no backend profile exists.
             */

            if (
                requestedRole
            ) {

                return requestedRole;
            }


            /*
             * Existing local role.
             */

            const savedRole =
                Login.normalizeRole(
                    localStorage.getItem(
                        "riderx_role"
                    )
                );


            return savedRole;
        };


    /* ========================================================
       ROUTE USER
       ======================================================== */

    Login.routeUser =
        function (
            role,
            options
        ) {

            options =
                options || {};


            role =
                Login.normalizeRole(
                    role
                );


            let target =
                null;


            if (
                role === "admin"
            ) {

                target =
                    Login.config
                        .adminDashboard;

            } else if (
                role === "rider"
            ) {

                target =
                    Login.config
                        .riderHome;

            } else if (
                role === "customer"
            ) {

                target =
                    Login.config
                        .customerHome;

            } else {

                target =
                    Login.config
                        .rolePage;
            }


            /*
             * Allow explicit redirect only
             * for internal RiderX pages.
             */

            if (
                options.redirect &&
                typeof options.redirect ===
                "string" &&
                !options.redirect
                    .includes("://")
            ) {

                target =
                    options.redirect;
            }


            Login.state.role =
                role;


            if (
                options.replace ===
                false
            ) {

                window.location.href =
                    target;

            } else {

                window.location.replace(
                    target
                );
            }


            return target;
        };


    /* ========================================================
       LOGIN WITH EMAIL
       ======================================================== */

    Login.loginWithEmail =
        async function (
            email,
            password,
            requestedRole
        ) {

            email =
                String(
                    email ||
                    ""
                ).trim();


            password =
                String(
                    password ||
                    ""
                );


            if (
                !Login.isValidEmail(
                    email
                )
            ) {

                throw new Error(
                    "Please enter a valid email address."
                );
            }


            if (
                !Login.isValidPassword(
                    password
                )
            ) {

                throw new Error(
                    "Password must be at least 6 characters."
                );
            }


            const auth =
                Login.getFirebaseAuth();


            if (
                !auth
            ) {

                throw new Error(
                    "Firebase Authentication is not available."
                );
            }


            Login.setLoading(
                true
            );


            try {

                const result =
                    await auth
                        .signInWithEmailAndPassword(
                            email,
                            password
                        );


                const user =
                    result.user;


                /*
                 * Detect verified role.
                 */

                const role =
                    await Login.detectRole(
                        user,
                        requestedRole
                    );


                if (
                    !role
                ) {

                    /*
                     * Sign out if admin
                     * verification or role
                     * validation fails.
                     */

                    if (
                        requestedRole ===
                        "admin"
                    ) {

                        await auth.signOut();

                        throw new Error(
                            "Admin access denied."
                        );
                    }


                    Login.saveSession(
                        user,
                        requestedRole ||
                        "customer"
                    );


                    Login.setLoading(
                        false
                    );


                    return {

                        success:
                            true,

                        user:
                            user,

                        role:
                            requestedRole ||
                            "customer",

                        needsRole:
                            true
                    };
                }


                const session =
                    Login.saveSession(
                        user,
                        role
                    );


                Login.emit(
                    "success",
                    {

                        user:
                            user,

                        role:
                            role,

                        session:
                            session
                    }
                );


                Login.setLoading(
                    false
                );


                return {

                    success:
                        true,

                    user:
                        user,

                    role:
                        role,

                    session:
                        session
                };

            } catch (error) {

                Login.setLoading(
                    false
                );


                Login.state.error =
                    error;


                throw Login.formatFirebaseError(
                    error
                );
            }
        };


    /* ========================================================
       FIREBASE ERROR FORMAT
       ======================================================== */

    Login.formatFirebaseError =
        function (
            error
        ) {

            const code =
                error?.code ||
                "";


            const messages = {

                "auth/invalid-email":
                    "Please enter a valid email address.",

                "auth/user-disabled":
                    "This account has been disabled.",

                "auth/user-not-found":
                    "No account found with this email.",

                "auth/wrong-password":
                    "Incorrect password.",

                "auth/invalid-credential":
                    "Invalid email or password.",

                "auth/too-many-requests":
                    "Too many attempts. Please try again later.",

                "auth/network-request-failed":
                    "Network error. Please check your internet connection.",

                "auth/user-mismatch":
                    "Account verification failed.",

                "auth/operation-not-allowed":
                    "This login method is not enabled.",

                "auth/internal-error":
                    "Authentication service error."
            };


            const message =
                messages[code] ||
                error?.message ||
                "Unable to login. Please try again.";


            const formatted =
                new Error(
                    message
                );


            formatted.code =
                code;


            formatted.original =
                error;


            return formatted;
        };


    /* ========================================================
       HANDLE EMAIL FORM
       ======================================================== */

    Login.handleSubmit =
        async function (
            event
        ) {

            if (
                event
            ) {

                event.preventDefault();
            }


            const form =
                event?.currentTarget ||
                Login.getElement(
                    "#loginForm"
                ) ||
                Login.getElement(
                    "form"
                );


            const data =
                Login.getFormData(
                    form
                );


            Login.clearMessage();


            try {

                const result =
                    await Login.loginWithEmail(
                        data.email,
                        data.password,
                        data.role
                    );


                /*
                 * If role is missing,
                 * open role selection.
                 */

                if (
                    result.needsRole
                ) {

                    Login.showMessage(
                        "Please select your account type.",
                        "warning"
                    );


                    try {

                        localStorage.setItem(
                            "riderx_pending_role",
                            "true"
                        );

                    } catch (error) {}


                    setTimeout(
                        function () {

                            Login.routeUser(
                                null,
                                {
                                    replace:
                                        true
                                }
                            );

                        },
                        500
                    );


                    return result;
                }


                Login.showMessage(
                    "Login successful.",
                    "success"
                );


                /*
                 * Small delay allows UI to
                 * show success state.
                 */

                setTimeout(
                    function () {

                        Login.routeUser(
                            result.role
                        );

                    },
                    150
                );


                return result;

            } catch (error) {

                Login.showMessage(
                    error.message,
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        error
                };
            }
        };


    /* ========================================================
       PHONE LOGIN HOOK
       ======================================================== */

    Login.loginWithPhone =
        async function (
            phone,
            appVerifier
        ) {

            phone =
                String(
                    phone ||
                    ""
                ).trim();


            if (
                !phone
            ) {

                throw new Error(
                    "Please enter your phone number."
                );
            }


            const auth =
                Login.getFirebaseAuth();


            if (
                !auth
            ) {

                throw new Error(
                    "Firebase Authentication is not available."
                );
            }


            /*
             * Firebase Phone Auth.
             */

            try {

                const confirmationResult =
                    await auth
                        .signInWithPhoneNumber(
                            phone,
                            appVerifier
                        );


                /*
                 * Store confirmation result
                 * for otp.js / verify-otp.js.
                 */

                RX.loginConfirmationResult =
                    confirmationResult;


                try {

                    sessionStorage.setItem(
                        "riderx_phone",
                        phone
                    );

                } catch (error) {}


                Login.emit(
                    "otp-sent",
                    {
                        phone:
                            phone
                    }
                );


                return {

                    success:
                        true,

                    confirmationResult:
                        confirmationResult
                };

            } catch (error) {

                throw Login.formatFirebaseError(
                    error
                );
            }
        };


    /* ========================================================
       COMPLETE PHONE LOGIN
       ======================================================== */

    Login.verifyPhoneOTP =
        async function (
            otp,
            requestedRole
        ) {

            otp =
                String(
                    otp ||
                    ""
                ).trim();


            if (
                !/^\d{6}$/.test(
                    otp
                )
            ) {

                throw new Error(
                    "Please enter the 6-digit OTP."
                );
            }


            const confirmation =
                RX.loginConfirmationResult;


            if (
                !confirmation
            ) {

                throw new Error(
                    "OTP session expired. Please request a new OTP."
                );
            }


            Login.setLoading(
                true
            );


            try {

                const result =
                    await confirmation
                        .confirm(
                            otp
                        );


                const user =
                    result.user;


                const role =
                    await Login.detectRole(
                        user,
                        requestedRole
                    );


                if (
                    !role
                ) {

                    Login.saveSession(
                        user,
                        requestedRole ||
                        "customer"
                    );


                    return {

                        success:
                            true,

                        user:
                            user,

                        role:
                            requestedRole ||
                            "customer",

                        needsRole:
                            true
                    };
                }


                const session =
                    Login.saveSession(
                        user,
                        role
                    );


                Login.emit(
                    "success",
                    {

                        user:
                            user,

                        role:
                            role,

                        session:
                            session
                    }
                );


                return {

                    success:
                        true,

                    user:
                        user,

                    role:
                        role,

                    session:
                        session
                };

            } catch (error) {

                throw Login.formatFirebaseError(
                    error
                );

            } finally {

                Login.setLoading(
                    false
                );
            }
        };


    /* ========================================================
       CHECK CURRENT SESSION
       ======================================================== */

    Login.checkCurrentUser =
        async function () {

            const auth =
                Login.getFirebaseAuth();


            if (
                !auth
            ) {

                return null;
            }


            const user =
                auth.currentUser;


            if (
                !user
            ) {

                return null;
            }


            const role =
                await Login.detectRole(
                    user,
                    localStorage.getItem(
                        "riderx_role"
                    )
                );


            if (
                role
            ) {

                Login.saveSession(
                    user,
                    role
                );
            }


            return {

                user:
                    user,

                role:
                    role
            };
        };


    /* ========================================================
       REDIRECT IF ALREADY LOGGED IN
       ======================================================== */

    Login.redirectIfLoggedIn =
        async function () {

            const session =
                await Login.checkCurrentUser();


            if (
                !session?.user ||
                !session?.role
            ) {

                return false;
            }


            /*
             * If already on login/auth page,
             * redirect to correct dashboard.
             */

            const path =
                window.location.pathname
                    .toLowerCase();


            const isAuthPage =
                path.includes(
                    "/auth/"
                );


            if (
                isAuthPage
            ) {

                Login.routeUser(
                    session.role
                );


                return true;
            }


            return false;
        };


    /* ========================================================
       LOGOUT
       ======================================================== */

    Login.logout =
        async function () {

            const auth =
                Login.getFirebaseAuth();


            try {

                if (
                    auth
                ) {

                    await auth.signOut();
                }

            } catch (error) {

                console.warn(
                    "Firebase logout failed:",
                    error
                );
            }


            Login.clearSession();


            Login.emit(
                "logout"
            );


            window.location.replace(
                Login.config.loginPage
            );
        };


    /* ========================================================
       BIND FORM
       ======================================================== */

    Login.bindForm =
        function () {

            const forms =
                Login.getElements(
                    [
                        "#loginForm",

                        "form[data-login-form]",

                        "form.login-form"
                    ].join(",")
                );


            forms.forEach(
                function (
                    form
                ) {

                    if (
                        form.dataset
                            .riderxBound ===
                        "true"
                    ) {

                        return;
                    }


                    form.dataset
                        .riderxBound =
                        "true";


                    form.addEventListener(
                        "submit",
                        Login.handleSubmit
                    );
                }
            );
        };


    /* ========================================================
       BIND LOGIN BUTTONS
       ======================================================== */

    Login.bindButtons =
        function () {

            const buttons =
                Login.getElements(
                    [
                        "[data-login]",

                        "[data-action='login']"
                    ].join(",")
                );


            buttons.forEach(
                function (
                    button
                ) {

                    if (
                        button.dataset
                            .riderxBound ===
                        "true"
                    ) {

                        return;
                    }


                    button.dataset
                        .riderxBound =
                        "true";


                    button.addEventListener(
                        "click",
                        function (
                            event
                        ) {

                            event.preventDefault();

                            Login.handleSubmit(
                                event
                            );
                        }
                    );
                }
            );
        };


    /* ========================================================
       ROLE SELECTOR
       ======================================================== */

    Login.bindRoleSelector =
        function () {

            const elements =
                Login.getElements(
                    [
                        "[data-login-role]",

                        "[data-role-login]"
                    ].join(",")
                );


            elements.forEach(
                function (
                    element
                ) {

                    if (
                        element.dataset
                            .riderxBound ===
                        "true"
                    ) {

                        return;
                    }


                    element.dataset
                        .riderxBound =
                        "true";


                    element.addEventListener(
                        "click",
                        function () {

                            const role =
                                Login.normalizeRole(
                                    element.dataset
                                        .loginRole ||
                                    element.dataset
                                        .roleLogin
                                );


                            if (
                                role
                            ) {

                                try {

                                    localStorage
                                        .setItem(
                                            "riderx_role",
                                            role
                                        );

                                } catch (error) {}


                                document
                                    .querySelectorAll(
                                        "[data-login-role]"
                                    )
                                    .forEach(
                                        function (
                                            item
                                        ) {

                                            item.classList
                                                .toggle(
                                                    "active",
                                                    item ===
                                                    element
                                                );
                                        }
                                    );
                            }
                        }
                    );
                }
            );
        };


    /* ========================================================
       PASSWORD VISIBILITY
       ======================================================== */

    Login.bindPasswordToggle =
        function () {

            const toggles =
                Login.getElements(
                    [
                        "[data-toggle-password]",

                        "#togglePassword"
                    ].join(",")
                );


            toggles.forEach(
                function (
                    toggle
                ) {

                    if (
                        toggle.dataset
                            .riderxBound ===
                        "true"
                    ) {

                        return;
                    }


                    toggle.dataset
                        .riderxBound =
                        "true";


                    toggle.addEventListener(
                        "click",
                        function () {

                            const targetSelector =
                                toggle.dataset
                                    .togglePassword;


                            const input =
                                targetSelector
                                    ? Login.getElement(
                                        targetSelector
                                    )
                                    : Login.getElement(
                                        "#password"
                                    );


                            if (
                                !input
                            ) {
                                return;
                            }


                            const visible =
                                input.type ===
                                "text";


                            input.type =
                                visible
                                    ? "password"
                                    : "text";


                            toggle.setAttribute(
                                "aria-pressed",
                                String(
                                    !visible
                                )
                            );
                        }
                    );
                }
            );
        };


    /* ========================================================
       FIREBASE AUTH STATE
       ======================================================== */

    Login.bindAuthState =
        function () {

            const auth =
                Login.getFirebaseAuth();


            if (
                !auth ||
                typeof auth.onAuthStateChanged !==
                "function"
            ) {

                return;
            }


            auth.onAuthStateChanged(
                async function (
                    user
                ) {

                    if (
                        !user
                    ) {

                        Login.state.user =
                            null;

                        return;
                    }


                    Login.state.user =
                        user;


                    /*
                     * Do not automatically redirect
                     * here. Login form controls the
                     * redirect, preventing loops.
                     */

                    Login.emit(
                        "auth-state",
                        {
                            user:
                                user
                        }
                    );
                }
            );
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    Login.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-login-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Login.on =
        function (
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
                "riderx-login-" +
                name,
                function (
                    event
                ) {

                    callback(
                        event.detail || {},
                        event
                    );
                }
            );
        };


    /* ========================================================
       INIT
       ======================================================== */

    Login.init =
        function () {

            if (
                Login.state.initialized
            ) {

                return;
            }


            Login.state.initialized =
                true;


            Login.bindForm();

            Login.bindButtons();

            Login.bindRoleSelector();

            Login.bindPasswordToggle();

            Login.bindAuthState();


            /*
             * Do not force redirect during
             * initialization because auth.js
             * may also be controlling state.
             */


            Login.emit(
                "ready"
            );


            console.log(
                "RiderX login.js loaded."
            );
        };


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Login.init
        );

    } else {

        Login.init();
    }


    /* ========================================================
       GLOBAL SHORTCUTS
       ======================================================== */

    RX.loginWithEmail =
        Login.loginWithEmail;

    RX.loginWithPhone =
        Login.loginWithPhone;

    RX.verifyPhoneOTP =
        Login.verifyPhoneOTP;

    RX.logout =
        Login.logout;


})();
