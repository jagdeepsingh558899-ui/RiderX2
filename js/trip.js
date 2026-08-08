/* ============================================================
   RIDERX TRIP ENGINE
   File: js/trip.js

   Handles complete trip lifecycle:

   searching
       ↓
   accepted
       ↓
   driver_arriving
       ↓
   driver_arrived
       ↓
   otp_verified
       ↓
   trip_started
       ↓
   trip_completed

   Also handles:
   - Rider / customer synchronization
   - Firebase Realtime Database
   - OTP verification
   - Cancellation
   - Trip timestamps
   - Fare finalization
   - Trip history preparation
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Trip =
        RX.trip =
        RX.trip || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Trip.config = {

        ridesPath:
            "rides",

        tripPath:
            "trips",

        historyPath:
            "history",

        usersPath:
            "users",

        otpLength:
            4,

        pickupArrivalDistance:
            0.15,

        tripStartDistance:
            0.20,

        maxCancelMinutes:
            5,

        defaultCancellationFee:
            20
    };


    /* ========================================================
       STATUS
       ======================================================== */

    Trip.status = {

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

        TRIP_STARTED:
            "trip_started",

        IN_PROGRESS:
            "in_progress",

        COMPLETING:
            "completing",

        COMPLETED:
            "completed",

        CANCELLED:
            "cancelled",

        NO_DRIVER:
            "no_driver",

        PAYMENT_PENDING:
            "payment_pending",

        PAYMENT_COMPLETED:
            "payment_completed"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Trip.state = {

        initialized:
            false,

        rideId:
            null,

        tripId:
            null,

        customerId:
            null,

        riderId:
            null,

        role:
            null,

        service:
            "bike",

        status:
            "idle",

        paymentMethod:
            "cash",

        pickup:
            null,

        destination:
            null,

        otp:
            null,

        otpVerified:
            false,

        startTime:
            null,

        endTime:
            null,

        acceptedAt:
            null,

        arrivedAt:
            null,

        cancelledAt:
            null,

        fare:
            null,

        distanceKm:
            0,

        durationMinutes:
            0,

        cancellationReason:
            null,

        ride:
            null,

        listener:
            null,

        initializedRide:
            false
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Trip.getDatabase =
        function () {

            try {

                if (
                    RX.firebase?.database
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

            } catch (error) {

                console.warn(
                    "RiderX trip Firebase error:",
                    error
                );

            }


            return null;
        };


    Trip.getAuth =
        function () {

            try {

                if (
                    RX.firebase?.auth
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


    Trip.getUser =
        function () {

            const auth =
                Trip.getAuth();


            try {

                if (
                    auth?.currentUser
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


    Trip.getUserId =
        function () {

            const user =
                Trip.getUser();


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
       UTILITY
       ======================================================== */

    Trip.now =
        function () {

            return Date.now();

        };


    Trip.generateTripId =
        function () {

            return (
                "trip_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(
                        2,
                        8
                    )
            );
        };


    Trip.normalizeStatus =
        function (
            status
        ) {

            status =
                String(
                    status ||
                    "idle"
                )
                .toLowerCase()
                .trim();


            const aliases = {

                "driver arriving":
                    Trip.status
                        .DRIVER_ARRIVING,

                "arriving":
                    Trip.status
                        .DRIVER_ARRIVING,

                "driver arrived":
                    Trip.status
                        .DRIVER_ARRIVED,

                "arrived":
                    Trip.status
                        .DRIVER_ARRIVED,

                "otp verified":
                    Trip.status
                        .OTP_VERIFIED,

                "started":
                    Trip.status
                        .TRIP_STARTED,

                "in progress":
                    Trip.status
                        .IN_PROGRESS,

                "completed":
                    Trip.status
                        .COMPLETED,

                "cancel":
                    Trip.status
                        .CANCELLED
            };


            return (
                aliases[status] ||
                status
            );
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    Trip.distance =
        function (
            a,
            b
        ) {

            if (
                !a ||
                !b
            ) {

                return null;
            }


            const lat1 =
                Number(
                    a.lat ??
                    a.latitude
                );


            const lon1 =
                Number(
                    a.lng ??
                    a.longitude ??
                    a.lon
                );


            const lat2 =
                Number(
                    b.lat ??
                    b.latitude
                );


            const lon2 =
                Number(
                    b.lng ??
                    b.longitude ??
                    b.lon
                );


            if (
                !Number.isFinite(lat1) ||
                !Number.isFinite(lon1) ||
                !Number.isFinite(lat2) ||
                !Number.isFinite(lon2)
            ) {

                return null;
            }


            const R =
                6371;


            const dLat =
                (
                    lat2 -
                    lat1
                ) *
                Math.PI /
                180;


            const dLon =
                (
                    lon2 -
                    lon1
                ) *
                Math.PI /
                180;


            const x =
                Math.sin(
                    dLat / 2
                ) *
                Math.sin(
                    dLat / 2
                ) +
                Math.cos(
                    lat1 *
                    Math.PI /
                    180
                ) *
                Math.cos(
                    lat2 *
                    Math.PI /
                    180
                ) *
                Math.sin(
                    dLon / 2
                ) *
                Math.sin(
                    dLon / 2
                );


            return (
                R *
                2 *
                Math.atan2(
                    Math.sqrt(x),
                    Math.sqrt(
                        1 - x
                    )
                )
            );
        };


    /* ========================================================
       SET RIDE
       ======================================================== */

    Trip.setRide =
        function (
            rideId,
            options
        ) {

            options =
                options || {};


            Trip.state.rideId =
                rideId ||
                options.rideId ||
                Trip.state.rideId;


            Trip.state.tripId =
                options.tripId ||
                Trip.state.tripId ||
                Trip.generateTripId();


            Trip.state.customerId =
                options.customerId ||
                options.userId ||
                Trip.state.customerId;


            Trip.state.riderId =
                options.riderId ||
                options.driverId ||
                Trip.state.riderId;


            Trip.state.role =
                options.role ||
                Trip.state.role;


            Trip.state.service =
                options.service ||
                options.serviceType ||
                Trip.state.service ||
                "bike";


            Trip.state.status =
                Trip.normalizeStatus(
                    options.status ||
                    Trip.state.status ||
                    "searching"
                );


            Trip.state.paymentMethod =
                options.paymentMethod ||
                Trip.state.paymentMethod ||
                "cash";


            Trip.state.pickup =
                options.pickup ||
                Trip.state.pickup;


            Trip.state.destination =
                options.destination ||
                options.dropoff ||
                Trip.state.destination;


            Trip.state.ride =
                options.ride ||
                Trip.state.ride;


            Trip.emit(
                "ride-set",
                Trip.getState()
            );


            return Trip.state.rideId;
        };


    /* ========================================================
       CREATE TRIP
       ======================================================== */

    Trip.create =
        async function (
            options
        ) {

            options =
                options || {};


            const rideId =
                options.rideId ||
                Trip.state.rideId;


            if (
                !rideId
            ) {

                throw new Error(
                    "Ride ID is required."
                );
            }


            Trip.setRide(
                rideId,
                options
            );


            const database =
                Trip.getDatabase();


            const tripData = {

                tripId:
                    Trip.state.tripId,

                rideId:
                    rideId,

                customerId:
                    Trip.state.customerId,

                riderId:
                    Trip.state.riderId,

                service:
                    Trip.state.service,

                status:
                    Trip.status.SEARCHING,

                paymentMethod:
                    Trip.state.paymentMethod,

                pickup:
                    Trip.state.pickup,

                destination:
                    Trip.state.destination,

                createdAt:
                    Trip.now(),

                updatedAt:
                    Trip.now()
            };


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Trip.config
                                .tripPath +
                            "/" +
                            Trip.state.tripId
                        )
                        .set(
                            tripData
                        );


                    await database
                        .ref(
                            Trip.config
                                .ridesPath +
                            "/" +
                            rideId
                        )
                        .update(
                            {

                                tripId:
                                    Trip.state.tripId,

                                status:
                                    Trip.status.SEARCHING,

                                updatedAt:
                                    Trip.now()
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Trip create Firebase error:",
                        error
                    );

                }
            }


            Trip.state.status =
                Trip.status.SEARCHING;


            Trip.state.ride =
                tripData;


            Trip.state.initializedRide =
                true;


            Trip.emit(
                "created",
                {
                    trip:
                        tripData
                }
            );


            Trip.updateUI();


            return tripData;
        };


    /* ========================================================
       GET TRIP
       ======================================================== */

    Trip.get =
        async function (
            tripId
        ) {

            tripId =
                tripId ||
                Trip.state.tripId;


            const database =
                Trip.getDatabase();


            if (
                !database ||
                !tripId
            ) {

                return null;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Trip.config
                                .tripPath +
                            "/" +
                            tripId
                        )
                        .once(
                            "value"
                        );


                return snapshot.val();

            } catch (error) {

                console.warn(
                    "Trip read failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       UPDATE TRIP
       ======================================================== */

    Trip.update =
        async function (
            updates
        ) {

            updates =
                updates || {};


            const database =
                Trip.getDatabase();


            const tripId =
                Trip.state.tripId;


            if (
                !tripId
            ) {

                return false;
            }


            const data = {

                ...updates,

                updatedAt:
                    Trip.now()
            };


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Trip.config
                                .tripPath +
                            "/" +
                            tripId
                        )
                        .update(
                            data
                        );

                } catch (error) {

                    console.warn(
                        "Trip update failed:",
                        error
                    );


                    return false;
                }
            }


            Object.assign(
                Trip.state,
                data
            );


            Trip.emit(
                "updated",
                {
                    updates:
                        data,

                    state:
                        Trip.getState()
                }
            );


            Trip.updateUI();


            return true;
        };


    /* ========================================================
       SET STATUS
       ======================================================== */

    Trip.setStatus =
        async function (
            status,
            extra
        ) {

            status =
                Trip.normalizeStatus(
                    status
                );


            extra =
                extra || {};


            Trip.state.status =
                status;


            const updates = {

                status:
                    status,

                ...extra,

                updatedAt:
                    Trip.now()
            };


            await Trip.update(
                updates
            );


            Trip.emit(
                "status-changed",
                {

                    status:
                        status,

                    state:
                        Trip.getState()
                }
            );


            Trip.updateUI();


            return true;
        };


    /* ========================================================
       DRIVER ACCEPT
       ======================================================== */

    Trip.accept =
        async function (
            rider
        ) {

            rider =
                rider || {};


            const riderId =
                rider.riderId ||
                rider.driverId ||
                rider.uid ||
                Trip.state.riderId ||
                Trip.getUserId();


            if (
                !riderId
            ) {

                throw new Error(
                    "Rider ID is required."
                );
            }


            Trip.state.riderId =
                riderId;


            Trip.state.acceptedAt =
                Trip.now();


            const updates = {

                riderId:
                    riderId,

                driverId:
                    riderId,

                rider:
                    rider,

                status:
                    Trip.status.ACCEPTED,

                acceptedAt:
                    Trip.state.acceptedAt,

                updatedAt:
                    Trip.now()
            };


            await Trip.update(
                updates
            );


            Trip.emit(
                "accepted",
                {
                    rider:
                        rider,

                    riderId:
                        riderId
                }
            );


            return true;
        };


    /* ========================================================
       DRIVER ARRIVING
       ======================================================== */

    Trip.driverArriving =
        async function () {

            return Trip.setStatus(
                Trip.status
                    .DRIVER_ARRIVING,
                {

                    driverArrivingAt:
                        Trip.now()
                }
            );
        };


    /* ========================================================
       DRIVER ARRIVED
       ======================================================== */

    Trip.driverArrived =
        async function () {

            Trip.state.arrivedAt =
                Trip.now();


            const result =
                await Trip.setStatus(
                    Trip.status
                        .DRIVER_ARRIVED,
                    {

                        arrivedAt:
                            Trip.state
                                .arrivedAt
                    }
                );


            /*
             * Generate OTP if not already
             * generated.
             */

            if (
                !Trip.state.otp
            ) {

                await Trip.generateOTP();

            }


            return result;
        };


    /* ========================================================
       OTP
       ======================================================== */

    Trip.generateOTP =
        async function () {

            let otp =
                "";


            for (
                let i = 0;
                i <
                Trip.config.otpLength;
                i++
            ) {

                otp +=
                    Math.floor(
                        Math.random() *
                        10
                    );

            }


            Trip.state.otp =
                otp;


            const database =
                Trip.getDatabase();


            if (
                database &&
                Trip.state.tripId
            ) {

                try {

                    await database
                        .ref(
                            Trip.config
                                .tripPath +
                            "/" +
                            Trip.state.tripId +
                            "/otp"
                        )
                        .set(
                            {

                                code:
                                    otp,

                                verified:
                                    false,

                                createdAt:
                                    Trip.now()
                            }
                        );

                } catch (error) {

                    console.warn(
                        "OTP save failed:",
                        error
                    );

                }
            }


            Trip.emit(
                "otp-generated",
                {

                    otp:
                        otp
                }
            );


            return otp;
        };


    Trip.verifyOTP =
        async function (
            enteredOTP
        ) {

            enteredOTP =
                String(
                    enteredOTP ||
                    ""
                )
                .replace(
                    /\D/g,
                    ""
                );


            if (
                enteredOTP.length !==
                Trip.config.otpLength
            ) {

                return {

                    success:
                        false,

                    error:
                        "Enter a valid OTP."
                };
            }


            /*
             * Read latest OTP from Firebase.
             */

            const database =
                Trip.getDatabase();


            let correctOTP =
                Trip.state.otp;


            if (
                database &&
                Trip.state.tripId
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Trip.config
                                    .tripPath +
                                "/" +
                                Trip.state.tripId +
                                "/otp"
                            )
                            .once(
                                "value"
                            );


                    const value =
                        snapshot.val();


                    if (
                        value?.code
                    ) {

                        correctOTP =
                            String(
                                value.code
                            );

                        }

                } catch (error) {}
            }


            if (
                String(
                    correctOTP
                ) !==
                enteredOTP
            ) {

                Trip.emit(
                    "otp-failed",
                    {

                        enteredOTP:
                            enteredOTP
                    }
                );


                return {

                    success:
                        false,

                    error:
                        "Incorrect OTP."
                };
            }


            Trip.state.otpVerified =
                true;


            await Trip.setStatus(
                Trip.status
                    .OTP_VERIFIED,
                {

                    otpVerified:
                        true,

                    otpVerifiedAt:
                        Trip.now(),

                    "otp/verified":
                        true
                }
            );


            Trip.emit(
                "otp-verified",
                {

                    success:
                        true
                }
            );


            return {

                success:
                    true
            };
        };


    /* ========================================================
       START TRIP
       ======================================================== */

    Trip.start =
        async function (
            options
        ) {

            options =
                options || {};


            /*
             * OTP is required unless explicitly
             * disabled for a trusted/admin flow.
             */

            if (
                !Trip.state.otpVerified &&
                options.skipOTP !== true
            ) {

                return {

                    success:
                        false,

                    error:
                        "OTP verification required."
                };
            }


            Trip.state.startTime =
                Trip.now();


            Trip.state.status =
                Trip.status.TRIP_STARTED;


            await Trip.update(
                {

                    status:
                        Trip.status.TRIP_STARTED,

                    tripStartedAt:
                        Trip.state
                            .startTime,

                    startTime:
                        Trip.state
                            .startTime,

                    otpVerified:
                        true
                }
            );


            Trip.emit(
                "started",
                {

                    startTime:
                        Trip.state
                            .startTime
                }
            );


            Trip.updateUI();


            return {

                success:
                    true
            };
        };


    /* ========================================================
       IN PROGRESS
       ======================================================== */

    Trip.inProgress =
        async function () {

            return Trip.setStatus(
                Trip.status.IN_PROGRESS
            );
        };


    /* ========================================================
       UPDATE DISTANCE
       ======================================================== */

    Trip.updateDistance =
        async function (
            distanceKm
        ) {

            distanceKm =
                Number(
                    distanceKm || 0
                );


            if (
                !Number.isFinite(
                    distanceKm
                )
            ) {

                return false;
            }


            Trip.state.distanceKm =
                Math.max(
                    0,
                    distanceKm
                );


            await Trip.update(
                {

                    distanceKm:
                        Trip.state
                            .distanceKm
                }
            );


            Trip.emit(
                "distance-updated",
                {

                    distanceKm:
                        Trip.state
                            .distanceKm
                }
            );


            return true;
        };


    /* ========================================================
       UPDATE DURATION
       ======================================================== */

    Trip.updateDuration =
        async function (
            minutes
        ) {

            minutes =
                Number(
                    minutes || 0
                );


            if (
                !Number.isFinite(
                    minutes
                )
            ) {

                return false;
            }


            Trip.state.durationMinutes =
                Math.max(
                    0,
                    minutes
                );


            await Trip.update(
                {

                    durationMinutes:
                        Trip.state
                            .durationMinutes
                }
            );


            return true;
        };


    /* ========================================================
       FINAL FARE
       ======================================================== */

    Trip.calculateFinalFare =
        function (
            options
        ) {

            options =
                options || {};


            const service =
                options.service ||
                Trip.state.service ||
                "bike";


            const distanceKm =
                Number(
                    options.distanceKm ??
                    Trip.state.distanceKm ??
                    0
                );


            const durationMinutes =
                Number(
                    options.durationMinutes ??
                    Trip.state.durationMinutes ??
                    0
                );


            let result = null;


            /*
             * Use pricing.js when available.
             */

            if (
                RX.pricing &&
                typeof RX.pricing.calculate ===
                "function"
            ) {

                result =
                    RX.pricing.calculate(
                        {

                            service:
                                service,

                            distanceKm:
                                distanceKm,

                            durationMinutes:
                                durationMinutes,

                            discount:
                                options.discount ||
                                0,

                            toll:
                                options.toll ||
                                0,

                            parking:
                                options.parking ||
                                0,

                            extraCharges:
                                options.extraCharges ||
                                0
                        }
                    );

            }


            /*
             * Fallback.
             */

            if (
                !result ||
                !result.success
            ) {

                result = {

                    success:
                        true,

                    service:
                        service,

                    distanceKm:
                        distanceKm,

                    durationMinutes:
                        durationMinutes,

                    finalFare:
                        Number(
                            options.fare ||
                            Trip.state.fare ||
                            0
                        )
                };

            }


            Trip.state.fare =
                result;


            return result;
        };


    /* ========================================================
       COMPLETE TRIP
       ======================================================== */

    Trip.complete =
        async function (
            options
        ) {

            options =
                options || {};


            if (
                Trip.state.status ===
                Trip.status.COMPLETED
            ) {

                return {

                    success:
                        true,

                    alreadyCompleted:
                        true,

                    fare:
                        Trip.state.fare
                };
            }


            /*
             * Save final distance.
             */

            if (
                options.distanceKm != null
            ) {

                Trip.state.distanceKm =
                    Number(
                        options.distanceKm
                    );

            }


            /*
             * Save final duration.
             */

            if (
                options.durationMinutes != null
            ) {

                Trip.state.durationMinutes =
                    Number(
                        options.durationMinutes
                    );

            }


            /*
             * Calculate final fare.
             */

            const fare =
                this.calculateFinalFare(
                    {

                        ...options,

                        service:
                            options.service ||
                            Trip.state.service,

                        distanceKm:
                            Trip.state
                                .distanceKm,

                        durationMinutes:
                            Trip.state
                                .durationMinutes
                    }
                );


            Trip.state.endTime =
                Trip.now();


            Trip.state.status =
                Trip.status.COMPLETED;


            const completion = {

                status:
                    Trip.status.COMPLETED,

                completedAt:
                    Trip.state.endTime,

                endTime:
                    Trip.state.endTime,

                distanceKm:
                    Trip.state.distanceKm,

                durationMinutes:
                    Trip.state
                        .durationMinutes,

                fare:
                    fare?.finalFare ??
                    fare?.total ??
                    0,

                fareDetails:
                    fare,

                paymentMethod:
                    Trip.state
                        .paymentMethod,

                updatedAt:
                    Trip.now()
            };


            await Trip.update(
                completion
            );


            /*
             * Save history.
             */

            await Trip.saveHistory(
                completion
            );


            Trip.emit(
                "completed",
                {

                    completion:
                        completion
                }
            );


            Trip.updateUI();


            return {

                success:
                    true,

                completion:
                    completion
            };
        };


    /* ========================================================
       SAVE HISTORY
       ======================================================== */

    Trip.saveHistory =
        async function (
            data
        ) {

            const database =
                Trip.getDatabase();


            if (
                !database
            ) {

                return false;
            }


            const rideId =
                Trip.state.rideId;


            const tripId =
                Trip.state.tripId;


            if (
                !rideId
            ) {

                return false;
            }


            const historyData = {

                ...data,

                tripId:
                    tripId,

                rideId:
                    rideId,

                customerId:
                    Trip.state.customerId,

                riderId:
                    Trip.state.riderId,

                service:
                    Trip.state.service,

                pickup:
                    Trip.state.pickup,

                destination:
                    Trip.state.destination,

                createdAt:
                    Trip.state
                        .ride
                        ?.createdAt ||
                    Trip.now(),

                savedAt:
                    Trip.now()
            };


            try {

                /*
                 * Customer history.
                 */

                if (
                    Trip.state.customerId
                ) {

                    await database
                        .ref(
                            Trip.config
                                .historyPath +
                            "/customers/" +
                            Trip.state
                                .customerId +
                            "/" +
                            rideId
                        )
                        .set(
                            historyData
                        );

                }


                /*
                 * Rider history.
                 */

                if (
                    Trip.state.riderId
                ) {

                    await database
                        .ref(
                            Trip.config
                                .historyPath +
                            "/riders/" +
                            Trip.state
                                .riderId +
                            "/" +
                            rideId
                        )
                        .set(
                            historyData
                        );

                }


                return true;

            } catch (error) {

                console.warn(
                    "Trip history save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       CANCEL TRIP
       ======================================================== */

    Trip.cancel =
        async function (
            reason,
            options
        ) {

            options =
                options || {};


            reason =
                reason ||
                "Cancelled by user";


            /*
             * Don't allow cancelling a
             * completed trip.
             */

            if (
                Trip.state.status ===
                Trip.status.COMPLETED
            ) {

                return {

                    success:
                        false,

                    error:
                        "Completed trip cannot be cancelled."
                };
            }


            Trip.state
                .cancellationReason =
                reason;


            Trip.state.cancelledAt =
                Trip.now();


            let cancellationFee =
                Number(
                    options.cancellationFee ??
                    0
                );


            if (
                !Number.isFinite(
                    cancellationFee
                )
            ) {

                cancellationFee =
                    0;
            }


            const cancelled = {

                status:
                    Trip.status.CANCELLED,

                cancelledAt:
                    Trip.state
                        .cancelledAt,

                cancellationReason:
                    reason,

                cancelledBy:
                    options.cancelledBy ||
                    Trip.state.role ||
                    "user",

                cancellationFee:
                    cancellationFee,

                updatedAt:
                    Trip.now()
            };


            await Trip.update(
                cancelled
            );


            await Trip.saveHistory(
                cancelled
            );


            Trip.emit(
                "cancelled",
                {

                    reason:
                        reason,

                    cancellationFee:
                        cancellationFee
                }
            );


            Trip.updateUI();


            return {

                success:
                    true,

                cancellationFee:
                    cancellationFee
            };
        };


    /* ========================================================
       PAYMENT
       ======================================================== */

    Trip.setPaymentMethod =
        async function (
            method
        ) {

            method =
                String(
                    method ||
                    "cash"
                )
                .toLowerCase()
                .trim();


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


            Trip.state.paymentMethod =
                method;


            await Trip.update(
                {

                    paymentMethod:
                        method
                }
            );


            return method;
        };


    Trip.markPaymentPending =
        async function () {

            return Trip.setStatus(
                Trip.status
                    .PAYMENT_PENDING
            );
        };


    Trip.markPaymentCompleted =
        async function (
            payment
        ) {

            payment =
                payment || {};


            await Trip.update(
                {

                    status:
                        Trip.status
                            .PAYMENT_COMPLETED,

                    payment:
                        payment,

                    paymentCompletedAt:
                        Trip.now()
                }
            );


            Trip.emit(
                "payment-completed",
                {

                    payment:
                        payment
                }
            );


            return true;
        };


    /* ========================================================
       RETRIEVE CURRENT RIDE
       ======================================================== */

    Trip.restore =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                localStorage.getItem(
                    "riderx_active_ride"
                );


            if (
                !rideId
            ) {

                return null;
            }


            Trip.state.rideId =
                rideId;


            const database =
                Trip.getDatabase();


            if (
                !database
            ) {

                return null;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Trip.config
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
                    !ride
                ) {

                    return null;
                }


                Trip.setRide(
                    rideId,
                    {

                        ride:
                            ride,

                        status:
                            ride.status,

                        riderId:
                            ride.riderId ||
                            ride.driverId,

                        customerId:
                            ride.customerId ||
                            ride.userId,

                        service:
                            ride.service ||
                            ride.serviceType,

                        pickup:
                            ride.pickup,

                        destination:
                            ride.destination ||
                            ride.dropoff,

                        paymentMethod:
                            ride.paymentMethod
                    }
                );


                if (
                    ride.tripId
                ) {

                    Trip.state.tripId =
                        ride.tripId;

                }


                Trip.emit(
                    "restored",
                    {

                        ride:
                            ride
                    }
                );


                Trip.updateUI();


                return ride;

            } catch (error) {

                console.warn(
                    "Trip restore failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       LISTEN FOR TRIP CHANGES
       ======================================================== */

    Trip.listen =
        function (
            rideId
        ) {

            const database =
                Trip.getDatabase();


            rideId =
                rideId ||
                Trip.state.rideId;


            if (
                !database ||
                !rideId
            ) {

                return false;
            }


            Trip.stopListening();


            const ref =
                database.ref(
                    Trip.config
                        .ridesPath +
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


                    Trip.setRide(
                        rideId,
                        {

                            ride:
                                ride,

                            status:
                                ride.status,

                            riderId:
                                ride.riderId ||
                                ride.driverId,

                            customerId:
                                ride.customerId ||
                                ride.userId,

                            service:
                                ride.service ||
                                ride.serviceType,

                            pickup:
                                ride.pickup,

                            destination:
                                ride.destination ||
                                ride.dropoff
                        }
                    );


                    Trip.emit(
                        "remote-update",
                        {

                            ride:
                                ride,

                            status:
                                ride.status
                        }
                    );


                    Trip.updateUI();

                };


            ref.on(
                "value",
                callback
            );


            Trip.state.listener =
                function () {

                    ref.off(
                        "value",
                        callback
                    );

                };


            return true;
        };


    Trip.stopListening =
        function () {

            if (
                typeof Trip.state.listener ===
                "function"
            ) {

                try {

                    Trip.state.listener();

                } catch (error) {}

            }


            Trip.state.listener =
                null;
        };


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    Trip.saveActiveRide =
        function () {

            if (
                Trip.state.rideId
            ) {

                localStorage.setItem(
                    "riderx_active_ride",
                    Trip.state.rideId
                );

            }
        };


    Trip.clearActiveRide =
        function () {

            localStorage.removeItem(
                "riderx_active_ride"
            );
        };


    /* ========================================================
       GET STATE
       ======================================================== */

    Trip.getState =
        function () {

            return {

                ...Trip.state
            };
        };


    /* ========================================================
       UI
       ======================================================== */

    Trip.updateUI =
        function () {

            const state =
                Trip.state;


            /*
             * Status.
             */

            document
                .querySelectorAll(
                    "[data-trip-status], #tripStatus, #rideStatus"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Trip.prettyStatus(
                                state.status
                            );

                    }
                );


            /*
             * OTP.
             */

            document
                .querySelectorAll(
                    "[data-trip-otp], #tripOtp"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            state.otp
                        ) {

                            element.textContent =
                                state.otp;

                        }

                    }
                );


            /*
             * Fare.
             */

            const fare =
                state.fare;


            const finalFare =
                fare?.finalFare ??
                fare?.total ??
                fare;


            if (
                finalFare != null
            ) {

                document
                    .querySelectorAll(
                        "[data-trip-fare], #tripFare, #finalFare"
                    )
                    .forEach(
                        function (
                            element
                        ) {

                            element.textContent =
                                "₹" +
                                Number(
                                    finalFare
                                ).toFixed(
                                    2
                                );

                        }
                    );

            }


            /*
             * Distance.
             */

            document
                .querySelectorAll(
                    "[data-trip-distance], #tripDistance"
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
                    "[data-trip-duration], #tripDuration"
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
             * Payment method.
             */

            document
                .querySelectorAll(
                    "[data-payment-method], #paymentMethod"
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
             * OTP verification state.
             */

            document
                .querySelectorAll(
                    "[data-otp-verified]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.hidden =
                            !state.otpVerified;

                    }
                );
        };


    /* ========================================================
       PRETTY STATUS
       ======================================================== */

    Trip.prettyStatus =
        function (
            status
        ) {

            const labels = {

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

                cancelled:
                    "Trip cancelled",

                no_driver:
                    "No driver available",

                payment_pending:
                    "Payment pending",

                payment_completed:
                    "Payment completed"
            };


            return (
                labels[
                    status
                ] ||
                "Ride"
            );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Trip.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-trip-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    Trip.on =
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
                "riderx-trip-" +
                name,
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
       GLOBAL API
       ======================================================== */

    RX.tripCreate =
        Trip.create;

    RX.tripAccept =
        Trip.accept;

    RX.tripStart =
        Trip.start;

    RX.tripComplete =
        Trip.complete;

    RX.tripCancel =
        Trip.cancel;

    RX.tripVerifyOTP =
        Trip.verifyOTP;

    RX.tripSetStatus =
        Trip.setStatus;

    RX.tripGetState =
        Trip.getState;


    /* ========================================================
       INIT
       ======================================================== */

    Trip.init =
        async function () {

            if (
                Trip.state.initialized
            ) {

                return;
            }


            Trip.state.initialized =
                true;


            /*
             * Restore active ride if
             * available.
             */

            try {

                const activeRide =
                    localStorage.getItem(
                        "riderx_active_ride"
                    );


                if (
                    activeRide
                ) {

                    await Trip.restore(
                        activeRide
                    );

                }

            } catch (error) {}


            console.log(
                "RiderX trip.js loaded."
            );
        };


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Trip.init
        );

    } else {

        Trip.init();

    }


})();
