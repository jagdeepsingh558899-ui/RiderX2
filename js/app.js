/* ============================================================
   RIDERX 2.0
   MAIN APPLICATION CONTROLLER
   File: js/app.js

   RESPONSIBILITIES
   - Global RiderX application state
   - Authenticated-session validation
   - Role detection
   - Page/folder detection
   - Safe project-root path handling
   - Theme
   - Language
   - PWA installation
   - Service worker
   - Connection state
   - Global actions
   - Toast/loading
   - Application events
   - Firebase connection state
   - Optional module initialization

   IMPORTANT AUTH RULE

   A dashboard session is valid ONLY when:

   riderx_user exists AND
   role is valid AND
   authenticated === true AND
   loggedIn === true AND
   status is not blocked/suspended/disabled/deleted.

   These MUST NOT authenticate a user by themselves:

   - userRole
   - riderx_role
   - riderx_selected_role
   - riderx_customer
   - riderx_rider

   Existing RiderX folder/file structure is preserved.
============================================================ */

(function () {

    "use strict";


    /* ========================================================
       GLOBAL
    ======================================================== */

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    RX.app =
        RX.app || {};

    const APP =
        RX.app;


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

        domReady:
            false,

        firebaseReady:
            false,

        firebaseConnection:
            false,

        online:
            typeof navigator !== "undefined"
                ? navigator.onLine
                : true,

        installed:
            false,

        deferredInstallPrompt:
            null,

        currentPage:
            "",

        currentFolder:
            "",

        currentRole:
            "",

        currentUser:
            null,

        serviceWorker:
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
       PATH / PROJECT ROOT
    ======================================================== */

    APP.getPathParts =
        function () {

            return window.location.pathname
                .split("/")
                .filter(Boolean);

        };


    APP.getPage =
        function () {

            const parts =
                APP.getPathParts();


            if (!parts.length) {

                return "index.html";
            }


            const last =
                parts[parts.length - 1]
                    .toLowerCase();


            if (!last) {

                return "index.html";
            }


            return last;
        };


    APP.getFolder =
        function () {

            const parts =
                APP.getPathParts();


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
                    String(parts[i])
                        .toLowerCase();


                if (
                    folders.includes(item)
                ) {

                    return item;
                }
            }


            return "";
        };


    /*
     * Returns the project root path.
     *
     * Examples:
     *
     * /index.html
     *             -> /
     *
     * /customer/home.html
     *             -> /
     *
     * /RiderX2/customer/home.html
     *             -> /RiderX2/
     *
     * This prevents nested pages from trying to load:
     *
     * /customer/sw.js
     * /customer/auth/role.html
     *
     * when the real files are at project root.
     */

    APP.getBasePath =
        function () {

            const path =
                window.location.pathname;


            const folders = [
                "/admin/",
                "/auth/",
                "/customer/",
                "/rider/"
            ];


            for (
                let i = 0;
                i < folders.length;
                i++
            ) {

                const folder =
                    folders[i];


                const index =
                    path.toLowerCase()
                        .indexOf(folder);


                if (index !== -1) {

                    let base =
                        path.substring(
                            0,
                            index
                        );


                    if (
                        base &&
                        !base.endsWith("/")
                    ) {

                        base += "/";
                    }


                    if (!base) {
                        base = "/";
                    }


                    return base;
                }
            }


            /*
             * If already at project root.
             */

            const lastSlash =
                path.lastIndexOf("/");


            if (
                lastSlash >= 0
            ) {

                return (
                    path.substring(
                        0,
                        lastSlash + 1
                    ) || "/"
                );
            }


            return "/";
        };


    APP.resolvePath =
        function (path) {

            if (!path) {
                return "";
            }


            const value =
                String(path)
                    .trim();


            if (!value) {
                return "";
            }


            /*
             * Full external URL.
             */

            if (
                /^https?:\/\//i.test(value) ||
                /^\/\//.test(value)
            ) {

                return value;
            }


            /*
             * Absolute application path.
             */

            if (
                value.startsWith("/")
            ) {

                return value;
            }


            const base =
                APP.getBasePath();


            return (
                base +
                value.replace(
                    /^\.?\//,
                    ""
                )
            );
        };


    /* ========================================================
       AUTHENTICATED SESSION
    ======================================================== */

    APP.getAuthenticatedUser =
        function () {

            let user =
                null;


            try {

                const raw =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (!raw) {

                    return null;
                }


                user =
                    JSON.parse(raw);

            } catch (error) {

                console.warn(
                    "RiderX session JSON invalid.",
                    error
                );


                /*
                 * Invalid session data should
                 * never be trusted.
                 */

                try {

                    localStorage.removeItem(
                        "riderx_user"
                    );

                } catch (removeError) {

                    console.warn(
                        "Unable to clear invalid RiderX session.",
                        removeError
                    );
                }


                return null;
            }


            if (
                !user ||
                typeof user !== "object"
            ) {

                return null;
            }


            /*
             * CRITICAL AUTH CHECK
             *
             * Old RiderX versions may contain
             * customer/rider objects in storage.
             *
             * They are NOT authenticated sessions.
             */

            if (
                user.authenticated !== true ||
                user.loggedIn !== true
            ) {

                return null;
            }


            let role =
                String(
                    user.role || ""
                )
                .trim()
                .toLowerCase();


            if (
                role === "driver"
            ) {

                role = "rider";
            }


            const validRoles = [
                "customer",
                "rider",
                "admin",
                "superadmin",
                "super_admin"
            ];


            if (
                !validRoles.includes(role)
            ) {

                return null;
            }


            const status =
                String(
                    user.status ||
                    "active"
                )
                .trim()
                .toLowerCase();


            const invalidStatuses = [
                "blocked",
                "suspended",
                "disabled",
                "deleted"
            ];


            if (
                invalidStatuses.includes(
                    status
                )
            ) {

                return null;
            }


            /*
             * Normalize role in the returned
             * in-memory object without changing
             * unrelated session fields.
             */

            user.role =
                role;


            user.status =
                status;


            return user;
        };


    /* ========================================================
       USER
    ======================================================== */

    APP.getUser =
        function () {

            return APP.getAuthenticatedUser();

        };


    /* ========================================================
       ROLE
    ======================================================== */

    APP.getRole =
        function () {

            const user =
                APP.getAuthenticatedUser();


            /*
             * Never use legacy role keys.
             */

            if (!user) {

                return "";
            }


            let role =
                String(
                    user.role || ""
                )
                .trim()
                .toLowerCase();


            if (
                role === "driver"
            ) {

                role =
                    "rider";
            }


            return role;
        };


    /* ========================================================
       AUTH PAGE
    ======================================================== */

    APP.isAuthPage =
        function () {

            const folder =
                APP.state.currentFolder ||
                APP.getFolder();


            const page =
                APP.state.currentPage ||
                APP.getPage();


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
                ].includes(page)
            );
        };


    /* ========================================================
       ROLE HOME
    ======================================================== */

    APP.getRoleHome =
        function (role) {

            role =
                String(
                    role || ""
                )
                .trim()
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


            return "auth/role.html";
        };


    /* ========================================================
       REDIRECT
    ======================================================== */

    APP.redirect =
        function (path) {

            if (!path) {

                return;
            }


            const destination =
                APP.resolvePath(path);


            if (!destination) {

                return;
            }


            window.location.href =
                destination;
        };


    APP.redirectRoleHome =
        function () {

            const user =
                APP.getAuthenticatedUser();


            if (!user) {

                APP.redirect(
                    "auth/role.html"
                );

                return;
            }


            const role =
                APP.getRole();


            APP.redirect(
                APP.getRoleHome(role)
            );
        };


    /* ========================================================
       INDEX
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
             * index.html owns startup routing.
             *
             * app.js deliberately does not
             * force dashboard navigation.
             */

            return;
        };


    /* ========================================================
       FIREBASE
    ======================================================== */

    APP.firebaseReady =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof window.firebase.auth ===
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
       CONNECTION
    ======================================================== */

    APP.updateConnectionUI =
        function (online) {

            APP.state.online =
                !!online;


            if (!document.body) {

                return;
            }


            document.body.classList.toggle(
                "is-online",
                APP.state.online
            );


            document.body.classList.toggle(
                "is-offline",
                !APP.state.online
            );


            document
                .querySelectorAll(
                    "[data-connection-status]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            APP.state.online
                                ? "Online"
                                : "Offline";

                    }
                );


            document
                .querySelectorAll(
                    "[data-offline-banner]"
                )
                .forEach(
                    function (element) {

                        element.hidden =
                            APP.state.online;

                    }
                );


            APP.emit(
                APP.state.online
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
        function (theme) {

            theme =
                String(
                    theme ||
                    APP.state.theme
                )
                .trim()
                .toLowerCase();


            if (
                ![
                    "dark",
                    "light"
                ].includes(theme)
            ) {

                theme =
                    APP.config.defaultTheme;
            }


            APP.state.theme =
                theme;


            document.documentElement
                .setAttribute(
                    "data-theme",
                    theme
                );


            if (document.body) {

                document.body
                    .setAttribute(
                        "data-theme",
                        theme
                    );
            }


            localStorage.setItem(
                "riderx_theme",
                theme
            );


            document
                .querySelectorAll(
                    "[data-theme-toggle]"
                )
                .forEach(
                    function (button) {

                        button.setAttribute(
                            "aria-label",
                            theme === "dark"
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        );

                        button.setAttribute(
                            "aria-pressed",
                            theme === "dark"
                                ? "true"
                                : "false"
                        );
                    }
                );
        };


    APP.toggleTheme =
        function () {

            APP.applyTheme(
                APP.state.theme === "dark"
                    ? "light"
                    : "dark"
            );
        };


    APP.setupTheme =
        function () {

            APP.applyTheme(
                APP.state.theme
            );


            /*
             * One centralized listener.
             * setupGlobalActions does not
             * duplicate theme handling.
             */

            document.addEventListener(
                "click",
                function (event) {

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
        function (language) {

            language =
                String(
                    language || ""
                )
                .trim()
                .toLowerCase();


            if (
                !APP.config
                    .supportedLanguages
                    .includes(language)
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


            document
                .querySelectorAll(
                    "[data-language]"
                )
                .forEach(
                    function (element) {

                        if (
                            element.tagName ===
                            "SELECT"
                        ) {

                            element.value =
                                language;
                        }
                    }
                );


            APP.emit(
                "language-changed",
                {
                    language:
                        language
                }
            );


            if (
                RX.language &&
                typeof RX.language.setLanguage ===
                "function"
            ) {

                try {

                    RX.language.setLanguage(
                        language
                    );

                } catch (error) {

                    console.warn(
                        "RiderX language module failed:",
                        error
                    );
                }
            }
        };


    APP.setupLanguage =
        function () {

            APP.setLanguage(
                APP.state.language
            );


            document.addEventListener(
                "change",
                function (event) {

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
       INSTALL
    ======================================================== */

    APP.setupInstallPrompt =
        function () {

            window.addEventListener(
                "beforeinstallprompt",
                function (event) {

                    event.preventDefault();


                    APP.state
                        .deferredInstallPrompt =
                        event;


                    document
                        .querySelectorAll(
                            "[data-install-app]"
                        )
                        .forEach(
                            function (button) {

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
                            function (button) {

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
                async function (event) {

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
                !APP.config.serviceWorker ||
                !("serviceWorker" in navigator)
            ) {

                return null;
            }


            try {

                /*
                 * IMPORTANT:
                 * Resolve sw.js from the RiderX
                 * project root, not from the
                 * current nested folder.
                 */

                const swPath =
                    APP.resolvePath(
                        "sw.js"
                    );


                const scope =
                    APP.getBasePath();


                const registration =
                    await navigator.serviceWorker
                        .register(
                            swPath,
                            {
                                scope:
                                    scope
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


                return registration;

            } catch (error) {

                console.warn(
                    "RiderX service worker registration failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       LOADING
    ======================================================== */

    APP.showLoading =
        function (message) {

            if (!document.body) {

                return;
            }


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

                        <div
                            class="riderx-loader-spinner"
                            aria-hidden="true">
                        </div>

                        <div
                            class="riderx-loader-text"
                            data-loader-text>
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
       TOAST
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
                String(
                    type || "info"
                );


            duration =
                Number(
                    duration || 3000
                );


            if (
                !Number.isFinite(duration) ||
                duration < 0
            ) {

                duration =
                    3000;
            }


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


            toast.setAttribute(
                "role",
                "status"
            );


            toast.innerHTML =
                `
                <div
                    class="riderx-toast-message">
                </div>

                <button
                    type="button"
                    class="riderx-toast-close"
                    aria-label="Close">
                    ×
                </button>
                `;


            const messageElement =
                toast.querySelector(
                    ".riderx-toast-message"
                );


            if (messageElement) {

                messageElement.textContent =
                    message;
            }


            const closeButton =
                toast.querySelector(
                    ".riderx-toast-close"
                );


            if (closeButton) {

                closeButton.addEventListener(
                    "click",
                    function () {

                        toast.remove();
                    }
                );
            }


            container.appendChild(
                toast
            );


            window.setTimeout(
                function () {

                    if (
                        !toast.isConnected
                    ) {

                        return;
                    }


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
       EVENTS
    ======================================================== */

    APP.emit =
        function (
            eventName,
            detail
        ) {

            if (!eventName) {

                return;
            }


            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-" +
                        eventName,
                        {
                            detail:
                                detail || {}
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
                !eventName ||
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
                "riderx-" + eventName,
                handler
            );


            /*
             * Return unsubscribe function.
             */

            return function () {

                window.removeEventListener(
                    "riderx-" + eventName,
                    handler
                );
            };
        };


    /* ========================================================
       GLOBAL ACTIONS
    ======================================================== */

    APP.clearSession =
        function () {

            const keys = [

                "riderx_user",

                "riderx_customer",

                "riderx_rider",

                "userRole",

                "riderx_role",

                "riderx_selected_role"
            ];


            keys.forEach(
                function (key) {

                    try {

                        localStorage.removeItem(
                            key
                        );

                    } catch (error) {

                        console.warn(
                            "Unable to remove session key:",
                            key,
                            error
                        );
                    }
                }
            );
        };


    APP.setupGlobalActions =
        function () {

            document.addEventListener(
                "click",
                async function (event) {

                    const logout =
                        event.target.closest(
                            "[data-logout]"
                        );


                    if (logout) {

                        event.preventDefault();


                        /*
                         * Firebase logout first.
                         */

                        if (
                            RX.auth &&
                            typeof RX.auth.logout ===
                            "function"
                        ) {

                            try {

                                await RX.auth.logout();

                            } catch (error) {

                                console.warn(
                                    "RiderX logout module error:",
                                    error
                                );
                            }
                        }


                        /*
                         * Clear every legacy/current
                         * local session key.
                         */

                        APP.clearSession();


                        APP.state.currentUser =
                            null;


                        APP.state.currentRole =
                            "";


                        APP.applyRoleUI();


                        APP.emit(
                            "user-logout"
                        );


                        APP.redirect(
                            "auth/role.html"
                        );


                        return;
                    }


                    const back =
                        event.target.closest(
                            "[data-back]"
                        );


                    if (back) {

                        event.preventDefault();


                        if (
                            window.history.length > 1
                        ) {

                            window.history.back();

                        } else {

                            APP.redirect(
                                "index.html"
                            );
                        }


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

            APP.on(
                "auth-login",
                function (detail) {

                    const role =
                        String(
                            detail.role || ""
                        )
                        .trim()
                        .toLowerCase();


                    /*
                     * Do not blindly trust event.user.
                     * Re-read the authenticated session.
                     */

                    const user =
                        APP.getAuthenticatedUser();


                    APP.state.currentUser =
                        user;


                    APP.state.currentRole =
                        APP.getRole();


                    APP.emit(
                        "user-ready",
                        {
                            user:
                                user,

                            role:
                                APP.state.currentRole,

                            source:
                                role || "auth-login"
                        }
                    );
                }
            );


            /*
             * auth.js may expose its own event API.
             */

            if (
                RX.auth &&
                typeof RX.auth.on ===
                "function"
            ) {

                RX.auth.on(
                    "login",
                    function (detail) {

                        const user =
                            APP.getAuthenticatedUser();


                        APP.state.currentUser =
                            user;


                        APP.state.currentRole =
                            APP.getRole();


                        APP.applyRoleUI();


                        APP.renderUserUI();


                        APP.emit(
                            "user-ready",
                            {
                                user:
                                    user,

                                role:
                                    APP.state.currentRole,

                                source:
                                    "auth.login",

                                detail:
                                    detail || {}
                            }
                        );
                    }
                );


                RX.auth.on(
                    "signed-in",
                    function (detail) {

                        const user =
                            APP.getAuthenticatedUser();


                        APP.state.currentUser =
                            user;


                        APP.state.currentRole =
                            APP.getRole();


                        APP.applyRoleUI();


                        APP.renderUserUI();


                        APP.emit(
                            "user-ready",
                            {
                                user:
                                    user,

                                role:
                                    APP.state.currentRole,

                                source:
                                    "auth.signed-in",

                                detail:
                                    detail || {}
                            }
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


                        APP.clearSession();


                        APP.applyRoleUI();


                        APP.emit(
                            "user-logout"
                        );
                    }
                );
            }
        };


    /* ========================================================
       ROLE UI
    ======================================================== */

    APP.applyRoleUI =
        function () {

            const role =
                APP.getRole();


            APP.state.currentRole =
                role;


            if (!document.body) {

                return;
            }


            document.body.setAttribute(
                "data-role",
                role || "guest"
            );


            document.body.classList.remove(
                "role-customer",
                "role-rider",
                "role-admin",
                "role-guest"
            );


            if (
                role === "customer"
            ) {

                document.body.classList.add(
                    "role-customer"
                );

            } else if (
                role === "rider"
            ) {

                document.body.classList.add(
                    "role-rider"
                );

            } else if (
                role === "admin" ||
                role === "superadmin" ||
                role === "super_admin"
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
       USER UI
    ======================================================== */

    APP.renderUserUI =
        function () {

            const user =
                APP.getAuthenticatedUser();


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
                    function (element) {

                        element.textContent =
                            name;
                    }
                );


            document
                .querySelectorAll(
                    "[data-user-email]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            email;
                    }
                );


            document
                .querySelectorAll(
                    "[data-user-phone]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            phone;
                    }
                );


            document
                .querySelectorAll(
                    "[data-user-role]"
                )
                .forEach(
                    function (element) {

                        element.textContent =
                            APP.getRole();
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

                            if (
                                element.tagName ===
                                "IMG"
                            ) {

                                element.src =
                                    user.photoURL;

                            } else {

                                element.style.backgroundImage =
                                    "url(" +
                                    JSON.stringify(
                                        user.photoURL
                                    ) +
                                    ")";
                            }
                        }
                    }
                );
        };


    /* ========================================================
       MODULES
    ======================================================== */

    APP.initModules =
        function () {

            /*
             * auth is initialized separately
             * inside APP.init().
             *
             * Do not initialize auth twice.
             */

            const modules = [

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
                function (name) {

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
       FIREBASE CONNECTION
    ======================================================== */

    APP.setupFirebaseConnection =
        function () {

            if (
                !window.firebase ||
                typeof window.firebase.database !==
                "function"
            ) {

                return;
            }


            let database =
                null;


            try {

                database =
                    window.firebase.database();

            } catch (error) {

                console.warn(
                    "Unable to access Firebase Realtime Database:",
                    error
                );


                return;
            }


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
                    function (snapshot) {

                        const connected =
                            snapshot.val() ===
                            true;


                        APP.state
                            .firebaseConnection =
                            connected;


                        if (
                            document.body
                        ) {

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
                        }


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

            if (!document.body) {

                return;
            }


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
                        APP.state.currentFolder,

                    role:
                        APP.getRole(),

                    authenticated:
                        !!APP.getAuthenticatedUser()
                }
            );
        };


    /* ========================================================
       ERRORS
    ======================================================== */

    APP.setupErrors =
        function () {

            window.addEventListener(
                "error",
                function (event) {

                    console.error(
                        "RiderX error:",
                        event.error ||
                        event.message
                    );
                }
            );


            window.addEventListener(
                "unhandledrejection",
                function (event) {

                    console.error(
                        "RiderX promise error:",
                        event.reason
                    );
                }
            );
        };


    /* ========================================================
       INIT
    ======================================================== */

    APP.init =
        async function () {

            if (
                APP.state.initialized
            ) {

                return;
            }


            /*
             * app.js should run after DOM exists.
             */

            if (
                document.readyState ===
                "loading"
            ) {

                await new Promise(
                    function (resolve) {

                        document.addEventListener(
                            "DOMContentLoaded",
                            resolve,
                            {
                                once: true
                            }
                        );
                    }
                );
            }


            APP.state.domReady =
                true;


            APP.state.currentPage =
                APP.getPage();


            APP.state.currentFolder =
                APP.getFolder();


            APP.showLoading(
                "Starting RiderX..."
            );


            /* ------------------------------------------------
               Global setup
            ------------------------------------------------ */

            APP.setupConnection();

            APP.setupTheme();

            APP.setupLanguage();

            APP.setupInstallPrompt();

            APP.setupGlobalActions();

            APP.setupAuthEvents();

            APP.setupErrors();


            /* ------------------------------------------------
               Firebase
            ------------------------------------------------ */

            APP.firebaseReady();

            APP.setupFirebaseConnection();


            /* ------------------------------------------------
               Auth module
            ------------------------------------------------ */

            if (
                RX.auth &&
                typeof RX.auth.init ===
                "function"
            ) {

                try {

                    /*
                     * auth.js owns its own Firebase
                     * authentication initialization.
                     *
                     * app.js only calls it once.
                     */

                    const authResult =
                        RX.auth.init();


                    if (
                        authResult &&
                        typeof authResult.then ===
                        "function"
                    ) {

                        await authResult;
                    }

                } catch (error) {

                    console.warn(
                        "RiderX auth initialization failed:",
                        error
                    );
                }
            }


            /* ------------------------------------------------
               Authenticated session
            ------------------------------------------------ */

            APP.state.currentUser =
                APP.getAuthenticatedUser();


            APP.state.currentRole =
                APP.getRole();


            APP.applyRoleUI();

            APP.renderUserUI();


            /* ------------------------------------------------
               Optional modules
            ------------------------------------------------ */

            APP.initModules();


            /* ------------------------------------------------
               Service worker
            ------------------------------------------------ */

            APP.registerServiceWorker();


            /* ------------------------------------------------
               Index routing
            ------------------------------------------------ */

            APP.handleIndex();


            APP.state.initialized =
                true;


            APP.pageReady();


            console.log(
                "RiderX app.js initialized.",
                {
                    page:
                        APP.state.currentPage,

                    folder:
                        APP.state.currentFolder,

                    role:
                        APP.state.currentRole,

                    authenticated:
                        !!APP.state.currentUser,

                    firebase:
                        APP.state.firebaseReady
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

            return APP.getAuthenticatedUser();
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
        function (message) {

            return APP.showLoading(
                message
            );
        };


    RX.hideLoading =
        function () {

            return APP.hideLoading();
        };


    RX.redirect =
        function (path) {

            return APP.redirect(
                path
            );
        };


    RX.getBasePath =
        function () {

            return APP.getBasePath();
        };


    RX.resolvePath =
        function (path) {

            return APP.resolvePath(
                path
            );
        };


    RX.clearSession =
        function () {

            return APP.clearSession();
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
                once: true
            }
        );

    } else {

        APP.init();
    }

})();
