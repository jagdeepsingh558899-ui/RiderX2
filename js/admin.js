/* ============================================================
   RIDERX
   ADMIN MAIN CONTROLLER
   File: js/admin.js

   Handles:
   - Admin authentication guard
   - Admin session
   - Admin dashboard initialization
   - Admin navigation
   - Admin notifications
   - Riders / Customers / Supports modules
   - Global admin refresh
   - Logout
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const ADMIN =
        RX.admin =
        RX.admin || {};


    /* ========================================================
       STATE
       ======================================================== */

    ADMIN.state = {

        initialized:
            false,

        authenticated:
            false,

        admin:
            null,

        page:
            "",

        notificationCount:
            0,

        notificationListener:
            null,

        authListener:
            null
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    ADMIN.getPage = function () {

        const path =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        return path ||
            "dashboard.html";
    };


    ADMIN.getUser = function () {

        /*
         * Firebase Auth
         */

        try {

            if (
                window.firebase &&
                firebase.auth
            ) {

                const user =
                    firebase.auth()
                        .currentUser;

                if (user) {

                    return {

                        uid:
                            user.uid,

                        email:
                            user.email ||
                            "",

                        displayName:
                            user.displayName ||
                            "",

                        photoURL:
                            user.photoURL ||
                            ""
                    };
                }
            }

        } catch (error) {

            console.warn(
                "Firebase admin user error:",
                error
            );
        }


        /*
         * Local session fallback
         */

        try {

            const stored =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_user"
                    ) || "null"
                );


            if (stored) {
                return stored;
            }

        } catch (error) {

            console.warn(
                "Admin local session error:",
                error
            );
        }


        return null;
    };


    ADMIN.getRole = function (
        user
    ) {

        user =
            user ||
            ADMIN.getUser();


        if (!user) {
            return "";
        }


        return String(

            user.role ||
            user.userRole ||
            user.accountType ||
            localStorage.getItem(
                "riderx_role"
            ) ||
            ""

        ).toLowerCase();
    };


    ADMIN.isAdmin = function (
        user
    ) {

        const role =
            ADMIN.getRole(
                user
            );


        return (
            role === "admin" ||
            role === "superadmin" ||
            role === "super_admin"
        );
    };


    ADMIN.isLoginPage = function () {

        const page =
            ADMIN.getPage();


        return (
            page ===
            "login.html"
        );
    };


    ADMIN.escape = function (
        value
    ) {

        const div =
            document.createElement(
                "div"
            );


        div.textContent =
            String(
                value ?? ""
            );


        return div.innerHTML;
    };


    /* ========================================================
       AUTH GUARD
       ======================================================== */

    ADMIN.guard = async function () {

        /*
         * Login page should remain accessible.
         */

        if (
            ADMIN.isLoginPage()
        ) {

            return true;
        }


        /*
         * Firebase Auth
         */

        try {

            if (
                window.firebase &&
                firebase.auth
            ) {

                const auth =
                    firebase.auth();


                const user =
                    auth.currentUser;


                if (user) {

                    const allowed =
                        await ADMIN.verifyRole(
                            user
                        );


                    if (allowed) {

                        ADMIN.state.authenticated =
                            true;

                        ADMIN.state.admin =
                            user;

                        return true;
                    }


                    ADMIN.denyAccess();

                    return false;
                }
            }

        } catch (error) {

            console.warn(
                "Firebase admin guard error:",
                error
            );
        }


        /*
         * Local role fallback.
         */

        const user =
            ADMIN.getUser();


        if (
            user &&
            ADMIN.isAdmin(
                user
            )
        ) {

            ADMIN.state.authenticated =
                true;

            ADMIN.state.admin =
                user;

            return true;
        }


        ADMIN.redirectLogin();

        return false;
    };


    /* ========================================================
       VERIFY ADMIN ROLE
       ======================================================== */

    ADMIN.verifyRole = async function (
        user
    ) {

        if (!user) {
            return false;
        }


        /*
         * Local role first.
         */

        if (
            ADMIN.isAdmin(
                user
            )
        ) {
            return true;
        }


        /*
         * Firestore role verification.
         */

        try {

            if (
                window.firebase &&
                typeof firebase.firestore ===
                "function"
            ) {

                const firestore =
                    firebase.firestore();


                const document =
                    await firestore
                        .collection(
                            "users"
                        )
                        .doc(
                            user.uid
                        )
                        .get();


                if (
                    document.exists
                ) {

                    const data =
                        document.data() ||
                        {};


                    const role =
                        String(
                            data.role ||
                            data.userRole ||
                            ""
                        ).toLowerCase();


                    return (
                        role === "admin" ||
                        role === "superadmin" ||
                        role === "super_admin"
                    );
                }
            }

        } catch (error) {

            console.warn(
                "Firestore role verification failed:",
                error
            );
        }


        /*
         * Realtime Database role verification.
         */

        try {

            if (
                window.firebase &&
                typeof firebase.database ===
                "function"
            ) {

                const snapshot =
                    await firebase.database()
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


                const role =
                    String(
                        data.role ||
                        data.userRole ||
                        ""
                    ).toLowerCase();


                return (
                    role === "admin" ||
                    role === "superadmin" ||
                    role === "super_admin"
                );
            }

        } catch (error) {

            console.warn(
                "RTDB role verification failed:",
                error
            );
        }


        return false;
    };


    /* ========================================================
       REDIRECT
       ======================================================== */

    ADMIN.redirectLogin = function () {

        const current =
            window.location.pathname;


        if (
            current.endsWith(
                "login.html"
            )
        ) {
            return;
        }


        window.location.replace(
            "login.html"
        );
    };


    ADMIN.denyAccess = function () {

        try {

            localStorage.removeItem(
                "riderx_admin_session"
            );

        } catch (error) {
            /* ignore */
        }


        document.body.innerHTML =
            `
            <div class="riderx-access-denied">

                <div class="access-denied-card">

                    <div class="access-denied-icon">
                        🔒
                    </div>

                    <h1>
                        Access Denied
                    </h1>

                    <p>
                        You do not have permission
                        to access the RiderX admin panel.
                    </p>

                    <button
                        type="button"
                        id="riderx-admin-login"
                    >
                        Go to Login
                    </button>

                </div>

            </div>
            `;


        const button =
            document.getElementById(
                "riderx-admin-login"
            );


        if (button) {

            button.addEventListener(
                "click",
                function () {

                    ADMIN.redirectLogin();
                }
            );
        }
    };


    /* ========================================================
       ADMIN PROFILE
       ======================================================== */

    ADMIN.renderProfile = function () {

        const user =
            ADMIN.state.admin ||
            ADMIN.getUser();


        if (!user) {
            return;
        }


        const name =
            user.displayName ||
            user.name ||
            "Admin";


        const email =
            user.email ||
            "";


        document
            .querySelectorAll(
                "[data-admin-name]"
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
                "[data-admin-email]"
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
                "[data-admin-avatar]"
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
       NAVIGATION
       ======================================================== */

    ADMIN.setupNavigation = function () {

        document.addEventListener(
            "click",
            function (
                event
            ) {

                const link =
                    event.target.closest(
                        "[data-admin-link]"
                    );


                if (!link) {
                    return;
                }


                const target =
                    link.dataset
                        .adminLink;


                if (!target) {
                    return;
                }


                event.preventDefault();


                window.location.href =
                    target;
            }
        );


        /*
         * Active navigation.
         */

        const current =
            ADMIN.getPage();


        document
            .querySelectorAll(
                "[data-admin-link]"
            )
            .forEach(
                function (
                    link
                ) {

                    const target =
                        (
                            link.dataset
                                .adminLink ||
                            ""
                        )
                            .split("/")
                            .pop()
                            .toLowerCase();


                    if (
                        target ===
                        current
                    ) {

                        link.classList.add(
                            "active"
                        );

                    } else {

                        link.classList.remove(
                            "active"
                        );
                    }
                }
            );
    };


    /* ========================================================
       MOBILE MENU
       ======================================================== */

    ADMIN.setupMenu = function () {

        document.addEventListener(
            "click",
            function (
                event
            ) {

                const open =
                    event.target.closest(
                        "[data-admin-menu-open]"
                    );


                if (open) {

                    event.preventDefault();

                    document.body.classList.add(
                        "admin-menu-open"
                    );

                    return;
                }


                const close =
                    event.target.closest(
                        "[data-admin-menu-close]"
                    );


                if (close) {

                    event.preventDefault();

                    document.body.classList.remove(
                        "admin-menu-open"
                    );

                    return;
                }


                const overlay =
                    event.target.closest(
                        ".admin-sidebar-overlay"
                    );


                if (overlay) {

                    document.body.classList.remove(
                        "admin-menu-open"
                    );
                }
            }
        );
    };


    /* ========================================================
       ADMIN NOTIFICATIONS
       ======================================================== */

    ADMIN.startNotifications =
        function () {

            const user =
                ADMIN.state.admin ||
                ADMIN.getUser();


            if (!user) {
                return;
            }


            const uid =
                user.uid ||
                user.id;


            if (!uid) {
                return;
            }


            /*
             * Avoid duplicate listener.
             */

            if (
                ADMIN.state.notificationListener
            ) {

                try {

                    ADMIN.state
                        .notificationListener
                        .off();

                } catch (error) {
                    /* ignore */
                }
            }


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


            const reference =
                database.ref(
                    "adminNotifications"
                );


            const callback =
                function (
                    snapshot
                ) {

                    let count =
                        0;


                    snapshot.forEach(
                        function (
                            child
                        ) {

                            const data =
                                child.val() ||
                                {};


                            if (
                                data.read !==
                                true
                            ) {

                                count++;
                            }
                        }
                    );


                    ADMIN.state.notificationCount =
                        count;


                    ADMIN.renderNotificationCount(
                        count
                    );
                };


            reference.on(
                "value",
                callback
            );


            ADMIN.state.notificationListener =
                reference;
        };


    ADMIN.renderNotificationCount =
        function (
            count
        ) {

            document
                .querySelectorAll(
                    "[data-admin-notification-count]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count > 99
                                ? "99+"
                                : count;

                        element.hidden =
                            count === 0;
                    }
                );


            document
                .querySelectorAll(
                    ".admin-notification-badge"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count > 99
                                ? "99+"
                                : count;

                        element.classList.toggle(
                            "hidden",
                            count === 0
                        );
                    }
                );
        };


    /* ========================================================
       MARK ADMIN NOTIFICATIONS READ
       ======================================================== */

    ADMIN.markNotificationsRead =
        async function () {

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

                const snapshot =
                    await database
                        .ref(
                            "adminNotifications"
                        )
                        .once(
                            "value"
                        );


                const updates =
                    {};


                snapshot.forEach(
                    function (
                        child
                    ) {

                        const data =
                            child.val() ||
                            {};


                        if (
                            data.read !==
                            true
                        ) {

                            updates[
                                child.key +
                                "/read"
                            ] =
                                true;
                        }
                    }
                );


                if (
                    Object.keys(
                        updates
                    ).length
                ) {

                    await database
                        .ref(
                            "adminNotifications"
                        )
                        .update(
                            updates
                        );
                }


                ADMIN.state.notificationCount =
                    0;


                ADMIN.renderNotificationCount(
                    0
                );

            } catch (error) {

                console.warn(
                    "Admin notification read error:",
                    error
                );
            }
        };


    /* ========================================================
       GLOBAL REFRESH
       ======================================================== */

    ADMIN.refresh =
        async function () {

            const jobs = [];


            if (
                RX.adminRiders &&
                typeof RX.adminRiders.load ===
                "function"
            ) {

                jobs.push(
                    RX.adminRiders.load()
                );
            }


            if (
                RX.adminSupports &&
                typeof RX.adminSupports.load ===
                "function"
            ) {

                jobs.push(
                    RX.adminSupports.load()
                );
            }


            if (
                RX.adminCustomers &&
                typeof RX.adminCustomers.load ===
                "function"
            ) {

                jobs.push(
                    RX.adminCustomers.load()
                );
            }


            if (
                RX.admin &&
                typeof RX.admin.loadDashboard ===
                "function"
            ) {

                jobs.push(
                    RX.admin.loadDashboard()
                );
            }


            if (jobs.length) {

                await Promise.allSettled(
                    jobs
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-admin-refresh"
                )
            );
        };


    /* ========================================================
       DASHBOARD HOOK
       ======================================================== */

    ADMIN.loadDashboard =
        async function () {

            /*
             * Dashboard module can provide
             * its own implementation.
             */

            if (
                RX.dashboard &&
                typeof RX.dashboard.load ===
                "function"
            ) {

                return RX.dashboard.load();
            }


            /*
             * Basic dashboard counters.
             */

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

                const [
                    usersSnapshot,
                    ridesSnapshot
                ] =
                    await Promise.all([
                        database
                            .ref(
                                "users"
                            )
                            .once(
                                "value"
                            ),

                        database
                            .ref(
                                "rides"
                            )
                            .once(
                                "value"
                            )
                    ]);


                const users =
                    usersSnapshot.val() ||
                    {};


                const rides =
                    ridesSnapshot.val() ||
                    {};


                let customers =
                    0;

                let riders =
                    0;

                let onlineRiders =
                    0;


                Object.keys(
                    users
                ).forEach(
                    function (
                        id
                    ) {

                        const user =
                            users[id] ||
                            {};


                        const role =
                            String(
                                user.role ||
                                user.userRole ||
                                ""
                            ).toLowerCase();


                        if (
                            role ===
                            "customer"
                        ) {

                            customers++;
                        }


                        if (
                            role ===
                            "rider"
                        ) {

                            riders++;


                            if (
                                user.online ===
                                true
                            ) {

                                onlineRiders++;
                            }
                        }
                    }
                );


                let totalRides =
                    0;

                let activeRides =
                    0;

                let completedRides =
                    0;


                Object.keys(
                    rides
                ).forEach(
                    function (
                        id
                    ) {

                        const ride =
                            rides[id] ||
                            {};


                        totalRides++;


                        const status =
                            String(
                                ride.status ||
                                ""
                            ).toLowerCase();


                        if (
                            [
                                "searching",
                                "requested",
                                "accepted",
                                "arriving",
                                "started",
                                "ongoing",
                                "in_progress"
                            ].includes(
                                status
                            )
                        ) {

                            activeRides++;
                        }


                        if (
                            [
                                "completed",
                                "complete",
                                "finished"
                            ].includes(
                                status
                            )
                        ) {

                            completedRides++;
                        }
                    }
                );


                const counters = {

                    customers:
                        customers,

                    riders:
                        riders,

                    onlineRiders:
                        onlineRiders,

                    totalRides:
                        totalRides,

                    activeRides:
                        activeRides,

                    completedRides:
                        completedRides
                };


                Object.keys(
                    counters
                ).forEach(
                    function (
                        key
                    ) {

                        document
                            .querySelectorAll(
                                "[data-admin-" +
                                key +
                                "]"
                            )
                            .forEach(
                                function (
                                    element
                                ) {

                                    element.textContent =
                                        counters[key];
                                }
                            );
                    }
                );


                return counters;

            } catch (error) {

                console.warn(
                    "Admin dashboard load failed:",
                    error
                );
            }
        };


    /* ========================================================
       LOGOUT
       ======================================================== */

    ADMIN.logout = async function () {

        try {

            /*
             * Remove local admin session.
             */

            localStorage.removeItem(
                "riderx_admin_session"
            );

            localStorage.removeItem(
                "riderx_role"
            );


            /*
             * Firebase logout.
             */

            if (
                window.firebase &&
                firebase.auth
            ) {

                await firebase.auth()
                    .signOut();
            }


        } catch (error) {

            console.warn(
                "Admin logout error:",
                error
            );

        } finally {

            ADMIN.state.authenticated =
                false;

            ADMIN.state.admin =
                null;


            window.location.replace(
                "login.html"
            );
        }
    };


    /* ========================================================
       LOGOUT EVENTS
       ======================================================== */

    ADMIN.setupLogout =
        function () {

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-admin-logout]"
                        );


                    if (!button) {
                        return;
                    }


                    event.preventDefault();


                    ADMIN.logout();
                }
            );
        };


    /* ========================================================
       AUTH STATE LISTENER
       ======================================================== */

    ADMIN.watchAuth =
        function () {

            try {

                if (
                    !window.firebase ||
                    !firebase.auth
                ) {
                    return;
                }


                ADMIN.state.authListener =
                    firebase.auth()
                        .onAuthStateChanged(
                            async function (
                                user
                            ) {

                                if (
                                    ADMIN.isLoginPage()
                                ) {

                                    return;
                                }


                                if (!user) {

                                    ADMIN.redirectLogin();

                                    return;
                                }


                                const allowed =
                                    await ADMIN.verifyRole(
                                        user
                                    );


                                if (!allowed) {

                                    ADMIN.denyAccess();

                                    return;
                                }


                                ADMIN.state.authenticated =
                                    true;

                                ADMIN.state.admin =
                                    user;


                                ADMIN.renderProfile();

                            }
                        );

            } catch (error) {

                console.warn(
                    "Admin auth listener failed:",
                    error
                );
            }
        };


    /* ========================================================
       PAGE SPECIFIC MODULES
       ======================================================== */

    ADMIN.initModules =
        function () {

            /*
             * Riders
             */

            if (
                RX.adminRiders &&
                typeof RX.adminRiders.init ===
                "function"
            ) {

                RX.adminRiders.init();
            }


            /*
             * Supports
             */

            if (
                RX.adminSupports &&
                typeof RX.adminSupports.init ===
                "function"
            ) {

                RX.adminSupports.init();
            }


            /*
             * Customers
             */

            if (
                RX.adminCustomers &&
                typeof RX.adminCustomers.init ===
                "function"
            ) {

                RX.adminCustomers.init();
            }


            /*
             * Notifications
             */

            if (
                RX.notifications &&
                typeof RX.notifications.init ===
                "function"
            ) {

                RX.notifications.init();
            }
        };


    /* ========================================================
       ADMIN LOGIN PAGE HELPERS
       ======================================================== */

    ADMIN.loginSuccess =
        function (
            user,
            role
        ) {

            user =
                user || {};


            role =
                String(
                    role ||
                    "admin"
                ).toLowerCase();


            localStorage.setItem(
                "riderx_role",
                role
            );


            localStorage.setItem(
                "riderx_user",
                JSON.stringify(
                    {
                        ...user,
                        role:
                            role
                    }
                )
            );


            localStorage.setItem(
                "riderx_admin_session",
                JSON.stringify(
                    {
                        uid:
                            user.uid ||
                            user.id ||
                            "",

                        email:
                            user.email ||
                            "",

                        role:
                            role,

                        loginAt:
                            Date.now()
                    }
                )
            );


            window.location.replace(
                "dashboard.html"
            );
    };


    /* ========================================================
       GLOBAL EVENTS
       ======================================================== */

    ADMIN.setupGlobalEvents =
        function () {

            window.addEventListener(
                "riderx-admin-notifications-open",
                function () {

                    ADMIN.markNotificationsRead();
                }
            );


            window.addEventListener(
                "riderx-admin-refresh-request",
                function () {

                    ADMIN.refresh();
                }
            );
        };


    /* ========================================================
       INIT
       ======================================================== */

    ADMIN.init = async function () {

        if (
            ADMIN.state.initialized
        ) {
            return;
        }


        ADMIN.state.page =
            ADMIN.getPage();


        /*
         * Login page does not need
         * protected admin modules.
         */

        if (
            ADMIN.isLoginPage()
        ) {

            ADMIN.setupLogout();
            ADMIN.setupGlobalEvents();

            ADMIN.state.initialized =
                true;

            return;
        }


        /*
         * Protect every other admin page.
         */

        const allowed =
            await ADMIN.guard();


        if (!allowed) {
            return;
        }


        ADMIN.setupNavigation();

        ADMIN.setupMenu();

        ADMIN.setupLogout();

        ADMIN.setupGlobalEvents();

        ADMIN.watchAuth();

        ADMIN.renderProfile();

        ADMIN.startNotifications();

        ADMIN.initModules();


        /*
         * Dashboard only.
         */

        if (
            ADMIN.state.page ===
                "dashboard.html" ||
            ADMIN.state.page ===
                ""
        ) {

            await ADMIN.loadDashboard();
        }


        ADMIN.state.initialized =
            true;


        window.dispatchEvent(
            new CustomEvent(
                "riderx-admin-ready"
            )
        );


        console.log(
            "RiderX admin.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.adminGuard =
        function () {

            return ADMIN.guard();
        };


    RX.adminLogout =
        function () {

            return ADMIN.logout();
        };


    RX.adminRefresh =
        function () {

            return ADMIN.refresh();
        };


    RX.adminIsAdmin =
        function () {

            return ADMIN.isAdmin();
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

                ADMIN.init();

            }
        );

    } else {

        ADMIN.init();
    }

})();
