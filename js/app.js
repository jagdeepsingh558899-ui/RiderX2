/* ============================================================
   RIDERX 2.0
   APP CORE
   File: js/app.js

   Handles:
   - Firebase initialization
   - Authentication state
   - User profile/session
   - Role detection
   - Protected page routing
   - Theme
   - Language preference
   - Common utilities
   - Notifications
   - Logout
   ============================================================ */

(function () {
    "use strict";

    /* ========================================================
       GLOBAL RIDERX OBJECT
       ======================================================== */

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.version = "2.0.0";
    RX.appName = "RiderX";

    RX.config = {
        city: "Chandigarh",
        currency: "₹",
        defaultLanguage: "en",
        defaultTheme: "light"
    };


    /* ========================================================
       FIREBASE REFERENCES
       ======================================================== */

    RX.firebase = {
        app: null,
        auth: null,
        db: null,
        realtime: null,
        storage: null
    };


    /* ========================================================
       APP STATE
       ======================================================== */

    RX.state = {
        initialized: false,
        authReady: false,
        currentUser: null,
        profile: null,
        role: null,
        language: localStorage.getItem("riderx_language") || "en",
        theme: localStorage.getItem("riderx_theme") || "light",
        online: navigator.onLine
    };


    /* ========================================================
       FIREBASE INITIALIZATION
       ======================================================== */

    RX.initFirebase = function () {

        try {

            if (typeof firebase === "undefined") {
                console.error(
                    "RiderX: Firebase SDK not loaded."
                );
                return false;
            }

            if (
                typeof firebaseConfig === "undefined" ||
                !firebaseConfig
            ) {
                console.error(
                    "RiderX: firebaseConfig not found."
                );
                return false;
            }

            if (!firebase.apps.length) {
                RX.firebase.app =
                    firebase.initializeApp(firebaseConfig);
            } else {
                RX.firebase.app =
                    firebase.app();
            }

            RX.firebase.auth =
                firebase.auth();

            if (typeof firebase.firestore === "function") {
                RX.firebase.db =
                    firebase.firestore();
            }

            if (
                typeof firebase.database === "function"
            ) {
                RX.firebase.realtime =
                    firebase.database();
            }

            if (
                typeof firebase.storage === "function"
            ) {
                RX.firebase.storage =
                    firebase.storage();
            }

            RX.state.initialized = true;

            console.log(
                "RiderX Firebase initialized."
            );

            return true;

        } catch (error) {

            console.error(
                "RiderX Firebase initialization failed:",
                error
            );

            RX.state.initialized = false;

            return false;
        }
    };


    /* ========================================================
       AUTH STATE
       ======================================================== */

    RX.watchAuth = function () {

        if (!RX.firebase.auth) {
            return;
        }

        RX.firebase.auth.onAuthStateChanged(
            async function (user) {

                RX.state.authReady = true;
                RX.state.currentUser = user || null;

                if (user) {

                    try {

                        RX.state.profile =
                            await RX.getUserProfile(
                                user.uid
                            );

                        RX.state.role =
                            RX.getUserRole(
                                RX.state.profile,
                                user
                            );

                    } catch (error) {

                        console.warn(
                            "RiderX profile loading failed:",
                            error
                        );

                        RX.state.profile = null;
                        RX.state.role = null;
                    }

                } else {

                    RX.state.profile = null;
                    RX.state.role = null;
                }

                RX.dispatchAuthEvent();

                RX.handleProtectedPage();
            }
        );
    };


    /* ========================================================
       AUTH EVENT
       ======================================================== */

    RX.dispatchAuthEvent = function () {

        window.dispatchEvent(
            new CustomEvent(
                "riderx-auth-changed",
                {
                    detail: {
                        user: RX.state.currentUser,
                        profile: RX.state.profile,
                        role: RX.state.role
                    }
                }
            )
        );
    };


    /* ========================================================
       GET USER PROFILE
       ======================================================== */

    RX.getUserProfile = async function (uid) {

        if (!uid) {
            return null;
        }

        if (!RX.firebase.db) {
            return null;
        }

        try {

            const userDoc =
                await RX.firebase.db
                    .collection("users")
                    .doc(uid)
                    .get();

            if (userDoc.exists) {

                return {
                    uid: uid,
                    ...userDoc.data()
                };
            }

            return null;

        } catch (error) {

            console.warn(
                "Unable to load users/{uid}:",
                error
            );

            return null;
        }
    };


    /* ========================================================
       GET USER ROLE
       ======================================================== */

    RX.getUserRole = function (profile, user) {

        if (profile && profile.role) {

            return String(
                profile.role
            ).toLowerCase();
        }

        if (
            user &&
            user.displayName
        ) {

            const name =
                user.displayName.toLowerCase();

            if (name.includes("admin")) {
                return "admin";
            }

            if (name.includes("rider")) {
                return "rider";
            }

            if (name.includes("driver")) {
                return "rider";
            }
        }

        return "customer";
    };


    /* ========================================================
       AUTH STATUS
       ======================================================== */

    RX.isLoggedIn = function () {

        return !!RX.state.currentUser;
    };


    RX.isAdmin = function () {

        return RX.state.role === "admin";
    };


    RX.isRider = function () {

        return RX.state.role === "rider" ||
               RX.state.role === "driver";
    };


    RX.isCustomer = function () {

        return RX.state.role === "customer";
    };


    /* ========================================================
       CURRENT USER
       ======================================================== */

    RX.getCurrentUser = function () {

        return RX.state.currentUser;
    };


    RX.getCurrentProfile = function () {

        return RX.state.profile;
    };


    RX.getCurrentRole = function () {

        return RX.state.role;
    };


    /* ========================================================
       PAGE DETECTION
       ======================================================== */

    RX.getCurrentPath = function () {

        return window.location.pathname
            .replace(/\\/g, "/");
    };


    RX.getPageName = function () {

        const path =
            RX.getCurrentPath();

        const file =
            path.split("/").pop();

        return (
            file ||
            "index.html"
        ).toLowerCase();
    };


    /* ========================================================
       AUTH PAGES
       ======================================================== */

    RX.isAuthPage = function () {

        const path =
            RX.getCurrentPath();

        return (
            path.includes("/auth/") ||
            path.endsWith("/login.html") ||
            path.endsWith("/register.html") ||
            path.endsWith("/otp.html")
        );
    };


    /* ========================================================
       PUBLIC PAGES
       ======================================================== */

    RX.isPublicPage = function () {

        const path =
            RX.getCurrentPath();

        const publicPages = [
            "",
            "/",
            "/index.html",
            "/auth/login.html",
            "/auth/register.html",
            "/auth/forgot-password.html"
        ];

        return publicPages.includes(path);
    };


    /* ========================================================
       ROLE FOLDER DETECTION
       ======================================================== */

    RX.getPageArea = function () {

        const path =
            RX.getCurrentPath()
                .toLowerCase();

        if (path.includes("/admin/")) {
            return "admin";
        }

        if (path.includes("/rider/")) {
            return "rider";
        }

        if (path.includes("/customer/")) {
            return "customer";
        }

        return "public";
    };


    /* ========================================================
       PROTECTED PAGE HANDLER
       ======================================================== */

    RX.handleProtectedPage = function () {

        if (!RX.state.authReady) {
            return;
        }

        const area =
            RX.getPageArea();

        if (
            area === "public" ||
            RX.isAuthPage()
        ) {

            return;
        }

        if (!RX.isLoggedIn()) {

            RX.redirectToLogin();

            return;
        }

        const role =
            RX.getCurrentRole();

        if (
            area === "admin" &&
            role !== "admin"
        ) {

            RX.redirectByRole();

            return;
        }

        if (
            area === "rider" &&
            role !== "rider" &&
            role !== "driver"
        ) {

            RX.redirectByRole();

            return;
        }

        if (
            area === "customer" &&
            role === "admin"
        ) {

            RX.redirectByRole();

            return;
        }

        RX.applyUserToPage();
    };


    /* ========================================================
       LOGIN REDIRECT
       ======================================================== */

    RX.redirectToLogin = function () {

        if (
            RX.isAuthPage()
        ) {
            return;
        }

        const returnUrl =
            encodeURIComponent(
                window.location.pathname +
                window.location.search
            );

        window.location.href =
            "/auth/login.html?returnUrl=" +
            returnUrl;
    };


    /* ========================================================
       ROLE REDIRECT
       ======================================================== */

    RX.redirectByRole = function () {

        const role =
            RX.getCurrentRole();

        if (role === "admin") {

            window.location.href =
                "/admin/dashboard.html";

            return;
        }

        if (
            role === "rider" ||
            role === "driver"
        ) {

            window.location.href =
                "/rider/home.html";

            return;
        }

        window.location.href =
            "/customer/home.html";
    };


    /* ========================================================
       LOGIN SUCCESS REDIRECT
       ======================================================== */

    RX.redirectAfterLogin = function () {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const returnUrl =
            params.get("returnUrl");

        if (returnUrl) {

            try {

                const decoded =
                    decodeURIComponent(
                        returnUrl
                    );

                if (
                    decoded.startsWith("/")
                ) {

                    window.location.href =
                        decoded;

                    return;
                }

            } catch (error) {

                console.warn(
                    "Invalid return URL."
                );
            }
        }

        RX.redirectByRole();
    };


    /* ========================================================
       LOGOUT
       ======================================================== */

    RX.logout = async function () {

        try {

            if (
                RX.firebase.auth
            ) {

                await RX.firebase.auth.signOut();
            }

            RX.clearSession();

            window.location.href =
                "/auth/login.html";

        } catch (error) {

            console.error(
                "Logout failed:",
                error
            );

            RX.showToast(
                "Logout failed",
                "Please try again.",
                "danger"
            );
        }
    };


    /* ========================================================
       CLEAR SESSION
       ======================================================== */

    RX.clearSession = function () {

        RX.state.currentUser = null;
        RX.state.profile = null;
        RX.state.role = null;

        localStorage.removeItem(
            "riderx_user"
        );

        localStorage.removeItem(
            "riderx_role"
        );
    };


    /* ========================================================
       SAVE SESSION
       ======================================================== */

    RX.saveSession = function () {

        if (
            RX.state.currentUser
        ) {

            localStorage.setItem(
                "riderx_user",
                JSON.stringify({
                    uid:
                        RX.state.currentUser.uid,
                    email:
                        RX.state.currentUser.email
                })
            );
        }

        if (RX.state.role) {

            localStorage.setItem(
                "riderx_role",
                RX.state.role
            );
        }
    };


    /* ========================================================
       APPLY USER TO PAGE
       ======================================================== */

    RX.applyUserToPage = function () {

        const user =
            RX.state.currentUser;

        const profile =
            RX.state.profile;

        if (!user) {
            return;
        }

        const displayName =
            (
                profile &&
                (
                    profile.name ||
                    profile.displayName
                )
            ) ||
            user.displayName ||
            "RiderX User";

        const email =
            (
                profile &&
                profile.email
            ) ||
            user.email ||
            "";

        const photo =
            (
                profile &&
                (
                    profile.photoURL ||
                    profile.photo
                )
            ) ||
            user.photoURL ||
            "";

        document
            .querySelectorAll(
                "[data-user-name]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        displayName;
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
                "[data-user-role]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.state.role ||
                        "customer";
                }
            );

        document
            .querySelectorAll(
                "[data-user-photo]"
            )
            .forEach(
                function (element) {

                    if (photo) {

                        element.src =
                            photo;

                        element.style.display =
                            "block";
                    }
                }
            );

        RX.saveSession();
    };


    /* ========================================================
       THEME
       ======================================================== */

    RX.applyTheme = function () {

        const theme =
            RX.state.theme;

        document.body.classList.remove(
            "rx-dark"
        );

        document.body.classList.remove(
            "rx-auto-dark"
        );

        if (theme === "dark") {

            document.body.classList.add(
                "rx-dark"
            );

        } else if (theme === "auto") {

            document.body.classList.add(
                "rx-auto-dark"
            );
        }

        localStorage.setItem(
            "riderx_theme",
            theme
        );

        window.dispatchEvent(
            new CustomEvent(
                "riderx-theme-changed",
                {
                    detail: {
                        theme: theme
                    }
                }
            )
        );
    };


    RX.setTheme = function (theme) {

        const allowed = [
            "light",
            "dark",
            "auto"
        ];

        if (
            !allowed.includes(theme)
        ) {
            theme = "light";
        }

        RX.state.theme = theme;

        RX.applyTheme();
    };


    RX.toggleTheme = function () {

        if (
            RX.state.theme === "dark"
        ) {

            RX.setTheme("light");

        } else {

            RX.setTheme("dark");
        }
    };


    /* ========================================================
       LANGUAGE
       ======================================================== */

    RX.setLanguage = function (language) {

        const allowed = [
            "en",
            "hi"
        ];

        if (
            !allowed.includes(language)
        ) {

            language = "en";
        }

        RX.state.language =
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

        window.dispatchEvent(
            new CustomEvent(
                "riderx-language-changed",
                {
                    detail: {
                        language: language
                    }
                }
            )
        );
    };


    /* ========================================================
       TRANSLATION HELPER
       ======================================================== */

    RX.t = function (
        english,
        hindi
    ) {

        if (
            RX.state.language === "hi" &&
            hindi
        ) {

            return hindi;
        }

        return english;
    };


    /* ========================================================
       ESCAPE HTML
       ======================================================== */

    RX.escapeHTML = function (value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }

        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    };


    /* ========================================================
       CURRENCY
       ======================================================== */

    RX.formatCurrency = function (
        amount
    ) {

        const number =
            Number(amount) || 0;

        return (
            RX.config.currency +
            number.toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }
            )
        );
    };


    /* ========================================================
       NUMBER FORMAT
       ======================================================== */

    RX.formatNumber = function (
        number
    ) {

        return (
            Number(number) || 0
        ).toLocaleString(
            "en-IN"
        );
    };


    /* ========================================================
       DATE FORMAT
       ======================================================== */

    RX.formatDate = function (
        value
    ) {

        if (!value) {
            return "-";
        }

        let date;

        if (
            value &&
            typeof value.toDate === "function"
        ) {

            date = value.toDate();

        } else if (
            value instanceof Date
        ) {

            date = value;

        } else {

            date = new Date(value);
        }

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "-";
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    };


    /* ========================================================
       TIME FORMAT
       ======================================================== */

    RX.formatTime = function (
        value
    ) {

        if (!value) {
            return "-";
        }

        let date;

        if (
            value &&
            typeof value.toDate === "function"
        ) {

            date = value.toDate();

        } else {

            date = new Date(value);
        }

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "-";
        }

        return date.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    };


    /* ========================================================
       RIDE ID
       ======================================================== */

    RX.generateRideId = function () {

        const now =
            Date.now()
                .toString(36)
                .toUpperCase();

        const random =
            Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase();

        return "RX-" + now + "-" + random;
    };


    /* ========================================================
       RANDOM ID
       ======================================================== */

    RX.generateId = function (
        prefix
    ) {

        const p =
            prefix || "RX";

        return (
            p +
            "-" +
            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 9)
        ).toUpperCase();
    };


    /* ========================================================
       DEBOUNCE
       ======================================================== */

    RX.debounce = function (
        callback,
        delay
    ) {

        let timer;

        return function () {

            const args = arguments;
            const context = this;

            clearTimeout(timer);

            timer = setTimeout(
                function () {

                    callback.apply(
                        context,
                        args
                    );

                },
                delay || 300
            );
        };
    };


    /* ========================================================
       THROTTLE
       ======================================================== */

    RX.throttle = function (
        callback,
        delay
    ) {

        let waiting = false;

        return function () {

            if (waiting) {
                return;
            }

            const args = arguments;
            const context = this;

            callback.apply(
                context,
                args
            );

            waiting = true;

            setTimeout(
                function () {

                    waiting = false;

                },
                delay || 300
            );
        };
    };


    /* ========================================================
       NETWORK STATUS
       ======================================================== */

    RX.updateNetworkStatus = function () {

        RX.state.online =
            navigator.onLine;

        document.body.classList.toggle(
            "rx-offline",
            !RX.state.online
        );

        window.dispatchEvent(
            new CustomEvent(
                "riderx-network-changed",
                {
                    detail: {
                        online:
                            RX.state.online
                    }
                }
            )
        );
    };


    /* ========================================================
       TOAST
       ======================================================== */

    RX.showToast = function (
        title,
        message,
        type
    ) {

        type = type || "info";

        let container =
            document.querySelector(
                ".rx-toast-container"
            );

        if (!container) {

            container =
                document.createElement(
                    "div"
                );

            container.className =
                "rx-toast-container";

            document.body.appendChild(
                container
            );
        }

        const toast =
            document.createElement(
                "div"
            );

        toast.className =
            "rx-toast";

        let icon = "●";

        if (type === "success") {
            icon = "✓";
        }

        if (type === "danger") {
            icon = "!";
        }

        if (type === "warning") {
            icon = "!";
        }

        toast.innerHTML = `
            <div class="rx-toast-icon">
                ${icon}
            </div>

            <div>
                <div class="rx-toast-title">
                    ${RX.escapeHTML(title || "RiderX")}
                </div>

                <div class="rx-toast-message">
                    ${RX.escapeHTML(message || "")}
                </div>
            </div>
        `;

        container.appendChild(
            toast
        );

        setTimeout(
            function () {

                toast.style.opacity = "0";
                toast.style.transform =
                    "translateY(-8px)";

                setTimeout(
                    function () {

                        toast.remove();

                    },
                    220
                );

            },
            3500
        );
    };


    /* ========================================================
       CONFIRM DIALOG
       ======================================================== */

    RX.confirm = function (
        message,
        callback
    ) {

        const result =
            window.confirm(
                message ||
                "Are you sure?"
            );

        if (
            result &&
            typeof callback === "function"
        ) {

            callback();
        }

        return result;
    };


    /* ========================================================
       SAFE LOCAL STORAGE
       ======================================================== */

    RX.storage = {

        set: function (
            key,
            value
        ) {

            try {

                localStorage.setItem(
                    key,
                    JSON.stringify(value)
                );

            } catch (error) {

                console.warn(
                    "Local storage save failed.",
                    error
                );
            }
        },

        get: function (
            key,
            fallback
        ) {

            try {

                const value =
                    localStorage.getItem(
                        key
                    );

                if (value === null) {
                    return fallback;
                }

                return JSON.parse(
                    value
                );

            } catch (error) {

                return fallback;
            }
        },

        remove: function (
            key
        ) {

            try {

                localStorage.removeItem(
                    key
                );

            } catch (error) {

                console.warn(
                    "Local storage remove failed."
                );
            }
        }
    };


    /* ========================================================
       LOCATION
       ======================================================== */

    RX.getCurrentLocation = function () {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                if (
                    !navigator.geolocation
                ) {

                    reject(
                        new Error(
                            "Geolocation is not supported."
                        )
                    );

                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    function (position) {

                        resolve({
                            latitude:
                                position.coords.latitude,

                            longitude:
                                position.coords.longitude,

                            accuracy:
                                position.coords.accuracy
                        });

                    },
                    function (error) {

                        reject(error);

                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 5000
                    }
                );
            }
        );
    };


    /* ========================================================
       GEOLOCATION WATCH
       ======================================================== */

    RX.watchLocation = function (
        success,
        error
    ) {

        if (
            !navigator.geolocation
        ) {

            if (
                typeof error === "function"
            ) {

                error(
                    new Error(
                        "Geolocation unavailable."
                    )
                );
            }

            return null;
        }

        return navigator.geolocation.watchPosition(
            function (position) {

                if (
                    typeof success === "function"
                ) {

                    success({
                        latitude:
                            position.coords.latitude,

                        longitude:
                            position.coords.longitude,

                        accuracy:
                            position.coords.accuracy,

                        heading:
                            position.coords.heading,

                        speed:
                            position.coords.speed
                    });
                }

            },
            error,
            {
                enableHighAccuracy: true,
                maximumAge: 3000,
                timeout: 15000
            }
        );
    };


    RX.clearLocationWatch = function (
        watchId
    ) {

        if (
            watchId !== null &&
            watchId !== undefined &&
            navigator.geolocation
        ) {

            navigator.geolocation.clearWatch(
                watchId
            );
        }
    };


    /* ========================================================
       USER DATA HELPERS
       ======================================================== */

    RX.getUserName = function () {

        const user =
            RX.state.currentUser;

        const profile =
            RX.state.profile;

        return (
            (
                profile &&
                (
                    profile.name ||
                    profile.displayName
                )
            ) ||
            (
                user &&
                user.displayName
            ) ||
            "RiderX User"
        );
    };


    RX.getUserPhone = function () {

        const profile =
            RX.state.profile;

        return (
            (
                profile &&
                (
                    profile.phone ||
                    profile.phoneNumber
                )
            ) ||
            (
                RX.state.currentUser &&
                RX.state.currentUser.phoneNumber
            ) ||
            ""
        );
    };


    RX.getUserPhoto = function () {

        const profile =
            RX.state.profile;

        return (
            (
                profile &&
                (
                    profile.photoURL ||
                    profile.photo
                )
            ) ||
            (
                RX.state.currentUser &&
                RX.state.currentUser.photoURL
            ) ||
            ""
        );
    };


    /* ========================================================
       ROLE CHECK
       ======================================================== */

    RX.requireRole = function (
        roles
    ) {

        if (!Array.isArray(roles)) {
            roles = [roles];
        }

        if (
            !RX.isLoggedIn()
        ) {

            RX.redirectToLogin();

            return false;
        }

        if (
            !roles.includes(
                RX.state.role
            )
        ) {

            RX.redirectByRole();

            return false;
        }

        return true;
    };


    /* ========================================================
       REQUIRE AUTH
       ======================================================== */

    RX.requireAuth = function () {

        if (
            !RX.isLoggedIn()
        ) {

            RX.redirectToLogin();

            return false;
        }

        return true;
    };


    /* ========================================================
       FIREBASE ERROR MESSAGE
       ======================================================== */

    RX.firebaseErrorMessage = function (
        error
    ) {

        if (!error) {
            return "Something went wrong.";
        }

        const code =
            error.code || "";

        const messages = {

            "auth/invalid-email":
                "Please enter a valid email address.",

            "auth/user-disabled":
                "This account has been disabled.",

            "auth/user-not-found":
                "No account was found with these details.",

            "auth/wrong-password":
                "Incorrect password.",

            "auth/invalid-credential":
                "Invalid login details.",

            "auth/email-already-in-use":
                "This email is already registered.",

            "auth/weak-password":
                "Password should be at least 6 characters.",

            "auth/network-request-failed":
                "Network error. Please check your internet.",

            "auth/too-many-requests":
                "Too many attempts. Please try again later.",

            "auth/requires-recent-login":
                "Please login again to continue."
        };

        return (
            messages[code] ||
            error.message ||
            "Something went wrong."
        );
    };


    /* ========================================================
       GLOBAL LOGOUT BUTTONS
       ======================================================== */

    RX.bindLogoutButtons = function () {

        document
            .querySelectorAll(
                "[data-action='logout'], .rx-logout"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxBound ===
                        "true"
                    ) {

                        return;
                    }

                    button.dataset.rxBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function (event) {

                            event.preventDefault();

                            RX.confirm(
                                "Do you want to logout?",
                                function () {
                                    RX.logout();
                                }
                            );
                        }
                    );
                }
            );
    };


    /* ========================================================
       THEME BUTTONS
       ======================================================== */

    RX.bindThemeButtons = function () {

        document
            .querySelectorAll(
                "[data-theme]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxThemeBound ===
                        "true"
                    ) {

                        return;
                    }

                    button.dataset.rxThemeBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            RX.setTheme(
                                button.dataset.theme
                            );
                        }
                    );
                }
            );

        document
            .querySelectorAll(
                "[data-action='toggle-theme']"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxThemeToggleBound ===
                        "true"
                    ) {

                        return;
                    }

                    button.dataset.rxThemeToggleBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            RX.toggleTheme();
                        }
                    );
                }
            );
    };


    /* ========================================================
       LANGUAGE BUTTONS
       ======================================================== */

    RX.bindLanguageButtons = function () {

        document
            .querySelectorAll(
                "[data-language]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxLanguageBound ===
                        "true"
                    ) {

                        return;
                    }

                    button.dataset.rxLanguageBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            RX.setLanguage(
                                button.dataset.language
                            );
                        }
                    );
                }
            );
    };


    /* ========================================================
       MOBILE MENU
       ======================================================== */

    RX.initMobileMenu = function () {

        const toggles =
            document.querySelectorAll(
                "[data-action='mobile-menu']"
            );

        toggles.forEach(
            function (toggle) {

                toggle.addEventListener(
                    "click",
                    function () {

                        document.body.classList.toggle(
                            "rx-menu-open"
                        );
                    }
                );
            }
        );
    };


    /* ========================================================
       ONLINE / OFFLINE
       ======================================================== */

    window.addEventListener(
        "online",
        function () {

            RX.updateNetworkStatus();

            RX.showToast(
                "Back online",
                "Internet connection restored.",
                "success"
            );
        }
    );


    window.addEventListener(
        "offline",
        function () {

            RX.updateNetworkStatus();

            RX.showToast(
                "You're offline",
                "Some RiderX features may not work.",
                "warning"
            );
        }
    );


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    RX.init = function () {

        if (
            RX.state.initialized
        ) {

            return;
        }

        RX.applyTheme();

        RX.setLanguage(
            RX.state.language
        );

        RX.initFirebase();

        if (
            RX.firebase.auth
        ) {

            RX.watchAuth();
        } else {

            RX.state.authReady = true;

            RX.handleProtectedPage();
        }

        RX.bindLogoutButtons();

        RX.bindThemeButtons();

        RX.bindLanguageButtons();

        RX.initMobileMenu();

        RX.updateNetworkStatus();

        document.body.classList.add(
            "rx-app-ready"
        );

        console.log(
            "RiderX " +
            RX.version +
            " initialized."
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
            function () {

                RX.init();
            }
        );

    } else {

        RX.init();
    }


    /* ========================================================
       GLOBAL SHORTCUTS
       ======================================================== */

    window.RiderXLogout =
        function () {

            return RX.logout();
        };

    window.RiderXToast =
        function (
            title,
            message,
            type
        ) {

            return RX.showToast(
                title,
                message,
                type
            );
        };

})();
