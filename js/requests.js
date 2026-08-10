/* ============================================================
   RIDERX 2.0
   RIDE REQUEST ENGINE
   File: js/requests.js

   Firebase v10 MODULAR compatible

   Handles:
   - Rider incoming ride requests
   - Realtime Database listener
   - Firestore fallback
   - Accept / Reject
   - Atomic accept protection
   - Request expiry
   - Countdown
   - Rider busy state
   - Customer ride status
   - Customer notification
   - Local request cache
   - Duplicate protection
   ============================================================ */

"use strict";

(function () {

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Requests =
        RX.requests ||
        (RX.requests = {});


    /* =========================================================
       CONFIG
    ========================================================= */

    Requests.config = {

        rideCollection:
            "rides",

        requestCollection:
            "rideRequests",

        riderCollection:
            "riders",

        customerCollection:
            "customers",

        notificationCollection:
            "notifications",

        requestTimeout:
            30000,

        maxVisibleRequests:
            5,

        storageKey:
            "riderx_active_requests",

        pendingStatuses: [

            "pending",
            "requested",
            "searching",
            "finding_rider",
            "waiting_for_rider",
            "new",
            "request"

        ],

        activeStatuses: [

            "accepted",
            "driver_assigned",
            "arriving",
            "arrived",
            "started",
            "in_progress"

        ],

        completedStatuses: [

            "completed",
            "cancelled",
            "rejected",
            "expired"

        ]

    };


    /* =========================================================
       STATE
    ========================================================= */

    Requests.state = {

        initialized:
            false,

        listening:
            false,

        loading:
            false,

        accepting:
            false,

        active:
            [],

        listeners:
            {},

        firestoreUnsubscribe:
            null,

        timers:
            {},

        currentRide:
            null,

        riderId:
            null,

        riderRole:
            "rider"

    };


    /* =========================================================
       FIREBASE MODULE
    ========================================================= */

    let FirebaseModule = null;

    let firebaseLoading = null;


    async function loadFirebase() {

        if (FirebaseModule) {

            return FirebaseModule;

        }

        if (firebaseLoading) {

            return firebaseLoading;

        }

        firebaseLoading =
            import(
                "../firebase/firebase-config.js"
            )
            .then(
                function (module) {

                    FirebaseModule =
                        module;

                    return module;

                }
            )
            .catch(
                function (error) {

                    console.error(
                        "RiderX Requests Firebase load failed:",
                        error
                    );

                    return null;

                }
            )
            .finally(
                function () {

                    firebaseLoading =
                        null;

                }
            );


        return firebaseLoading;

    }


    /* =========================================================
       FIREBASE USER
    ========================================================= */

    Requests.getFirebaseUser =
        function () {

            try {

                if (
                    RX.auth &&
                    RX.auth.state &&
                    RX.auth.state.firebaseUser
                ) {

                    return (
                        RX.auth.state
                            .firebaseUser
                    );

                }

            } catch (_) {}


            try {

                if (
                    RX.auth &&
                    typeof RX.auth
                        .getUid ===
                    "function"
                ) {

                    const uid =
                        RX.auth.getUid();

                    if (uid) {

                        return {
                            uid:
                                uid
                        };

                    }

                }

            } catch (_) {}


            return null;

        };


    /* =========================================================
       RIDER ID
    ========================================================= */

    Requests.getRiderId =
        function () {

            try {

                const user =
                    Requests.getFirebaseUser();

                if (
                    user &&
                    user.uid
                ) {

                    return user.uid;

                }

            } catch (_) {}


            try {

                if (
                    RX.auth &&
                    typeof RX.auth.getUid ===
                    "function"
                ) {

                    const uid =
                        RX.auth.getUid();

                    if (uid) {

                        return uid;

                    }

                }

            } catch (_) {}


            try {

                const stored =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (stored) {

                    const user =
                        JSON.parse(
                            stored
                        );


                    return (
                        user?.uid ||
                        user?.id ||
                        user?.userId ||
                        null
                    );

                }

            } catch (_) {}


            const keys = [

                "riderx_uid",
                "riderId",
                "uid"

            ];


            for (
                const key of keys
            ) {

                try {

                    const value =
                        localStorage.getItem(
                            key
                        );

                    if (value) {

                        return value;

                    }

                } catch (_) {}

            }


            return null;

        };


    /* =========================================================
       ROLE
    ========================================================= */

    Requests.getRole =
        function () {

            try {

                if (
                    RX.auth &&
                    typeof RX.auth.getRole ===
                    "function"
                ) {

                    const role =
                        RX.auth.getRole();

                    if (role) {

                        return String(
                            role
                        )
                        .trim()
                        .toLowerCase();

                    }

                }

            } catch (_) {}


            try {

                const role =
                    localStorage.getItem(
                        "riderx_role"
                    );


                if (role) {

                    return String(
                        role
                    )
                    .trim()
                    .toLowerCase();

                }

            } catch (_) {}


            return "";

        };


    Requests.isRider =
        function () {

            return (
                Requests.getRole() ===
                "rider"
            );

        };


    /* =========================================================
       FIREBASE DATABASE
    ========================================================= */

    Requests.getDatabase =
        async function () {

            const FB =
                await loadFirebase();


            if (
                FB &&
                FB.realtimeDb
            ) {

                return FB.realtimeDb;

            }


            return null;

        };


    Requests.getFirestore =
        async function () {

            const FB =
                await loadFirebase();


            if (
                FB &&
                FB.db
            ) {

                return FB.db;

            }


            return null;

        };


    /* =========================================================
       NORMALIZE RIDE
    ========================================================= */

    Requests.normalizeRide =
        function (
            ride,
            id
        ) {

            if (!ride) {

                return null;

            }


            const normalized = {

                ...ride

            };


            normalized.id =
                normalized.id ||
                id ||
                normalized.rideId ||
                normalized.bookingId ||
                "";


            normalized.customerId =
                normalized.customerId ||
                normalized.customerUid ||
                normalized.userId ||
                normalized.userUID ||
                "";


            normalized.riderId =
                normalized.riderId ||
                normalized.assignedRiderId ||
                normalized.driverId ||
                "";


            normalized.driverId =
                normalized.driverId ||
                normalized.riderId ||
                "";


            normalized.status =
                String(
                    normalized.status ||
                    normalized.rideStatus ||
                    "pending"
                )
                .trim()
                .toLowerCase();


            normalized.createdAt =
                Requests.toMillis(
                    normalized.createdAt ||
                    normalized.requestedAt ||
                    normalized.timestamp
                );


            normalized.requestedAt =
                Requests.toMillis(
                    normalized.requestedAt ||
                    normalized.createdAt
                );


            return normalized;

        };


    /* =========================================================
       TIMESTAMP HELPER
    ========================================================= */

    Requests.toMillis =
        function (
            value
        ) {

            if (
                value ===
                undefined ||
                value ===
                null
            ) {

                return Date.now();

            }


            if (
                typeof value ===
                "number"
            ) {

                return value < 10000000000
                    ? value * 1000
                    : value;

            }


            if (
                value instanceof Date
            ) {

                return value.getTime();

            }


            if (
                typeof value.toMillis ===
                "function"
            ) {

                try {

                    return value.toMillis();

                } catch (_) {}

            }


            if (
                typeof value.seconds ===
                "number"
            ) {

                return (
                    value.seconds *
                    1000
                ) +
                Math.floor(
                    (
                        value.nanoseconds ||
                        0
                    ) /
                    1000000
                );

            }


            const parsed =
                Date.parse(
                    value
                );


            return Number.isFinite(
                parsed
            )
                ? parsed
                : Date.now();

        };


    /* =========================================================
       START
    ========================================================= */

    Requests.start =
        async function () {

            if (
                !Requests.isRider()
            ) {

                console.warn(
                    "RiderX Requests: current account is not a rider."
                );

                return false;

            }


            if (
                Requests.state.listening
            ) {

                return true;

            }


            const riderId =
                Requests.getRiderId();


            if (!riderId) {

                console.warn(
                    "RiderX Requests: rider UID not found."
                );

                return false;

            }


            Requests.state.riderId =
                riderId;


            Requests.state.listening =
                true;


            Requests.loadLocal();


            try {

                const database =
                    await Requests.getDatabase();


                if (database) {

                    Requests.listenRealtime(
                        database
                    );

                }


                const firestore =
                    await Requests.getFirestore();


                if (
                    firestore &&
                    !database
                ) {

                    Requests.listenFirestore(
                        firestore
                    );

                }


                Requests.emit(
                    "started",
                    {
                        riderId:
                            riderId
                    }
                );


                return true;

            } catch (error) {

                Requests.state.listening =
                    false;

                console.error(
                    "RiderX Requests start failed:",
                    error
                );

                return false;

            }

        };


    /* =========================================================
       STOP
    ========================================================= */

    Requests.stop =
        async function () {

            try {

                const database =
                    await Requests.getDatabase();


                if (database) {

                    Object.keys(
                        Requests.state
                            .listeners
                    )
                    .forEach(
                        function (
                            key
                        ) {

                            const item =
                                Requests.state
                                    .listeners[key];


                            try {

                                item.ref.off(
                                    item.event,
                                    item.handler
                                );

                            } catch (_) {}

                        }
                    );

                }

            } catch (_) {}


            Requests.state.listeners =
                {};


            if (
                Requests.state
                    .firestoreUnsubscribe
            ) {

                try {

                    Requests.state
                        .firestoreUnsubscribe();

                } catch (_) {}

            }


            Requests.state
                .firestoreUnsubscribe =
                null;


            Object.keys(
                Requests.state.timers
            )
            .forEach(
                function (
                    key
                ) {

                    clearInterval(
                        Requests.state.timers[key]
                    );

                }
            );


            Requests.state.timers =
                {};


            Requests.state.listening =
                false;


            Requests.emit(
                "stopped"
            );


            return true;

        };


    /* =========================================================
       REALTIME DATABASE LISTENERS
    ========================================================= */

    Requests.listenRealtime =
        function (
            database
        ) {

            const riderId =
                Requests.state.riderId;


            if (
                !database ||
                !riderId
            ) {

                return false;

            }


            /* ---------------------------------------------
               Assigned rides
            --------------------------------------------- */

            const ridesRef =
                database
                    .ref(
                        Requests.config
                            .rideCollection
                    )
                    .orderByChild(
                        "riderId"
                    )
                    .equalTo(
                        riderId
                    );


            const ridesHandler =
                function (
                    snapshot
                ) {

                    Requests.processSnapshot(
                        snapshot
                    );

                };


            ridesRef.on(
                "value",
                ridesHandler
            );


            Requests.state.listeners
                .rides = {

                    ref:
                        ridesRef,

                    event:
                        "value",

                    handler:
                        ridesHandler

                };


            /* ---------------------------------------------
               New ride requests
            --------------------------------------------- */

            const requestsRef =
                database.ref(
                    Requests.config
                        .requestCollection
                );


            const requestsHandler =
                function (
                    snapshot
                ) {

                    Requests.processRequestSnapshot(
                        snapshot
                    );

                };


            requestsRef.on(
                "value",
                requestsHandler
            );


            Requests.state.listeners
                .requests = {

                    ref:
                        requestsRef,

                    event:
                        "value",

                    handler:
                        requestsHandler

                };


            return true;

        };


    /* =========================================================
       PROCESS RIDES
    ========================================================= */

    Requests.processSnapshot =
        function (
            snapshot
        ) {

            const incoming = [];


            snapshot.forEach(
                function (
                    child
                ) {

                    const ride =
                        Requests.normalizeRide(
                            child.val(),
                            child.key
                        );


                    if (!ride) {

                        return;

                    }


                    if (
                        Requests.isPending(
                            ride
                        )
                    ) {

                        incoming.push(
                            ride
                        );

                    }

                }
            );


            incoming.sort(
                function (
                    a,
                    b
                ) {

                    return (
                        b.createdAt -
                        a.createdAt
                    );

                }
            );


            incoming
                .slice(
                    0,
                    Requests.config
                        .maxVisibleRequests
                )
                .forEach(
                    function (
                        ride
                    ) {

                        Requests.add(
                            ride
                        );

                    }
                );


            Requests.render();

        };


    /* =========================================================
       PROCESS RIDE REQUESTS
    ========================================================= */

    Requests.processRequestSnapshot =
        function (
            snapshot
        ) {

            const incoming = [];


            snapshot.forEach(
                function (
                    child
                ) {

                    const request =
                        Requests.normalizeRide(
                            child.val(),
                            child.key
                        );


                    if (!request) {

                        return;

                    }


                    const targetRider =
                        request.riderId ||
                        request.assignedRiderId ||
                        request.driverId ||
                        "";


                    if (
                        targetRider &&
                        targetRider !==
                        Requests.state.riderId
                    ) {

                        return;

                    }


                    if (
                        request.rejectedRiders &&
                        request.rejectedRiders[
                            Requests.state
                                .riderId
                        ]
                    ) {

                        return;

                    }


                    if (
                        Requests.isPending(
                            request
                        )
                    ) {

                        incoming.push(
                            request
                        );

                    }

                }
            );


            incoming.forEach(
                function (
                    ride
                ) {

                    Requests.add(
                        ride
                    );

                }
            );


            Requests.render();

        };


    /* =========================================================
       PENDING CHECK
    ========================================================= */

    Requests.isPending =
        function (
            ride
        ) {

            if (!ride) {

                return false;

            }


            const status =
                String(
                    ride.status ||
                    ride.rideStatus ||
                    "pending"
                )
                .trim()
                .toLowerCase();


            if (
                !Requests.config
                    .pendingStatuses
                    .includes(
                        status
                    )
            ) {

                return false;

            }


            if (
                ride.cancelled ===
                true
            ) {

                return false;

            }


            const riderId =
                Requests.state.riderId;


            if (
                ride.riderId &&
                ride.riderId !==
                riderId
            ) {

                return false;

            }


            if (
                ride.driverId &&
                ride.driverId !==
                riderId
            ) {

                return false;

            }


            if (
                Requests.isExpired(
                    ride
                )
            ) {

                Requests.expire(
                    ride.id
                );

                return false;

            }


            return true;

        };


    /* =========================================================
       EXPIRY
    ========================================================= */

    Requests.isExpired =
        function (
            ride
        ) {

            if (!ride) {

                return true;

            }


            const created =
                Requests.toMillis(
                    ride.requestedAt ||
                    ride.createdAt ||
                    ride.timestamp
                );


            const timeout =
                Number(
                    ride.requestTimeout ||
                    Requests.config
                        .requestTimeout
                );


            return (
                Date.now() -
                created >
                timeout
            );

        };


    Requests.getRemainingTime =
        function (
            ride
        ) {

            const created =
                Requests.toMillis(
                    ride?.requestedAt ||
                    ride?.createdAt ||
                    ride?.timestamp
                );


            const timeout =
                Number(
                    ride?.requestTimeout ||
                    Requests.config
                        .requestTimeout
                );


            return Math.max(
                0,
                timeout -
                (
                    Date.now() -
                    created
                )
            );

        };


    /* =========================================================
       ADD REQUEST
    ========================================================= */

    Requests.add =
        function (
            ride
        ) {

            if (
                !ride ||
                !ride.id
            ) {

                return false;

            }


            const normalized =
                Requests.normalizeRide(
                    ride,
                    ride.id
                );


            if (
                !normalized
            ) {

                return false;

            }


            const index =
                Requests.state.active
                    .findIndex(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                normalized.id
                            );

                        }
                    );


            if (
                index >= 0
            ) {

                Requests.state.active[
                    index
                ] = {

                    ...Requests.state
                        .active[index],

                    ...normalized

                };

            } else {

                Requests.state.active
                    .push(
                        normalized
                    );

            }


            Requests.saveLocal();

            Requests.startTimer(
                normalized
            );

            Requests.emit(
                "new",
                {
                    ride:
                        normalized
                }
            );

            Requests.render();


            return true;

        };


    /* =========================================================
       REMOVE
    ========================================================= */

    Requests.remove =
        function (
            rideId
        ) {

            if (!rideId) {

                return false;

            }


            Requests.state.active =
                Requests.state.active
                    .filter(
                        function (
                            ride
                        ) {

                            return (
                                ride.id !==
                                rideId
                            );

                        }
                    );


            Requests.stopTimer(
                rideId
            );


            Requests.saveLocal();

            Requests.render();


            return true;

        };


    /* =========================================================
       GET
    ========================================================= */

    Requests.get =
        function (
            rideId
        ) {

            return (
                Requests.state.active
                    .find(
                        function (
                            ride
                        ) {

                            return (
                                ride.id ===
                                rideId
                            );

                        }
                    ) ||
                null
            );

        };


    /* =========================================================
       ACCEPT RIDE
    ========================================================= */

    Requests.accept =
        async function (
            rideId
        ) {

            const riderId =
                Requests.state.riderId ||
                Requests.getRiderId();


            if (!riderId) {

                throw new Error(
                    "Rider login required."
                );

            }


            if (
                Requests.state.accepting
            ) {

                return false;

            }


            const ride =
                Requests.get(
                    rideId
                );


            if (!ride) {

                throw new Error(
                    "Ride request no longer exists."
                );

            }


            if (
                !Requests.isPending(
                    ride
                )
            ) {

                throw new Error(
                    "This ride request is no longer available."
                );

            }


            Requests.state.accepting =
                true;


            try {

                const accepted =
                    await Requests.acceptRemote(
                        ride,
                        riderId
                    );


                if (!accepted) {

                    throw new Error(
                        "Ride was already accepted by another rider."
                    );

                }


                ride.riderId =
                    riderId;


                ride.driverId =
                    riderId;


                ride.status =
                    "accepted";


                ride.rideStatus =
                    "accepted";


                ride.customerStatus =
                    "accepted";


                ride.acceptedAt =
                    Date.now();


                Requests.state.currentRide =
                    ride;


                Requests.remove(
                    rideId
                );


                await Requests.setRiderBusy(
                    riderId
                );


                await Requests.notifyCustomer(
                    ride,
                    "accepted"
                );


                Requests.emit(
                    "accepted",
                    {

                        ride:
                            ride,

                        riderId:
                            riderId

                    }
                );


                Requests.showMessage(
                    "Ride accepted successfully.",
                    "success"
                );


                Requests.redirectAfterAccept(
                    ride
                );


                return ride;

            } finally {

                Requests.state.accepting =
                    false;

            }

        };


    /* =========================================================
       ACCEPT REMOTE
       ---------------------------------------------------------
       Realtime Database transaction prevents two riders
       from accepting the same ride at the same time.
    ========================================================= */

    Requests.acceptRemote =
        async function (
            ride,
            riderId
        ) {

            const FB =
                await loadFirebase();


            if (
                !FB ||
                !FB.realtimeDb
            ) {

                throw new Error(
                    "Firebase Realtime Database is unavailable."
                );

            }


            const database =
                FB.realtimeDb;


            const rideRef =
                database.ref(
                    Requests.config
                        .rideCollection +
                    "/" +
                    ride.id
                );


            try {

                const result =
                    await FB.runTransaction(
                        database,
                        rideRef,
                        function (
                            current
                        ) {

                            if (
                                !current
                            ) {

                                return;

                            }


                            const status =
                                String(
                                    current.status ||
                                    current.rideStatus ||
                                    "pending"
                                )
                                .toLowerCase();


                            const riderAlreadyAssigned =
                                current.riderId ||
                                current.driverId ||
                                "";


                            if (
                                riderAlreadyAssigned &&
                                riderAlreadyAssigned !==
                                riderId
                            ) {

                                return;

                            }


                            if (
                                !Requests.config
                                    .pendingStatuses
                                    .includes(
                                        status
                                    )
                            ) {

                                return;

                            }


                            if (
                                current.cancelled ===
                                true
                            ) {

                                return;

                            }


                            return {

                                ...current,

                                riderId:
                                    riderId,

                                driverId:
                                    riderId,

                                status:
                                    "accepted",

                                rideStatus:
                                    "accepted",

                                customerStatus:
                                    "accepted",

                                acceptedAt:
                                    Date.now(),

                                updatedAt:
                                    Date.now()

                            };

                        }
                    );


                if (
                    !result.committed
                ) {

                    return false;

                }


                /*
                 * Keep ride request mirror in sync.
                 */

                try {

                    await database
                        .ref(
                            Requests.config
                                .requestCollection +
                            "/" +
                            ride.id
                        )
                        .update(
                            {

                                riderId:
                                    riderId,

                                driverId:
                                    riderId,

                                status:
                                    "accepted",

                                rideStatus:
                                    "accepted",

                                acceptedAt:
                                    Date.now(),

                                updatedAt:
                                    Date.now()

                            }
                        );

                } catch (_) {}


                return true;

            } catch (error) {

                console.error(
                    "RiderX ride acceptance failed:",
                    error
                );

                throw new Error(
                    "Unable to accept this ride. Please try again."
                );

            }

        };


    /* =========================================================
       REJECT
    ========================================================= */

    Requests.reject =
        async function (
            rideId,
            reason
        ) {

            const riderId =
                Requests.state.riderId ||
                Requests.getRiderId();


            if (!riderId) {

                throw new Error(
                    "Rider login required."
                );

            }


            const ride =
                Requests.get(
                    rideId
                );


            if (!ride) {

                return false;

            }


            Requests.remove(
                rideId
            );


            const FB =
                await loadFirebase();


            if (
                FB &&
                FB.realtimeDb
            ) {

                const database =
                    FB.realtimeDb;


                const rejection = {

                    reason:
                        reason ||
                        "rejected",

                    rejectedAt:
                        Date.now()

                };


                try {

                    await database
                        .ref(
                            Requests.config
                                .rideCollection +
                            "/" +
                            rideId +
                            "/rejectedRiders/" +
                            riderId
                        )
                        .set(
                            rejection
                        );

                } catch (error) {

                    console.warn(
                        "Ride rejection save failed:",
                        error
                    );

                }


                try {

                    await database
                        .ref(
                            Requests.config
                                .requestCollection +
                            "/" +
                            rideId +
                            "/rejectedRiders/" +
                            riderId
                        )
                        .set(
                            rejection
                        );

                } catch (_) {}

            }


            Requests.emit(
                "rejected",
                {

                    ride:
                        ride,

                    reason:
                        reason ||
                        "rejected"

                }
            );


            Requests.showMessage(
                "Ride request rejected.",
                "info"
            );


            return true;

        };


    /* =========================================================
       EXPIRE
    ========================================================= */

    Requests.expire =
        async function (
            rideId
        ) {

            const ride =
                Requests.get(
                    rideId
                );


            Requests.remove(
                rideId
            );


            if (!ride) {

                return false;

            }


            const riderId =
                Requests.state.riderId;


            const FB =
                await loadFirebase();


            if (
                FB &&
                FB.realtimeDb &&
                riderId
            ) {

                try {

                    await FB.realtimeDb
                        .ref(
                            Requests.config
                                .requestCollection +
                            "/" +
                            rideId +
                            "/expiredRiders/" +
                            riderId
                        )
                        .set(
                            {

                                expiredAt:
                                    Date.now()

                            }
                        );

                } catch (_) {}

            }


            Requests.emit(
                "expired",
                {
                    ride:
                        ride
                }
            );


            return true;

        };


    /* =========================================================
       TIMER
    ========================================================= */

    Requests.startTimer =
        function (
            ride
        ) {

            if (
                !ride ||
                !ride.id
            ) {

                return;

            }


            Requests.stopTimer(
                ride.id
            );


            Requests.state.timers[
                ride.id
            ] =
                setInterval(
                    function () {

                        const current =
                            Requests.get(
                                ride.id
                            );


                        if (!current) {

                            Requests.stopTimer(
                                ride.id
                            );

                            return;

                        }


                        const remaining =
                            Requests.getRemainingTime(
                                current
                            );


                        Requests.updateCountdown(
                            current.id,
                            remaining
                        );


                        if (
                            remaining <=
                            0
                        ) {

                            Requests.expire(
                                current.id
                            );

                        }

                    },
                    1000
                );

        };


    Requests.stopTimer =
        function (
            rideId
        ) {

            const timer =
                Requests.state.timers[
                    rideId
                ];


            if (timer) {

                clearInterval(
                    timer
                );


                delete Requests.state
                    .timers[rideId];

            }

        };


    /* =========================================================
       COUNTDOWN
    ========================================================= */

    Requests.updateCountdown =
        function (
            rideId,
            milliseconds
        ) {

            const seconds =
                Math.ceil(
                    milliseconds /
                    1000
                );


            document
                .querySelectorAll(
                    "[data-request-countdown=\"" +
                    Requests.escapeAttribute(
                        rideId
                    ) +
                    "\"]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            seconds > 0
                                ? seconds + "s"
                                : "Expired";

                    }
                );

        };


    /* =========================================================
       RIDER BUSY
    ========================================================= */

    Requests.setRiderBusy =
        async function (
            riderId
        ) {

            const FB =
                await loadFirebase();


            if (
                !FB ||
                !FB.realtimeDb ||
                !riderId
            ) {

                return false;

            }


            try {

                await FB.realtimeDb
                    .ref(
                        Requests.config
                            .riderCollection +
                        "/" +
                        riderId
                    )
                    .update(
                        {

                            online:
                                true,

                            available:
                                false,

                            busy:
                                true,

                            status:
                                "busy",

                            updatedAt:
                                Date.now()

                        }
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Rider busy state update failed:",
                    error
                );


                return false;

            }

        };


    /* =========================================================
       CUSTOMER NOTIFICATION
    ========================================================= */

    Requests.notifyCustomer =
        async function (
            ride,
            status
        ) {

            if (!ride) {

                return false;

            }


            const customerId =
                ride.customerId ||
                ride.customerUid ||
                ride.userId ||
                ride.userUID;


            if (!customerId) {

                return false;

            }


            const FB =
                await loadFirebase();


            if (
                !FB ||
                !FB.realtimeDb
            ) {

                return false;

            }


            const database =
                FB.realtimeDb;


            const riderId =
                Requests.state.riderId;


            try {

                await database
                    .ref(
                        Requests.config
                            .rideCollection +
                        "/" +
                        ride.id
                    )
                    .update(
                        {

                            riderId:
                                riderId,

                            driverId:
                                riderId,

                            customerStatus:
                                status,

                            status:
                                status,

                            rideStatus:
                                status,

                            updatedAt:
                                Date.now()

                        }
                    );


                const notificationId =
                    "ride_" +
                    ride.id +
                    "_" +
                    status +
                    "_" +
                    Date.now();


                await database
                    .ref(
                        Requests.config
                            .notificationCollection +
                        "/" +
                        customerId +
                        "/" +
                        notificationId
                    )
                    .set(
                        {

                            id:
                                notificationId,

                            type:
                                "ride",

                            title:
                                status ===
                                "accepted"
                                    ? "Rider found"
                                    : "Ride update",

                            message:
                                status ===
                                "accepted"
                                    ? "Your RiderX ride has been accepted."
                                    : "Your RiderX ride status has been updated.",

                            rideId:
                                ride.id,

                            riderId:
                                riderId,

                            read:
                                false,

                            createdAt:
                                Date.now()

                        }
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Customer notification failed:",
                    error
                );


                return false;

            }

        };


    /* =========================================================
       REDIRECT
    ========================================================= */

    Requests.redirectAfterAccept =
        function (
            ride
        ) {

            if (!ride?.id) {

                return;

            }


            const currentPath =
                window.location.pathname
                    .toLowerCase();


            if (
                currentPath.includes(
                    "/rider/"
                )
            ) {

                /*
                 * Existing RiderX ride-details page.
                 */

                window.setTimeout(
                    function () {

                        window.location.href =
                            "./ride-details.html" +
                            "?rideId=" +
                            encodeURIComponent(
                                ride.id
                            );

                    },
                    300
                );


                return;

            }


            Requests.emit(
                "navigate",
                {

                    ride:
                        ride

                }
            );

        };


    /* =========================================================
       RENDER
    ========================================================= */

    Requests.render =
        function () {

            const containers =
                document.querySelectorAll(
                    "[data-ride-requests]"
                );


            containers.forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        "";


                    const active =
                        Requests.state.active
                            .filter(
                                function (
                                    ride
                                ) {

                                    return Requests
                                        .isPending(
                                            ride
                                        );

                                }
                            )
                            .sort(
                                function (
                                    a,
                                    b
                                ) {

                                    return (
                                        b.createdAt -
                                        a.createdAt
                                    );

                                }
                            );


                    if (
                        active.length ===
                        0
                    ) {

                        const empty =
                            document.createElement(
                                "div"
                            );


                        empty.className =
                            "requests-empty";


                        empty.textContent =
                            "No new ride requests";


                        container.appendChild(
                            empty
                        );


                        return;

                    }


                    active
                        .slice(
                            0,
                            Requests.config
                                .maxVisibleRequests
                        )
                        .forEach(
                            function (
                                ride
                            ) {

                                container.appendChild(
                                    Requests.createCard(
                                        ride
                                    )
                                );

                            }
                        );

                }
            );

        };


    /* =========================================================
       CARD
    ========================================================= */

    Requests.createCard =
        function (
            ride
        ) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "ride-request-card";


            card.dataset.rideId =
                ride.id;


            const pickup =
                ride.pickupAddress ||
                ride.pickupName ||
                ride.pickup ||
                "Pickup location";


            const destination =
                ride.dropoffAddress ||
                ride.destinationAddress ||
                ride.dropoffName ||
                ride.destination ||
                ride.dropoff ||
                "Destination";


            const service =
                ride.serviceType ||
                ride.rideType ||
                ride.vehicleType ||
                "Bike Taxi";


            const fare =
                Number(
                    ride.fare ||
                    ride.estimatedFare ||
                    ride.price ||
                    0
                );


            const distance =
                ride.distance ||
                ride.distanceKm ||
                "";


            const remaining =
                Requests.getRemainingTime(
                    ride
                );


            card.innerHTML = `

                <div class="ride-request-header">

                    <div class="ride-request-service">
                        ${Requests.escape(service)}
                    </div>

                    <div
                        class="ride-request-time"
                        data-request-countdown="${Requests.escapeAttribute(ride.id)}"
                    >
                        ${Math.ceil(
                            remaining / 1000
                        )}s
                    </div>

                </div>


                <div class="ride-request-route">

                    <div class="route-point pickup">

                        <span class="route-dot"></span>

                        <div>

                            <small>
                                Pickup
                            </small>

                            <strong>
                                ${Requests.escape(pickup)}
                            </strong>

                        </div>

                    </div>


                    <div class="route-line"></div>


                    <div class="route-point destination">

                        <span class="route-dot"></span>

                        <div>

                            <small>
                                Drop-off
                            </small>

                            <strong>
                                ${Requests.escape(destination)}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="ride-request-meta">

                    <div>

                        <small>
                            Fare
                        </small>

                        <strong>
                            ₹${fare.toFixed(0)}
                        </strong>

                    </div>


                    <div>

                        <small>
                            Distance
                        </small>

                        <strong>
                            ${Requests.escape(
                                String(
                                    distance
                                )
                            )}
                        </strong>

                    </div>

                </div>


                <div class="ride-request-actions">

                    <button
                        type="button"
                        class="ride-request-reject"
                        data-request-reject="${Requests.escapeAttribute(ride.id)}"
                    >
                        Reject
                    </button>


                    <button
                        type="button"
                        class="ride-request-accept"
                        data-request-accept="${Requests.escapeAttribute(ride.id)}"
                    >
                        Accept
                    </button>

                </div>

            `;


            return card;

        };


    /* =========================================================
       BUTTON EVENTS
    ========================================================= */

    Requests.bindButtons =
        function () {

            if (
                Requests.state
                    .buttonsBound
            ) {

                return;

            }


            Requests.state
                .buttonsBound =
                true;


            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const accept =
                        event.target.closest(
                            "[data-request-accept]"
                        );


                    if (accept) {

                        event.preventDefault();


                        const rideId =
                            accept.dataset
                                .requestAccept;


                        accept.disabled =
                            true;


                        try {

                            await Requests.accept(
                                rideId
                            );

                        } catch (error) {

                            Requests.showMessage(
                                error.message ||
                                "Unable to accept ride.",
                                "error"
                            );


                            accept.disabled =
                                false;

                        }


                        return;

                    }


                    const reject =
                        event.target.closest(
                            "[data-request-reject]"
                        );


                    if (reject) {

                        event.preventDefault();


                        const rideId =
                            reject.dataset
                                .requestReject;


                        reject.disabled =
                            true;


                        try {

                            await Requests.reject(
                                rideId
                            );

                        } catch (error) {

                            Requests.showMessage(
                                error.message ||
                                "Unable to reject request.",
                                "error"
                            );


                            reject.disabled =
                                false;

                        }

                    }

                }
            );

        };


    /* =========================================================
       LOCAL CACHE
    ========================================================= */

    Requests.loadLocal =
        function () {

            try {

                const raw =
                    localStorage.getItem(
                        Requests.config
                            .storageKey
                    );


                if (!raw) {

                    Requests.state.active =
                        [];

                    Requests.render();

                    return;

                }


                const data =
                    JSON.parse(
                        raw
                    );


                if (
                    Array.isArray(
                        data
                    )
                ) {

                    Requests.state.active =
                        data
                            .map(
                                function (
                                    ride
                                ) {

                                    return Requests
                                        .normalizeRide(
                                            ride,
                                            ride?.id
                                        );

                                }
                            )
                            .filter(
                                Boolean
                            )
                            .filter(
                                Requests.isPending
                            );

                } else {

                    Requests.state.active =
                        [];

                }

            } catch (error) {

                console.warn(
                    "RiderX request cache read failed:",
                    error
                );


                Requests.state.active =
                    [];

            }


            Requests.saveLocal();

            Requests.render();

        };


    Requests.saveLocal =
        function () {

            try {

                localStorage.setItem(
                    Requests.config
                        .storageKey,
                    JSON.stringify(
                        Requests.state.active
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX request cache save failed:",
                    error
                );

            }

        };


    /* =========================================================
       FIRESTORE FALLBACK
    ========================================================= */

    Requests.listenFirestore =
        function (
            firestore
        ) {

            const riderId =
                Requests.state.riderId;


            if (
                !firestore ||
                !riderId
            ) {

                return false;

            }


            try {

                const FB =
                    FirebaseModule;


                const rideCollection =
                    FB.collection(
                        firestore,
                        Requests.config
                            .rideCollection
                    );


                const rideQuery =
                    FB.query(
                        rideCollection,
                        FB.where(
                            "riderId",
                            "==",
                            riderId
                        )
                    );


                Requests.state
                    .firestoreUnsubscribe =
                    FB.onSnapshot(
                        rideQuery,
                        function (
                            snapshot
                        ) {

                            snapshot.forEach(
                                function (
                                    document
                                ) {

                                    const ride =
                                        Requests
                                            .normalizeRide(
                                                document.data(),
                                                document.id
                                            );


                                    if (
                                        Requests
                                            .isPending(
                                                ride
                                            )
                                    ) {

                                        Requests.add(
                                            ride
                                        );

                                    } else {

                                        Requests.remove(
                                            ride?.id
                                        );

                                    }

                                }
                            );


                            Requests.render();

                        },
                        function (
                            error
                        ) {

                            console.warn(
                                "RiderX Firestore request listener failed:",
                                error
                            );

                        }
                    );


                return true;

            } catch (error) {

                console.warn(
                    "RiderX Firestore listener setup failed:",
                    error
                );


                return false;

            }

        };


    /* =========================================================
       ESCAPE
    ========================================================= */

    Requests.escape =
        function (
            value
        ) {

            return String(
                value ===
                undefined ||
                value ===
                null
                    ? ""
                    : value
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


    Requests.escapeAttribute =
        function (
            value
        ) {

            return Requests.escape(
                value
            );

        };


    /* =========================================================
       MESSAGE
    ========================================================= */

    Requests.showMessage =
        function (
            message,
            type
        ) {

            const target =
                document.querySelector(
                    "[data-request-message]"
                );


            if (target) {

                target.textContent =
                    message;


                target.dataset.type =
                    type ||
                    "info";


                target.classList.add(
                    "show"
                );


                window.setTimeout(
                    function () {

                        target.classList.remove(
                            "show"
                        );

                    },
                    3500
                );


                return;

            }


            if (
                type ===
                "error"
            ) {

                console.error(
                    "RiderX:",
                    message
                );

            } else {

                console.log(
                    "RiderX:",
                    message
                );

            }

        };


    /* =========================================================
       EVENTS
    ========================================================= */

    Requests.emit =
        function (
            name,
            detail
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-request-" +
                    name,
                    {

                        detail:
                            detail ||
                            {}

                    }
                )
            );

        };


    /* =========================================================
       PUBLIC API
    ========================================================= */

    RX.requestsController =
        Requests;


    RX.startRideRequests =
        Requests.start;


    RX.stopRideRequests =
        Requests.stop;


    RX.acceptRideRequest =
        Requests.accept;


    RX.rejectRideRequest =
        Requests.reject;


    RX.getRideRequest =
        Requests.get;


    /* =========================================================
       AUTH EVENT RESTART
    ========================================================= */

    window.addEventListener(
        "riderx-auth-signed-in",
        function (
            event
        ) {

            const role =
                event.detail?.role ||
                Requests.getRole();


            if (
                String(role)
                    .toLowerCase() ===
                "rider"
            ) {

                Requests.state.riderId =
                    Requests.getRiderId();


                Requests.start();

            }

        }
    );


    window.addEventListener(
        "riderx-auth-logout",
        function () {

            Requests.stop();

        }
    );


    /* =========================================================
       VISIBILITY
    ========================================================= */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState !==
                "visible"
            ) {

                return;

            }


            if (
                Requests.isRider() &&
                !Requests.state.listening
            ) {

                Requests.start();

            }

        }
    );


    /* =========================================================
       INIT
    ========================================================= */

    Requests.init =
        async function () {

            if (
                Requests.state
                    .initialized
            ) {

                return;

            }


            Requests.state
                .initialized =
                true;


            Requests.bindButtons();

            Requests.loadLocal();


            if (
                Requests.isRider()
            ) {

                await Requests.start();

            }


            console.log(
                "RiderX modular requests engine loaded."
            );

        };


    /* =========================================================
       AUTO INIT
    ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                Requests.init();

            },
            {
                once:
                    true
            }
        );

    } else {

        Requests.init();

    }

})();
