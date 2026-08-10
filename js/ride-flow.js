/* ============================================================
   RIDERX 2.0 - RIDE FLOW ENGINE
   File: js/ride-flow.js

   Rider trip state machine:

   searching
       ↓
   accepted
       ↓
   arriving
       ↓
   arrived
       ↓
   otp_verified
       ↓
   in_progress
       ↓
   completed

   Also handles:
   - Firebase RTDB ride synchronization
   - Rider ownership protection
   - Customer notifications
   - OTP verification
   - Pickup / drop status
   - Ride completion handoff
   - Local active ride recovery
   - Strict ride state transitions
   - UI action state
   - DOM ride controls
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Flow =
        RX.rideFlow =
        RX.rideFlow || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Flow.config = {

        ridesPath:
            "rides",

        requestsPath:
            "rideRequests",

        customersPath:
            "customers",

        ridersPath:
            "riders",

        notificationsPath:
            "notifications",

        activeRideKey:
            "riderx_active_ride",

        activeStatusKey:
            "riderx_ride_status",

        otpAttemptsKey:
            "riderx_otp_attempts",

        otpLength:
            4,

        maxOtpAttempts:
            5,

        listenerEvents:
            [
                "value"
            ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    Flow.state = {

        initialized:
            false,

        initializing:
            false,

        ride:
            null,

        rideId:
            null,

        status:
            null,

        otpAttempts:
            0,

        updating:
            false,

        listeners:
            [],

        customerListener:
            null
    };


    /* ========================================================
       STATUS ORDER
       ======================================================== */

    Flow.statusOrder = {

        searching:
            0,

        accepted:
            1,

        arriving:
            2,

        arrived:
            3,

        otp_verified:
            4,

        in_progress:
            5,

        completed:
            6,

        cancelled:
            99
    };


    /* ========================================================
       VALID NEXT STATES
       ======================================================== */

    Flow.nextStates = {

        searching:
            [
                "accepted",
                "cancelled"
            ],

        accepted:
            [
                "arriving",
                "cancelled"
            ],

        arriving:
            [
                "arrived",
                "cancelled"
            ],

        arrived:
            [
                "otp_verified",
                "cancelled"
            ],

        otp_verified:
            [
                "in_progress"
            ],

        in_progress:
            [
                "completed"
            ],

        completed:
            [],

        cancelled:
            []
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

                    /*
                     * Supports both:
                     *
                     * RX.firebase.database()
                     *
                     * and
                     *
                     * RX.firebase.database
                     *
                     */

                    if (
                        typeof RX.firebase.database ===
                        "function"
                    ) {

                        return RX.firebase.database();
                    }

                    return RX.firebase.database;
                }

            } catch (error) {

                console.warn(
                    "RiderX database access failed:",
                    error
                );
            }


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
                    "Firebase database access failed:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       FIREBASE AUTH USER
       ======================================================== */

    Flow.getUser =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    if (
                        RX.firebase.auth.currentUser
                    ) {

                        return RX.firebase.auth.currentUser;
                    }

                    if (
                        typeof RX.firebase.auth ===
                        "function"
                    ) {

                        const auth =
                            RX.firebase.auth();

                        if (
                            auth &&
                            auth.currentUser
                        ) {

                            return auth.currentUser;
                        }
                    }
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    const auth =
                        firebase.auth();

                    if (
                        auth &&
                        auth.currentUser
                    ) {

                        return auth.currentUser;
                    }
                }

            } catch (error) {}


            /*
             * Local RiderX session fallback.
             */

            const keys = [

                "riderx_rider",
                "riderx_user"

            ];


            for (
                let i = 0;
                i < keys.length;
                i++
            ) {

                try {

                    const saved =
                        localStorage.getItem(
                            keys[i]
                        );


                    if (
                        saved
                    ) {

                        const user =
                            JSON.parse(
                                saved
                            );


                        if (
                            user
                        ) {

                            return user;
                        }
                    }

                } catch (error) {}
            }


            return null;
        };


    /* ========================================================
       RIDER ID
       ======================================================== */

    Flow.getRiderId =
        function () {

            const user =
                Flow.getUser() ||
                {};


            return (

                user.uid ||

                user.riderId ||

                user.driverId ||

                user.id ||

                localStorage.getItem(
                    "riderx_uid"
                ) ||

                localStorage.getItem(
                    "riderx_rider_id"
                ) ||

                null

            );
        };


    /* ========================================================
       CUSTOMER ID
       ======================================================== */

    Flow.getCustomerId =
        function (
            ride
        ) {

            ride =
                ride ||
                Flow.state.ride ||
                {};


            return (

                ride.customerId ||

                ride.userId ||

                ride.passengerId ||

                ride.customerUID ||

                ride.customerUid ||

                null

            );
        };


    /* ========================================================
       RIDE ID
       ======================================================== */

    Flow.getRideId =
        function (
            ride
        ) {

            ride =
                ride ||
                {};


            return (

                ride.rideId ||

                ride.id ||

                Flow.state.rideId ||

                localStorage.getItem(
                    Flow.config.activeRideKey
                ) ||

                null

            );
        };


    /* ========================================================
       NORMALIZE STATUS
       ======================================================== */

    Flow.normalizeStatus =
        function (
            status
        ) {

            const value =
                String(
                    status ||
                    "accepted"
                )
                .toLowerCase()
                .trim()
                .replace(
                    /[\s-]+/g,
                    "_"
                );


            const aliases = {

                pending:
                    "searching",

                requested:
                    "searching",

                searching:
                    "searching",

                matching:
                    "searching",

                matched:
                    "accepted",

                assigned:
                    "accepted",

                accepted:
                    "accepted",

                driver_assigned:
                    "accepted",

                rider_assigned:
                    "accepted",

                arriving:
                    "arriving",

                enroute:
                    "arriving",

                en_route:
                    "arriving",

                on_the_way:
                    "arriving",

                going_to_pickup:
                    "arriving",

                arrived:
                    "arrived",

                at_pickup:
                    "arrived",

                pickup_arrived:
                    "arrived",

                otp:
                    "otp_verified",

                otp_verified:
                    "otp_verified",

                verified:
                    "otp_verified",

                started:
                    "in_progress",

                ongoing:
                    "in_progress",

                in_progress:
                    "in_progress",

                riding:
                    "in_progress",

                trip_started:
                    "in_progress",

                completed:
                    "completed",

                complete:
                    "completed",

                finished:
                    "completed",

                cancelled:
                    "cancelled",

                canceled:
                    "cancelled",

                rejected:
                    "cancelled"
            };


            return (
                aliases[value] ||
                value
            );
        };


    /* ========================================================
       CHECK STATUS
       ======================================================== */

    Flow.isTerminalStatus =
        function (
            status
        ) {

            status =
                Flow.normalizeStatus(
                    status
                );


            return (

                status ===
                    "completed" ||

                status ===
                    "cancelled"

            );
        };


    /* ========================================================
       CAN TRANSITION
       ======================================================== */

    Flow.canTransition =
        function (
            from,
            to
        ) {

            from =
                Flow.normalizeStatus(
                    from
                );

            to =
                Flow.normalizeStatus(
                    to
                );


            if (
                from ===
                to
            ) {

                return true;
            }


            /*
             * Never move away from terminal states.
             */

            if (
                Flow.isTerminalStatus(
                    from
                )
            ) {

                return false;
            }


            /*
             * Cancellation is allowed only
             * before trip completion.
             */

            if (
                to ===
                "cancelled"
            ) {

                return [
                    "searching",
                    "accepted",
                    "arriving",
                    "arrived"
                ].includes(
                    from
                );
            }


            /*
             * Strict state-machine transition.
             */

            return (
                Flow.nextStates[
                    from
                ] &&
                Flow.nextStates[
                    from
                ].includes(
                    to
                )
            );
        };


    /* ========================================================
       RIDE OWNERSHIP
       ======================================================== */

    Flow.isRideOwnedByCurrentRider =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return false;
            }


            const riderId =
                Flow.getRiderId();


            if (
                !riderId
            ) {

                return false;
            }


            const assignedRider =
                ride.riderId ||
                ride.driverId ||
                ride.acceptedBy;


            /*
             * No rider assigned yet.
             */

            if (
                !assignedRider
            ) {

                return true;
            }


            return (
                String(
                    assignedRider
                ) ===
                String(
                    riderId
                )
            );
        };


    /* ========================================================
       NORMALIZE RIDE
       ======================================================== */

    Flow.normalizeRide =
        function (
            ride,
            rideId
        ) {

            if (
                !ride
            ) {

                return null;
            }


            const normalized = {

                ...ride,

                rideId:
                    ride.rideId ||
                    ride.id ||
                    rideId ||
                    null
            };


            normalized.status =
                Flow.normalizeStatus(
                    ride.status
                );


            if (
                normalized.riderId &&
                !normalized.driverId
            ) {

                normalized.driverId =
                    normalized.riderId;
            }


            if (
                normalized.driverId &&
                !normalized.riderId
            ) {

                normalized.riderId =
                    normalized.driverId;
            }


            return normalized;
        };


    /* ========================================================
       ACCEPT RIDE
       ======================================================== */

    Flow.acceptRide =
        async function (
            data
        ) {

            data =
                data ||
                {};


            const rideId =
                data.rideId ||
                data.id;


            if (
                !rideId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride ID is required."
                };
            }


            const riderId =
                data.riderId ||
                Flow.getRiderId();


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
                Flow.getDatabase();


            let existing =
                null;


            /*
             * Always load the current remote ride
             * before accepting.
             */

            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Flow.config.ridesPath +
                                "/" +
                                rideId
                            )
                            .once(
                                "value"
                            );


                    existing =
                        snapshot.val() ||
                        null;

                } catch (error) {

                    console.error(
                        "Ride acceptance load failed:",
                        error
                    );


                    return {

                        success:
                            false,

                        error:
                            "Unable to verify ride availability."
                    };
                }

            } else {

                existing =
                    await Flow.loadRide(
                        rideId
                    );
            }


            /*
             * Do not accept an already completed/cancelled ride.
             */

            if (
                existing
            ) {

                const currentStatus =
                    Flow.normalizeStatus(
                        existing.status
                    );


                if (
                    Flow.isTerminalStatus(
                        currentStatus
                    )
                ) {

                    return {

                        success:
                            false,

                        error:
                            "This ride is no longer available."
                    };
                }


                /*
                 * Prevent another rider from
                 * taking an already assigned ride.
                 */

                const assignedRider =
                    existing.riderId ||
                    existing.driverId ||
                    existing.acceptedBy;


                if (
                    assignedRider &&
                    String(
                        assignedRider
                    ) !==
                    String(
                        riderId
                    )
                ) {

                    return {

                        success:
                            false,

                        error:
                            "This ride has already been accepted by another rider."
                    };
                }
            }


            const ride =
                {

                    ...(existing || {}),
                    ...data,

                    rideId:
                        rideId,

                    riderId:
                        riderId,

                    driverId:
                        riderId,

                    acceptedBy:
                        riderId,

                    status:
                        "accepted",

                    acceptedAt:
                        existing?.acceptedAt ||
                        Date.now(),

                    updatedAt:
                        Date.now()
                };


            /*
             * If the remote ride exists, verify the
             * current state before changing it.
             */

            if (
                existing
            ) {

                const current =
                    Flow.normalizeStatus(
                        existing.status
                    );


                if (
                    current !==
                        "searching" &&
                    current !==
                        "accepted"
                ) {

                    return {

                        success:
                            false,

                        error:
                            "Ride is not available for acceptance."
                    };
                }
            }


            const result =
                await Flow.updateRide(
                    ride,
                    {

                        status:
                            "accepted",

                        riderId:
                            riderId,

                        driverId:
                            riderId,

                        acceptedBy:
                            riderId,

                        acceptedAt:
                            ride.acceptedAt
                    }
                );


            if (
                !result.success
            ) {

                return result;
            }


            Flow.setActiveRide(
                ride
            );


            Flow.state.ride =
                ride;

            Flow.state.rideId =
                rideId;

            Flow.state.status =
                "accepted";


            Flow.state.otpAttempts =
                0;


            Flow.saveOtpAttempts();


            Flow.startRideListener(
                rideId
            );


            /*
             * Notification should not make
             * ride acceptance fail.
             */

            Flow.notifyCustomer(
                ride,
                "accepted"
            );


            Flow.emit(
                "accepted",
                {

                    ride:
                        ride,

                    rideId:
                        rideId
                }
            );


            return {

                success:
                    true,

                ride:
                    ride,

                rideId:
                    rideId
            };
        };


    /* ========================================================
       START ARRIVING
       ======================================================== */

    Flow.startArriving =
        async function () {

            return Flow.setStatus(
                "arriving",
                {

                    arrivingAt:
                        Date.now()
                }
            );
        };


    /* ========================================================
       ARRIVED AT PICKUP
       ======================================================== */

    Flow.arrivedAtPickup =
        async function () {

            const ride =
                Flow.state.ride;


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "No active ride."
                };
            }


            const result =
                await Flow.setStatus(
                    "arrived",
                    {

                        arrivedAt:
                            Date.now(),

                        pickupArrivedAt:
                            Date.now()
                    }
                );


            if (
                result.success
            ) {

                Flow.notifyCustomer(
                    Flow.state.ride,
                    "arrived"
                );
            }


            return result;
        };


    /* ========================================================
       GET EXPECTED OTP
       ======================================================== */

    Flow.getExpectedOTP =
        async function (
            ride
        ) {

            ride =
                ride ||
                Flow.state.ride;


            if (
                !ride
            ) {

                return "";
            }


            const directOtp =
                ride.otp ||
                ride.rideOtp ||
                ride.pickupOtp ||
                ride.customerOtp ||
                ride.otpCode;


            if (
                directOtp
            ) {

                return String(
                    directOtp
                )
                .replace(
                    /\D/g,
                    ""
                );
            }


            const database =
                Flow.getDatabase();


            const customerId =
                Flow.getCustomerId(
                    ride
                );


            if (
                database &&
                customerId
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Flow.config
                                    .customersPath +
                                "/" +
                                customerId
                            )
                            .once(
                                "value"
                            );


                    const customer =
                        snapshot.val() ||
                        {};


                    const customerOtp =
                        customer.rideOtp ||
                        customer.otp ||
                        customer.pickupOtp ||
                        customer.rideOTP;


                    return String(
                        customerOtp ||
                        ""
                    )
                    .replace(
                        /\D/g,
                        ""
                    );

                } catch (error) {

                    console.warn(
                        "Customer OTP lookup failed:",
                        error
                    );
                }
            }


            return "";
        };


    /* ========================================================
       OTP ATTEMPTS STORAGE
       ======================================================== */

    Flow.loadOtpAttempts =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Flow.config.otpAttemptsKey
                    );


                const attempts =
                    Number(
                        saved
                    );


                Flow.state.otpAttempts =
                    Number.isFinite(
                        attempts
                    )
                        ? Math.max(
                            0,
                            attempts
                        )
                        : 0;

            } catch (error) {

                Flow.state.otpAttempts =
                    0;
            }


            return Flow.state.otpAttempts;
        };


    Flow.saveOtpAttempts =
        function () {

            try {

                localStorage.setItem(
                    Flow.config.otpAttemptsKey,
                    String(
                        Flow.state.otpAttempts
                    )
                );

            } catch (error) {}
        };


    Flow.clearOtpAttempts =
        function () {

            Flow.state.otpAttempts =
                0;


            try {

                localStorage.removeItem(
                    Flow.config.otpAttemptsKey
                );

            } catch (error) {}
        };


    /* ========================================================
       VERIFY OTP
       ======================================================== */

    Flow.verifyOTP =
        async function (
            otp
        ) {

            otp =
                String(
                    otp ??
                    ""
                )
                .replace(
                    /\D/g,
                    ""
                );


            if (
                otp.length !==
                Flow.config.otpLength
            ) {

                return {

                    success:
                        false,

                    error:
                        "Enter a valid 4-digit OTP."
                };
            }


            const ride =
                Flow.state.ride;


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "No active ride."
                };
            }


            const currentStatus =
                Flow.normalizeStatus(
                    ride.status
                );


            /*
             * OTP is only valid at pickup.
             */

            if (
                currentStatus !==
                "arrived"
            ) {

                return {

                    success:
                        false,

                    error:
                        "OTP can only be verified after the rider reaches pickup."
                };
            }


            if (
                Flow.state.otpAttempts >=
                Flow.config.maxOtpAttempts
            ) {

                return {

                    success:
                        false,

                    error:
                        "Too many OTP attempts. Please contact support."
                };
            }


            const expected =
                await Flow.getExpectedOTP(
                    ride
                );


            /*
             * Never accept an arbitrary OTP
             * when no OTP exists.
             */

            if (
                !expected
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride OTP is not available yet. Please try again."
                };
            }


            const valid =
                expected ===
                otp;


            if (
                !valid
            ) {

                Flow.state.otpAttempts++;


                Flow.saveOtpAttempts();


                Flow.emit(
                    "otp-invalid",
                    {

                        attempts:
                            Flow.state.otpAttempts,

                        remaining:
                            Math.max(
                                0,
                                Flow.config
                                    .maxOtpAttempts -
                                Flow.state.otpAttempts
                            )
                    }
                );


                return {

                    success:
                        false,

                    error:
                        "Incorrect OTP.",

                    attempts:
                        Flow.state.otpAttempts,

                    remaining:
                        Math.max(
                            0,
                            Flow.config
                                .maxOtpAttempts -
                            Flow.state.otpAttempts
                        )
                };
            }


            /*
             * OTP verified successfully.
             */

            const result =
                await Flow.setStatus(
                    "otp_verified",
                    {

                        otpVerified:
                            true,

                        otpVerifiedAt:
                            Date.now()
                    }
                );


            if (
                !result.success
            ) {

                return result;
            }


            Flow.clearOtpAttempts();


            Flow.emit(
                "otp-verified",
                {

                    ride:
                        Flow.state.ride
                }
            );


            return {

                success:
                    true,

                ride:
                    Flow.state.ride
            };
        };


    /* ========================================================
       START TRIP
       ======================================================== */

    Flow.startTrip =
        async function () {

            const ride =
                Flow.state.ride;


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "No active ride."
                };
            }


            const status =
                Flow.normalizeStatus(
                    ride.status
                );


            /*
             * OTP verification is mandatory.
             *
             * Previous implementation allowed:
             *
             * accepted → in_progress
             *
             * which is unsafe.
             */

            if (
                status !==
                "otp_verified"
            ) {

                return {

                    success:
                        false,

                    error:
                        "Verify the customer's OTP before starting the trip."
                };
            }


            const result =
                await Flow.setStatus(
                    "in_progress",
                    {

                        startedAt:
                            Date.now(),

                        tripStartedAt:
                            Date.now(),

                        otpVerified:
                            true
                    }
                );


            if (
                result.success
            ) {

                Flow.notifyCustomer(
                    Flow.state.ride,
                    "started"
                );


                Flow.emit(
                    "started",
                    {

                        ride:
                            Flow.state.ride
                    }
                );
            }


            return result;
        };


    /* ========================================================
       COMPLETE TRIP
       ======================================================== */

    Flow.completeTrip =
        async function (
            options
        ) {

            options =
                options ||
                {};


            const ride =
                Flow.state.ride;


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "No active ride."
                };
            }


            const status =
                Flow.normalizeStatus(
                    ride.status
                );


            if (
                status !==
                "in_progress"
            ) {

                return {

                    success:
                        false,

                    error:
                        "Trip can only be completed after it has started."
                };
            }


            /*
             * Handoff to ride-complete.js
             */

            if (
                RX.rideComplete &&
                typeof RX.rideComplete.complete ===
                "function"
            ) {

                const result =
                    await RX.rideComplete.complete(
                        ride,
                        options
                    );


                if (
                    result &&
                    result.success
                ) {

                    const completedRide =
                        Flow.normalizeRide(
                            result.ride ||
                            ride,
                            Flow.getRideId(
                                ride
                            )
                        );


                    Flow.state.status =
                        "completed";

                    Flow.state.ride =
                        completedRide;


                    Flow.clearOtpAttempts();


                    Flow.clearActiveRide();


                    Flow.notifyCustomer(
                        completedRide,
                        "completed"
                    );


                    Flow.emit(
                        "completed",
                        {

                            ...result,

                            ride:
                                completedRide
                        }
                    );
                }


                return result;
            }


            /*
             * Fallback.
             */

            const result =
                await Flow.setStatus(
                    "completed",
                    {

                        completedAt:
                            Date.now(),

                        endedAt:
                            Date.now(),

                        dropCompletedAt:
                            Date.now(),

                        paymentMethod:
                            options.paymentMethod ||
                            ride.paymentMethod ||
                            "cash"
                    }
                );


            if (
                result.success
            ) {

                Flow.clearOtpAttempts();


                Flow.notifyCustomer(
                    Flow.state.ride,
                    "completed"
                );


                Flow.clearActiveRide();


                Flow.emit(
                    "completed",
                    {

                        ride:
                            Flow.state.ride
                    }
                );
            }


            return result;
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    Flow.cancelRide =
        async function (
            reason
        ) {

            reason =
                reason ||
                "Cancelled by rider";


            const ride =
                Flow.state.ride;


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "No active ride."
                };
            }


            const status =
                Flow.normalizeStatus(
                    ride.status
                );


            if (
                ![
                    "searching",
                    "accepted",
                    "arriving",
                    "arrived"
                ].includes(
                    status
                )
            ) {

                return {

                    success:
                        false,

                    error:
                        "This ride cannot be cancelled at the current stage."
                };
            }


            const result =
                await Flow.setStatus(
                    "cancelled",
                    {

                        cancelledAt:
                            Date.now(),

                        cancelledBy:
                            "rider",

                        cancellationReason:
                            reason
                    }
                );


            if (
                result.success
            ) {

                Flow.clearOtpAttempts();


                Flow.notifyCustomer(
                    Flow.state.ride,
                    "cancelled"
                );


                Flow.emit(
                    "cancelled",
                    {

                        ride:
                            Flow.state.ride,

                        reason:
                            reason
                    }
                );


                Flow.clearActiveRide();
            }


            return result;
        };


    /* ========================================================
       SET STATUS
       ======================================================== */

    Flow.setStatus =
        async function (
            status,
            extra
        ) {

            status =
                Flow.normalizeStatus(
                    status
                );


            extra =
                extra ||
                {};


            if (
                Flow.state.updating
            ) {

                return {

                    success:
                        false,

                    error:
                        "Another ride update is in progress."
                };
            }


            const ride =
                Flow.state.ride;


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "No active ride."
                };
            }


            const rideId =
                Flow.getRideId(
                    ride
                );


            if (
                !rideId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride ID missing."
                };
            }


            const current =
                Flow.normalizeStatus(
                    ride.status ||
                    "accepted"
                );


            if (
                !Flow.canTransition(
                    current,
                    status
                )
            ) {

                return {

                    success:
                        false,

                    error:
                        `Cannot change ride from ${current} to ${status}.`
                };
            }


            /*
             * Prevent rider from changing another
             * rider's ride.
             */

            if (
                !Flow.isRideOwnedByCurrentRider(
                    ride
                )
            ) {

                return {

                    success:
                        false,

                    error:
                        "This ride belongs to another rider."
                };
            }


            const updated =
                {

                    ...ride,
                    ...extra,

                    rideId:
                        rideId,

                    status:
                        status,

                    updatedAt:
                        Date.now()
                };


            Flow.state.updating =
                true;


            try {

                const result =
                    await Flow.updateRide(
                        updated,
                        extra
                    );


                if (
                    !result.success
                ) {

                    return result;
                }


                Flow.state.ride =
                    updated;

                Flow.state.rideId =
                    rideId;

                Flow.state.status =
                    status;


                if (
                    status ===
                        "otp_verified"
                ) {

                    updated.otpVerified =
                        true;
                }


                Flow.setActiveRide(
                    updated
                );


                Flow.updateStatusUI(
                    updated
                );


                Flow.emit(
                    "status",
                    {

                        status:
                            status,

                        previousStatus:
                            current,

                        ride:
                            updated
                    }
                );


                return {

                    success:
                        true,

                    status:
                        status,

                    ride:
                        updated
                };

            } finally {

                Flow.state.updating =
                    false;
            }
        };


    /* ========================================================
       FIREBASE RIDE UPDATE
       ======================================================== */

    Flow.updateRide =
        async function (
            ride,
            extra
        ) {

            ride =
                Flow.normalizeRide(
                    ride
                );


            const database =
                Flow.getDatabase();


            const rideId =
                Flow.getRideId(
                    ride
                );


            if (
                !rideId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride ID missing."
                };
            }


            const payload =
                {

                    ...(extra || {}),

                    status:
                        ride.status,

                    updatedAt:
                        Date.now()
                };


            /*
             * Preserve important assignment data.
             */

            if (
                ride.riderId
            ) {

                payload.riderId =
                    ride.riderId;
            }


            if (
                ride.driverId
            ) {

                payload.driverId =
                    ride.driverId;
            }


            if (
                ride.acceptedBy
            ) {

                payload.acceptedBy =
                    ride.acceptedBy;
            }


            if (
                ride.customerId
            ) {

                payload.customerId =
                    ride.customerId;
            }


            /*
             * Important ride timestamps.
             */

            [
                "acceptedAt",
                "arrivingAt",
                "arrivedAt",
                "pickupArrivedAt",
                "otpVerifiedAt",
                "startedAt",
                "tripStartedAt",
                "completedAt",
                "endedAt",
                "cancelledAt"
            ]
            .forEach(
                function (
                    key
                ) {

                    if (
                        ride[key] !==
                        undefined
                    ) {

                        payload[key] =
                            ride[key];
                    }
                }
            );


            if (
                ride.otpVerified !==
                undefined
            ) {

                payload.otpVerified =
                    ride.otpVerified;
            }


            if (
                ride.paymentMethod
            ) {

                payload.paymentMethod =
                    ride.paymentMethod;
            }


            if (
                ride.cancellationReason
            ) {

                payload.cancellationReason =
                    ride.cancellationReason;
            }


            if (
                database
            ) {

                try {

                    /*
                     * Before writing an assignment,
                     * verify current remote owner.
                     */

                    const remoteSnapshot =
                        await database
                            .ref(
                                Flow.config.ridesPath +
                                "/" +
                                rideId
                            )
                            .once(
                                "value"
                            );


                    const remoteRide =
                        remoteSnapshot.val();


                    if (
                        remoteRide
                    ) {

                        const remoteOwner =
                            remoteRide.riderId ||
                            remoteRide.driverId ||
                            remoteRide.acceptedBy;


                        const localOwner =
                            ride.riderId ||
                            ride.driverId ||
                            ride.acceptedBy;


                        if (
                            remoteOwner &&
                            localOwner &&
                            String(
                                remoteOwner
                            ) !==
                            String(
                                localOwner
                            )
                        ) {

                            return {

                                success:
                                    false,

                                error:
                                    "Ride ownership conflict. Another rider is assigned."
                            };
                        }


                        const remoteStatus =
                            Flow.normalizeStatus(
                                remoteRide.status
                            );


                        /*
                         * Never overwrite a terminal ride.
                         */

                        if (
                            Flow.isTerminalStatus(
                                remoteStatus
                            ) &&
                            remoteStatus !==
                            Flow.normalizeStatus(
                                ride.status
                            )
                        ) {

                            return {

                                success:
                                    false,

                                error:
                                    "Ride is already closed."
                            };
                        }
                    }


                    await database
                        .ref(
                            Flow.config.ridesPath +
                            "/" +
                            rideId
                        )
                        .update(
                            payload
                        );


                    /*
                     * Keep rideRequests synchronized.
                     */

                    try {

                        await database
                            .ref(
                                Flow.config.requestsPath +
                                "/" +
                                rideId
                            )
                            .update(
                                payload
                            );

                    } catch (error) {

                        console.warn(
                            "Ride request sync failed:",
                            error
                        );
                    }


                    return {

                        success:
                            true,

                        offline:
                            false
                    };

                } catch (error) {

                    console.error(
                        "RiderX Firebase ride update failed:",
                        error
                    );


                    return {

                        success:
                            false,

                        error:
                            error.message ||
                            "Firebase ride update failed."
                    };
                }
            }


            /*
             * Local fallback.
             *
             * This is only a local recovery mechanism;
             * it does not claim that the ride was synced
             * to Firebase.
             */

            try {

                localStorage.setItem(
                    Flow.config.activeRideKey,
                    JSON.stringify(
                        ride
                    )
                );

            } catch (error) {}


            return {

                success:
                    true,

                offline:
                    true
            };
        };


    /* ========================================================
       LOAD RIDE
       ======================================================== */

    Flow.loadRide =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                Flow.getRideId();


            if (
                !rideId
            ) {

                return null;
            }


            const database =
                Flow.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Flow.config.ridesPath +
                                "/" +
                                rideId
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val();


                    if (
                        data
                    ) {

                        const ride =
                            Flow.normalizeRide(
                                data,
                                rideId
                            );


                        Flow.state.ride =
                            ride;

                        Flow.state.rideId =
                            rideId;

                        Flow.state.status =
                            Flow.normalizeStatus(
                                ride.status
                            );


                        return ride;
                    }

                } catch (error) {

                    console.warn(
                        "Ride load failed:",
                        error
                    );
                }
            }


            /*
             * Local fallback.
             */

            try {

                const saved =
                    localStorage.getItem(
                        Flow.config.activeRideKey
                    );


                if (
                    saved
                ) {

                    const localRide =
                        JSON.parse(
                            saved
                        );


                    const localRideId =
                        Flow.getRideId(
                            localRide
                        );


                    if (
                        String(
                            localRideId
                        ) ===
                        String(
                            rideId
                        )
                    ) {

                        const ride =
                            Flow.normalizeRide(
                                localRide,
                                rideId
                            );


                        Flow.state.ride =
                            ride;

                        Flow.state.rideId =
                            rideId;

                        Flow.state.status =
                            Flow.normalizeStatus(
                                ride.status
                            );


                        return ride;
                    }
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       START RIDE LISTENER
       ======================================================== */

    Flow.startRideListener =
        function (
            rideId
        ) {

            const database =
                Flow.getDatabase();


            rideId =
                rideId ||
                Flow.getRideId();


            if (
                !database ||
                !rideId
            ) {

                return false;
            }


            Flow.stopRideListener();


            const ref =
                database.ref(
                    Flow.config.ridesPath +
                    "/" +
                    rideId
                );


            const callback =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val();


                    if (
                        !data
                    ) {

                        return;
                    }


                    const remoteRide =
                        Flow.normalizeRide(
                            data,
                            rideId
                        );


                    const currentRide =
                        Flow.state.ride;


                    /*
                     * Protect local rider ownership.
                     */

                    const localRiderId =
                        Flow.getRiderId();


                    const remoteOwner =
                        remoteRide.riderId ||
                        remoteRide.driverId ||
                        remoteRide.acceptedBy;


                    if (
                        localRiderId &&
                        remoteOwner &&
                        String(
                            localRiderId
                        ) !==
                        String(
                            remoteOwner
                        )
                    ) {

                        Flow.emit(
                            "ownership-conflict",
                            {

                                ride:
                                    remoteRide
                            }
                        );


                        return;
                    }


                    /*
                     * If a local ride is already terminal,
                     * don't revive it with an old update.
                     */

                    if (
                        currentRide &&
                        Flow.isTerminalStatus(
                            currentRide.status
                        ) &&
                        !Flow.isTerminalStatus(
                            remoteRide.status
                        )
                    ) {

                        return;
                    }


                    Flow.state.ride =
                        remoteRide;

                    Flow.state.rideId =
                        rideId;

                    Flow.state.status =
                        Flow.normalizeStatus(
                            remoteRide.status
                        );


                    Flow.setActiveRide(
                        remoteRide
                    );


                    Flow.updateStatusUI(
                        remoteRide
                    );


                    Flow.emit(
                        "remote-update",
                        {

                            ride:
                                remoteRide
                        }
                    );


                    /*
                     * Terminal rides no longer need
                     * a live listener.
                     */

                    if (
                        Flow.isTerminalStatus(
                            Flow.state.status
                        )
                    ) {

                        Flow.stopRideListener();
                    }
                };


            ref.on(
                "value",
                callback
            );


            Flow.state.listeners.push(
                {

                    ref:
                        ref,

                    event:
                        "value",

                    callback:
                        callback
                }
            );


            return true;
        };


    /* ========================================================
       STOP RIDE LISTENER
       ======================================================== */

    Flow.stopRideListener =
        function () {

            (
                Flow.state.listeners ||
                []
            )
            .forEach(
                function (
                    item
                ) {

                    try {

                        if (
                            item &&
                            item.ref
                        ) {

                            item.ref.off(
                                item.event,
                                item.callback
                            );
                        }

                    } catch (error) {}
                }
            );


            Flow.state.listeners =
                [];


            return true;
        };


    /* ========================================================
       ACTIVE RIDE STORAGE
       ======================================================== */

    Flow.setActiveRide =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return;
            }


            ride =
                Flow.normalizeRide(
                    ride
                );


            Flow.state.ride =
                ride;

            Flow.state.rideId =
                Flow.getRideId(
                    ride
                );

            Flow.state.status =
                Flow.normalizeStatus(
                    ride.status
                );


            try {

                localStorage.setItem(
                    Flow.config.activeRideKey,
                    JSON.stringify(
                        ride
                    )
                );


                localStorage.setItem(
                    Flow.config.activeStatusKey,
                    Flow.state.status
                );

            } catch (error) {}


            return ride;
        };


    Flow.clearActiveRide =
        function () {

            Flow.stopRideListener();


            Flow.state.ride =
                null;

            Flow.state.rideId =
                null;

            Flow.state.status =
                null;

            Flow.state.updating =
                false;


            Flow.clearOtpAttempts();


            try {

                localStorage.removeItem(
                    Flow.config.activeRideKey
                );

                localStorage.removeItem(
                    Flow.config.activeStatusKey
                );

            } catch (error) {}


            Flow.emit(
                "active-cleared"
            );


            return true;
        };


    /* ========================================================
       RESTORE ACTIVE RIDE
       ======================================================== */

    Flow.restoreActiveRide =
        async function () {

            try {

                const saved =
                    localStorage.getItem(
                        Flow.config.activeRideKey
                    );


                if (
                    !saved
                ) {

                    return null;
                }


                const localRide =
                    Flow.normalizeRide(
                        JSON.parse(
                            saved
                        )
                    );


                const rideId =
                    Flow.getRideId(
                        localRide
                    );


                if (
                    !rideId
                ) {

                    Flow.clearActiveRide();

                    return null;
                }


                Flow.loadOtpAttempts();


                /*
                 * Try Firebase first.
                 */

                const remoteRide =
                    await Flow.loadRide(
                        rideId
                    );


                const ride =
                    remoteRide ||
                    localRide;


                const status =
                    Flow.normalizeStatus(
                        ride.status
                    );


                if (
                    Flow.isTerminalStatus(
                        status
                    )
                ) {

                    Flow.clearActiveRide();

                    return null;
                }


                /*
                 * If a rider is logged in, make sure
                 * this active ride belongs to them.
                 */

                const riderId =
                    Flow.getRiderId();


                const owner =
                    ride.riderId ||
                    ride.driverId ||
                    ride.acceptedBy;


                if (
                    riderId &&
                    owner &&
                    String(
                        riderId
                    ) !==
                    String(
                        owner
                    )
                ) {

                    Flow.clearActiveRide();

                    return null;
                }


                Flow.setActiveRide(
                    ride
                );


                Flow.startRideListener(
                    rideId
                );


                Flow.updateStatusUI(
                    ride
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
                    "Active ride restore failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       CUSTOMER NOTIFICATION
       ======================================================== */

    Flow.notifyCustomer =
        async function (
            ride,
            type
        ) {

            const database =
                Flow.getDatabase();


            if (
                !database ||
                !ride
            ) {

                return false;
            }


            const customerId =
                Flow.getCustomerId(
                    ride
                );


            const rideId =
                Flow.getRideId(
                    ride
                );


            if (
                !customerId ||
                !rideId
            ) {

                return false;
            }


            const messages = {

                accepted:
                    "Your RiderX ride has been accepted.",

                arriving:
                    "Your RiderX rider is on the way to pickup.",

                arrived:
                    "Your RiderX rider has arrived at pickup.",

                started:
                    "Your RiderX trip has started.",

                completed:
                    "Your RiderX trip has been completed.",

                cancelled:
                    "Your RiderX ride has been cancelled."
            };


            const message =
                messages[type] ||
                "Your RiderX ride has been updated.";


            try {

                await database
                    .ref(
                        Flow.config
                            .notificationsPath +
                        "/" +
                        customerId
                    )
                    .push(
                        {

                            type:
                                "ride",

                            rideId:
                                rideId,

                            title:
                                "RiderX",

                            message:
                                message,

                            rideStatus:
                                Flow.normalizeStatus(
                                    ride.status
                                ),

                            read:
                                false,

                            createdAt:
                                Date.now()
                        }
                    );


                /*
                 * Keep customer's activeRide synchronized.
                 */

                const activeRideRef =
                    database.ref(
                        Flow.config
                            .customersPath +
                        "/" +
                        customerId +
                        "/activeRide"
                    );


                if (
                    type ===
                        "completed" ||
                    type ===
                        "cancelled"
                ) {

                    /*
                     * Remove stale active ride.
                     */

                    await activeRideRef
                        .remove();

                } else {

                    await activeRideRef
                        .update(
                            {

                                rideId:
                                    rideId,

                                status:
                                    Flow.normalizeStatus(
                                        ride.status
                                    ),

                                riderId:
                                    ride.riderId ||
                                    ride.driverId ||
                                    null,

                                updatedAt:
                                    Date.now()
                            }
                        );
                }


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
       UPDATE UI
       ======================================================== */

    Flow.updateStatusUI =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return;
            }


            const status =
                Flow.normalizeStatus(
                    ride.status
                );


            document
                .querySelectorAll(
                    "[data-ride-status]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Flow.getStatusLabel(
                                status
                            );


                        element.dataset.status =
                            status;
                    }
                );


            document
                .querySelectorAll(
                    "[data-ride-action]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const action =
                            element.dataset
                                .rideAction;


                        const allowed =
                            Flow.canUseAction(
                                action,
                                status
                            );


                        element.disabled =
                            !allowed;


                        element.dataset
                            .enabled =
                            allowed
                                ? "true"
                                : "false";
                    }
                );


            Flow.emit(
                "ui-update",
                {

                    status:
                        status,

                    ride:
                        ride
                }
            );
        };


    /* ========================================================
       ACTION CHECK
       ======================================================== */

    Flow.canUseAction =
        function (
            action,
            status
        ) {

            status =
                Flow.normalizeStatus(
                    status
                );


            const rules = {

                /*
                 * accept is normally handled
                 * by the incoming ride card,
                 * not active ride controls.
                 */

                accept:
                    [
                        "searching"
                    ],

                arriving:
                    [
                        "accepted"
                    ],

                arrived:
                    [
                        "arriving"
                    ],

                otp:
                    [
                        "arrived"
                    ],

                start:
                    [
                        "otp_verified"
                    ],

                complete:
                    [
                        "in_progress"
                    ],

                cancel:
                    [
                        "searching",
                        "accepted",
                        "arriving",
                        "arrived"
                    ]
            };


            if (
                !rules[action]
            ) {

                return true;
            }


            return rules[action]
                .includes(
                    status
                );
        };


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    Flow.getStatusLabel =
        function (
            status
        ) {

            const labels = {

                searching:
                    "Finding rider",

                accepted:
                    "Ride accepted",

                arriving:
                    "On the way to pickup",

                arrived:
                    "Arrived at pickup",

                otp_verified:
                    "OTP verified",

                in_progress:
                    "Trip in progress",

                completed:
                    "Ride completed",

                cancelled:
                    "Ride cancelled"
            };


            return (
                labels[
                    Flow.normalizeStatus(
                        status
                    )
                ] ||
                "Ride"
            );
        };


    /* ========================================================
       EMIT EVENT
       ======================================================== */

    Flow.emit =
        function (
            name,
            data
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-flow-" +
                        name,
                        {

                            detail:
                                data ||
                                {}
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX ride-flow event error:",
                    error
                );
            }
        };


    /* ========================================================
       EVENT LISTENER API
       ======================================================== */

    Flow.on =
        function (
            name,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                return function () {};
            }


            const eventName =
                "riderx-ride-flow-" +
                name;


            const handler =
                function (
                    event
                ) {

                    callback(
                        event.detail ||
                        {},
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
       GLOBAL API
       ======================================================== */

    RX.acceptRide =
        Flow.acceptRide;

    RX.startArriving =
        Flow.startArriving;

    RX.arrivedAtPickup =
        Flow.arrivedAtPickup;

    RX.verifyRideOTP =
        Flow.verifyOTP;

    RX.startTrip =
        Flow.startTrip;

    RX.completeTrip =
        Flow.completeTrip;

    RX.cancelRide =
        Flow.cancelRide;

    RX.getActiveRide =
        function () {

            return Flow.state.ride;
        };


    RX.getRideStatus =
        function () {

            return Flow.state.status;
        };


    RX.getRideId =
        function () {

            return Flow.state.rideId;
        };


    /* ========================================================
       DOM CLICK HANDLERS
       ======================================================== */

    document.addEventListener(
        "click",
        function (
            event
        ) {

            const button =
                event.target.closest(
                    "[data-ride-action]"
                );


            if (
                !button
            ) {

                return;
            }


            if (
                button.disabled
            ) {

                return;
            }


            const action =
                button.dataset
                    .rideAction;


            if (
                action ===
                "arriving"
            ) {

                Flow.startArriving();


            } else if (
                action ===
                "arrived"
            ) {

                Flow.arrivedAtPickup();


            } else if (
                action ===
                "start"
            ) {

                Flow.startTrip();


            } else if (
                action ===
                "complete"
            ) {

                Flow.completeTrip();


            } else if (
                action ===
                "cancel"
            ) {

                Flow.cancelRide(
                    button.dataset
                        .cancelReason
                );
            }

        }
    );


    /* ========================================================
       OTP FORM SUPPORT
       ======================================================== */

    document.addEventListener(
        "submit",
        function (
            event
        ) {

            const form =
                event.target.closest(
                    "[data-ride-otp-form]"
                );


            if (
                !form
            ) {

                return;
            }


            event.preventDefault();


            const input =
                form.querySelector(
                    "input[name='otp'], input[data-ride-otp]"
                );


            if (
                !input
            ) {

                return;
            }


            Flow.verifyOTP(
                input.value
            )
            .then(
                function (
                    result
                ) {

                    if (
                        !result.success
                    ) {

                        if (
                            RX.notification &&
                            typeof RX.notification.show ===
                            "function"
                        ) {

                            RX.notification.show(
                                result.error
                            );

                        } else {

                            console.warn(
                                result.error
                            );
                        }

                        return;
                    }


                    /*
                     * Clear OTP input after
                     * successful verification.
                     */

                    input.value =
                        "";

                    input.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );
                }
            )
            .catch(
                function (
                    error
                ) {

                    console.error(
                        "OTP verification error:",
                        error
                    );
                }
            );
        }
    );


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


            if (
                Flow.state.initializing
            ) {

                return;
            }


            Flow.state.initializing =
                true;


            try {

                Flow.loadOtpAttempts();


                /*
                 * Recover active ride after refresh.
                 */

                await Flow.restoreActiveRide();


                /*
                 * Update UI if a ride exists.
                 */

                if (
                    Flow.state.ride
                ) {

                    Flow.updateStatusUI(
                        Flow.state.ride
                    );
                }


                Flow.state.initialized =
                    true;


                console.log(
                    "RiderX ride-flow.js loaded."
                );

            } catch (error) {

                console.error(
                    "RiderX ride-flow initialization failed:",
                    error
                );

            } finally {

                Flow.state.initializing =
                    false;
            }
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
            Flow.init,
            {
                once:
                    true
            }
        );

    } else {

        Flow.init();
    }

})();
