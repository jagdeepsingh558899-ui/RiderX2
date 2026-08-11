/* ============================================================
   RIDERX 2.0
   ADMIN MAIN CONTROLLER
   File: js/admin.js

   FINAL VERSION

   Handles:
   - Secure admin authentication guard
   - Firebase modular SDK compatibility
   - Firestore admin-role verification
   - Admin session state
   - Admin dashboard initialization
   - Admin navigation
   - Admin notifications
   - Riders / Customers / Supports modules
   - Global admin refresh
   - Logout
   - Firebase ready-state handling

   IMPORTANT:
   - Firebase initialization is handled ONLY by:
       ../firebase/firebase-config.js
   - This file NEVER calls initializeApp().
   - This file NEVER trusts localStorage for admin authorization.
   - Firebase Authentication + Firestore are the authority.
============================================================ */

"use strict";


/* ============================================================
   RIDERX NAMESPACE
============================================================ */

window.RiderX =
    window.RiderX || {};

const RX =
    window.RiderX;

const ADMIN =
    RX.admin =
    RX.admin || {};


/* ============================================================
   STATE
============================================================ */

ADMIN.state = {

    initialized: false,

    initializing: false,

    authenticated: false,

    admin: null,

    adminProfile: null,

    page: "",

    notificationCount: 0,

    notificationListener: null,

    notificationReference: null,

    authListener: null,

    firebaseLoaded: false,

    firebase: null
};


/* ============================================================
   FIREBASE REFERENCES
============================================================ */

let firebaseModule = null;

let auth = null;

let db = null;

let realtimeDb = null;

let firebaseReadyPromise = null;


/* ============================================================
   FIREBASE LOADER
   ------------------------------------------------------------
   Loads the SINGLE Firebase configuration module.

   This prevents admin.js from using the old compat API.
============================================================ */

function loadFirebase() {

    if (firebaseReadyPromise) {

        return firebaseReadyPromise;
    }


    firebaseReadyPromise =
        new Promise(
            async function (resolve, reject) {

                try {

                    /*
                     * If firebase-config.js has already loaded,
                     * use the existing shared services.
                     */

                    if (
                        RX.firebase &&
                        RX.firebase.auth &&
                        RX.firebase.db
                    ) {

                        firebaseModule =
                            RX.firebase;

                    } else {

                        /*
                         * Dynamically load the canonical
                         * Firebase configuration.
                         *
                         * admin.js can therefore remain a
                         * normal script and does not require
                         * every admin HTML page to be converted
                         * to type="module".
                         */

                        const module =
                            await import(
                                "../firebase/firebase-config.js"
                            );


                        firebaseModule =
                            module.firebaseServices ||
                            RX.firebase;
                    }


                    if (!firebaseModule) {

                        throw new Error(
                            "RiderX Firebase services are unavailable."
                        );
                    }


                    auth =
                        firebaseModule.auth ||
                        null;


                    db =
                        firebaseModule.db ||
                        firebaseModule.firestore ||
                        null;


                    realtimeDb =
                        firebaseModule.realtimeDb ||
                        firebaseModule.database ||
                        null;


                    if (
                        !auth ||
                        !db
                    ) {

                        throw new Error(
                            "RiderX Firebase Auth/Firestore service missing."
                        );
                    }


                    ADMIN.state.firebaseLoaded =
                        true;


                    ADMIN.state.firebase =
                        firebaseModule;


                    resolve(
                        firebaseModule
                    );

                } catch (error) {

                    console.error(
                        "RiderX admin Firebase loading failed:",
                        error
                    );


                    reject(
                        error
                    );
                }
            }
        );


    return firebaseReadyPromise;
}


/* ============================================================
   FIREBASE READY HELPER
============================================================ */

async function ensureFirebase() {

    try {

        return await loadFirebase();

    } catch (error) {

        console.error(
            "RiderX admin Firebase unavailable:",
            error
        );

        return null;
    }
}


/* ============================================================
   GET CURRENT PAGE
============================================================ */

ADMIN.getPage = function () {

    const path =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    return path ||
        "dashboard.html";
};


/* ============================================================
   GET CURRENT AUTH USER
============================================================ */

ADMIN.getUser = function () {

    try {

        if (
            auth &&
            auth.currentUser
        ) {

            return auth.currentUser;
        }

    } catch (error) {

        console.warn(
            "RiderX admin current-user error:",
            error
        );
    }


    return null;
};


/* ============================================================
   GET LOCAL PROFILE
   ------------------------------------------------------------
   LocalStorage is used only for UI/session convenience.
   It is NEVER treated as proof of admin access.
============================================================ */

ADMIN.getStoredUser = function () {

    try {

        const value =
            localStorage.getItem(
                "riderx_user"
            );


        if (!value) {

            return null;
        }


        return JSON.parse(
            value
        );

    } catch (error) {

        console.warn(
            "RiderX admin local profile error:",
            error
        );

        return null;
    }
};


/* ============================================================
   GET ROLE
============================================================ */

ADMIN.getRole = function (
    user,
    profile
) {

    user =
        user ||
        ADMIN.getUser();


    profile =
        profile ||
        ADMIN.state.adminProfile ||
        {};


    const role =
        profile.role ||
        profile.userRole ||
        profile.accountType ||
        user?.role ||
        user?.userRole ||
        user?.accountType ||
        "";


    return String(
        role
    ).trim().toLowerCase();
};


/* ============================================================
   ADMIN ROLE CHECK
============================================================ */

ADMIN.isAdmin = function (
    user,
    profile
) {

    const role =
        ADMIN.getRole(
            user,
            profile
        );


    return (
        role === "admin" ||
        role === "superadmin" ||
        role === "super_admin"
    );
};


/* ============================================================
   LOGIN PAGE CHECK
============================================================ */

ADMIN.isLoginPage = function () {

    return (
        ADMIN.getPage() ===
        "login.html"
    );
};


/* ============================================================
   HTML ESCAPE
============================================================ */

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


/* ============================================================
   FIRESTORE ADMIN PROFILE VERIFICATION
   ------------------------------------------------------------
   Security authority:
       users/{uid}

   Supported role fields:
       role
       userRole
       accountType

   Supported admin flags:
       isAdmin
============================================================ */

ADMIN.verifyRole = async function (
    user
) {

    if (!user || !user.uid) {

        return false;
    }


    const services =
        await ensureFirebase();


    if (!services || !db) {

        return false;
    }


    try {

        const {
            doc,
            getDoc
        } = await import(
            "../firebase/firebase-config.js"
        );


        const userReference =
            doc(
                db,
                "users",
                user.uid
            );


        const snapshot =
            await getDoc(
                userReference
            );


        if (!snapshot.exists()) {

            ADMIN.state.adminProfile =
                null;

            return false;
        }


        const data =
            snapshot.data() ||
            {};


        ADMIN.state.adminProfile =
            data;


        /*
         * Admin role is determined from
         * the trusted Firestore profile.
         */

        const role =
            String(
                data.role ||
                data.userRole ||
                data.accountType ||
                ""
            )
                .trim()
                .toLowerCase();


        const adminFlag =
            data.isAdmin === true;


        /*
         * Disabled/blocked accounts cannot
         * access the admin panel.
         */

        const blocked =
            data.disabled === true ||
            data.blocked === true ||
            data.status === "disabled" ||
            data.status === "blocked" ||
            data.status === "suspended";


        if (blocked) {

            return false;
        }


        return (
            role === "admin" ||
            role === "superadmin" ||
            role === "super_admin" ||
            adminFlag
        );

    } catch (error) {

        console.error(
            "RiderX admin Firestore role verification failed:",
            error
        );


        ADMIN.state.adminProfile =
            null;


        return false;
    }
};


/* ============================================================
   AUTH GUARD
   ------------------------------------------------------------
   IMPORTANT:
   LocalStorage cannot bypass this guard.
============================================================ */

ADMIN.guard = async function () {

    if (
        ADMIN.isLoginPage()
    ) {

        return true;
    }


    const services =
        await ensureFirebase();


    if (!services || !auth) {

        ADMIN.showFirebaseError();

        return false;
    }


    /*
     * Wait for Firebase Auth to resolve
     * the current session.
     */

    const user =
        await ADMIN.waitForAuthUser();


    if (!user) {

        ADMIN.redirectLogin();

        return false;
    }


    const allowed =
        await ADMIN.verifyRole(
            user
        );


    if (!allowed) {

        ADMIN.denyAccess();

        return false;
    }


    ADMIN.state.authenticated =
        true;


    ADMIN.state.admin =
        user;


    return true;
};


/* ============================================================
   WAIT FOR AUTH USER
============================================================ */

ADMIN.waitForAuthUser = function () {

    return new Promise(
        async function (resolve) {

            const services =
                await ensureFirebase();


            if (
                !services ||
                !auth
            ) {

                resolve(
                    null
                );

                return;
            }


            /*
             * If Firebase already knows the user,
             * use it immediately.
             */

            if (
                auth.currentUser
            ) {

                resolve(
                    auth.currentUser
                );

                return;
            }


            let finished =
                false;


            let unsubscribe =
                null;


            const finish =
                function (
                    user
                ) {

                    if (finished) {

                        return;
                    }


                    finished =
                        true;


                    if (
                        typeof unsubscribe ===
                        "function"
                    ) {

                        unsubscribe();
                    }


                    resolve(
                        user ||
                        null
                    );
                };


            try {

                const {
                    onAuthStateChanged
                } = await import(
                    "../firebase/firebase-config.js"
                );


                unsubscribe =
                    onAuthStateChanged(
                        auth,
                        function (
                            user
                        ) {

                            finish(
                                user
                            );
                        }
                    );


                /*
                 * Safety timeout.
                 * This prevents a broken auth listener
                 * from leaving the admin page frozen forever.
                 */

                setTimeout(
                    function () {

                        finish(
                            auth.currentUser ||
                            null
                        );

                    },
                    10000
                );

            } catch (error) {

                console.error(
                    "RiderX admin auth wait failed:",
                    error
                );


                finish(
                    null
                );
            }
        }
    );
};


/* ============================================================
   REDIRECT TO LOGIN
============================================================ */

ADMIN.redirectLogin = function () {

    if (
        ADMIN.isLoginPage()
    ) {

        return;
    }


    window.location.replace(
        "login.html"
    );
};


/* ============================================================
   FIREBASE ERROR SCREEN
============================================================ */

ADMIN.showFirebaseError = function () {

    if (!document.body) {

        return;
    }


    document.body.innerHTML =
        `
        <div class="riderx-access-denied">

            <div class="access-denied-card">

                <div class="access-denied-icon">
                    ⚠️
                </div>

                <h1>
                    RiderX System Error
                </h1>

                <p>
                    Firebase services could not be loaded.
                    Please refresh the page and try again.
                </p>

                <button
                    type="button"
                    id="riderx-admin-retry"
                >
                    Retry
                </button>

                <button
                    type="button"
                    id="riderx-admin-login"
                >
                    Go to Login
                </button>

            </div>

        </div>
        `;


    const retry =
        document.getElementById(
            "riderx-admin-retry"
        );


    if (retry) {

        retry.addEventListener(
            "click",
            function () {

                window.location.reload();

            }
        );
    }


    const login =
        document.getElementById(
            "riderx-admin-login"
        );


    if (login) {

        login.addEventListener(
            "click",
            function () {

                ADMIN.redirectLogin();

            }
        );
    }
};


/* ============================================================
   ACCESS DENIED
============================================================ */

ADMIN.denyAccess = function () {

    ADMIN.state.authenticated =
        false;


    ADMIN.state.admin =
        null;


    ADMIN.state.adminProfile =
        null;


    try {

        localStorage.removeItem(
            "riderx_admin_session"
        );

    } catch (error) {
        /* Ignore local storage errors. */
    }


    if (!document.body) {

        ADMIN.redirectLogin();

        return;
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


/* ============================================================
   ADMIN PROFILE
============================================================ */

ADMIN.renderProfile = function () {

    const user =
        ADMIN.state.admin ||
        ADMIN.getUser();


    const profile =
        ADMIN.state.adminProfile ||
        {};


    if (!user) {

        return;
    }


    const name =
        profile.displayName ||
        profile.fullName ||
        profile.name ||
        user.displayName ||
        "Admin";


    const email =
        profile.email ||
        user.email ||
        "";


    const photo =
        profile.photoURL ||
        profile.profileImage ||
        user.photoURL ||
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

                if (photo) {

                    element.src =
                        photo;
                }
            }
        );
};


/* ============================================================
   NAVIGATION
============================================================ */

ADMIN.setupNavigation = function () {

    if (
        ADMIN.state.navigationReady
    ) {

        return;
    }


    ADMIN.state.navigationReady =
        true;


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
                link.dataset.adminLink;


            if (!target) {

                return;
            }


            event.preventDefault();


            window.location.href =
                target;
        }
    );


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
                        link.dataset.adminLink ||
                        ""
                    )
                        .split("/")
                        .pop()
                        .toLowerCase();


                link.classList.toggle(
                    "active",
                    target === current
                );
            }
        );
};


/* ============================================================
   MOBILE MENU
============================================================ */

ADMIN.setupMenu = function () {

    if (
        ADMIN.state.menuReady
    ) {

        return;
    }


    ADMIN.state.menuReady =
        true;


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


/* ============================================================
   ADMIN NOTIFICATIONS
   ------------------------------------------------------------
   Uses Realtime Database modular API.

   Expected location:
       adminNotifications/{notificationId}

   Expected read field:
       read: true/false
============================================================ */

ADMIN.startNotifications = async function () {

    if (
        ADMIN.state.notificationListener
    ) {

        return;
    }


    if (!realtimeDb) {

        return;
    }


    try {

        const {
            ref,
            onValue
        } = await import(
            "../firebase/firebase-config.js"
        );


        const reference =
            ref(
                realtimeDb,
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
                            data.read !== true &&
                            data.isRead !== true
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


        onValue(
            reference,
            callback
        );


        ADMIN.state.notificationReference =
            reference;


        ADMIN.state.notificationListener =
            callback;

    } catch (error) {

        console.warn(
            "RiderX admin notification listener failed:",
            error
        );
    }
};


/* ============================================================
   STOP ADMIN NOTIFICATIONS
============================================================ */

ADMIN.stopNotifications = async function () {

    if (
        !realtimeDb ||
        !ADMIN.state.notificationReference ||
        !ADMIN.state.notificationListener
    ) {

        return;
    }


    try {

        const {
            off
        } = await import(
            "../firebase/firebase-config.js"
        );


        off(
            ADMIN.state.notificationReference,
            "value",
            ADMIN.state.notificationListener
        );

    } catch (error) {

        console.warn(
            "RiderX admin notification listener cleanup failed:",
            error
        );
    }


    ADMIN.state.notificationReference =
        null;


    ADMIN.state.notificationListener =
        null;
};


/* ============================================================
   RENDER NOTIFICATION COUNT
============================================================ */

ADMIN.renderNotificationCount =
    function (
        count
    ) {

        const safeCount =
            Math.max(
                0,
                Number(
                    count
                ) || 0
            );


        document
            .querySelectorAll(
                "[data-admin-notification-count]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        safeCount > 99
                            ? "99+"
                            : String(
                                safeCount
                            );


                    element.hidden =
                        safeCount === 0;
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
                        safeCount > 99
                            ? "99+"
                            : String(
                                safeCount
                            );


                    element.classList.toggle(
                        "hidden",
                        safeCount === 0
                    );
                }
            );
    };


/* ============================================================
   MARK ADMIN NOTIFICATIONS READ
============================================================ */

ADMIN.markNotificationsRead =
    async function () {

        if (!realtimeDb) {

            return false;
        }


        try {

            const {
                ref,
                get,
                update
            } = await import(
                "../firebase/firebase-config.js"
            );


            const reference =
                ref(
                    realtimeDb,
                    "adminNotifications"
                );


            const snapshot =
                await get(
                    reference
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
                        data.read !== true
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

                await update(
                    reference,
                    updates
                );
            }


            ADMIN.state.notificationCount =
                0;


            ADMIN.renderNotificationCount(
                0
            );


            return true;

        } catch (error) {

            console.warn(
                "RiderX admin notification update failed:",
                error
            );


            return false;
        }
    };


/* ============================================================
   GLOBAL REFRESH
============================================================ */

ADMIN.refresh =
    async function () {

        const jobs =
            [];


        if (
            RX.adminRiders &&
            typeof RX.adminRiders.load ===
            "function"
        ) {

            jobs.push(
                Promise.resolve(
                    RX.adminRiders.load()
                )
            );
        }


        if (
            RX.adminSupports &&
            typeof RX.adminSupports.load ===
            "function"
        ) {

            jobs.push(
                Promise.resolve(
                    RX.adminSupports.load()
                )
            );
        }


        if (
            RX.adminCustomers &&
            typeof RX.adminCustomers.load ===
            "function"
        ) {

            jobs.push(
                Promise.resolve(
                    RX.adminCustomers.load()
                )
            );
        }


        /*
         * Do not call RX.admin.loadDashboard()
         * here because RX.admin is this controller
         * itself and that would create a recursive
         * refresh loop.
         */

        if (
            typeof ADMIN.loadDashboard ===
            "function"
        ) {

            jobs.push(
                Promise.resolve(
                    ADMIN.loadDashboard()
                )
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


/* ============================================================
   DASHBOARD COUNTERS
   ------------------------------------------------------------
   Uses Firestore as the canonical source.

   Collections:
       users
       riders
       rides
============================================================ */

ADMIN.loadDashboard =
    async function () {

        if (!db) {

            return null;
        }


        try {

            const {
                collection,
                getDocs,
                query,
                where
            } = await import(
                "../firebase/firebase-config.js"
            );


            const usersReference =
                collection(
                    db,
                    "users"
                );


            const ridersReference =
                collection(
                    db,
                    "riders"
                );


            const ridesReference =
                collection(
                    db,
                    "rides"
                );


            const [
                usersSnapshot,
                ridersSnapshot,
                ridesSnapshot
            ] =
                await Promise.all([
                    getDocs(
                        usersReference
                    ),

                    getDocs(
                        ridersReference
                    ),

                    getDocs(
                        ridesReference
                    )
                ]);


            let customers =
                0;


            let riders =
                0;


            let onlineRiders =
                0;


            usersSnapshot.forEach(
                function (
                    document
                ) {

                    const user =
                        document.data() ||
                        {};


                    const role =
                        String(
                            user.role ||
                            user.userRole ||
                            user.accountType ||
                            ""
                        )
                            .toLowerCase();


                    if (
                        role === "customer" ||
                        role === "user"
                    ) {

                        customers++;
                    }
                }
            );


            riders =
                ridersSnapshot.size;


            ridersSnapshot.forEach(
                function (
                    document
                ) {

                    const rider =
                        document.data() ||
                        {};


                    if (
                        rider.online === true ||
                        rider.isOnline === true
                    ) {

                        onlineRiders++;
                    }
                }
            );


            let totalRides =
                ridesSnapshot.size;


            let activeRides =
                0;


            let completedRides =
                0;


            ridesSnapshot.forEach(
                function (
                    document
                ) {

                    const ride =
                        document.data() ||
                        {};


                    const status =
                        String(
                            ride.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    if (
                        [
                            "requested",
                            "searching",
                            "pending",
                            "accepted",
                            "arriving",
                            "started",
                            "ongoing",
                            "in_progress",
                            "in-progress"
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

                customers,

                riders,

                onlineRiders,

                totalRides,

                activeRides,

                completedRides
            };


            Object.entries(
                counters
            )
                .forEach(
                    function (
                        [
                            key,
                            value
                        ]
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
                                        String(
                                            value
                                        );
                                }
                            );
                    }
                );


            return counters;

        } catch (error) {

            console.warn(
                "RiderX admin dashboard load failed:",
                error
            );


            return null;
        }
    };


/* ============================================================
   LOGOUT
============================================================ */

ADMIN.logout =
    async function () {

        try {

            await ADMIN.stopNotifications();


            if (auth) {

                const {
                    signOut
                } = await import(
                    "../firebase/firebase-config.js"
                );


                await signOut(
                    auth
                );
            }

        } catch (error) {

            console.warn(
                "RiderX admin logout error:",
                error
            );

        } finally {

            ADMIN.state.authenticated =
                false;


            ADMIN.state.admin =
                null;


            ADMIN.state.adminProfile =
                null;


            try {

                localStorage.removeItem(
                    "riderx_admin_session"
                );

                localStorage.removeItem(
                    "riderx_role"
                );

            } catch (error) {
                /* Ignore local-storage errors. */
            }


            window.location.replace(
                "login.html"
            );
        }
    };


/* ============================================================
   LOGOUT EVENTS
============================================================ */

ADMIN.setupLogout =
    function () {

        if (
            ADMIN.state.logoutReady
        ) {

            return;
        }


        ADMIN.state.logoutReady =
            true;


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


/* ============================================================
   AUTH STATE LISTENER
============================================================ */

ADMIN.watchAuth =
    async function () {

        if (
            ADMIN.state.authListener
        ) {

            return;
        }


        if (!auth) {

            return;
        }


        try {

            const {
                onAuthStateChanged
            } = await import(
                "../firebase/firebase-config.js"
            );


            ADMIN.state.authListener =
                onAuthStateChanged(
                    auth,
                    async function (
                        user
                    ) {

                        if (
                            ADMIN.isLoginPage()
                        ) {

                            return;
                        }


                        if (!user) {

                            ADMIN.state.authenticated =
                                false;


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
                "RiderX admin auth listener failed:",
                error
            );
        }
    };


/* ============================================================
   PAGE-SPECIFIC MODULES
============================================================ */

ADMIN.initModules =
    function () {

        if (
            RX.adminRiders &&
            typeof RX.adminRiders.init ===
            "function"
        ) {

            try {

                RX.adminRiders.init();

            } catch (error) {

                console.warn(
                    "RiderX admin riders module error:",
                    error
                );
            }
        }


        if (
            RX.adminSupports &&
            typeof RX.adminSupports.init ===
            "function"
        ) {

            try {

                RX.adminSupports.init();

            } catch (error) {

                console.warn(
                    "RiderX admin supports module error:",
                    error
                );
            }
        }


        if (
            RX.adminCustomers &&
            typeof RX.adminCustomers.init ===
            "function"
        ) {

            try {

                RX.adminCustomers.init();

            } catch (error) {

                console.warn(
                    "RiderX admin customers module error:",
                    error
                );
            }
        }


        if (
            RX.notifications &&
            typeof RX.notifications.init ===
            "function"
        ) {

            try {

                RX.notifications.init();

            } catch (error) {

                console.warn(
                    "RiderX admin notifications module error:",
                    error
                );
            }
        }
    };


/* ============================================================
   ADMIN LOGIN SUCCESS
   ------------------------------------------------------------
   This function only stores a convenience session.

   IMPORTANT:
   The real admin authority remains Firebase Auth +
   Firestore users/{uid}.
============================================================ */

ADMIN.loginSuccess =
    function (
        user,
        role
    ) {

        user =
            user ||
            {};


        role =
            String(
                role ||
                "admin"
            )
                .trim()
                .toLowerCase();


        if (
            !(
                role === "admin" ||
                role === "superadmin" ||
                role === "super_admin"
            )
        ) {

            console.warn(
                "RiderX: loginSuccess rejected non-admin role."
            );

            return false;
        }


        try {

            localStorage.setItem(
                "riderx_role",
                role
            );


            localStorage.setItem(
                "riderx_user",
                JSON.stringify(
                    {
                        uid:
                            user.uid ||
                            "",

                        email:
                            user.email ||
                            "",

                        displayName:
                            user.displayName ||
                            "",

                        photoURL:
                            user.photoURL ||
                            "",

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

        } catch (error) {

            console.warn(
                "RiderX admin local session storage failed:",
                error
            );
        }


        window.location.replace(
            "dashboard.html"
        );


        return true;
    };


/* ============================================================
   GLOBAL EVENTS
============================================================ */

ADMIN.setupGlobalEvents =
    function () {

        if (
            ADMIN.state.globalEventsReady
        ) {

            return;
        }


        ADMIN.state.globalEventsReady =
            true;


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


/* ============================================================
   INITIALIZATION
============================================================ */

ADMIN.init =
    async function () {

        if (
            ADMIN.state.initialized ||
            ADMIN.state.initializing
        ) {

            return;
        }


        ADMIN.state.initializing =
            true;


        ADMIN.state.page =
            ADMIN.getPage();


        try {

            /*
             * Login page:
             * Firebase is not required for admin controller
             * initialization itself.
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
             * Load Firebase.
             */

            const services =
                await ensureFirebase();


            if (!services) {

                ADMIN.showFirebaseError();

                return;
            }


            /*
             * Protect every admin page.
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

            await ADMIN.watchAuth();

            ADMIN.renderProfile();

            await ADMIN.startNotifications();

            ADMIN.initModules();


            /*
             * Dashboard page.
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


            console.info(
                "RiderX admin controller initialized."
            );

        } catch (error) {

            console.error(
                "RiderX admin initialization failed:",
                error
            );

        } finally {

            ADMIN.state.initializing =
                false;
        }
    };


/* ============================================================
   PUBLIC API
============================================================ */

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

        return ADMIN.isAdmin(
            ADMIN.state.admin,
            ADMIN.state.adminProfile
        );
    };


/* ============================================================
   AUTO START
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            ADMIN.init();

        },
        {
            once: true
        }
    );

} else {

    ADMIN.init();
           }
