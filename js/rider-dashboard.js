/* ============================================================
   RIDERX - RIDER DASHBOARD
   File: js/rider-dashboard.js

   Handles:
   - Rider dashboard
   - Online / Offline status
   - Today's earnings
   - Today's rides
   - Active ride
   - Available requests
   - Rider statistics
   - Firebase synchronization
   - Dashboard UI
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Dashboard =
        RX.riderDashboard ||
        (RX.riderDashboard = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Dashboard.config = {

        ridersPath:
            "riders",

        ridesPath:
            "rides",

        riderStatusPath:
            "status",

        cacheKey:
            "riderx_rider_dashboard",

        refreshInterval:
            20000
    };


    /* ========================================================
       STATE
       ======================================================== */

    Dashboard.state = {

        initialized:
            false,

        loading:
            false,

        riderId:
            null,

        rider:
            null,

        online:
            false,

        earningsToday:
            0,

        ridesToday:
            0,

        completedToday:
            0,

        cancelledToday:
            0,

        activeRide:
            null,

        availableRides:
            0,

        totalDistanceToday:
            0,

        totalDurationToday:
            0,

        rating:
            5,

        refreshTimer:
            null,

        statusChanging:
            false,

        listener:
            null
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
       RIDER ID
       ======================================================== */

    Dashboard.getRiderId =
        function () {

            if (
                Dashboard.state.riderId
            ) {

                return Dashboard.state.riderId;
            }


            try {

                if (
                    RX.getRiderProfile
                ) {

                    const profile =
                        RX.getRiderProfile();


                    if (
                        profile &&
                        (
                            profile.uid ||
                            profile.id
                        )
                    ) {

                        Dashboard.state.riderId =
                            profile.uid ||
                            profile.id;

                        return Dashboard.state.riderId;
                    }
                }

            } catch (error) {}


            try {

                const uid =
                    localStorage.getItem(
                        "riderx_uid"
                    );


                if (
                    uid
                ) {

                    Dashboard.state.riderId =
                        uid;

                    return uid;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    const user =
                        firebase.auth()
                            .currentUser;


                    if (
                        user
                    ) {

                        Dashboard.state.riderId =
                            user.uid;

                        return user.uid;
                    }
                }

            } catch (error) {}


            return null;
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
                !database
            ) {

                return Dashboard.state.rider;
            }


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
                        {

                            ...rider,

                            id:
                                rider.id ||
                                rider.uid ||
                                riderId,

                            uid:
                                rider.uid ||
                                riderId,

                            online:
                                rider.online ===
                                true,

                            isOnline:
                                rider.isOnline ===
                                true
                        };


                    Dashboard.state.online =
                        Dashboard.state.rider.online ||
                        Dashboard.state.rider.isOnline;


                    if (
                        rider.rating !==
                        undefined
                    ) {

                        Dashboard.state.rating =
                            Number(
                                rider.rating
                            );
                    }


                    Dashboard.renderProfile();
                    Dashboard.renderStatus();
                }


                return Dashboard.state.rider;

            } catch (error) {

                console.error(
                    "Rider profile load failed:",
                    error
                );

                return null;
            }
        };


    /* ========================================================
       LOAD DASHBOARD STATS
       ======================================================== */

    Dashboard.loadStats =
        async function () {

            const database =
                Dashboard.getDatabase();


            const riderId =
                Dashboard.getRiderId();


            if (
                !database ||
                !riderId
            ) {

                Dashboard.loadCache();

                Dashboard.render();

                return Dashboard.getStats();
            }


            Dashboard.state.loading =
                true;


            try {

                const snapshot =
                    await database
                        .ref(
                            Dashboard.config
                                .ridesPath
                        )
                        .orderByChild(
                            "riderId"
                        )
                        .equalTo(
                            riderId
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                const rides =
                    Object.entries(
                        data
                    )
                    .map(
                        function (
                            [
                                id,
                                ride
                            ]
                        ) {

                            return {

                                ...ride,

                                id:
                                    ride.id ||
                                    ride.rideId ||
                                    id,

                                status:
                                    String(
                                        ride.status ||
                                        ""
                                    ).toLowerCase(),

                                fare:
                                    Number(
                                        ride.finalFare ??
                                        ride.fare ??
                                        ride.estimatedFare ??
                                        0
                                    ),

                                distance:
                                    Number(
                                        ride.distance ??
                                        ride.distanceKm ??
                                        0
                                    ),

                                duration:
                                    Number(
                                        ride.duration ??
                                        ride.durationMinutes ??
                                        0
                                    ),

                                createdAt:
                                    ride.createdAt ||
                                    0,

                                completedAt:
                                    ride.completedAt ||
                                    0
                            };

                        }
                    );


                const start =
                    Dashboard.startOfToday();


                const end =
                    Dashboard.endOfToday();


                let earnings =
                    0;

                let ridesToday =
                    0;

                let completedToday =
                    0;

                let cancelledToday =
                    0;

                let distance =
                    0;

                let duration =
                    0;

                let activeRide =
                    null;


                rides.forEach(
                    function (
                        ride
                    ) {

                        const timestamp =
                            Number(
                                ride.completedAt ||
                                ride.createdAt ||
                                0
                            );


                        if (
                            Dashboard.isActiveRide(
                                ride
                            )
                        ) {

                            if (
                                !activeRide ||
                                timestamp >
                                Number(
                                    activeRide.createdAt ||
                                    0
                                )
                            ) {

                                activeRide =
                                    ride;
                            }
                        }


                        if (
                            timestamp <
                            start ||
                            timestamp >
                            end
                        ) {

                            return;
                        }


                        ridesToday++;


                        if (
                            ride.status ===
                            "completed"
                        ) {

                            completedToday++;

                            earnings +=
                                Number(
                                    ride.fare ||
                                    0
                                );

                            distance +=
                                Number(
                                    ride.distance ||
                                    0
                                );

                            duration +=
                                Number(
                                    ride.duration ||
                                    0
                                );
                        }


                        if (
                            ride.status ===
                            "cancelled"
                        ) {

                            cancelledToday++;
                        }

                    }
                );


                Dashboard.state.earningsToday =
                    earnings;


                Dashboard.state.ridesToday =
                    ridesToday;


                Dashboard.state.completedToday =
                    completedToday;


                Dashboard.state.cancelledToday =
                    cancelledToday;


                Dashboard.state.totalDistanceToday =
                    distance;


                Dashboard.state.totalDurationToday =
                    duration;


                Dashboard.state.activeRide =
                    activeRide;


                await Dashboard.loadAvailableCount();


                Dashboard.saveCache();

                Dashboard.render();


                return Dashboard.getStats();

            } catch (error) {

                console.error(
                    "Dashboard stats failed:",
                    error
                );


                Dashboard.loadCache();

                Dashboard.render();


                return Dashboard.getStats();

            } finally {

                Dashboard.state.loading =
                    false;
            }
        };


    /* ========================================================
       AVAILABLE RIDES COUNT
       ======================================================== */

    Dashboard.loadAvailableCount =
        async function () {

            const database =
                Dashboard.getDatabase();


            if (
                !database
            ) {

                return 0;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Dashboard.config
                                .ridesPath
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                let count =
                    0;


                Object.values(
                    data
                )
                .forEach(
                    function (
                        ride
                    ) {

                        const status =
                            String(
                                ride.status ||
                                ""
                            ).toLowerCase();


                        if (
                            (
                                status ===
                                "requested" ||
                                status ===
                                "searching"
                            ) &&
                            !ride.riderId
                        ) {

                            count++;
                        }

                    }
                );


                Dashboard.state.availableRides =
                    count;


                return count;

            } catch (error) {

                return 0;
            }
        };


    /* ========================================================
       ONLINE / OFFLINE
       ======================================================== */

    Dashboard.setOnline =
        async function (
            online
        ) {

            if (
                Dashboard.state.statusChanging
            ) {

                return {

                    success:
                        false,

                    error:
                        "Please wait."
                };
            }


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


            const database =
                Dashboard.getDatabase();


            Dashboard.state.statusChanging =
                true;


            try {

                const value =
                    Boolean(
                        online
                    );


                if (
                    database
                ) {

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
                                    value,

                                isOnline:
                                    value,

                                status:
                                    value
                                        ? "online"
                                        : "offline",

                                lastStatusChange:
                                    Date.now(),

                                updatedAt:
                                    Date.now()
                            }
                        );


                    /*
                     * Keep a separate online status
                     * node for fast rider matching.
                     */

                    await database
                        .ref(
                            Dashboard.config
                                .riderStatusPath +
                            "/" +
                            riderId
                        )
                        .set(
                            {

                                online:
                                    value,

                                updatedAt:
                                    Date.now()
                            }
                        );
                }


                Dashboard.state.online =
                    value;


                if (
                    Dashboard.state.rider
                ) {

                    Dashboard.state.rider.online =
                        value;

                    Dashboard.state.rider.isOnline =
                        value;
                }


                Dashboard.renderStatus();


                Dashboard.emit(
                    value
                        ? "online"
                        : "offline",
                    {

                        riderId:
                            riderId
                    }
                );


                Dashboard.showMessage(
                    value
                        ? "You are now online."
                        : "You are now offline.",
                    "success"
                );


                return {

                    success:
                        true,

                    online:
                        value
                };

            } catch (error) {

                console.error(
                    "Rider status update failed:",
                    error
                );


                Dashboard.showMessage(
                    "Unable to change online status.",
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        error.message
                };

            } finally {

                Dashboard.state.statusChanging =
                    false;
            }
        };


    /* ========================================================
       TOGGLE ONLINE
       ======================================================== */

    Dashboard.toggleOnline =
        function () {

            return Dashboard.setOnline(
                !Dashboard.state.online
            );
        };


    /* ========================================================
       ACTIVE RIDE
       ======================================================== */

    Dashboard.isActiveRide =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return false;
            }


            return [

                "accepted",
                "arriving",
                "arrived",
                "started",
                "in_progress"

            ].includes(
                String(
                    ride.status ||
                    ""
                ).toLowerCase()
            );
        };


    Dashboard.openActiveRide =
        function () {

            const ride =
                Dashboard.state.activeRide;


            if (
                !ride
            ) {

                Dashboard.showMessage(
                    "No active ride.",
                    "info"
                );

                return;
            }


            Dashboard.emit(
                "active-ride",
                {

                    ride:
                        ride
                }
            );


            /*
             * Use existing rider ride module
             * if available.
             */

            if (
                RX.riderRide &&
                RX.riderRide.setCurrent
            ) {

                RX.riderRide.setCurrent(
                    ride
                );
            }


            const target =
                document.querySelector(
                    "[data-active-ride-link]"
                );


            if (
                target &&
                target.href
            ) {

                window.location.href =
                    target.href;

                return;
            }


            /*
             * Fallback to rider ride page.
             */

            if (
                window.location.pathname
                    .includes(
                        "/rider/"
                    )
            ) {

                window.location.href =
                    "ride-details.html?id=" +
                    encodeURIComponent(
                        ride.id
                    );
            }
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Dashboard.saveCache =
        function () {

            try {

                localStorage.setItem(
                    Dashboard.config.cacheKey,
                    JSON.stringify(
                        {

                            earningsToday:
                                Dashboard.state
                                    .earningsToday,

                            ridesToday:
                                Dashboard.state
                                    .ridesToday,

                            completedToday:
                                Dashboard.state
                                    .completedToday,

                            cancelledToday:
                                Dashboard.state
                                    .cancelledToday,

                            totalDistanceToday:
                                Dashboard.state
                                    .totalDistanceToday,

                            totalDurationToday:
                                Dashboard.state
                                    .totalDurationToday,

                            availableRides:
                                Dashboard.state
                                    .availableRides,

                            rating:
                                Dashboard.state
                                    .rating,

                            online:
                                Dashboard.state
                                    .online

                        }
                    )
                );

            } catch (error) {}
        };


    Dashboard.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Dashboard.config.cacheKey
                    );


                if (
                    !saved
                ) {

                    return;
                }


                const data =
                    JSON.parse(
                        saved
                    );


                Object.keys(
                    data
                )
                .forEach(
                    function (
                        key
                    ) {

                        if (
                            key in
                            Dashboard.state
                        ) {

                            Dashboard.state[
                                key
                            ] =
                                data[
                                    key
                                ];
                        }
                    }
                );

            } catch (error) {}
        };


    /* ========================================================
       DATE HELPERS
       ======================================================== */

    Dashboard.startOfToday =
        function () {

            const date =
                new Date();


            date.setHours(
                0,
                0,
                0,
                0
            );


            return date.getTime();
        };


    Dashboard.endOfToday =
        function () {

            const date =
                new Date();


            date.setHours(
                23,
                59,
                59,
                999
            );


            return date.getTime();
        };


    /* ========================================================
       GET STATS
       ======================================================== */

    Dashboard.getStats =
        function () {

            return {

                riderId:
                    Dashboard.state.riderId,

                online:
                    Dashboard.state.online,

                earningsToday:
                    Dashboard.state
                        .earningsToday,

                ridesToday:
                    Dashboard.state
                        .ridesToday,

                completedToday:
                    Dashboard.state
                        .completedToday,

                cancelledToday:
                    Dashboard.state
                        .cancelledToday,

                availableRides:
                    Dashboard.state
                        .availableRides,

                activeRide:
                    Dashboard.state
                        .activeRide,

                totalDistanceToday:
                    Dashboard.state
                        .totalDistanceToday,

                totalDurationToday:
                    Dashboard.state
                        .totalDurationToday,

                rating:
                    Dashboard.state
                        .rating
            };
        };


    /* ========================================================
       RENDER
       ======================================================== */

    Dashboard.render =
        function () {

            Dashboard.renderStatus();

            Dashboard.renderProfile();

            Dashboard.renderStats();

            Dashboard.renderActiveRide();

            Dashboard.renderCounters();
        };


    /* ========================================================
       RENDER STATUS
       ======================================================== */

    Dashboard.renderStatus =
        function () {

            const online =
                Dashboard.state.online;


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

                        element.dataset.status =
                            online
                                ? "online"
                                : "offline";
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
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                online;

                        } else {

                            element
                                .classList
                                .toggle(
                                    "active",
                                    online
                                );
                        }
                    }
                );


            document
                .querySelectorAll(
                    "[data-online-text]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            online
                                ? "Go Offline"
                                : "Go Online";
                    }
                );


            document
                .querySelectorAll(
                    "[data-online-dot]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.dataset.status =
                            online
                                ? "online"
                                : "offline";
                    }
                );
        };


    /* ========================================================
       RENDER PROFILE
       ======================================================== */

    Dashboard.renderProfile =
        function () {

            const rider =
                Dashboard.state.rider;


            if (
                !rider
            ) {

                return;
            }


            const name =
                rider.name ||
                rider.fullName ||
                rider.displayName ||
                "Rider";


            const phone =
                rider.phone ||
                rider.mobile ||
                "";


            const photo =
                rider.photoURL ||
                rider.photo ||
                rider.profileImage ||
                "";


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
                    "[data-rider-phone]"
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
                    "[data-rider-photo]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            photo
                        ) {

                            element.src =
                                photo;

                        } else {

                            element.removeAttribute(
                                "src"
                            );
                        }
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
                            Number(
                                Dashboard.state
                                    .rating ||
                                5
                            ).toFixed(
                                1
                            );
                    }
                );
        };


    /* ========================================================
       RENDER STATS
       ======================================================== */

    Dashboard.renderStats =
        function () {

            const values =
                {

                    earnings:
                        Dashboard.formatMoney(
                            Dashboard.state
                                .earningsToday
                        ),

                    earningsToday:
                        Dashboard.formatMoney(
                            Dashboard.state
                                .earningsToday
                        ),

                    rides:
                        Dashboard.state
                            .ridesToday,

                    ridesToday:
                        Dashboard.state
                            .ridesToday,

                    completed:
                        Dashboard.state
                            .completedToday,

                    cancelled:
                        Dashboard.state
                            .cancelledToday,

                    distance:
                        Dashboard.state
                            .totalDistanceToday
                            .toFixed(
                                1
                            ) +
                        " km",

                    duration:
                        Dashboard.state
                            .totalDurationToday +
                        " min",

                    rating:
                        Number(
                            Dashboard.state
                                .rating ||
                            5
                        ).toFixed(
                            1
                        ),

                    requests:
                        Dashboard.state
                            .availableRides
                };


            Object.entries(
                values
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
                            `[data-rider-stat="${key}"]`
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


    /* ========================================================
       RENDER ACTIVE RIDE
       ======================================================== */

    Dashboard.renderActiveRide =
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


            const values =
                {

                    id:
                        ride.id,

                    customer:
                        ride.customerName ||
                        "Customer",

                    pickup:
                        ride.pickupAddress ||
                        "Pickup location",

                    destination:
                        ride.destinationAddress ||
                        "Destination",

                    fare:
                        Dashboard.formatMoney(
                            ride.fare
                        ),

                    status:
                        Dashboard.statusLabel(
                            ride.status
                        )
                };


            Object.entries(
                values
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
                            `[data-active-ride-${key}]`
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


    /* ========================================================
       RENDER COUNTERS
       ======================================================== */

    Dashboard.renderCounters =
        function () {

            const counters =
                {

                    rides:
                        Dashboard.state
                            .ridesToday,

                    completed:
                        Dashboard.state
                            .completedToday,

                    cancelled:
                        Dashboard.state
                            .cancelledToday,

                    requests:
                        Dashboard.state
                            .availableRides,

                    active:
                        Dashboard.state.activeRide
                            ? 1
                            : 0
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
                            `[data-dashboard-count="${key}"]`
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


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    Dashboard.statusLabel =
        function (
            status
        ) {

            const labels =
                {

                    accepted:
                        "Ride accepted",

                    arriving:
                        "Going to pickup",

                    arrived:
                        "Arrived at pickup",

                    started:
                        "Ride started",

                    in_progress:
                        "Ride in progress"
                };


            return (
                labels[
                    String(
                        status ||
                        ""
                    ).toLowerCase()
                ] ||
                "Active ride"
            );
        };


    /* ========================================================
       MONEY
       ======================================================== */

    Dashboard.formatMoney =
        function (
            amount
        ) {

            try {

                return new Intl.NumberFormat(
                    "en-IN",
                    {

                        style:
                            "currency",

                        currency:
                            "INR",

                        maximumFractionDigits:
                            0

                    }
                ).format(
                    Number(
                        amount ||
                        0
                    )
                );

            } catch (error) {

                return "₹" +
                    Math.round(
                        Number(
                            amount ||
                            0
                        )
                    );
            }
        };


    /* ========================================================
       REALTIME RIDER LISTENER
       ======================================================== */

    Dashboard.listen =
        function () {

            Dashboard.stopListening();


            const database =
                Dashboard.getDatabase();


            const riderId =
                Dashboard.getRiderId();


            if (
                !database ||
                !riderId
            ) {

                return;
            }


            const ref =
                database.ref(
                    Dashboard.config
                        .ridersPath +
                    "/" +
                    riderId
                );


            const callback =
                function (
                    snapshot
                ) {

                    const rider =
                        snapshot.val();


                    if (
                        !rider
                    ) {

                        return;
                    }


                    Dashboard.state.rider =
                        {

                            ...rider,

                            id:
                                rider.id ||
                                rider.uid ||
                                riderId,

                            uid:
                                rider.uid ||
                                riderId
                        };


                    Dashboard.state.online =
                        rider.online ===
                        true ||
                        rider.isOnline ===
                        true;


                    if (
                        rider.rating !==
                        undefined
                    ) {

                        Dashboard.state.rating =
                            Number(
                                rider.rating
                            );
                    }


                    Dashboard.renderProfile();
                    Dashboard.renderStatus();
                    Dashboard.saveCache();


                    Dashboard.emit(
                        "rider-updated",
                        {

                            rider:
                                rider
                        }
                    );
                };


            ref.on(
                "value",
                callback
            );


            Dashboard.state.listener =
                {

                    ref:
                        ref,

                    callback:
                        callback
                };
        };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    Dashboard.stopListening =
        function () {

            if (
                Dashboard.state.listener
            ) {

                try {

                    Dashboard.state.listener
                        .ref
                        .off(
                            "value",
                            Dashboard.state.listener
                                .callback
                        );

                } catch (error) {}


                Dashboard.state.listener =
                    null;
            }
        };


    /* ========================================================
       AUTO REFRESH
       ======================================================== */

    Dashboard.startRefresh =
        function () {

            Dashboard.stopRefresh();


            Dashboard.state.refreshTimer =
                setInterval(
                    function () {

                        Dashboard.loadStats();

                    },
                    Dashboard.config
                        .refreshInterval
                );
        };


    Dashboard.stopRefresh =
        function () {

            if (
                Dashboard.state.refreshTimer
            ) {

                clearInterval(
                    Dashboard.state.refreshTimer
                );

                Dashboard.state.refreshTimer =
                    null;
            }
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Dashboard.showMessage =
        function (
            message,
            type
        ) {

            try {

                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        message,
                        type
                    );

                    return;
                }

            } catch (error) {}


            document
                .querySelectorAll(
                    "[data-dashboard-message]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            message;

                        element.dataset.type =
                            type ||
                            "info";

                        element.hidden =
                            false;
                    }
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


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    Dashboard.bindEvents =
        function () {

            /*
             * Online toggle.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-online-toggle]"
                        );


                    if (
                        button &&
                        button.type !==
                        "checkbox"
                    ) {

                        event.preventDefault();

                        Dashboard.toggleOnline();
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
                        toggle &&
                        toggle.type ===
                        "checkbox"
                    ) {

                        Dashboard.setOnline(
                            toggle.checked
                        );
                    }
                }
            );


            /*
             * Active ride.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-open-active-ride]"
                        );


                    if (
                        button
                    ) {

                        event.preventDefault();

                        Dashboard.openActiveRide();
                    }
                }
            );


            /*
             * Refresh dashboard.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-refresh-dashboard]"
                        );


                    if (
                        button
                    ) {

                        Dashboard.loadStats();
                        Dashboard.loadRider();
                    }
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.setRiderOnline =
        Dashboard.setOnline;


    RX.toggleRiderOnline =
        Dashboard.toggleOnline;


    RX.getRiderDashboardStats =
        Dashboard.getStats;


    RX.refreshRiderDashboard =
        Dashboard.loadStats;


    RX.getRiderActiveRide =
        function () {

            return Dashboard.state.activeRide;
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


            Dashboard.loadCache();


            Dashboard.bindEvents();


            await Dashboard.loadRider();

            await Dashboard.loadStats();


            Dashboard.listen();

            Dashboard.startRefresh();


            Dashboard.render();


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
