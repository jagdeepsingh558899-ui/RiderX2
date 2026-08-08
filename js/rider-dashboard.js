/* ============================================================
   RIDERX - RIDER DASHBOARD
   File: js/rider-dashboard.js

   Rider dashboard controller.

   Handles:
   - Online / Offline
   - Today's earnings
   - Today's rides
   - Rating
   - Completed rides
   - Active ride
   - Incoming requests count
   - Rider profile data
   - Firebase synchronization
   - Dashboard UI
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Dashboard = RX.riderDashboard =
        RX.riderDashboard || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Dashboard.config = {

        ridersPath:
            "riders",

        ridesPath:
            "rides",

        earningsPath:
            "riderEarnings",

        requestsPath:
            "rideRequests",

        activeRideKey:
            "riderx_active_ride",

        onlineKey:
            "riderx_online",

        statsKey:
            "riderx_rider_stats"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Dashboard.state = {

        initialized:
            false,

        riderId:
            null,

        online:
            false,

        loading:
            false,

        stats:
            {

                todayEarnings:
                    0,

                todayRides:
                    0,

                totalEarnings:
                    0,

                totalRides:
                    0,

                rating:
                    5,

                completedRides:
                    0
            },

        rider:
            null,

        activeRide:
            null,

        requests:
            0,

        listeners:
            []
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Dashboard.getDatabase =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.database
                ) {

                    return RX.firebase.database;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       USER
       ======================================================== */

    Dashboard.getUser =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth.currentUser;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth().currentUser;
                }

            } catch (error) {}


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );

                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       RIDER ID
       ======================================================== */

    Dashboard.getRiderId =
        function () {

            if (
                Dashboard.state.riderId
            ) {

                return Dashboard.state.riderId;
            }


            const user =
                Dashboard.getUser() ||
                {};


            const riderId =
                user.uid ||
                user.id ||
                user.riderId ||
                user.driverId ||
                localStorage.getItem(
                    "riderx_uid"
                );


            if (
                riderId
            ) {

                Dashboard.state.riderId =
                    riderId;
            }


            return riderId || null;
        };


    /* ========================================================
       LOAD RIDER
       ======================================================== */

    Dashboard.loadRider =
        async function () {

            const riderId =
                Dashboard.getRiderId();


            if (
                !riderId
            ) {

                return null;
            }


            const database =
                Dashboard.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Dashboard.config
                                    .ridersPath +
                                "/" +
                                riderId
                            )
                            .once(
                                "value"
                            );


                    const rider =
                        snapshot.val();


                    if (
                        rider
                    ) {

                        Dashboard.state.rider =
                            rider;


                        Dashboard.updateProfileUI(
                            rider
                        );


                        return rider;
                    }

                } catch (error) {

                    console.warn(
                        "Rider profile load failed:",
                        error
                    );
                }
            }


            /*
             * Local fallback.
             */

            const user =
                Dashboard.getUser();


            if (
                user
            ) {

                Dashboard.state.rider =
                    user;


                Dashboard.updateProfileUI(
                    user
                );


                return user;
            }


            return null;
        };


    /* ========================================================
       UPDATE RIDER ONLINE
       ======================================================== */

    Dashboard.setOnline =
        async function (
            online
        ) {

            online =
                Boolean(
                    online
                );


            const riderId =
                Dashboard.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rider login required."
                };
            }


            Dashboard.state.online =
                online;


            try {

                localStorage.setItem(
                    Dashboard.config
                        .onlineKey,
                    String(
                        online
                    )
                );

            } catch (error) {}


            const database =
                Dashboard.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Dashboard.config
                                .ridersPath +
                            "/" +
                            riderId
                        )
                        .update(
                            {

                                online:
                                    online,

                                isOnline:
                                    online,

                                availability:
                                    online
                                        ? "online"
                                        : "offline",

                                updatedAt:
                                    Date.now()
                            }
                        );

                } catch (error) {

                    console.error(
                        "Online status update failed:",
                        error
                    );


                    return {

                        success:
                            false,

                        error:
                            error.message
                    };
                }
            }


            /*
             * Start/stop incoming requests.
             */

            try {

                if (
                    RX.rideAccept
                ) {

                    if (
                        online &&
                        typeof RX.rideAccept
                            .startListening ===
                        "function"
                    ) {

                        RX.rideAccept
                            .startListening();

                    } else if (
                        !online &&
                        typeof RX.rideAccept
                            .stopListening ===
                        "function"
                    ) {

                        RX.rideAccept
                            .stopListening();
                    }

                }

            } catch (error) {}


            Dashboard.updateOnlineUI(
                online
            );


            Dashboard.emit(
                "online",
                {

                    online:
                        online
                }
            );


            return {

                success:
                    true,

                online:
                    online
            };
        };


    /* ========================================================
       TOGGLE ONLINE
       ======================================================== */

    Dashboard.toggleOnline =
        async function () {

            return Dashboard.setOnline(
                !Dashboard.state.online
            );
        };


    /* ========================================================
       LOAD STATS
       ======================================================== */

    Dashboard.loadStats =
        async function () {

            const riderId =
                Dashboard.getRiderId();


            if (
                !riderId
            ) {

                return Dashboard.state.stats;
            }


            const database =
                Dashboard.getDatabase();


            if (
                database
            ) {

                try {

                    await Dashboard
                        .loadStatsFromFirebase(
                            database,
                            riderId
                        );

                } catch (error) {

                    console.warn(
                        "Stats load failed:",
                        error
                    );
                }
            }


            Dashboard.loadLocalStats();


            Dashboard.updateStatsUI();


            return Dashboard.state.stats;
        };


    /* ========================================================
       FIREBASE STATS
       ======================================================== */

    Dashboard.loadStatsFromFirebase =
        async function (
            database,
            riderId
        ) {

            const today =
                Dashboard.getDayKey(
                    Date.now()
                );


            const earningsRef =
                database.ref(
                    Dashboard.config
                        .earningsPath +
                    "/" +
                    riderId
                );


            const snapshot =
                await earningsRef.once(
                    "value"
                );


            const data =
                snapshot.val() ||
                {};


            let todayEarnings =
                0;

            let todayRides =
                0;

            let totalEarnings =
                0;

            let totalRides =
                0;


            Object.values(
                data
            )
            .forEach(
                function (
                    item
                ) {

                    if (
                        !item
                    ) {

                        return;
                    }


                    const earning =
                        Number(
                            item.earning ??
                            item.amount ??
                            0
                        ) || 0;


                    totalEarnings +=
                        earning;


                    totalRides++;


                    const itemDate =
                        item.completedAt ||
                        item.createdAt ||
                        item.date;


                    if (
                        itemDate &&
                        Dashboard.getDayKey(
                            itemDate
                        ) ===
                        today
                    ) {

                        todayEarnings +=
                            earning;

                        todayRides++;
                    }

                }
            );


            Dashboard.state.stats
                .todayEarnings =
                Number(
                    todayEarnings.toFixed(
                        2
                    )
                );


            Dashboard.state.stats
                .todayRides =
                todayRides;


            Dashboard.state.stats
                .totalEarnings =
                Number(
                    totalEarnings.toFixed(
                        2
                    )
                );


            Dashboard.state.stats
                .totalRides =
                totalRides;


            return Dashboard.state.stats;
        };


    /* ========================================================
       LOCAL STATS
       ======================================================== */

    Dashboard.loadLocalStats =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Dashboard.config
                            .statsKey
                    );


                if (
                    saved
                ) {

                    const stats =
                        JSON.parse(
                            saved
                        );


                    Dashboard.state.stats =
                        {

                            ...Dashboard.state.stats,
                            ...stats
                        };
                }

            } catch (error) {}


            return Dashboard.state.stats;
        };


    Dashboard.saveLocalStats =
        function () {

            try {

                localStorage.setItem(
                    Dashboard.config
                        .statsKey,
                    JSON.stringify(
                        Dashboard.state.stats
                    )
                );

            } catch (error) {}
        };


    /* ========================================================
       RATING
       ======================================================== */

    Dashboard.loadRating =
        async function () {

            const riderId =
                Dashboard.getRiderId();


            if (
                !riderId
            ) {

                return 5;
            }


            const database =
                Dashboard.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Dashboard.config
                                    .ridersPath +
                                "/" +
                                riderId
                            )
                            .once(
                                "value"
                            );


                    const rider =
                        snapshot.val() ||
                        {};


                    const rating =
                        Number(
                            rider.rating ??
                            rider.averageRating ??
                            5
                        );


                    Dashboard.state.stats
                        .rating =
                        Number(
                            rating.toFixed(
                                2
                            )
                        );


                } catch (error) {}
            }


            Dashboard.updateStatsUI();


            return Dashboard.state.stats
                .rating;
        };


    /* ========================================================
       ACTIVE RIDE
       ======================================================== */

    Dashboard.loadActiveRide =
        async function () {

            const rideId =
                localStorage.getItem(
                    Dashboard.config
                        .activeRideKey
                );


            if (
                !rideId
            ) {

                try {

                    const saved =
                        localStorage.getItem(
                            Dashboard.config
                                .activeRideKey
                        );


                    if (
                        saved &&
                        saved.startsWith(
                            "{"
                        )
                    ) {

                        Dashboard.state.activeRide =
                            JSON.parse(
                                saved
                            );

                        return Dashboard.state
                            .activeRide;
                    }

                } catch (error) {}


                Dashboard.state.activeRide =
                    null;


                Dashboard.updateActiveRideUI();


                return null;
            }


            const database =
                Dashboard.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Dashboard.config
                                    .ridesPath +
                                "/" +
                                rideId
                            )
                            .once(
                                "value"
                            );


                    const ride =
                        snapshot.val();


                    if (
                        ride
                    ) {

                        Dashboard.state
                            .activeRide =
                            {

                                ...ride,

                                rideId:
                                    ride.rideId ||
                                    rideId
                            };


                        Dashboard.updateActiveRideUI();


                        return Dashboard.state
                            .activeRide;
                    }

                } catch (error) {}
            }


            return null;
        };


    /* ========================================================
       REQUEST COUNT
       ======================================================== */

    Dashboard.loadRequestCount =
        async function () {

            const database =
                Dashboard.getDatabase();


            const riderId =
                Dashboard.getRiderId();


            if (
                !database ||
                !riderId
            ) {

                Dashboard.state.requests =
                    0;

                Dashboard.updateRequestUI();

                return 0;
            }


            /*
             * Actual rideAccept state is preferred.
             */

            try {

                if (
                    RX.rideAccept &&
                    RX.rideAccept.state &&
                    RX.rideAccept.state.requests
                ) {

                    Dashboard.state.requests =
                        Object.keys(
                            RX.rideAccept.state
                                .requests
                        ).length;


                    Dashboard.updateRequestUI();


                    return Dashboard.state.requests;
                }

            } catch (error) {}


            return 0;
        };


    /* ========================================================
       DAY KEY
       ======================================================== */

    Dashboard.getDayKey =
        function (
            timestamp
        ) {

            const date =
                new Date(
                    Number(
                        timestamp
                    )
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "";
            }


            return [
                date.getFullYear(),
                String(
                    date.getMonth() + 1
                ).padStart(
                    2,
                    "0"
                ),
                String(
                    date.getDate()
                ).padStart(
                    2,
                    "0"
                )
            ].join(
                "-"
            );
        };


    /* ========================================================
       PROFILE UI
       ======================================================== */

    Dashboard.updateProfileUI =
        function (
            rider
        ) {

            if (
                !rider
            ) {

                return;
            }


            const name =
                rider.name ||
                rider.displayName ||
                "Rider";


            const rating =
                Number(
                    rider.rating ??
                    rider.averageRating ??
                    5
                );


            document
                .querySelectorAll(
                    "[data-rider-name]"
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
                    "[data-rider-rating]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rating.toFixed(
                                1
                            );

                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-photo]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            rider.photo ||
                            rider.photoURL
                        ) {

                            element.src =
                                rider.photo ||
                                rider.photoURL;

                        }

                    }
                );
        };


    /* ========================================================
       STATS UI
       ======================================================== */

    Dashboard.updateStatsUI =
        function () {

            const stats =
                Dashboard.state.stats;


            Dashboard.setText(
                "today-earnings",
                Dashboard.formatMoney(
                    stats.todayEarnings
                )
            );


            Dashboard.setText(
                "today-rides",
                stats.todayRides
            );


            Dashboard.setText(
                "total-earnings",
                Dashboard.formatMoney(
                    stats.totalEarnings
                )
            );


            Dashboard.setText(
                "total-rides",
                stats.totalRides
            );


            Dashboard.setText(
                "completed-rides",
                stats.completedRides ||
                stats.totalRides
            );


            Dashboard.setText(
                "rider-rating",
                Number(
                    stats.rating ||
                    5
                ).toFixed(
                    1
                )
            );


            /*
             * Also support data attributes.
             */

            document
                .querySelectorAll(
                    "[data-rider-today-earnings]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Dashboard.formatMoney(
                                stats.todayEarnings
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-today-rides]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            stats.todayRides;
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-total-earnings]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Dashboard.formatMoney(
                                stats.totalEarnings
                            );
                    }
                );
        };


    /* ========================================================
       ONLINE UI
       ======================================================== */

    Dashboard.updateOnlineUI =
        function (
            online
        ) {

            online =
                Boolean(
                    online
                );


            document
                .querySelectorAll(
                    "[data-rider-online]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            online
                                ? "Online"
                                : "Offline";

                        element.dataset.online =
                            String(
                                online
                            );

                    }
                );


            document
                .querySelectorAll(
                    "[data-online-indicator]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.classList.toggle(
                            "online",
                            online
                        );

                        element.classList.toggle(
                            "offline",
                            !online
                        );

                    }
                );


            document
                .querySelectorAll(
                    "[data-online-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.tagName ===
                            "INPUT"
                        ) {

                            element.checked =
                                online;

                        } else {

                            element.textContent =
                                online
                                    ? "Go Offline"
                                    : "Go Online";

                        }

                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-status]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            online
                                ? "You're online"
                                : "You're offline";

                    }
                );
        };


    /* ========================================================
       ACTIVE RIDE UI
       ======================================================== */

    Dashboard.updateActiveRideUI =
        function () {

            const ride =
                Dashboard.state.activeRide;


            document
                .querySelectorAll(
                    "[data-active-ride]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.hidden =
                            !ride;

                    }
                );


            if (
                !ride
            ) {

                return;
            }


            Dashboard.setText(
                "active-ride-status",
                ride.status ||
                "Active"
            );


            Dashboard.setText(
                "active-ride-pickup",
                ride.pickupAddress ||
                ride.pickup?.address ||
                "Pickup"
            );


            Dashboard.setText(
                "active-ride-destination",
                ride.destinationAddress ||
                ride.destination?.address ||
                "Destination"
            );


            Dashboard.setText(
                "active-ride-fare",
                Dashboard.formatMoney(
                    ride.finalFare ??
                    ride.estimatedFare ??
                    ride.fare ??
                    0
                )
            );
        };


    /* ========================================================
       REQUEST UI
       ======================================================== */

    Dashboard.updateRequestUI =
        function () {

            const count =
                Dashboard.state.requests;


            document
                .querySelectorAll(
                    "[data-ride-request-count]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count;

                        element.hidden =
                            count <= 0;

                    }
                );
        };


    /* ========================================================
       HELPERS
       ======================================================== */

    Dashboard.setText =
        function (
            id,
            value
        ) {

            const selectors = [

                `#${id}`,

                `[data-dashboard="${id}"]`,

                `[data-${id}]`

            ];


            selectors.forEach(
                function (
                    selector
                ) {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.textContent =
                                    value;

                            }
                        );
                }
            );
        };


    Dashboard.formatMoney =
        function (
            value
        ) {

            value =
                Number(
                    value
                ) || 0;


            return "₹" +
                value.toLocaleString(
                    "en-IN",
                    {

                        minimumFractionDigits:
                            0,

                        maximumFractionDigits:
                            2
                    }
                );
        };


    /* ========================================================
       EVENT HANDLERS
       ======================================================== */

    Dashboard.bindEvents =
        function () {

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const toggle =
                        event.target.closest(
                            "[data-online-toggle]"
                        );


                    if (
                        toggle
                    ) {

                        Dashboard
                            .toggleOnline();

                        return;
                    }


                    const refresh =
                        event.target.closest(
                            "[data-refresh-dashboard]"
                        );


                    if (
                        refresh
                    ) {

                        Dashboard.refresh();

                        return;
                    }

                }
            );


            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const toggle =
                        event.target.closest(
                            "[data-online-toggle]"
                        );


                    if (
                        !toggle ||
                        toggle.tagName !==
                        "INPUT"
                    ) {

                        return;
                    }


                    Dashboard.setOnline(
                        toggle.checked
                    );
                }
            );


            /*
             * Incoming request changes.
             */

            window.addEventListener(
                "riderx-ride-accept-request",
                function () {

                    Dashboard
                        .loadRequestCount();

                }
            );


            window.addEventListener(
                "riderx-ride-accept-accepted",
                function () {

                    Dashboard.state.requests =
                        0;

                    Dashboard.updateRequestUI();

                    Dashboard.loadActiveRide();

                }
            );


            window.addEventListener(
                "riderx-ride-flow-status",
                function (
                    event
                ) {

                    const ride =
                        event.detail?.ride;


                    if (
                        ride
                    ) {

                        Dashboard.state.activeRide =
                            ride;

                        Dashboard.updateActiveRideUI();

                    }

                }
            );


            window.addEventListener(
                "riderx-ride-complete-completed",
                function () {

                    Dashboard.state.activeRide =
                        null;

                    Dashboard.refresh();

                }
            );
        };


    /* ========================================================
       REFRESH
       ======================================================== */

    Dashboard.refresh =
        async function () {

            if (
                Dashboard.state.loading
            ) {

                return;
            }


            Dashboard.state.loading =
                true;


            try {

                await Promise.all(
                    [

                        Dashboard.loadRider(),

                        Dashboard.loadStats(),

                        Dashboard.loadRating(),

                        Dashboard.loadActiveRide(),

                        Dashboard.loadRequestCount()

                    ]
                );


                Dashboard.updateOnlineUI(
                    Dashboard.state.online
                );


            } finally {

                Dashboard.state.loading =
                    false;
            }


            Dashboard.emit(
                "refreshed",
                {

                    stats:
                        Dashboard.state.stats,

                    rider:
                        Dashboard.state.rider,

                    activeRide:
                        Dashboard.state.activeRide
                }
            );
        };


    /* ========================================================
       FIREBASE ONLINE RECOVERY
       ======================================================== */

    Dashboard.restoreOnline =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Dashboard.config
                            .onlineKey
                    );


                Dashboard.state.online =
                    saved === "true";

            } catch (error) {

                Dashboard.state.online =
                    false;
            }


            Dashboard.updateOnlineUI(
                Dashboard.state.online
            );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Dashboard.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-dashboard-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    Dashboard.on =
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


            const event =
                "riderx-dashboard-" +
                name;


            const handler =
                function (
                    e
                ) {

                    callback(
                        e.detail || {},
                        e
                    );
                };


            window.addEventListener(
                event,
                handler
            );


            return function () {

                window.removeEventListener(
                    event,
                    handler
                );
            };
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.riderSetOnline =
        Dashboard.setOnline;

    RX.riderToggleOnline =
        Dashboard.toggleOnline;

    RX.riderRefreshDashboard =
        Dashboard.refresh;

    RX.getRiderDashboardStats =
        function () {

            return Dashboard.state.stats;
        };


    /* ========================================================
       INIT
       ======================================================== */

    Dashboard.init =
        async function () {

            if (
                Dashboard.state.initialized
            ) {

                return;
            }


            Dashboard.state.initialized =
                true;


            Dashboard.restoreOnline();


            Dashboard.bindEvents();


            await Dashboard.refresh();


            console.log(
                "RiderX rider-dashboard.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Dashboard.init
        );

    } else {

        Dashboard.init();

    }

})();
