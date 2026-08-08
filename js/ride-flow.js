/* ============================================================
   RIDERX RIDE FLOW ENGINE
   File: js/ride-flow.js

   Complete Uber-style ride lifecycle controller.

   CUSTOMER:
   booking
      ↓
   searching
      ↓
   driver assigned
      ↓
   driver arriving
      ↓
   driver arrived
      ↓
   OTP
      ↓
   trip started
      ↓
   live trip
      ↓
   completed
      ↓
   payment
      ↓
   rating

   RIDER:
   request
      ↓
   accept
      ↓
   navigation to pickup
      ↓
   arrived
      ↓
   OTP verification
      ↓
   start trip
      ↓
   complete trip
      ↓
   payment
      ↓
   next ride
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Flow =
        RX.rideFlow =
        RX.rideFlow || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Flow.config = {

        ridePath:
            "rides",

        tripPath:
            "trips",

        requestPath:
            "rideRequests",

        activeRideKey:
            "riderx_active_ride",

        activeTripKey:
            "riderx_active_trip",

        roleKey:
            "riderx_role",

        timeout:
            30000,

        retryDelay:
            2000,

        maxRetries:
            3
    };


    /* ========================================================
       FLOW STATES
       ======================================================== */

    Flow.states = {

        IDLE:
            "idle",

        BOOKING:
            "booking",

        SEARCHING:
            "searching",

        ACCEPTED:
            "accepted",

        DRIVER_ARRIVING:
            "driver_arriving",

        DRIVER_ARRIVED:
            "driver_arrived",

        OTP_PENDING:
            "otp_pending",

        OTP_VERIFIED:
            "otp_verified",

        STARTED:
            "trip_started",

        IN_PROGRESS:
            "in_progress",

        COMPLETING:
            "completing",

        COMPLETED:
            "completed",

        PAYMENT_PENDING:
            "payment_pending",

        PAYMENT_COMPLETED:
            "payment_completed",

        RATING:
            "rating",

        CANCELLED:
            "cancelled",

        NO_DRIVER:
            "no_driver",

        ERROR:
            "error"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Flow.state = {

        initialized:
            false,

        role:
            null,

        rideId:
            null,

        tripId:
            null,

        customerId:
            null,

        riderId:
            null,

        status:
            Flow.states.IDLE,

        service:
            "bike",

        paymentMethod:
            "cash",

        pickup:
            null,

        destination:
            null,

        fare:
            null,

        distanceKm:
            0,

        durationMinutes:
            0,

        rider:
            null,

        customer:
            null,

        ride:
            null,

        trip:
            null,

        createdAt:
            null,

        acceptedAt:
            null,

        startedAt:
            null,

        completedAt:
            null,

        cancelledAt:
            null,

        error:
            null,

        listeners:
            [],

        initializedRide:
            false
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Flow.getDatabase =
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


    Flow.getAuth =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth;

                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth();

                }

            } catch (error) {}


            return null;
        };


    Flow.getCurrentUser =
        function () {

            const auth =
                Flow.getAuth();


            try {

                if (
                    auth &&
                    auth.currentUser
                ) {

                    return auth.currentUser;

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


    Flow.getUserId =
        function () {

            const user =
                Flow.getCurrentUser();


            return (
                user?.uid ||
                user?.id ||
                user?.userId ||
                localStorage.getItem(
                    "riderx_uid"
                ) ||
                null
            );
        };


    /* ========================================================
       ROLE
       ======================================================== */

    Flow.getRole =
        function () {

            if (
                Flow.state.role
            ) {

                return Flow.state.role;

            }


            const user =
                Flow.getCurrentUser();


            const role =
                user?.role ||
                localStorage.getItem(
                    Flow.config.roleKey
                );


            if (
                role
            ) {

                Flow.state.role =
                    String(
                        role
                    ).toLowerCase();

            }


            return (
                Flow.state.role ||
                null
            );
        };


    Flow.setRole =
        function (
            role
        ) {

            role =
                String(
                    role ||
                    ""
                )
                .toLowerCase()
                .trim();


            if (
                ![
                    "customer",
                    "rider",
                    "driver",
                    "admin"
                ].includes(
                    role
                )
            ) {

                return false;
            }


            if (
                role ===
                "driver"
            ) {

                role =
                    "rider";
            }


            Flow.state.role =
                role;


            localStorage.setItem(
                Flow.config.roleKey,
                role
            );


            return true;
        };


    /* ========================================================
       UTILITIES
       ======================================================== */

    Flow.now =
        function () {

            return Date.now();

        };


    Flow.generateId =
        function (
            prefix
        ) {

            return (
                String(
                    prefix ||
                    "ride"
                ) +
                "_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(
                        2,
                        9
                    )
            );
        };


    Flow.normalizeStatus =
        function (
            status
        ) {

            status =
                String(
                    status ||
                    ""
                )
                .toLowerCase()
                .trim();


            const map = {

                "driver arriving":
                    Flow.states
                        .DRIVER_ARRIVING,

                "arriving":
                    Flow.states
                        .DRIVER_ARRIVING,

                "driver arrived":
                    Flow.states
                        .DRIVER_ARRIVED,

                "arrived":
                    Flow.states
                        .DRIVER_ARRIVED,

                "otp":
                    Flow.states
                        .OTP_PENDING,

                "otp pending":
                    Flow.states
                        .OTP_PENDING,

                "otp verified":
                    Flow.states
                        .OTP_VERIFIED,

                "started":
                    Flow.states
                        .STARTED,

                "in progress":
                    Flow.states
                        .IN_PROGRESS,

                "complete":
                    Flow.states
                        .COMPLETED,

                "cancel":
                    Flow.states
                        .CANCELLED
            };


            return (
                map[status] ||
                status ||
                Flow.states.IDLE
            );
        };


    /* ========================================================
       SAVE ACTIVE RIDE
       ======================================================== */

    Flow.saveActiveRide =
        function () {

            if (
                Flow.state.rideId
            ) {

                localStorage.setItem(
                    Flow.config.activeRideKey,
                    Flow.state.rideId
                );

            }


            if (
                Flow.state.tripId
            ) {

                localStorage.setItem(
                    Flow.config.activeTripKey,
                    Flow.state.tripId
                );

            }
        };


    Flow.clearActiveRide =
        function () {

            localStorage.removeItem(
                Flow.config.activeRideKey
            );

            localStorage.removeItem(
                Flow.config.activeTripKey
            );
        };


    /* ========================================================
       SET STATE
       ======================================================== */

    Flow.setState =
        function (
            updates
        ) {

            if (
                !updates
            ) {

                return Flow.state;
            }


            Object.assign(
                Flow.state,
                updates
            );


            if (
                Flow.state.status
            ) {

                Flow.state.status =
                    Flow.normalizeStatus(
                        Flow.state.status
                    );

            }


            Flow.saveActiveRide();


            Flow.emit(
                "state",
                {

                    state:
                        Flow.getState()
                }
            );


            Flow.updateUI();


            return Flow.state;
        };


    Flow.getState =
        function () {

            return {
                ...Flow.state
            };
        };


    /* ========================================================
       FIREBASE RIDE UPDATE
       ======================================================== */

    Flow.updateFirebaseRide =
        async function (
            updates
        ) {

            const database =
                Flow.getDatabase();


            const rideId =
                Flow.state.rideId;


            if (
                !database ||
                !rideId
            ) {

                return false;
            }


            try {

                await database
                    .ref(
                        Flow.config
                            .ridePath +
                        "/" +
                        rideId
                    )
                    .update(
                        {

                            ...updates,

                            updatedAt:
                                Flow.now()
                        }
                    );


                return true;

            } catch (error) {

                console.warn(
                    "RiderX ride update failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       CREATE RIDE
       ======================================================== */

    Flow.createRide =
        async function (
            options
        ) {

            options =
                options || {};


            Flow.setRole(
                "customer"
            );


            const customerId =
                options.customerId ||
                options.userId ||
                Flow.getUserId();


            if (
                !customerId
            ) {

                throw new Error(
                    "Customer login required."
                );
            }


            const rideId =
                options.rideId ||
                Flow.generateId(
                    "ride"
                );


            const tripId =
                options.tripId ||
                Flow.generateId(
                    "trip"
                );


            const ride = {

                rideId:
                    rideId,

                tripId:
                    tripId,

                customerId:
                    customerId,

                riderId:
                    null,

                status:
                    Flow.states.SEARCHING,

                service:
                    options.service ||
                    options.serviceType ||
                    "bike",

                paymentMethod:
                    options.paymentMethod ||
                    "cash",

                pickup:
                    options.pickup ||
                    null,

                destination:
                    options.destination ||
                    options.dropoff ||
                    null,

                pickupAddress:
                    options.pickupAddress ||
                    "",

                destinationAddress:
                    options.destinationAddress ||
                    options.dropoffAddress ||
                    "",

                fare:
                    options.fare ||
                    null,

                distanceKm:
                    Number(
                        options.distanceKm ||
                        0
                    ),

                durationMinutes:
                    Number(
                        options.durationMinutes ||
                        0
                    ),

                createdAt:
                    Flow.now(),

                updatedAt:
                    Flow.now()
            };


            Flow.setState(
                {

                    role:
                        "customer",

                    rideId:
                        rideId,

                    tripId:
                        tripId,

                    customerId:
                        customerId,

                    riderId:
                        null,

                    status:
                        Flow.states.SEARCHING,

                    service:
                        ride.service,

                    paymentMethod:
                        ride.paymentMethod,

                    pickup:
                        ride.pickup,

                    destination:
                        ride.destination,

                    fare:
                        ride.fare,

                    distanceKm:
                        ride.distanceKm,

                    durationMinutes:
                        ride.durationMinutes,

                    ride:
                        ride,

                    trip:
                        null,

                    createdAt:
                        ride.createdAt,

                    error:
                        null,

                    initializedRide:
                        true
                }
            );


            const database =
                Flow.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Flow.config
                                .ridePath +
                            "/" +
                            rideId
                        )
                        .set(
                            ride
                        );


                    await database
                        .ref(
                            Flow.config
                                .tripPath +
                            "/" +
                            tripId
                        )
                        .set(
                            {

                                tripId:
                                    tripId,

                                rideId:
                                    rideId,

                                customerId:
                                    customerId,

                                status:
                                    Flow.states
                                        .SEARCHING,

                                service:
                                    ride.service,

                                paymentMethod:
                                    ride.paymentMethod,

                                pickup:
                                    ride.pickup,

                                destination:
                                    ride.destination,

                                createdAt:
                                    ride.createdAt,

                                updatedAt:
                                    ride.updatedAt
                            }
                        );


                    await database
                        .ref(
                            Flow.config
                                .requestPath +
                            "/" +
                            rideId
                        )
                        .set(
                            {

                                rideId:
                                    rideId,

                                tripId:
                                    tripId,

                                customerId:
                                    customerId,

                                service:
                                    ride.service,

                                pickup:
                                    ride.pickup,

                                destination:
                                    ride.destination,

                                status:
                                    Flow.states
                                        .SEARCHING,

                                createdAt:
                                    ride.createdAt,

                                updatedAt:
                                    ride.updatedAt
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Ride creation Firebase error:",
                        error
                    );

                    Flow.setState(
                        {

                            error:
                                error.message
                        }
                    );
                }
            }


            Flow.emit(
                "created",
                {

                    ride:
                        ride
                }
            );


            Flow.startListening(
                rideId
            );


            Flow.startMatching();


            return ride;
        };


    /* ========================================================
       START MATCHING
       ======================================================== */

    Flow.startMatching =
        async function () {

            Flow.setState(
                {

                    status:
                        Flow.states.SEARCHING
                }
            );


            Flow.emit(
                "searching",
                {

                    rideId:
                        Flow.state.rideId
                }
            );


            /*
             * Use matching.js if available.
             */

            try {

                if (
                    RX.matching
                ) {

                    if (
                        typeof RX.matching.start ===
                        "function"
                    ) {

                        await RX.matching.start(
                            Flow.getState()
                        );

                    } else if (
                        typeof RX.matching.findDriver ===
                        "function"
                    ) {

                        await RX.matching.findDriver(
                            Flow.getState()
                        );

                    }

                }

            } catch (error) {

                console.warn(
                    "Matching module error:",
                    error
                );
            }


            return true;
        };


    /* ========================================================
       RIDER ACCEPT
       ======================================================== */

    Flow.acceptRide =
        async function (
            options
        ) {

            options =
                options || {};


            Flow.setRole(
                "rider"
            );


            const riderId =
                options.riderId ||
                options.driverId ||
                options.uid ||
                Flow.getUserId();


            if (
                !riderId
            ) {

                throw new Error(
                    "Rider login required."
                );
            }


            if (
                !Flow.state.rideId &&
                options.rideId
            ) {

                Flow.state.rideId =
                    options.rideId;

            }


            if (
                !Flow.state.rideId
            ) {

                throw new Error(
                    "Ride ID is required."
                );
            }


            const acceptedAt =
                Flow.now();


            const rider = {

                riderId:
                    riderId,

                driverId:
                    riderId,

                name:
                    options.name ||
                    options.riderName ||
                    "",

                phone:
                    options.phone ||
                    "",

                photo:
                    options.photo ||
                    "",

                vehicle:
                    options.vehicle ||
                    null,

                rating:
                    options.rating ||
                    0
            };


            Flow.setState(
                {

                    role:
                        "rider",

                    riderId:
                        riderId,

                    rider:
                        rider,

                    status:
                        Flow.states.ACCEPTED,

                    acceptedAt:
                        acceptedAt
                }
            );


            const updates = {

                riderId:
                    riderId,

                driverId:
                    riderId,

                rider:
                    rider,

                status:
                    Flow.states.ACCEPTED,

                acceptedAt:
                    acceptedAt,

                updatedAt:
                    Flow.now()
            };


            await Flow.updateFirebaseRide(
                updates
            );


            /*
             * Update trip if available.
             */

            const database =
                Flow.getDatabase();


            if (
                database &&
                Flow.state.tripId
            ) {

                try {

                    await database
                        .ref(
                            Flow.config
                                .tripPath +
                            "/" +
                            Flow.state.tripId
                        )
                        .update(
                            updates
                        );

                } catch (error) {}
            }


            Flow.emit(
                "accepted",
                {

                    rideId:
                        Flow.state.rideId,

                    rider:
                        rider
                }
            );


            Flow.beginDriverArrival();


            return true;
        };


    /* ========================================================
       DRIVER ARRIVAL
       ======================================================== */

    Flow.beginDriverArrival =
        async function () {

            Flow.setState(
                {

                    status:
                        Flow.states
                            .DRIVER_ARRIVING
                }
            );


            await Flow.updateFirebaseRide(
                {

                    status:
                        Flow.states
                            .DRIVER_ARRIVING,

                    driverArrivingAt:
                        Flow.now()
                }
            );


            Flow.emit(
                "driver-arriving",
                {

                    rideId:
                        Flow.state.rideId
                }
            );


            return true;
        };


    /* ========================================================
       DRIVER ARRIVED
       ======================================================== */

    Flow.driverArrived =
        async function () {

            Flow.setState(
                {

                    status:
                        Flow.states
                            .DRIVER_ARRIVED
                }
            );


            await Flow.updateFirebaseRide(
                {

                    status:
                        Flow.states
                            .DRIVER_ARRIVED,

                    arrivedAt:
                        Flow.now()
                }
            );


            /*
             * Ask trip.js to generate OTP.
             */

            try {

                if (
                    RX.trip &&
                    typeof RX.trip.driverArrived ===
                    "function"
                ) {

                    await RX.trip.driverArrived();

                } else if (
                    RX.trip &&
                    typeof RX.trip.generateOTP ===
                    "function"
                ) {

                    await RX.trip.generateOTP();

                }

            } catch (error) {}


            Flow.setState(
                {

                    status:
                        Flow.states
                            .OTP_PENDING
                }
            );


            Flow.emit(
                "driver-arrived",
                {

                    rideId:
                        Flow.state.rideId
                }
            );


            return true;
        };


    /* ========================================================
       OTP VERIFY
       ======================================================== */

    Flow.verifyOTP =
        async function (
            otp
        ) {

            otp =
                String(
                    otp ||
                    ""
                )
                .replace(
                    /\D/g,
                    ""
                );


            /*
             * Prefer trip.js.
             */

            if (
                RX.trip &&
                typeof RX.trip.verifyOTP ===
                "function"
            ) {

                const result =
                    await RX.trip.verifyOTP(
                        otp
                    );


                if (
                    result?.success
                ) {

                    Flow.setState(
                        {

                            status:
                                Flow.states
                                    .OTP_VERIFIED
                        }
                    );


                    await Flow.updateFirebaseRide(
                        {

                            status:
                                Flow.states
                                    .OTP_VERIFIED,

                            otpVerified:
                                true,

                            otpVerifiedAt:
                                Flow.now()
                        }
                    );


                    Flow.emit(
                        "otp-verified",
                        {

                            success:
                                true
                        }
                    );

                }


                return result;
            }


            return {

                success:
                    false,

                error:
                    "OTP service unavailable."
            };
        };


    /* ========================================================
       START TRIP
       ======================================================== */

    Flow.startTrip =
        async function (
            options
        ) {

            options =
                options || {};


            /*
             * Prefer trip.js.
             */

            if (
                RX.trip &&
                typeof RX.trip.start ===
                "function"
            ) {

                const result =
                    await RX.trip.start(
                        options
                    );


                if (
                    result?.success
                ) {

                    Flow.setState(
                        {

                            status:
                                Flow.states
                                    .STARTED,

                            startedAt:
                                Flow.now()
                        }
                    );

                    await Flow.updateFirebaseRide(
                        {

                            status:
                                Flow.states
                                    .STARTED,

                            startedAt:
                                Flow.now(),

                            tripStartedAt:
                                Flow.now(),

                            otpVerified:
                                true
                        }
                    );


                    Flow.emit(
                        "started",
                        {

                            rideId:
                                Flow.state
                                    .rideId
                        }
                    );

                }


                return result;
            }


            /*
             * Fallback.
             */

            Flow.setState(
                {

                    status:
                        Flow.states.STARTED,

                    startedAt:
                        Flow.now()
                }
            );


            await Flow.updateFirebaseRide(
                {

                    status:
                        Flow.states.STARTED,

                    startedAt:
                        Flow.now()
                }
            );


            return {

                success:
                    true
            };
        };


    /* ========================================================
       LIVE TRIP
       ======================================================== */

    Flow.startLiveTrip =
        async function () {

            Flow.setState(
                {

                    status:
                        Flow.states.IN_PROGRESS
                }
            );


            await Flow.updateFirebaseRide(
                {

                    status:
                        Flow.states.IN_PROGRESS
                }
            );


            Flow.emit(
                "in-progress",
                {

                    rideId:
                        Flow.state.rideId
                }
            );


            /*
             * Start tracking module.
             */

            try {

                if (
                    RX.tracking
                ) {

                    if (
                        typeof RX.tracking.start ===
                        "function"
                    ) {

                        RX.tracking.start(
                            Flow.state
                        );

                    } else if (
                        typeof RX.tracking.startTracking ===
                        "function"
                    ) {

                        RX.tracking.startTracking(
                            Flow.state
                        );

                    }

                }

            } catch (error) {

                console.warn(
                    "Tracking module error:",
                    error
                );
            }


            return true;
        };


    /* ========================================================
       UPDATE DISTANCE
       ======================================================== */

    Flow.updateDistance =
        async function (
            distanceKm
        ) {

            distanceKm =
                Number(
                    distanceKm
                );


            if (
                !Number.isFinite(
                    distanceKm
                )
            ) {

                return false;
            }


            Flow.state.distanceKm =
                Math.max(
                    0,
                    distanceKm
                );


            await Flow.updateFirebaseRide(
                {

                    distanceKm:
                        Flow.state
                            .distanceKm
                }
            );


            try {

                if (
                    RX.trip &&
                    typeof RX.trip.updateDistance ===
                    "function"
                ) {

                    await RX.trip.updateDistance(
                        Flow.state.distanceKm
                    );

                }

            } catch (error) {}


            Flow.emit(
                "distance",
                {

                    distanceKm:
                        Flow.state
                            .distanceKm
                }
            );


            return true;
        };


    /* ========================================================
       UPDATE DURATION
       ======================================================== */

    Flow.updateDuration =
        async function (
            minutes
        ) {

            minutes =
                Number(
                    minutes
                );


            if (
                !Number.isFinite(
                    minutes
                )
            ) {

                return false;
            }


            Flow.state.durationMinutes =
                Math.max(
                    0,
                    minutes
                );


            await Flow.updateFirebaseRide(
                {

                    durationMinutes:
                        Flow.state
                            .durationMinutes
                }
            );


            try {

                if (
                    RX.trip &&
                    typeof RX.trip.updateDuration ===
                    "function"
                ) {

                    await RX.trip.updateDuration(
                        Flow.state
                            .durationMinutes
                    );

                }

            } catch (error) {}


            return true;
        };


    /* ========================================================
       COMPLETE RIDE
       ======================================================== */

    Flow.completeRide =
        async function (
            options
        ) {

            options =
                options || {};


            Flow.setState(
                {

                    status:
                        Flow.states.COMPLETING
                }
            );


            /*
             * Stop tracking.
             */

            try {

                if (
                    RX.tracking
                ) {

                    if (
                        typeof RX.tracking.stop ===
                        "function"
                    ) {

                        RX.tracking.stop();

                    } else if (
                        typeof RX.tracking.stopTracking ===
                        "function"
                    ) {

                        RX.tracking.stopTracking();

                    }

                }

            } catch (error) {}


            let result =
                null;


            /*
             * Use trip.js.
             */

            if (
                RX.trip &&
                typeof RX.trip.complete ===
                "function"
            ) {

                result =
                    await RX.trip.complete(
                        {

                            ...options,

                            distanceKm:
                                options.distanceKm ??
                                Flow.state
                                    .distanceKm,

                            durationMinutes:
                                options
                                    .durationMinutes ??
                                Flow.state
                                    .durationMinutes
                        }
                    );

            }


            /*
             * Fallback completion.
             */

            if (
                !result?.success
            ) {

                const completedAt =
                    Flow.now();


                Flow.setState(
                    {

                        status:
                            Flow.states
                                .COMPLETED,

                        completedAt:
                            completedAt,

                        fare:
                            options.fare ??
                            Flow.state.fare
                    }
                );


                await Flow.updateFirebaseRide(
                    {

                        status:
                            Flow.states
                                .COMPLETED,

                        completedAt:
                            completedAt,

                        distanceKm:
                            Flow.state
                                .distanceKm,

                        durationMinutes:
                            Flow.state
                                .durationMinutes,

                        fare:
                            Flow.state.fare
                    }
                );


                result = {

                    success:
                        true,

                    completion:
                        {

                            completedAt:
                                completedAt,

                            fare:
                                Flow.state
                                    .fare
                        }
                };

            } else {

                Flow.setState(
                    {

                        status:
                            Flow.states
                                .COMPLETED,

                        completedAt:
                            Flow.now(),

                        fare:
                            result
                                .completion
                                ?.fare ??
                            Flow.state.fare
                    }
                );

            }


            Flow.emit(
                "completed",
                {

                    result:
                        result
                }
            );


            /*
             * Payment stage.
             */

            if (
                Flow.state.paymentMethod ===
                "cash"
            ) {

                Flow.setState(
                    {

                        status:
                            Flow.states
                                .PAYMENT_PENDING
                    }
                );

            } else {

                Flow.setState(
                    {

                        status:
                            Flow.states
                                .PAYMENT_PENDING
                    }
                );

            }


            return result;
        };


    /* ========================================================
       PAYMENT
       ======================================================== */

    Flow.setPaymentMethod =
        async function (
            method
        ) {

            method =
                String(
                    method ||
                    "cash"
                )
                .toLowerCase();


            const allowed = [
                "cash",
                "online",
                "upi",
                "wallet",
                "card"
            ];


            if (
                !allowed.includes(
                    method
                )
            ) {

                method =
                    "cash";
            }


            Flow.state.paymentMethod =
                method;


            await Flow.updateFirebaseRide(
                {

                    paymentMethod:
                        method
                }
            );


            return method;
        };


    Flow.completePayment =
        async function (
            paymentData
        ) {

            paymentData =
                paymentData || {};


            await Flow.updateFirebaseRide(
                {

                    status:
                        Flow.states
                            .PAYMENT_COMPLETED,

                    paymentStatus:
                        "paid",

                    payment:
                        paymentData,

                    paidAt:
                        Flow.now()
                }
            );


            Flow.setState(
                {

                    status:
                        Flow.states
                            .PAYMENT_COMPLETED
                }
            );


            Flow.emit(
                "payment-completed",
                {

                    payment:
                        paymentData
                }
            );


            /*
             * Move to rating.
             */

            Flow.setState(
                {

                    status:
                        Flow.states.RATING
                }
            );


            Flow.emit(
                "rating-required",
                {

                    rideId:
                        Flow.state.rideId
                }
            );


            return true;
        };


    /* ========================================================
       CANCEL
       ======================================================== */

    Flow.cancelRide =
        async function (
            reason,
            options
        ) {

            options =
                options || {};


            reason =
                reason ||
                "Cancelled by user";


            if (
                Flow.state.status ===
                Flow.states.COMPLETED
            ) {

                return {

                    success:
                        false,

                    error:
                        "Completed ride cannot be cancelled."
                };
            }


            let result =
                null;


            /*
             * Use trip.js cancellation.
             */

            if (
                RX.trip &&
                typeof RX.trip.cancel ===
                "function"
            ) {

                result =
                    await RX.trip.cancel(
                        reason,
                        {

                            ...options,

                            cancelledBy:
                                options.cancelledBy ||
                                Flow.getRole()
                        }
                    );

            }


            if (
                !result?.success
            ) {

                Flow.setState(
                    {

                        status:
                            Flow.states
                                .CANCELLED,

                        cancelledAt:
                            Flow.now(),

                        error:
                            null
                    }
                );


                await Flow.updateFirebaseRide(
                    {

                        status:
                            Flow.states
                                .CANCELLED,

                        cancellationReason:
                            reason,

                        cancelledBy:
                            options.cancelledBy ||
                            Flow.getRole() ||
                            "user",

                        cancelledAt:
                            Flow.now()
                    }
                );


                result = {

                    success:
                        true
                };

            } else {

                Flow.setState(
                    {

                        status:
                            Flow.states
                                .CANCELLED,

                        cancelledAt:
                            Flow.now()
                    }
                );

            }


            /*
             * Stop tracking.
             */

            try {

                if (
                    RX.tracking &&
                    typeof RX.tracking.stop ===
                    "function"
                ) {

                    RX.tracking.stop();

                }

            } catch (error) {}


            Flow.emit(
                "cancelled",
                {

                    reason:
                        reason
                }
            );


            Flow.clearActiveRide();


            return result;
        };


    /* ========================================================
       RIDE RATING
       ======================================================== */

    Flow.submitRating =
        async function (
            ratingData
        ) {

            ratingData =
                ratingData || {};


            const rating =
                Number(
                    ratingData.rating
                );


            if (
                !Number.isFinite(
                    rating
                ) ||
                rating <
                1 ||
                rating >
                5
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rating must be between 1 and 5."
                };
            }


            const database =
                Flow.getDatabase();


            const rideId =
                Flow.state.rideId;


            const data = {

                rating:
                    rating,

                comment:
                    ratingData.comment ||
                    "",

                ratedBy:
                    ratingData.ratedBy ||
                    Flow.getRole(),

                ratedAt:
                    Flow.now()
            };


            if (
                database &&
                rideId
            ) {

                try {

                    await database
                        .ref(
                            Flow.config
                                .ridePath +
                            "/" +
                            rideId +
                            "/rating"
                        )
                        .set(
                            data
                        );

                } catch (error) {

                    console.warn(
                        "Rating save failed:",
                        error
                    );
                }
            }


            Flow.emit(
                "rated",
                {

                    rating:
                        data
                }
            );


            Flow.clearActiveRide();


            return {

                success:
                    true,

                rating:
                    data
            };
        };


    /* ========================================================
       RESTORE ACTIVE RIDE
       ======================================================== */

    Flow.restore =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                localStorage.getItem(
                    Flow.config
                        .activeRideKey
                );


            if (
                !rideId
            ) {

                return null;
            }


            const database =
                Flow.getDatabase();


            if (
                !database
            ) {

                return null;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Flow.config
                                .ridePath +
                            "/" +
                            rideId
                        )
                        .once(
                            "value"
                        );


                const ride =
                    snapshot.val();


                if (
                    !ride
                ) {

                    Flow.clearActiveRide();

                    return null;
                }


                Flow.setState(
                    {

                        rideId:
                            ride.rideId ||
                            rideId,

                        tripId:
                            ride.tripId ||
                            null,

                        customerId:
                            ride.customerId ||
                            ride.userId ||
                            null,

                        riderId:
                            ride.riderId ||
                            ride.driverId ||
                            null,

                        status:
                            Flow.normalizeStatus(
                                ride.status
                            ),

                        service:
                            ride.service ||
                            ride.serviceType ||
                            "bike",

                        paymentMethod:
                            ride.paymentMethod ||
                            "cash",

                        pickup:
                            ride.pickup ||
                            null,

                        destination:
                            ride.destination ||
                            ride.dropoff ||
                            null,

                        fare:
                            ride.fare ||
                            null,

                        distanceKm:
                            Number(
                                ride.distanceKm ||
                                0
                            ),

                        durationMinutes:
                            Number(
                                ride.durationMinutes ||
                                0
                            ),

                        rider:
                            ride.rider ||
                            null,

                        ride:
                            ride,

                        createdAt:
                            ride.createdAt ||
                            null,

                        acceptedAt:
                            ride.acceptedAt ||
                            null,

                        startedAt:
                            ride.startedAt ||
                            null,

                        completedAt:
                            ride.completedAt ||
                            null,

                        cancelledAt:
                            ride.cancelledAt ||
                            null,

                        initializedRide:
                            true
                    }
                );


                /*
                 * Restore trip state if
                 * trip.js is available.
                 */

                try {

                    if (
                        RX.trip &&
                        typeof RX.trip.restore ===
                        "function"
                    ) {

                        await RX.trip.restore(
                            rideId
                        );

                    }

                } catch (error) {}


                Flow.startListening(
                    rideId
                );


                Flow.emit(
                    "restored",
                    {

                        ride:
                            ride
                    }
                );


                return ride;

            } catch (error) {

                console.warn(
                    "Ride restore failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       REALTIME LISTENER
       ======================================================== */

    Flow.startListening =
        function (
            rideId
        ) {

            const database =
                Flow.getDatabase();


            rideId =
                rideId ||
                Flow.state.rideId;


            if (
                !database ||
                !rideId
            ) {

                return false;
            }


            Flow.stopListening();


            const ref =
                database.ref(
                    Flow.config
                        .ridePath +
                    "/" +
                    rideId
                );


            const callback =
                function (
                    snapshot
                ) {

                    const ride =
                        snapshot.val();


                    if (
                        !ride
                    ) {

                        return;
                    }


                    const previousStatus =
                        Flow.state.status;


                    const currentStatus =
                        Flow.normalizeStatus(
                            ride.status
                        );


                    Flow.setState(
                        {

                            ride:
                                ride,

                            rideId:
                                ride.rideId ||
                                rideId,

                            tripId:
                                ride.tripId ||
                                Flow.state.tripId,

                            customerId:
                                ride.customerId ||
                                ride.userId ||
                                Flow.state
                                    .customerId,

                            riderId:
                                ride.riderId ||
                                ride.driverId ||
                                Flow.state
                                    .riderId,

                            status:
                                currentStatus,

                            service:
                                ride.service ||
                                ride.serviceType ||
                                Flow.state
                                    .service,

                            paymentMethod:
                                ride.paymentMethod ||
                                Flow.state
                                    .paymentMethod,

                            pickup:
                                ride.pickup ||
                                Flow.state.pickup,

                            destination:
                                ride.destination ||
                                ride.dropoff ||
                                Flow.state
                                    .destination,

                            fare:
                                ride.fare ||
                                Flow.state.fare,

                            distanceKm:
                                Number(
                                    ride.distanceKm ??
                                    Flow.state
                                        .distanceKm ??
                                    0
                                ),

                            durationMinutes:
                                Number(
                                    ride.durationMinutes ??
                                    Flow.state
                                        .durationMinutes ??
                                    0
                                ),

                            rider:
                                ride.rider ||
                                Flow.state.rider
                        }
                    );


                    /*
                     * Notify about status change.
                     */

                    if (
                        previousStatus !==
                        currentStatus
                    ) {

                        Flow.emit(
                            "status-changed",
                            {

                                previous:
                                    previousStatus,

                                current:
                                    currentStatus,

                                ride:
                                    ride
                            }
                        );

                    }


                    Flow.handleRemoteStatus(
                        currentStatus,
                        ride
                    );


                    Flow.updateUI();

                };


            ref.on(
                "value",
                callback
            );


            Flow.state.listeners.push(
                {

                    ref:
                        ref,

                    callback:
                        callback
                }
            );


            return true;
        };


    Flow.stopListening =
        function () {

            const listeners =
                Flow.state.listeners ||
                [];


            listeners.forEach(
                function (
                    item
                ) {

                    try {

                        item.ref.off(
                            "value",
                            item.callback
                        );

                    } catch (error) {}

                }
            );


            Flow.state.listeners =
                [];


            return true;
        };


    /* ========================================================
       REMOTE STATUS HANDLER
       ======================================================== */

    Flow.handleRemoteStatus =
        function (
            status,
            ride
        ) {

            switch (
                Flow.normalizeStatus(
                    status
                )
            ) {

                case Flow.states.ACCEPTED:

                    Flow.emit(
                        "driver-assigned",
                        {

                            ride:
                                ride,

                            rider:
                                ride.rider ||
                                null
                        }
                    );

                    break;


                case Flow.states.DRIVER_ARRIVING:

                    Flow.emit(
                        "driver-arriving",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.DRIVER_ARRIVED:

                    Flow.emit(
                        "driver-arrived",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.OTP_PENDING:

                    Flow.emit(
                        "otp-required",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.STARTED:

                case Flow.states.IN_PROGRESS:

                    Flow.emit(
                        "trip-live",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.COMPLETED:

                    Flow.emit(
                        "trip-completed",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.CANCELLED:

                    Flow.emit(
                        "ride-cancelled",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.PAYMENT_PENDING:

                    Flow.emit(
                        "payment-required",
                        {

                            ride:
                                ride
                        }
                    );

                    break;


                case Flow.states.PAYMENT_COMPLETED:

                    Flow.emit(
                        "payment-completed",
                        {

                            ride:
                                ride
                        }
                    );

                    break;
            }
        };


    /* ========================================================
       UI
       ======================================================== */

    Flow.prettyStatus =
        function (
            status
        ) {

            const labels = {

                idle:
                    "Ready",

                booking:
                    "Booking ride",

                searching:
                    "Finding a driver",

                accepted:
                    "Driver assigned",

                driver_arriving:
                    "Driver is arriving",

                driver_arrived:
                    "Driver has arrived",

                otp_pending:
                    "Enter ride OTP",

                otp_verified:
                    "OTP verified",

                trip_started:
                    "Trip started",

                in_progress:
                    "Trip in progress",

                completing:
                    "Completing trip",

                completed:
                    "Trip completed",

                payment_pending:
                    "Payment pending",

                payment_completed:
                    "Payment completed",

                rating:
                    "Rate your ride",

                cancelled:
                    "Ride cancelled",

                no_driver:
                    "No driver available",

                error:
                    "Something went wrong"
            };


            return (
                labels[
                    status
                ] ||
                "Ride"
            );
        };


    Flow.updateUI =
        function () {

            const state =
                Flow.state;


            /*
             * Status text.
             */

            document
                .querySelectorAll(
                    "[data-ride-status], #rideStatus, #tripStatus"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Flow.prettyStatus(
                                state.status
                            );

                    }
                );


            /*
             * Ride ID.
             */

            document
                .querySelectorAll(
                    "[data-ride-id], #rideId"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            state.rideId ||
                            "—";

                    }
                );


            /*
             * Distance.
             */

            document
                .querySelectorAll(
                    "[data-distance], #rideDistance"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Number(
                                state.distanceKm ||
                                0
                            ).toFixed(
                                1
                            ) +
                            " km";

                    }
                );


            /*
             * Duration.
             */

            document
                .querySelectorAll(
                    "[data-duration], #rideDuration"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Math.round(
                                state
                                    .durationMinutes ||
                                0
                            ) +
                            " min";

                    }
                );


            /*
             * Payment.
             */

            document
                .querySelectorAll(
                    "[data-payment-method]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            String(
                                state.paymentMethod ||
                                "cash"
                            )
                            .toUpperCase();

                    }
                );


            /*
             * Fare.
             */

            let fare =
                state.fare;


            if (
                fare &&
                typeof fare ===
                "object"
            ) {

                fare =
                    fare.finalFare ??
                    fare.total ??
                    fare.amount ??
                    null;

            }


            if (
                fare != null
            ) {

                document
                    .querySelectorAll(
                        "[data-fare], #rideFare, #finalFare"
                    )
                    .forEach(
                        function (
                            element
                        ) {

                            element.textContent =
                                "₹" +
                                Number(
                                    fare
                                ).toFixed(
                                    2
                                );

                        }
                    );

            }


            /*
             * Rider name.
             */

            const riderName =
                state.rider?.name ||
                state.ride?.riderName ||
                "";


            document
                .querySelectorAll(
                    "[data-rider-name], #riderName"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            riderName ||
                            "Rider";

                    }
                );


            /*
             * Action buttons.
             */

            Flow.updateActionButtons();

        };


    /* ========================================================
       ACTION BUTTONS
       ======================================================== */

    Flow.updateActionButtons =
        function () {

            const state =
                Flow.state;


            document
                .querySelectorAll(
                    "[data-ride-action]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        const action =
                            button.dataset
                                .rideAction;


                        let visible =
                            true;


                        switch (
                            action
                        ) {

                            case "accept":

                                visible =
                                    state.status ===
                                    Flow.states
                                        .SEARCHING;

                                break;


                            case "arrived":

                                visible =
                                    state.status ===
                                    Flow.states
                                        .DRIVER_ARRIVING;

                                break;


                            case "start":

                                visible =
                                    state.status ===
                                        Flow.states
                                            .OTP_VERIFIED ||
                                    state.status ===
                                        Flow.states
                                            .DRIVER_ARRIVED;

                                break;


                            case "complete":

                                visible =
                                    state.status ===
                                        Flow.states
                                            .STARTED ||
                                    state.status ===
                                        Flow.states
                                            .IN_PROGRESS;

                                break;


                            case "cancel":

                                visible =
                                    ![
                                        Flow.states
                                            .COMPLETED,

                                        Flow.states
                                            .CANCELLED
                                    ].includes(
                                        state.status
                                    );

                                break;


                            case "pay":

                                visible =
                                    state.status ===
                                    Flow.states
                                        .PAYMENT_PENDING;

                                break;


                            case "rate":

                                visible =
                                    state.status ===
                                    Flow.states.RATING;

                                break;
                        }


                        button.hidden =
                            !visible;

                    }
                );
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    Flow.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    Flow.on =
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


            const eventName =
                "riderx-ride-" +
                name;


            const handler =
                function (
                    event
                ) {

                    callback(
                        event.detail || {},
                        event
                    );

                };


            window.addEventListener(
                eventName,
                handler
            );


            return function () {

                window.removeEventListener(
                    eventName,
                    handler
                );

            };
        };


    /* ========================================================
       BUTTON AUTO-BINDING
       ======================================================== */

    Flow.bindButtons =
        function () {

            document
                .querySelectorAll(
                    "[data-ride-action]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .rxBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .rxBound =
                            "true";


                        button.addEventListener(
                            "click",
                            async function () {

                                const action =
                                    button.dataset
                                        .rideAction;


                                try {

                                    switch (
                                        action
                                    ) {

                                        case "accept":

                                            await Flow
                                                .acceptRide();

                                            break;


                                        case "arrived":

                                            await Flow
                                                .driverArrived();

                                            break;


                                        case "start":

                                            await Flow
                                                .startTrip();

                                            break;


                                        case "complete":

                                            await Flow
                                                .completeRide();

                                            break;


                                        case "cancel":

                                            await Flow
                                                .cancelRide(
                                                    "Cancelled by user"
                                                );

                                            break;


                                        case "pay":

                                            await Flow
                                                .completePayment();

                                            break;

                                    }

                                } catch (error) {

                                    console.error(
                                        "Ride action failed:",
                                        error
                                    );


                                    Flow.setState(
                                        {

                                            error:
                                                error.message
                                        }
                                    );

                                }

                            }
                        );

                    }
                );
        };


    /* ========================================================
       INIT
       ======================================================== */

    Flow.init =
        async function () {

            if (
                Flow.state.initialized
            ) {

                return;
            }


            Flow.state.initialized =
                true;


            Flow.getRole();


            Flow.bindButtons();


            /*
             * Restore active ride.
             */

            try {

                const activeRide =
                    localStorage.getItem(
                        Flow.config
                            .activeRideKey
                    );


                if (
                    activeRide
                ) {

                    await Flow.restore(
                        activeRide
                    );

                }

            } catch (error) {

                console.warn(
                    "Active ride restore failed:",
                    error
                );

            }


            Flow.updateUI();


            console.log(
                "RiderX ride-flow.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.createRide =
        Flow.createRide;

    RX.startMatching =
        Flow.startMatching;

    RX.acceptRide =
        Flow.acceptRide;

    RX.driverArrived =
        Flow.driverArrived;

    RX.verifyRideOTP =
        Flow.verifyOTP;

    RX.startRide =
        Flow.startTrip;

    RX.startLiveRide =
        Flow.startLiveTrip;

    RX.completeRide =
        Flow.completeRide;

    RX.cancelRide =
        Flow.cancelRide;

    RX.completePayment =
        Flow.completePayment;

    RX.submitRideRating =
        Flow.submitRating;

    RX.getRideFlow =
        Flow.getState;


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Flow.init
        );

    } else {

        Flow.init();

    }


})();
