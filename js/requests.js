/* ============================================================
   RIDERX - RIDE REQUEST CONTROLLER
   File: js/requests.js

   Handles:
   - Rider incoming ride requests
   - Realtime ride request listener
   - Accept request
   - Reject request
   - Request expiry
   - Request countdown
   - Rider availability check
   - Customer notification/status update
   - Duplicate request protection
   - Firebase Realtime Database
   - Firestore fallback
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Requests =
        RX.requests ||
        (RX.requests = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Requests.config = {

        rideCollection:
            "rides",

        requestCollection:
            "rideRequests",

        riderCollection:
            "riders",

        customerCollection:
            "customers",

        requestTimeout:
            30000,

        maxVisibleRequests:
            5,

        storageKey:
            "riderx_active_requests",

        acceptedStatuses:
            [
                "accepted",
                "driver_assigned",
                "arriving",
                "arrived",
                "started",
                "in_progress"
            ],

        completedStatuses:
            [
                "completed",
                "cancelled",
                "rejected",
                "expired"
            ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    Requests.state = {

        initialized:
            false,

        listening:
            false,

        online:
            false,

        loading:
            false,

        accepting:
            false,

        active:
            [],

        listeners:
            {},

        timers:
            {},

        currentRide:
            null,

        riderId:
            null,

        riderRole:
            "rider"
    };


    /* ========================================================
       FIREBASE USER
       ======================================================== */

    Requests.getFirebaseUser =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth()
                        .currentUser;
                }

            } catch (error) {}

            return null;
        };


    Requests.getRiderId =
        function () {

            const user =
                Requests.getFirebaseUser();


            if (
                user &&
                user.uid
            ) {

                return user.uid;
            }


            try {

                return (
                    localStorage.getItem(
                        "riderx_uid"
                    ) ||
                    localStorage.getItem(
                        "uid"
                    ) ||
                    localStorage.getItem(
                        "riderId"
                    ) ||
                    null
                );

            } catch (error) {

                return null;
            }
        };


    Requests.getRole =
        function () {

            try {

                const role =
                    localStorage.getItem(
                        "riderx_role"
                    );


                if (
                    role
                ) {

                    return String(
                        role
                    ).toLowerCase();
                }

            } catch (error) {}


            return "rider";
        };


    /* ========================================================
       DATABASE
       ======================================================== */

    Requests.getDatabase =
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


    Requests.getFirestore =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.firestore
                ) {

                    return RX.firebase.firestore;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       RIDER CHECK
       ======================================================== */

    Requests.isRider =
        function () {

            return (
                Requests.getRole() ===
                "rider"
            );
        };


    /* ========================================================
       START LISTENER
       ======================================================== */

    Requests.start =
        function () {

            if (
                !Requests.isRider()
            ) {

                console.warn(
                    "RiderX Requests: current user is not a rider."
                );

                return false;
            }


            if (
                Requests.state.listening
            ) {

                return true;
            }


            Requests.state.riderId =
                Requests.getRiderId();


            if (
                !Requests.state.riderId
            ) {

                console.warn(
                    "RiderX Requests: rider ID not found."
                );

                return false;
            }


            Requests.state.listening =
                true;


            Requests.loadLocal();


            const database =
                Requests.getDatabase();


            if (
                database
            ) {

                Requests.listenRealtime(
                    database
                );

            } else {

                Requests.listenFirestore();
            }


            Requests.emit(
                "started",
                {

                    riderId:
                        Requests.state.riderId
                }
            );


            return true;
        };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    Requests.stop =
        function () {

            const database =
                Requests.getDatabase();


            if (
                database
            ) {

                Object.keys(
                    Requests.state.listeners
                )
                .forEach(
                    function (
                        key
                    ) {

                        try {

                            Requests.state
                                .listeners[key]
                                .ref
                                .off(
                                    Requests.state
                                        .listeners[key]
                                        .event,
                                    Requests.state
                                        .listeners[key]
                                        .handler
                                );

                        } catch (error) {}
                    }
                );
            }


            Requests.state.listeners =
                {};


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
        };


    /* ========================================================
       REALTIME DATABASE LISTENER
       ======================================================== */

    Requests.listenRealtime =
        function (
            database
        ) {

            const riderId =
                Requests.state.riderId;


            /*
             * Primary query:
             * rides assigned to this rider.
             */

            const riderRef =
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


            const riderHandler =
                function (
                    snapshot
                ) {

                    Requests.processSnapshot(
                        snapshot
                    );
                };


            riderRef.on(
                "value",
                riderHandler
            );


            Requests.state.listeners
                .rider =
                {

                    ref:
                        riderRef,

                    event:
                        "value",

                    handler:
                        riderHandler
                };


            /*
             * Secondary request listener.
             *
             * Some RiderX ride flows create
             * rideRequests/{rideId} before
             * assigning riderId.
             */

            const requestRef =
                database
                    .ref(
                        Requests.config
                            .requestCollection
                    );


            const requestHandler =
                function (
                    snapshot
                ) {

                    Requests.processRequestSnapshot(
                        snapshot
                    );
                };


            requestRef.on(
                "value",
                requestHandler
            );


            Requests.state.listeners
                .requests =
                {

                    ref:
                        requestRef,

                    event:
                        "value",

                    handler:
                        requestHandler
                };
        };


    /* ========================================================
       PROCESS RIDE SNAPSHOT
       ======================================================== */

    Requests.processSnapshot =
        function (
            snapshot
        ) {

            const rides =
                [];


            snapshot.forEach(
                function (
                    child
                ) {

                    const ride =
                        child.val();


                    if (
                        !ride
                    ) {

                        return;
                    }


                    ride.id =
                        ride.id ||
                        child.key;


                    if (
                        Requests.isPending(
                            ride
                        )
                    ) {

                        rides.push(
                            ride
                        );
                    }
                }
            );


            rides.sort(
                function (
                    a,
                    b
                ) {

                    return (
                        Number(
                            b.createdAt ||
                            b.requestedAt ||
                            0
                        ) -
                        Number(
                            a.createdAt ||
                            a.requestedAt ||
                            0
                        )
                    );
                }
            );


            rides
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


    /* ========================================================
       PROCESS REQUEST SNAPSHOT
       ======================================================== */

    Requests.processRequestSnapshot =
        function (
            snapshot
        ) {

            const requests =
                [];


            snapshot.forEach(
                function (
                    child
                ) {

                    const request =
                        child.val();


                    if (
                        !request
                    ) {

                        return;
                    }


                    request.id =
                        request.id ||
                        child.key;


                    /*
                     * Accept only requests
                     * intended for this rider.
                     */

                    const targetRider =
                        request.riderId ||
                        request.assignedRiderId ||
                        request.driverId;


                    if (
                        targetRider &&
                        targetRider !==
                        Requests.state.riderId
                    ) {

                        return;
                    }


                    if (
                        Requests.isPending(
                            request
                        )
                    ) {

                        requests.push(
                            request
                        );
                    }
                }
            );


            requests.forEach(
                function (
                    request
                ) {

                    Requests.add(
                        request
                    );
                }
            );


            Requests.render();
        };


    /* ========================================================
       PENDING CHECK
       ======================================================== */

    Requests.isPending =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return false;
            }


            const status =
                String(
                    ride.status ||
                    ride.rideStatus ||
                    "pending"
                )
                .toLowerCase();


            const pendingStatuses =
                [

                    "pending",
                    "requested",
                    "searching",
                    "finding_rider",
                    "waiting_for_rider",
                    "new",
                    "request"

                ];


            if (
                !pendingStatuses.includes(
                    status
                )
            ) {

                return false;
            }


            /*
             * Don't show cancelled rides.
             */

            if (
                ride.cancelled ===
                true
            ) {

                return false;
            }


            /*
             * Don't show rides already
             * accepted by another rider.
             */

            if (
                ride.riderId &&
                ride.riderId !==
                Requests.state.riderId
            ) {

                return false;
            }


            /*
             * Expiry.
             */

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


    /* ========================================================
       EXPIRY
       ======================================================== */

    Requests.isExpired =
        function (
            ride
        ) {

            const created =
                Number(
                    ride.requestedAt ||
                    ride.createdAt ||
                    ride.timestamp ||
                    Date.now()
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
                Number(
                    ride.requestedAt ||
                    ride.createdAt ||
                    Date.now()
                );


            const timeout =
                Number(
                    ride.requestTimeout ||
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


    /* ========================================================
       ADD REQUEST
       ======================================================== */

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


            const existingIndex =
                Requests.state.active
                    .findIndex(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                ride.id
                            );
                        }
                    );


            if (
                existingIndex >=
                0
            ) {

                Requests.state.active[
                    existingIndex
                ] =
                    {

                        ...Requests.state.active[
                            existingIndex
                        ],

                        ...ride
                    };

            } else {

                Requests.state.active.push(
                    ride
                );
            }


            Requests.saveLocal();


            Requests.startTimer(
                ride
            );


            Requests.emit(
                "new",
                {

                    ride:
                        ride
                }
            );


            Requests.render();


            return true;
        };


    /* ========================================================
       REMOVE
       ======================================================== */

    Requests.remove =
        function (
            rideId
        ) {

            if (
                !rideId
            ) {

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


    /* ========================================================
       GET REQUEST
       ======================================================== */

    Requests.get =
        function (
            rideId
        ) {

            return Requests.state.active
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
                null;
        };


    /* ========================================================
       ACCEPT
       ======================================================== */

    Requests.accept =
        async function (
            rideId
        ) {

            const riderId =
                Requests.state.riderId ||
                Requests.getRiderId();


            if (
                !riderId
            ) {

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


            if (
                !ride
            ) {

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


                if (
                    !accepted
                ) {

                    throw new Error(
                        "Ride was already accepted by another rider."
                    );
                }


                /*
                 * Update local request.
                 */

                ride.riderId =
                    riderId;


                ride.driverId =
                    riderId;


                ride.status =
                    "accepted";


                ride.rideStatus =
                    "accepted";


                ride.acceptedAt =
                    Date.now();


                Requests.state.currentRide =
                    ride;


                Requests.remove(
                    rideId
                );


                Requests.stop();


                /*
                 * Update rider status.
                 */

                await Requests.setRiderBusy(
                    riderId
                );


                /*
                 * Customer notification.
                 */

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


                /*
                 * Redirect rider to
                 * ride details/trip page.
                 */

                Requests.redirectAfterAccept(
                    ride
                );


                return ride;

            } finally {

                Requests.state.accepting =
                    false;
            }
        };


    /* ========================================================
       ACCEPT REMOTE
       ======================================================== */

    Requests.acceptRemote =
        async function (
            ride,
            riderId
        ) {

            const database =
                Requests.getDatabase();


            if (
                database
            ) {

                try {

                    /*
                     * Transaction prevents
                     * two riders accepting
                     * the same ride.
                     */

                    const ref =
                        database
                            .ref(
                                Requests.config
                                    .rideCollection +
                                "/" +
                                ride.id
                            );


                    const result =
                        await ref.transaction(
                            function (
                                current
                            ) {

                                if (
                                    !current
                                ) {

                                    return current;
                                }


                                const status =
                                    String(
                                        current.status ||
                                        current.rideStatus ||
                                        "pending"
                                    )
                                    .toLowerCase();


                                const existingRider =
                                    current.riderId ||
                                    current.driverId;


                                const pending =
                                    [

                                        "pending",
                                        "requested",
                                        "searching",
                                        "finding_rider",
                                        "waiting_for_rider",
                                        "new",
                                        "request"

                                    ].includes(
                                        status
                                    );


                                if (
                                    !pending
                                ) {

                                    return;
                                }


                                if (
                                    existingRider &&
                                    existingRider !==
                                    riderId
                                ) {

                                    return;
                                }


                                current.riderId =
                                    riderId;


                                current.driverId =
                                    riderId;


                                current.status =
                                    "accepted";


                                current.rideStatus =
                                    "accepted";


                                current.acceptedAt =
                                    Date.now();


                                current.updatedAt =
                                    Date.now();


                                return current;
                            }
                        );


                    return Boolean(
                        result.committed
                    );

                } catch (error) {

                    console.error(
                        "Ride accept transaction failed:",
                        error
                    );


                    return false;
                }
            }


            /*
             * Firestore fallback.
             */

            const firestore =
                Requests.getFirestore();


            if (
                firestore
            ) {

                try {

                    const ref =
                        firestore
                            .collection(
                                Requests.config
                                    .rideCollection
                            )
                            .doc(
                                ride.id
                            );


                    const snapshot =
                        await ref.get();


                    if (
                        !snapshot.exists
                    ) {

                        return false;
                    }


                    const current =
                        snapshot.data();


                    const status =
                        String(
                            current.status ||
                            "pending"
                        )
                        .toLowerCase();


                    if (
                        ![
                            "pending",
                            "requested",
                            "searching"
                        ].includes(
                            status
                        )
                    ) {

                        return false;
                    }


                    await ref.update(
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


                    return true;

                } catch (error) {

                    console.error(
                        "Firestore ride accept failed:",
                        error
                    );


                    return false;
                }
            }


            return false;
        };


    /* ========================================================
       REJECT
       ======================================================== */

    Requests.reject =
        async function (
            rideId,
            reason
        ) {

            const ride =
                Requests.get(
                    rideId
                );


            if (
                !ride
            ) {

                return false;
            }


            reason =
                reason ||
                "rider_declined";


            const riderId =
                Requests.state.riderId ||
                Requests.getRiderId();


            /*
             * Remove from this rider's
             * local list immediately.
             */

            Requests.remove(
                rideId
            );


            const database =
                Requests.getDatabase();


            if (
                database
            ) {

                try {

                    /*
                     * Keep ride available for
                     * other riders.
                     */

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
                            {

                                reason:
                                    reason,

                                rejectedAt:
                                    Date.now()
                            }
                        );


                    await database
                        .ref(
                            Requests.config
                                .requestCollection +
                            "/" +
                            rideId +
                            "/" +
                            "rejectedRiders/" +
                            riderId
                        )
                        .set(
                            {

                                reason:
                                    reason,

                                rejectedAt:
                                    Date.now()
                            }
                        );


                    Requests.emit(
                        "rejected",
                        {

                            ride:
                                ride,

                            reason:
                                reason
                        }
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "Ride reject save failed:",
                        error
                    );
                }
            }


            Requests.emit(
                "rejected",
                {

                    ride:
                        ride,

                    reason:
                        reason
                }
            );


            return true;
        };


    /* ========================================================
       EXPIRE
       ======================================================== */

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


            if (
                !ride
            ) {

                return false;
            }


            const database =
                Requests.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Requests.config
                                .requestCollection +
                            "/" +
                            rideId +
                            "/expiredRiders/" +
                            Requests.state
                                .riderId
                        )
                        .set(
                            {

                                expiredAt:
                                    Date.now()
                            }
                        );

                } catch (error) {}
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


    /* ========================================================
       TIMER
       ======================================================== */

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


                        if (
                            !current
                        ) {

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

            if (
                Requests.state.timers[
                    rideId
                ]
            ) {

                clearInterval(
                    Requests.state.timers[
                        rideId
                    ]
                );


                delete Requests.state.timers[
                    rideId
                ];
            }
        };


    /* ========================================================
       COUNTDOWN
       ======================================================== */

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
                    `[data-request-countdown="${rideId}"]`
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


    /* ========================================================
       RIDER BUSY STATUS
       ======================================================== */

    Requests.setRiderBusy =
        async function (
            riderId
        ) {

            const database =
                Requests.getDatabase();


            if (
                !database ||
                !riderId
            ) {

                return false;
            }


            try {

                await database
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
                    "Rider busy update failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       CUSTOMER NOTIFICATION
       ======================================================== */

    Requests.notifyCustomer =
        async function (
            ride,
            status
        ) {

            if (
                !ride
            ) {

                return false;
            }


            const customerId =
                ride.customerId ||
                ride.userId ||
                ride.customerUid;


            if (
                !customerId
            ) {

                return false;
            }


            const database =
                Requests.getDatabase();


            if (
                !database
            ) {

                return false;
            }


            const riderId =
                Requests.state.riderId;


            try {

                /*
                 * Ride status itself is
                 * the primary customer
                 * notification mechanism.
                 */

                await database
                    .ref(
                        Requests.config
                            .rideCollection +
                        "/" +
                        ride.id
                    )
                    .update(
                        {

                            customerStatus:
                                status,

                            riderId:
                                riderId,

                            driverId:
                                riderId,

                            updatedAt:
                                Date.now()
                        }
                    );


                /*
                 * Rider notification record.
                 */

                const notificationId =
                    "ride_" +
                    ride.id +
                    "_" +
                    status +
                    "_" +
                    Date.now();


                await database
                    .ref(
                        "notifications/" +
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
                                    : "Your ride status has been updated.",

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


    /* ========================================================
       REDIRECT AFTER ACCEPT
       ======================================================== */

    Requests.redirectAfterAccept =
        function (
            ride
        ) {

            /*
             * Existing RiderX pages.
             */

            const candidates =
                [

                    "ride-details.html",
                    "trip.html",
                    "live.html",
                    "rides.html"

                ];


            /*
             * If already inside rider folder,
             * use the first existing page.
             */

            const currentPath =
                window.location.pathname;


            const isRiderFolder =
                currentPath
                    .toLowerCase()
                    .includes(
                        "/rider/"
                    );


            if (
                isRiderFolder
            ) {

                const url =
                    "ride-details.html" +
                    "?rideId=" +
                    encodeURIComponent(
                        ride.id
                    );


                /*
                 * Do not force navigation if
                 * ride-details doesn't exist.
                 * Current project contains it.
                 */

                setTimeout(
                    function () {

                        window.location.href =
                            url;

                    },
                    300
                );


                return;
            }


            /*
             * JS-only flow.
             */

            Requests.emit(
                "navigate",
                {

                    ride:
                        ride,

                    pages:
                        candidates
                }
            );
        };


    /* ========================================================
       RENDER REQUESTS
       ======================================================== */

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
                                        Number(
                                            b.createdAt ||
                                            b.requestedAt ||
                                            0
                                        ) -
                                        Number(
                                            a.createdAt ||
                                            a.requestedAt ||
                                            0
                                        )
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


                    active.forEach(
                        function (
                            ride
                        ) {

                            container.appendChild(
                                Requests.createCard(
                                    ride
                                );
                        }
                    );
                }
            );
        };


    /* ========================================================
       CREATE CARD
       ======================================================== */

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


            card.innerHTML =
                `

                <div class="ride-request-header">

                    <div class="ride-request-service">
                        ${Requests.escape(
                            service
                        )}
                    </div>

                    <div
                        class="ride-request-time"
                        data-request-countdown="${Requests.escape(
                            ride.id
                        )}"
                    >
                        ${Math.ceil(
                            remaining /
                            1000
                        )}s
                    </div>

                </div>


                <div class="ride-request-route">

                    <div class="route-point pickup">

                        <span class="route-dot"></span>

                        <div>

                            <small>Pickup</small>

                            <strong>
                                ${Requests.escape(
                                    pickup
                                )}
                            </strong>

                        </div>

                    </div>


                    <div class="route-line"></div>


                    <div class="route-point destination">

                        <span class="route-dot"></span>

                        <div>

                            <small>Drop-off</small>

                            <strong>
                                ${Requests.escape(
                                    destination
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="ride-request-meta">

                    <div>

                        <small>Fare</small>

                        <strong>
                            ₹${fare.toFixed(0)}
                        </strong>

                    </div>


                    <div>

                        <small>Distance</small>

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
                        data-request-reject="${Requests.escape(
                            ride.id
                        )}"
                    >
                        Reject
                    </button>


                    <button
                        type="button"
                        class="ride-request-accept"
                        data-request-accept="${Requests.escape(
                            ride.id
                        )}"
                    >
                        Accept
                    </button>

                </div>

                `;


            return card;
        };


    /* ========================================================
       BUTTON EVENTS
       ======================================================== */

    Requests.bindButtons =
        function () {

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const accept =
                        event.target.closest(
                            "[data-request-accept]"
                        );


                    if (
                        accept
                    ) {

                        event.preventDefault();


                        const rideId =
                            accept.dataset
                                .requestAccept;


                        if (
                            accept.disabled
                        ) {

                            return;
                        }


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


                    if (
                        reject
                    ) {

                        event.preventDefault();


                        const rideId =
                            reject.dataset
                                .requestReject;


                        try {

                            await Requests.reject(
                                rideId
                            );

                        } catch (error) {

                            Requests.showMessage(
                                "Unable to reject request.",
                                "error"
                            );
                        }
                    }
                }
            );
        };


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    Requests.loadLocal =
        function () {

            try {

                const raw =
                    localStorage.getItem(
                        Requests.config
                            .storageKey
                    );


                if (
                    raw
                ) {

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
                            data;
                    }
                }

            } catch (error) {

                Requests.state.active =
                    [];
            }


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

            } catch (error) {}
        };


    /* ========================================================
       FIRESTORE FALLBACK
       ======================================================== */

    Requests.listenFirestore =
        function () {

            const firestore =
                Requests.getFirestore();


            const riderId =
                Requests.state.riderId;


            if (
                !firestore ||
                !riderId
            ) {

                return false;
            }


            try {

                const query =
                    firestore
                        .collection(
                            Requests.config
                                .rideCollection
                        )
                        .where(
                            "riderId",
                            "==",
                            riderId
                        );


                Requests.state.firestoreUnsubscribe =
                    query.onSnapshot(
                        function (
                            snapshot
                        ) {

                            snapshot.forEach(
                                function (
                                    doc
                                ) {

                                    const ride =
                                        doc.data();


                                    ride.id =
                                        doc.id;


                                    if (
                                        Requests
                                            .isPending(
                                                ride
                                            )
                                    ) {

                                        Requests.add(
                                            ride
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
                                "Firestore request listener failed:",
                                error
                            );
                        }
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Firestore listener failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       ESCAPE HTML
       ======================================================== */

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


    /* ========================================================
       MESSAGE
       ======================================================== */

    Requests.showMessage =
        function (
            message,
            type
        ) {

            const target =
                document.querySelector(
                    "[data-request-message]"
                );


            if (
                target
            ) {

                target.textContent =
                    message;


                target.dataset.type =
                    type ||
                    "info";


                target.classList.add(
                    "show"
                );


                setTimeout(
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


    /* ========================================================
       EVENTS
       ======================================================== */

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


    /* ========================================================
       PUBLIC API
       ======================================================== */

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


    /* ========================================================
       INIT
       ======================================================== */

    Requests.init =
        function () {

            if (
                Requests.state.initialized
            ) {

                return;
            }


            Requests.state.initialized =
                true;


            Requests.state.riderId =
                Requests.getRiderId();


            Requests.bindButtons();


            Requests.loadLocal();


            /*
             * Start only on rider pages.
             */

            if (
                Requests.isRider()
            ) {

                Requests.start();
            }


            console.log(
                "RiderX requests.js loaded."
            );
        };


    /* ========================================================
       VISIBILITY HANDLING
       ======================================================== */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState ===
                "visible"
            ) {

                if (
                    Requests.isRider() &&
                    !Requests.state.listening
                ) {

                    Requests.start();
                }
            }
        }
    );


    /* ========================================================
       PAGE INIT
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Requests.init
        );

    } else {

        Requests.init();

    }

})();
