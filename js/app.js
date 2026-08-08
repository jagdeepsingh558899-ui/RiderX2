/* ============================================================
   RIDERX
   MAIN APPLICATION CONTROLLER
   File: js/app.js

   Handles:
   - Global RiderX initialization
   - Firebase readiness
   - Authentication startup
   - Role-based application startup
   - Customer / Rider / Admin routing
   - Global UI state
   - Online/offline detection
   - Install prompt
   - Service worker
   - Global logout
   - Global notifications/events
   ============================================================ */

(function () {

    "use strict";

    /* ========================================================
       GLOBAL RIDERX OBJECT
       ======================================================== */

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.app = RX.app || {};

    const APP = RX.app;


    /* ========================================================
       CONFIG
       ======================================================== */

    APP.config = {

        name:
            "RiderX",

        version:
            "2.0.0",

        city:
            "Chandigarh",

        defaultLanguage:
            "en",

        supportedLanguages:
            [
                "en",
                "hi"
            ],

        defaultTheme:
            "dark",

        firebaseRequired:
            true,

        serviceWorker:
            true
    };


    /* ========================================================
       STATE
       ======================================================== */

    APP.state = {

        initialized:
            false,

        firebaseReady:
            false,

        online:
            navigator.onLine,

        installed:
            false,

        deferredInstallPrompt:
            null,

        currentPage:
            "",

        currentRole:
            "",

        currentUser:
            null,

        language:
            localStorage.getItem(
                "riderx_language"
            ) ||
            APP.config.defaultLanguage,

        theme:
            localStorage.getItem(
                "riderx_theme"
            ) ||
            APP.config.defaultTheme
    };


    /* ========================================================
       PAGE DETECTION
       ======================================================== */

    APP.getPage = function () {

        const path =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        return path ||
            "index.html";
    };


    APP.getFolder = function () {

        const parts =
            window.location.pathname
                .split("/")
                .filter(Boolean);


        const folders = [
            "admin",
            "auth",
            "customer",
            "rider"
        ];


        for (
            let i = 0;
            i < parts.length;
            i++
        ) {

            const item =
                parts[i]
                    .toLowerCase();


            if (
                folders.includes(
                    item
                )
            ) {

                return item;
            }
        }


        return "";
    };


    /* ========================================================
       FIREBASE DETECTION
       ======================================================== */

    APP.firebaseReady =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    APP.state.firebaseReady =
                        true;

                    return true;
                }

            } catch (error) {

                console.warn(
                    "RiderX Firebase check failed:",
                    error
                );
            }


            APP.state.firebaseReady =
                false;


            return false;
        };


    /* ========================================================
       USER / ROLE
       ======================================================== */

    APP.getUser = function () {

        if (
            RX.auth &&
            typeof RX.auth.getUser ===
            "function"
        ) {

            return RX.auth.getUser();
        }


        try {

            return JSON.parse(
                localStorage.getItem(
                    "riderx_user"
                ) || "null"
            );

        } catch (error) {

            return null;
        }
    };


    APP.getRole = function () {

        if (
            RX.auth &&
            typeof RX.auth.getRole ===
            "function"
        ) {

            return RX.auth.getRole();
        }


        const user =
            APP.getUser();


        return String(
            user?.role ||
            localStorage.getItem(
                "riderx_role"
            ) ||
            ""
        )
            .toLowerCase();
    };


    /* ========================================================
       AUTH PAGE DETECTION
       ======================================================== */

    APP.isAuthPage = function () {

        const folder =
            APP.getFolder();

        const page =
            APP.state.currentPage;


        return (
            folder === "auth" ||
            [
                "login.html",
                "register.html",
                "otp-login.html",
                "verify-otp.html",
                "customer-login.html",
                "rider-login.html",
                "role.html"
            ].includes(
                page
            )
        );
    };


    /* ========================================================
       ROLE HOME
       ======================================================== */

    APP.getRoleHome = function (
        role
    ) {

        role =
            String(
                role || ""
            )
            .toLowerCase();


        if (
            role === "admin" ||
            role === "superadmin" ||
            role === "super_admin"
        ) {

            return "admin/dashboard.html";
        }


        if (
            role === "rider" ||
            role === "driver"
        ) {

            return "rider/home.html";
        }


        if (
            role === "customer"
        ) {

            return "customer/home.html";
        }


        return "auth/login.html";
    };


    /* ========================================================
       SAFE REDIRECT
       ======================================================== */

    APP.redirect =
        function (
            path
        ) {

            if (!path) {
                return;
            }


            window.location.href =
                path;
        };


    APP.redirectRoleHome =
        function () {

            const role =
                APP.getRole();


            const destination =
                APP.getRoleHome(
                    role
                );


            APP.redirect(
                destination
            );
        };


    /* ========================================================
       INDEX ROUTING
       ======================================================== */

    APP.handleIndex =
        function () {

            const page =
                APP.state.currentPage;


            if (
                page !== "index.html"
            ) {

                return;
            }


            /*
             * Do not redirect if the page
             * contains a splash/landing state.
             */

            const user =
                APP.getUser();


            if (
                !user
            ) {

                return;
            }


            const role =
                APP.getRole();


            if (!role) {
                return;
            }


            /*
             * Only redirect when explicitly
             * requested by the index page.
             */

            if (
                document.body.dataset
                    .redirectLoggedUser ===
                "true"
            ) {

                APP.redirectRoleHome();
            }
        };


    /* ========================================================
       ONLINE / OFFLINE
       ======================================================== */

    APP.updateConnectionUI =
        function (
            online
        ) {

            APP.state.online =
                online;


            document.body.classList.toggle(
                "is-online",
                online
            );


            document.body.classList.toggle(
                "is-offline",
                !online
            );


            document
                .querySelectorAll(
                    "[data-connection-status]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            online
                                ? "Online"
                                : "Offline";
                    }
                );


            document
                .querySelectorAll(
                    "[data-offline-banner]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.hidden =
                            online;
                    }
                );


            APP.emit(
                online
                    ? "online"
                    : "offline"
            );
        };


    APP.setupConnection =
        function () {

            window.addEventListener(
                "online",
                function () {

                    APP.updateConnectionUI(
                        true
                    );
                }
            );


            window.addEventListener(
                "offline",
                function () {

                    APP.updateConnectionUI(
                        false
                    );
                }
            );


            APP.updateConnectionUI(
                navigator.onLine
            );
        };


    /* ========================================================
       THEME
       ======================================================== */

    APP.applyTheme =
        function (
            theme
        ) {

            theme =
                String(
                    theme ||
                    APP.state.theme
                )
                .toLowerCase();


            if (
                ![
                    "dark",
                    "light"
                ].includes(
                    theme
                )
            ) {

                theme =
                    "dark";
            }


            APP.state.theme =
                theme;


            document.documentElement
                .setAttribute(
                    "data-theme",
                    theme
                );


            document.body
                .setAttribute(
                    "data-theme",
                    theme
                );


            localStorage.setItem(
                "riderx_theme",
                theme
            );


            document
                .querySelectorAll(
                    "[data-theme-toggle]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button
                            .setAttribute(
                                "aria-label",
                                theme ===
                                    "dark"
                                    ? "Switch to light mode"
                                    : "Switch to dark mode"
                            );
                    }
                );
        };


    APP.toggleTheme =
        function () {

            APP.applyTheme(
                APP.state.theme ===
                    "dark"
                    ? "light"
                    : "dark"
            );
        };


    APP.setupTheme =
        function () {

            APP.applyTheme(
                APP.state.theme
            );


            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-theme-toggle]"
                        );


                    if (!button) {
                        return;
                    }


                    event.preventDefault();


                    APP.toggleTheme();
                }
            );
        };


    /* ========================================================
       LANGUAGE
       ======================================================== */

    APP.setLanguage =
        function (
            language
        ) {

            language =
                String(
                    language || ""
                )
                .toLowerCase();


            if (
                !APP.config
                    .supportedLanguages
                    .includes(
                        language
                    )
            ) {

                language =
                    APP.config
                        .defaultLanguage;
            }


            APP.state.language =
                language;


            localStorage.setItem(
                "riderx_language",
                language
            );


            document.documentElement
                .setAttribute(
                    "lang",
                    language
                );


            APP.emit(
                "language-changed",
                {
                    language:
                        language
                }
            );


            /*
             * Use existing language module
             * when available.
             */

            if (
                RX.language &&
                typeof RX.language.setLanguage ===
                "function"
            ) {

                RX.language.setLanguage(
                    language
                );
            }
        };


    APP.setupLanguage =
        function () {

            APP.setLanguage(
                APP.state.language
            );


            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const select =
                        event.target.closest(
                            "[data-language]"
                        );


                    if (!select) {
                        return;
                    }


                    APP.setLanguage(
                        select.value
                    );
                }
            );
        };


    /* ========================================================
       INSTALL APP
       ======================================================== */

    APP.setupInstallPrompt =
        function () {

            window.addEventListener(
                "beforeinstallprompt",
                function (
                    event
                ) {

                    event.preventDefault();


                    APP.state
                        .deferredInstallPrompt =
                        event;


                    document
                        .querySelectorAll(
                            "[data-install-app]"
                        )
                        .forEach(
                            function (
                                button
                            ) {

                                button.hidden =
                                    false;
                            }
                        );
                }
            );


            window.addEventListener(
                "appinstalled",
                function () {

                    APP.state.installed =
                        true;

                    APP.state
                        .deferredInstallPrompt =
                        null;


                    document
                        .querySelectorAll(
                            "[data-install-app]"
                        )
                        .forEach(
                            function (
                                button
                            ) {

                                button.hidden =
                                    true;
                            }
                        );


                    APP.emit(
                        "installed"
                    );
                }
            );


            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-install-app]"
                        );


                    if (!button) {
                        return;
                    }


                    event.preventDefault();


                    await APP.install();
                }
            );
        };


    APP.install =
        async function () {

            const prompt =
                APP.state
                    .deferredInstallPrompt;


            if (!prompt) {

                APP.emit(
                    "install-unavailable"
                );

                return false;
            }


            try {

                await prompt.prompt();


                const result =
                    await prompt.userChoice;


                APP.state
                    .deferredInstallPrompt =
                    null;


                APP.emit(
                    "install-result",
                    {
                        outcome:
                            result.outcome
                    }
                );


                return (
                    result.outcome ===
                    "accepted"
                );

            } catch (error) {

                console.warn(
                    "RiderX install prompt failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       SERVICE WORKER
       ======================================================== */

    APP.registerServiceWorker =
        async function () {

            if (
                !APP.config.serviceWorker
            ) {
                return;
            }


            if (
                !("serviceWorker" in navigator)
            ) {
                return;
            }


            try {

                const registration =
                    await navigator
                        .serviceWorker
                        .register(
                            "sw.js",
                            {
                                scope:
                                    "./"
                            }
                        );


                APP.state.serviceWorker =
                    registration;


                APP.emit(
                    "service-worker-ready",
                    {
                        registration:
                            registration
                    }
                );

            } catch (error) {

                /*
                 * Some nested pages can have
                 * a different relative path.
                 */

                try {

                    const registration =
                        await navigator
                            .serviceWorker
                            .register(
                                "../sw.js"
                            );


                    APP.state.serviceWorker =
                        registration;

                } catch (secondError) {

                    console.warn(
                        "RiderX service worker registration failed:",
                        secondError
                    );
                }
            }
        };


    /* ========================================================
       GLOBAL LOADING
       ======================================================== */

    APP.showLoading =
        function (
            message
        ) {

            let loader =
                document.getElementById(
                    "riderx-global-loader"
                );


            if (!loader) {

                loader =
                    document.createElement(
                        "div"
                    );

                loader.id =
                    "riderx-global-loader";

                loader.innerHTML =
                    `
                    <div class="riderx-loader-inner">

                        <div class="riderx-loader-spinner">
                        </div>

                        <div
                            class="riderx-loader-text"
                            data-loader-text
                        >
                            Loading...
                        </div>

                    </div>
                    `;


                document.body.appendChild(
                    loader
                );
            }


            const text =
                loader.querySelector(
                    "[data-loader-text]"
                );


            if (text) {

                text.textContent =
                    message ||
                    "Loading...";
            }


            loader.classList.add(
                "show"
            );
        };


    APP.hideLoading =
        function () {

            const loader =
                document.getElementById(
                    "riderx-global-loader"
                );


            if (!loader) {
                return;
            }


            loader.classList.remove(
                "show"
            );
        };


    /* ========================================================
       GLOBAL TOAST
       ======================================================== */

    APP.toast =
        function (
            message,
            type,
            duration
        ) {

            message =
                String(
                    message || ""
                );


            if (!message) {
                return;
            }


            type =
                type ||
                "info";


            duration =
                Number(
                    duration ||
                    3000
                );


            let container =
                document.getElementById(
                    "riderx-toast-container"
                );


            if (!container) {

                container =
                    document.createElement(
                        "div"
                    );

                container.id =
                    "riderx-toast-container";

                container.className =
                    "riderx-toast-container";

                document.body.appendChild(
                    container
                );
            }


            const toast =
                document.createElement(
                    "div"
                );


            toast.className =
                "riderx-toast " +
                "riderx-toast-" +
                type;


            toast.innerHTML =
                `
                <div class="riderx-toast-message"></div>

                <button
                    type="button"
                    class="riderx-toast-close"
                    aria-label="Close"
                >
                    ×
                </button>
                `;


            toast.querySelector(
                ".riderx-toast-message"
            ).textContent =
                message;


            toast.querySelector(
                ".riderx-toast-close"
            ).addEventListener(
                "click",
                function () {

                    toast.remove();
                }
            );


            container.appendChild(
                toast
            );


            window.setTimeout(
                function () {

                    toast.classList.add(
                        "hide"
                    );


                    window.setTimeout(
                        function () {

                            toast.remove();

                        },
                        300
                    );

                },
                duration
            );
        };


    /* ========================================================
       GLOBAL EVENTS
       ======================================================== */

    APP.emit =
        function (
            eventName,
            detail
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-" +
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
                    "RiderX event error:",
                    error
                );
            }
        };


    APP.on =
        function (
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
                "riderx-" +
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
       GLOBAL CLICK ACTIONS
       ======================================================== */

    APP.setupGlobalActions =
        function () {

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    /*
                     * Logout
                     */

                    const logout =
                        event.target.closest(
                            "[data-logout]"
                        );


                    if (logout) {

                        event.preventDefault();


                        if (
                            RX.auth &&
                            typeof RX.auth.logout ===
                            "function"
                        ) {

                            await RX.auth.logout();

                        } else {

                            localStorage.clear();

                            window.location.href =
                                "auth/login.html";
                        }


                        return;
                    }


                    /*
                     * Back button
                     */

                    const back =
                        event.target.closest(
                            "[data-back]"
                        );


                    if (back) {

                        event.preventDefault();


                        if (
                            window.history.length >
                            1
                        ) {

                            window.history.back();

                        } else {

                            window.location.href =
                                "../index.html";
                        }


                        return;
                    }


                    /*
                     * Theme
                     */

                    const theme =
                        event.target.closest(
                            "[data-theme-toggle]"
                        );


                    if (theme) {

                        event.preventDefault();

                        APP.toggleTheme();

                        return;
                    }
                }
            );
        };


    /* ========================================================
       AUTH EVENTS
       ======================================================== */

    APP.setupAuthEvents =
        function () {

            /*
             * Login
             */

            APP.on(
                "auth-login",
                function (
                    detail
                ) {

                    const role =
                        String(
                            detail.role ||
                            ""
                        )
                        .toLowerCase();


                    APP.state.currentUser =
                        detail.user ||
                        APP.getUser();


                    APP.state.currentRole =
                        role;


                    APP.emit(
                        "user-ready",
                        {
                            user:
                                APP.state
                                    .currentUser,

                            role:
                                role
                        }
                    );
                }
            );


            /*
             * RiderX auth module.
             */

            if (
                RX.auth &&
                typeof RX.auth.on ===
                "function"
            ) {

                RX.auth.on(
                    "login",
                    function (
                        detail
                    ) {

                        APP.state.currentUser =
                            detail.user;

                        APP.state.currentRole =
                            detail.role;


                        APP.emit(
                            "user-ready",
                            detail
                        );
                    }
                );


                RX.auth.on(
                    "signed-in",
                    function (
                        detail
                    ) {

                        APP.state.currentUser =
                            detail.user;

                        APP.state.currentRole =
                            detail.role;


                        APP.emit(
                            "user-ready",
                            detail
                        );
                    }
                );


                RX.auth.on(
                    "logout",
                    function () {

                        APP.state.currentUser =
                            null;

                        APP.state.currentRole =
                            "";


                        APP.emit(
                            "user-logout"
                        );
                    }
                );
            }
        };


    /* ========================================================
       ROLE-BASED BODY CLASS
       ======================================================== */

    APP.applyRoleUI =
        function () {

            const role =
                APP.getRole();


            APP.state.currentRole =
                role;


            document.body
                .setAttribute(
                    "data-role",
                    role ||
                    "guest"
                );


            document.body.classList.remove(
                "role-customer",
                "role-rider",
                "role-admin",
                "role-guest"
            );


            if (
                role ===
                "customer"
            ) {

                document.body.classList.add(
                    "role-customer"
                );

            } else if (
                role ===
                "rider"
            ) {

                document.body.classList.add(
                    "role-rider"
                );

            } else if (
                role ===
                    "admin" ||
                role ===
                    "superadmin" ||
                role ===
                    "super_admin"
            ) {

                document.body.classList.add(
                    "role-admin"
                );

            } else {

                document.body.classList.add(
                    "role-guest"
                );
            }
        };


    /* ========================================================
       GLOBAL USER UI
       ======================================================== */

    APP.renderUserUI =
        function () {

            const user =
                APP.getUser();


            if (!user) {
                return;
            }


            const name =
                user.name ||
                user.displayName ||
                "User";


            const email =
                user.email ||
                "";


            const phone =
                user.phone ||
                user.phoneNumber ||
                "";


            document
                .querySelectorAll(
                    "[data-user-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            name;
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
                            email;
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
                            phone;
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
                            APP.getRole();
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
       MODULE INITIALIZATION
       ======================================================== */

    APP.initModules =
        function () {

            const modules = [

                "auth",
                "map",
                "booking",
                "chat",
                "notification",
                "payment",
                "pricing",
                "profile",
                "rating",
                "tracking",
                "trip",
                "wallet",
                "history",
                "settings"
            ];


            modules.forEach(
                function (
                    name
                ) {

                    const module =
                        RX[name];


                    if (
                        module &&
                        typeof module.init ===
                        "function"
                    ) {

                        try {

                            module.init();

                        } catch (error) {

                            console.warn(
                                "RiderX module failed:",
                                name,
                                error
                            );
                        }
                    }
                }
            );
        };


    /* ========================================================
       FIREBASE CONNECTION STATE
       ======================================================== */

    APP.setupFirebaseConnection =
        function () {

            const database =
                (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                )
                    ? firebase.database()
                    : null;


            if (!database) {
                return;
            }


            try {

                const connectedRef =
                    database.ref(
                        ".info/connected"
                    );


                connectedRef.on(
                    "value",
                    function (
                        snapshot
                    ) {

                        const connected =
                            snapshot.val() ===
                            true;


                        document.body
                            .classList.toggle(
                                "firebase-connected",
                                connected
                            );


                        document.body
                            .classList.toggle(
                                "firebase-disconnected",
                                !connected
                            );


                        APP.emit(
                            "firebase-connection",
                            {
                                connected:
                                    connected
                            }
                        );
                    }
                );

            } catch (error) {

                console.warn(
                    "Firebase connection listener failed:",
                    error
                );
            }
        };


    /* ========================================================
       PAGE READY
       ======================================================== */

    APP.pageReady =
        function () {

            document.body.classList.add(
                "riderx-ready"
            );


            APP.hideLoading();


            APP.emit(
                "page-ready",
                {
                    page:
                        APP.state.currentPage,

                    folder:
                        APP.getFolder(),

                    role:
                        APP.getRole()
                }
            );
        };


    /* ========================================================
       ERROR HANDLING
       ======================================================== */

    APP.setupErrors =
        function () {

            window.addEventListener(
                "error",
                function (
                    event
                ) {

                    console.error(
                        "RiderX error:",
                        event.error ||
                        event.message
                    );
                }
            );


            window.addEventListener(
                "unhandledrejection",
                function (
                    event
                ) {

                    console.error(
                        "RiderX promise error:",
                        event.reason
                    );
                }
            );
        };


    /* ========================================================
       APP INITIALIZATION
       ======================================================== */

    APP.init = async function () {

        if (
            APP.state.initialized
        ) {

            return;
        }


        APP.state.currentPage =
            APP.getPage();


        APP.showLoading(
            "Starting RiderX..."
        );


        /*
         * Global UI first.
         */

        APP.setupConnection();

        APP.setupTheme();

        APP.setupLanguage();

        APP.setupInstallPrompt();

        APP.setupGlobalActions();

        APP.setupErrors();


        /*
         * Firebase.
         */

        APP.firebaseReady();


        APP.setupFirebaseConnection();


        /*
         * Auth module.
         */

        if (
            RX.auth &&
            typeof RX.auth.init ===
            "function"
        ) {

            try {

                RX.auth.init();

            } catch (error) {

                console.warn(
                    "RiderX auth initialization failed:",
                    error
                );
            }
        }


        /*
         * Current user.
         */

        APP.state.currentUser =
            APP.getUser();


        APP.state.currentRole =
            APP.getRole();


        APP.applyRoleUI();

        APP.renderUserUI();


        /*
         * Modules.
         */

        APP.initModules();


        /*
         * Service worker.
         */

        APP.registerServiceWorker();


        /*
         * Index handling.
         */

        APP.handleIndex();


        /*
         * Finished.
         */

        APP.state.initialized =
            true;


        APP.pageReady();


        console.log(
            "RiderX app.js initialized.",
            {
                page:
                    APP.state.currentPage,

                folder:
                    APP.getFolder(),

                role:
                    APP.state.currentRole
            }
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.getApp =
        function () {

            return APP;
        };


    RX.getUser =
        function () {

            return APP.getUser();
        };


    RX.getRole =
        function () {

            return APP.getRole();
        };


    RX.toast =
        function (
            message,
            type,
            duration
        ) {

            return APP.toast(
                message,
                type,
                duration
            );
        };


    RX.showLoading =
        function (
            message
        ) {

            return APP.showLoading(
                message
            );
        };


    RX.hideLoading =
        function () {

            return APP.hideLoading();
        };


    RX.redirect =
        function (
            path
        ) {

            return APP.redirect(
                path
            );
        };


    /* ========================================================
       AUTO START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                APP.init();

            },
            {
                once:
                    true
            }
        );

    } else {

        APP.init();
    }

})();
