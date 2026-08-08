/* ============================================================
   RIDERX HOME CONTROLLER
   File: js/home.js

   Handles:
   - Customer home
   - Rider home
   - Current location
   - Online/offline state
   - Recent rides
   - Quick actions
   - Notifications
   - Dashboard stats
   - Service selection
   - Navigation events
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Home = RX.home = RX.home || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Home.config = {

        defaultRole: "customer",

        defaultService: "bike",

        locationRefresh: 15000,

        rideLimit: 5,

        notificationLimit: 5,

        storageKey: "riderx_home_state",

        city: "Chandigarh",

        services: [
            {
                id: "bike",
                name: "Bike Taxi",
                icon: "🏍️",
                description: "Fast & affordable"
            },
            {
                id: "cab",
                name: "Cab",
                icon: "🚕",
                description: "Comfortable rides"
            },
            {
                id: "parcel",
                name: "Parcel",
                icon: "📦",
                description: "Send anything"
            },
            {
                id: "food",
                name: "Food Delivery",
                icon: "🍔",
                description: "Quick delivery"
            }
        ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    Home.state = {

        role: "customer",

        user: null,

        location: null,

        locationWatchId: null,

        selectedService: "bike",

        isOnline: false,

        activeRide: null,

        recentRides: [],

        notifications: [],

        stats: {

            totalRides: 0,

            completedRides: 0,

            cancelledRides: 0,

            totalSpent: 0,

            totalEarned: 0,

            distance: 0
        },

        loading: false
    };


    /* ========================================================
       ROLE
       ======================================================== */

    Home.normalizeRole = function (role) {

        role = String(
            role || ""
        )
        .toLowerCase()
        .trim();


        if (
            role === "rider" ||
            role === "driver" ||
            role === "captain"
        ) {
            return "rider";
        }


        if (
            role === "admin"
        ) {
            return "admin";
        }


        return "customer";
    };


    Home.setRole = function (role) {

        Home.state.role =
            Home.normalizeRole(role);


        Home.saveState();


        Home.emit(
            "role-changed",
            {
                role:
                    Home.state.role
            }
        );


        return Home.state.role;
    };


    /* ========================================================
       USER
       ======================================================== */

    Home.getUser = function () {

        try {

            if (
                RX.auth &&
                RX.auth.currentUser
            ) {

                return RX.auth.currentUser;
            }


            if (
                window.firebase &&
                firebase.auth &&
                firebase.auth().currentUser
            ) {

                return firebase.auth().currentUser;
            }

        } catch (error) {}


        try {

            const saved =
                localStorage.getItem(
                    "riderx_user"
                );


            if (saved) {

                return JSON.parse(
                    saved
                );
            }

        } catch (error) {}


        return null;
    };


    Home.setUser = function (user) {

        Home.state.user =
            user || null;


        if (user) {

            try {

                localStorage.setItem(
                    "riderx_user",
                    JSON.stringify(user)
                );

            } catch (error) {}
        }


        Home.emit(
            "user-updated",
            {
                user:
                    user
            }
        );


        return user;
    };


    /* ========================================================
       USER NAME
       ======================================================== */

    Home.getUserName = function () {

        const user =
            Home.state.user ||
            Home.getUser();


        if (!user) {
            return "RiderX User";
        }


        return (
            user.displayName ||
            user.name ||
            user.fullName ||
            user.firstName ||
            user.email?.split("@")[0] ||
            "RiderX User"
        );
    };


    /* ========================================================
       LOCATION
       ======================================================== */

    Home.getLocation = async function () {

        try {

            if (
                RX.getCurrentLocation
            ) {

                const location =
                    await RX.getCurrentLocation({
                        enableHighAccuracy:
                            true,

                        timeout:
                            12000,

                        maximumAge:
                            5000
                    });


                Home.state.location =
                    location;


                Home.saveState();


                Home.emit(
                    "location-updated",
                    {
                        location:
                            location
                    }
                );


                return location;
            }


            if (
                navigator.geolocation
            ) {

                return new Promise(
                    function (
                        resolve,
                        reject
                    ) {

                        navigator.geolocation
                            .getCurrentPosition(
                                function (
                                    position
                                ) {

                                    const location = {

                                        lat:
                                            position
                                                .coords
                                                .latitude,

                                        lng:
                                            position
                                                .coords
                                                .longitude,

                                        accuracy:
                                            position
                                                .coords
                                                .accuracy
                                    };


                                    Home.state.location =
                                        location;


                                    Home.saveState();


                                    Home.emit(
                                        "location-updated",
                                        {
                                            location:
                                                location
                                        }
                                    );


                                    resolve(
                                        location
                                    );
                                },

                                reject,

                                {
                                    enableHighAccuracy:
                                        true,

                                    timeout:
                                        12000,

                                    maximumAge:
                                        5000
                                }
                            );
                    }
                );
            }


            throw new Error(
                "Geolocation unavailable."
            );

        } catch (error) {

            console.warn(
                "RiderX home location error:",
                error
            );


            Home.emit(
                "location-error",
                {
                    error:
                        error
                }
            );


            return null;
        }
    };


    /* ========================================================
       WATCH LOCATION
       ======================================================== */

    Home.startLocationWatch =
        function () {

            if (
                !navigator.geolocation
            ) {
                return null;
            }


            Home.stopLocationWatch();


            Home.state.locationWatchId =
                navigator.geolocation
                    .watchPosition(

                        function (
                            position
                        ) {

                            const location = {

                                lat:
                                    position
                                        .coords
                                        .latitude,

                                lng:
                                    position
                                        .coords
                                        .longitude,

                                accuracy:
                                    position
                                        .coords
                                        .accuracy,

                                heading:
                                    position
                                        .coords
                                        .heading,

                                speed:
                                    position
                                        .coords
                                        .speed
                            };


                            Home.state.location =
                                location;


                            Home.emit(
                                "location-updated",
                                {
                                    location:
                                        location,

                                    live:
                                        true
                                }
                            );
                        },

                        function (
                            error
                        ) {

                            Home.emit(
                                "location-error",
                                {
                                    error:
                                        error
                                }
                            );
                        },

                        {

                            enableHighAccuracy:
                                true,

                            maximumAge:
                                3000,

                            timeout:
                                15000
                        }
                    );


            return Home.state.locationWatchId;
        };


    Home.stopLocationWatch =
        function () {

            if (
                Home.state.locationWatchId !==
                null
            ) {

                try {

                    navigator.geolocation
                        .clearWatch(
                            Home.state
                                .locationWatchId
                        );

                } catch (error) {}
            }


            Home.state.locationWatchId =
                null;
        };


    /* ========================================================
       SERVICE
       ======================================================== */

    Home.getServices = function () {

        return [
            ...Home.config.services
        ];
    };


    Home.getService = function (
        serviceId
    ) {

        return Home.config.services.find(
            function (service) {

                return (
                    service.id ===
                    serviceId
                );
            }
        ) || null;
    };


    Home.selectService = function (
        serviceId
    ) {

        const service =
            Home.getService(
                serviceId
            );


        if (!service) {
            return null;
        }


        Home.state.selectedService =
            service.id;


        Home.saveState();


        Home.emit(
            "service-selected",
            {
                service:
                    service,

                serviceId:
                    service.id
            }
        );


        return service;
    };


    /* ========================================================
       BOOK RIDE
       ======================================================== */

    Home.bookRide = function (
        options
    ) {

        options =
            options || {};


        const service =
            options.service ||
            Home.state.selectedService ||
            "bike";


        Home.selectService(
            service
        );


        Home.emit(
            "book-ride",
            {
                service:
                    service,

                options:
                    options
            }
        );


        /*
         * Existing booking.js can listen
         * to this event.
         */

        if (
            RX.booking &&
            typeof RX.booking.start ===
            "function"
        ) {

            try {

                return RX.booking.start({
                    service:
                        service,

                    ...options
                });

            } catch (error) {

                console.warn(
                    "Booking start failed:",
                    error
                );
            }
        }


        return {
            service:
                service,

            started:
                true
        };
    };


    /* ========================================================
       ACTIVE RIDE
       ======================================================== */

    Home.setActiveRide = function (
        ride
    ) {

        Home.state.activeRide =
            ride || null;


        Home.saveState();


        Home.emit(
            "active-ride",
            {
                ride:
                    ride
            }
        );


        return ride;
    };


    Home.getActiveRide = function () {

        return Home.state.activeRide;
    };


    Home.hasActiveRide = function () {

        return !!Home.state.activeRide;
    };


    /* ========================================================
       RIDE HISTORY
       ======================================================== */

    Home.loadRecentRides =
        async function () {

            try {

                if (
                    RX.history &&
                    typeof RX.history.load ===
                    "function"
                ) {

                    await RX.history.load({
                        role:
                            Home.state.role
                    });


                    const rides =
                        RX.history.state?.filtered ||
                        RX.history.state?.rides ||
                        [];


                    Home.state.recentRides =
                        rides.slice(
                            0,
                            Home.config.rideLimit
                        );


                    Home.emit(
                        "recent-rides",
                        {
                            rides:
                                Home.state
                                    .recentRides
                        }
                    );


                    return Home.state.recentRides;
                }

            } catch (error) {

                console.warn(
                    "Recent rides error:",
                    error
                );
            }


            return Home.state.recentRides;
        };


    /* ========================================================
       NOTIFICATIONS
       ======================================================== */

    Home.loadNotifications =
        async function () {

            try {

                if (
                    RX.notification
                ) {

                    if (
                        typeof RX.notification
                            .getRecent ===
                        "function"
                    ) {

                        const notifications =
                            await RX
                                .notification
                                .getRecent(
                                    Home.config
                                        .notificationLimit
                                );


                        Home.state.notifications =
                            Array.isArray(
                                notifications
                            )
                                ? notifications
                                : [];


                        Home.emit(
                            "notifications",
                            {
                                notifications:
                                    Home.state
                                        .notifications
                            }
                        );


                        return Home.state
                            .notifications;
                    }


                    if (
                        Array.isArray(
                            RX.notification
                        )
                    ) {

                        Home.state.notifications =
                            RX.notification.slice(
                                0,
                                Home.config
                                    .notificationLimit
                            );
                    }
                }

            } catch (error) {

                console.warn(
                    "Notification load error:",
                    error
                );
            }


            return Home.state.notifications;
        };


    /* ========================================================
       UNREAD NOTIFICATIONS
       ======================================================== */

    Home.getUnreadCount =
        function () {

            const list =
                Home.state.notifications ||
                [];


            return list.filter(
                function (
                    item
                ) {

                    return (
                        item.read === false ||
                        item.isRead === false ||
                        item.seen === false
                    );
                }
            ).length;
        };


    /* ========================================================
       STATS
       ======================================================== */

    Home.calculateStats =
        function (
            rides
        ) {

            rides =
                Array.isArray(
                    rides
                )
                    ? rides
                    : Home.state.recentRides;


            const stats = {

                totalRides:
                    rides.length,

                completedRides:
                    0,

                cancelledRides:
                    0,

                totalSpent:
                    0,

                totalEarned:
                    0,

                distance:
                    0
            };


            rides.forEach(
                function (
                    ride
                ) {

                    const status =
                        String(
                            ride.status ||
                            ""
                        )
                        .toLowerCase();


                    const fare =
                        Number(
                            ride.fare ||
                            ride.totalFare ||
                            ride.amount ||
                            0
                        );


                    const distance =
                        Number(
                            ride.distance ||
                            ride.distanceKm ||
                            0
                        );


                    if (
                        status ===
                        "completed" ||
                        status ===
                        "complete"
                    ) {

                        stats.completedRides++;


                        if (
                            Home.state.role ===
                            "rider"
                        ) {

                            stats.totalEarned +=
                                Number.isFinite(
                                    fare
                                )
                                    ? fare
                                    : 0;

                        } else {

                            stats.totalSpent +=
                                Number.isFinite(
                                    fare
                                )
                                    ? fare
                                    : 0;
                        }


                        stats.distance +=
                            Number.isFinite(
                                distance
                            )
                                ? distance
                                : 0;

                    } else if (
                        status ===
                        "cancelled" ||
                        status ===
                        "canceled"
                    ) {

                        stats.cancelledRides++;
                    }
                }
            );


            Home.state.stats =
                stats;


            Home.emit(
                "stats-updated",
                {
                    stats:
                        stats
                }
            );


            return stats;
        };


    /* ========================================================
       RIDER ONLINE STATE
       ======================================================== */

    Home.setOnline =
        async function (
            online
        ) {

            online =
                Boolean(
                    online
                );


            Home.state.isOnline =
                online;


            Home.saveState();


            /*
             * Existing rider controller.
             */

            try {

                if (
                    RX.rider &&
                    typeof RX.rider.setOnline ===
                    "function"
                ) {

                    await RX.rider.setOnline(
                        online
                    );
                }

            } catch (error) {

                console.warn(
                    "Rider online update failed:",
                    error
                );
            }


            Home.emit(
                "online-changed",
                {
                    online:
                        online
                }
            );


            return online;
        };


    Home.toggleOnline =
        function () {

            return Home.setOnline(
                !Home.state.isOnline
            );
        };


    Home.isOnline =
        function () {

            return (
                Home.state.isOnline ===
                true
            );
        };


    /* ========================================================
       NAVIGATION
       ======================================================== */

    Home.navigate =
        function (
            target
        ) {

            if (!target) {
                return;
            }


            Home.emit(
                "navigate",
                {
                    target:
                        target
                }
            );


            /*
             * Allow existing app.js/router
             * to handle navigation.
             */

            if (
                RX.app &&
                typeof RX.app.navigate ===
                "function"
            ) {

                try {

                    RX.app.navigate(
                        target
                    );

                    return;
                } catch (error) {}
            }


            /*
             * If target is a URL/path,
             * use normal browser navigation.
             */

            if (
                typeof target ===
                "string" &&
                (
                    target.includes(
                        ".html"
                    ) ||
                    target.startsWith(
                        "/"
                    )
                )
            ) {

                window.location.href =
                    target;
            }
        };


    /* ========================================================
       QUICK ACTIONS
       ======================================================== */

    Home.quickAction =
        function (
            action
        ) {

            action =
                String(
                    action ||
                    ""
                )
                .toLowerCase()
                .trim();


            const actions = {

                book:
                    function () {
                        return Home.bookRide();
                    },

                bike:
                    function () {
                        return Home.bookRide({
                            service:
                                "bike"
                        });
                    },

                cab:
                    function () {
                        return Home.bookRide({
                            service:
                                "cab"
                        });
                    },

                parcel:
                    function () {
                        return Home.bookRide({
                            service:
                                "parcel"
                        });
                    },

                food:
                    function () {
                        return Home.bookRide({
                            service:
                                "food"
                        });
                    },

                history:
                    function () {
                        return Home.navigate(
                            "history.html"
                        );
                    },

                wallet:
                    function () {
                        return Home.navigate(
                            "wallet.html"
                        );
                    },

                profile:
                    function () {
                        return Home.navigate(
                            "profile.html"
                        );
                    },

                notifications:
                    function () {
                        return Home.navigate(
                            "notifications.html"
                        );
                    },

                settings:
                    function () {
                        return Home.navigate(
                            "settings.html"
                        );
                    },

                menu:
                    function () {
                        return Home.navigate(
                            "menu.html"
                        );
                    },

                support:
                    function () {
                        return Home.emit(
                            "support"
                        );
                    }
            };


            if (
                actions[action]
            ) {

                return actions[action]();
            }


            return null;
        };


    /* ========================================================
       HOME DATA
       ======================================================== */

    Home.getData =
        function () {

            return {

                role:
                    Home.state.role,

                user:
                    Home.state.user,

                userName:
                    Home.getUserName(),

                location:
                    Home.state.location,

                selectedService:
                    Home.state
                        .selectedService,

                activeRide:
                    Home.state.activeRide,

                isOnline:
                    Home.state.isOnline,

                recentRides:
                    Home.state.recentRides,

                notifications:
                    Home.state.notifications,

                unreadNotifications:
                    Home.getUnreadCount(),

                stats:
                    Home.state.stats
            };
        };


    /* ========================================================
       SAVE STATE
       ======================================================== */

    Home.saveState =
        function () {

            try {

                localStorage.setItem(
                    Home.config.storageKey,
                    JSON.stringify({

                        role:
                            Home.state.role,

                        selectedService:
                            Home.state
                                .selectedService,

                        isOnline:
                            Home.state.isOnline,

                        location:
                            Home.state.location
                    })
                );

            } catch (error) {}
        };


    /* ========================================================
       LOAD STATE
       ======================================================== */

    Home.loadState =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Home.config.storageKey
                    );


                if (!saved) {
                    return;
                }


                const data =
                    JSON.parse(
                        saved
                    );


                if (
                    data.role
                ) {

                    Home.state.role =
                        Home.normalizeRole(
                            data.role
                        );
                }


                if (
                    data.selectedService
                ) {

                    Home.state.selectedService =
                        data.selectedService;
                }


                if (
                    typeof data.isOnline ===
                    "boolean"
                ) {

                    Home.state.isOnline =
                        data.isOnline;
                }


                if (
                    data.location
                ) {

                    Home.state.location =
                        data.location;
                }

            } catch (error) {

                console.warn(
                    "Home state load error:",
                    error
                );
            }
        };


    /* ========================================================
       RENDER USER NAME
       ======================================================== */

    Home.renderUser =
        function (
            selector
        ) {

            const elements =
                document.querySelectorAll(
                    selector ||
                    "[data-riderx-user-name]"
                );


            const name =
                Home.getUserName();


            elements.forEach(
                function (
                    element
                ) {

                    element.textContent =
                        name;
                }
            );
        };


    /* ========================================================
       RENDER UNREAD COUNT
       ======================================================== */

    Home.renderUnread =
        function (
            selector
        ) {

            const elements =
                document.querySelectorAll(
                    selector ||
                    "[data-riderx-unread]"
                );


            const count =
                Home.getUnreadCount();


            elements.forEach(
                function (
                    element
                ) {

                    element.textContent =
                        count;


                    element.hidden =
                        count === 0;
                }
            );
        };


    /* ========================================================
       RENDER STATS
       ======================================================== */

    Home.renderStats =
        function () {

            const stats =
                Home.state.stats;


            document
                .querySelectorAll(
                    "[data-riderx-stat]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const key =
                            element.getAttribute(
                                "data-riderx-stat"
                            );


                        if (
                            Object.prototype
                                .hasOwnProperty
                                .call(
                                    stats,
                                    key
                                )
                        ) {

                            element.textContent =
                                stats[key];
                        }
                    }
                );
        };


    /* ========================================================
       RENDER SERVICES
       ======================================================== */

    Home.renderServices =
        function (
            container
        ) {

            const element =
                typeof container ===
                "string"
                    ? document.querySelector(
                        container
                    )
                    : (
                        container ||
                        document.querySelector(
                            "[data-riderx-services]"
                        )
                    );


            if (!element) {
                return;
            }


            element.innerHTML =
                Home.config.services
                    .map(
                        function (
                            service
                        ) {

                            const selected =
                                Home.state
                                    .selectedService ===
                                service.id;


                            return `
                                <button
                                    type="button"
                                    class="rx-home-service ${
                                        selected
                                            ? "active"
                                            : ""
                                    }"
                                    data-service="${
                                        Home.escape(
                                            service.id
                                        )
                                    }"
                                >

                                    <span class="rx-home-service-icon">
                                        ${service.icon}
                                    </span>

                                    <span class="rx-home-service-name">
                                        ${Home.escape(
                                            service.name
                                        )}
                                    </span>

                                    <small>
                                        ${Home.escape(
                                            service.description
                                        )}
                                    </small>

                                </button>
                            `;
                        }
                    )
                    .join("");


            element.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-service]"
                        );


                    if (!button) {
                        return;
                    }


                    const service =
                        button.getAttribute(
                            "data-service"
                        );


                    Home.selectService(
                        service
                    );


                    Home.renderServices(
                        element
                    );
                }
            );
        };


    /* ========================================================
       ESCAPE
       ======================================================== */

    Home.escape =
        function (
            value
        ) {

            return String(
                value ?? ""
            )
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
       EVENT SYSTEM
       ======================================================== */

    Home.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-home-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Home.on =
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
                "riderx-home-" + name,
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

    Home.init =
        async function (
            options
        ) {

            options =
                options || {};


            if (
                Home.state.loading
            ) {
                return Home.getData();
            }


            Home.state.loading =
                true;


            try {

                Home.loadState();


                if (
                    options.role
                ) {

                    Home.setRole(
                        options.role
                    );
                }


                Home.state.user =
                    Home.getUser();


                if (
                    options.service
                ) {

                    Home.selectService(
                        options.service
                    );
                }


                /*
                 * Get current location.
                 */

                await Home.getLocation();


                /*
                 * Start live location.
                 */

                if (
                    options.watchLocation !==
                    false
                ) {

                    Home.startLocationWatch();
                }


                /*
                 * Recent rides.
                 */

                await Home.loadRecentRides();


                /*
                 * Notifications.
                 */

                await Home.loadNotifications();


                /*
                 * Stats.
                 */

                Home.calculateStats(
                    Home.state.recentRides
                );


                Home.renderUser();

                Home.renderUnread();

                Home.renderStats();


                Home.emit(
                    "ready",
                    Home.getData()
                );


                return Home.getData();

            } catch (error) {

                console.error(
                    "RiderX home init error:",
                    error
                );


                Home.emit(
                    "error",
                    {
                        error:
                            error
                    }
                );


                return Home.getData();

            } finally {

                Home.state.loading =
                    false;
            }
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.homeInit =
        Home.init;

    RX.homeBook =
        Home.bookRide;

    RX.homeNavigate =
        Home.navigate;

    RX.homeSelectService =
        Home.selectService;

    RX.homeGetLocation =
        Home.getLocation;


    /* ========================================================
       PAGE AUTO INIT
       ======================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            const role =
                document.body?.dataset?.role ||
                document.documentElement
                    ?.dataset?.role ||
                null;


            Home.init({
                role:
                    role ||
                    Home.state.role,

                watchLocation:
                    true
            });

        }
    );


    Home.ready =
        true;


    Home.emit(
        "ready-controller",
        {
            version:
                "1.0.0"
        }
    );


    console.log(
        "RiderX home.js loaded."
    );

})();
