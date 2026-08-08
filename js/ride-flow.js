/* ============================================================
   RIDERX - RIDE FLOW
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
   - Firebase ride synchronization
   - Customer notifications
   - OTP verification
   - Pickup / drop status
   - Ride completion handoff
   - Local active ride recovery
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Flow = RX.rideFlow =
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

        activeRideKey:
            "riderx_active_ride",

        activeStatusKey:
            "riderx_ride_status",

        otpLength:
            4,

        maxOtpAttempts:
            5
    };


    /* ========================================================
       STATE
       ======================================================== */

    Flow.state = {

        initialized:
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


    /* ========================================================
       USER
       ======================================================== */

    Flow.getUser =
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

    Flow.getRiderId =
        function () {

            const user =
                Flow.getUser() ||
                {};

            return (
                user.uid ||
                user.id ||
                user.riderId ||
                user.driverId ||
                localStorage.getItem(
                    "riderx_uid"
                ) ||
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

            return (
                ride?.rideId ||
                ride?.id ||
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
                .trim();


            const aliases = {

                pending:
                    "accepted",

                assigned:
                    "accepted",

                accepted:
                    "accepted",

                driver_assigned:
                    "accepted",

                arriving:
                    "arriving",

                enroute:
                    "arriving",

                en_route:
                    "arriving",

                on_the_way:
                    "arriving",

                arrived:
                    "arrived",

                at_pickup:
                    "arrived",

                otp:
                    "otp_verified",

                otp_verified:
                    "otp_verified",

                started:
                    "in_progress",

                ongoing:
                    "in_progress",

                in_progress:
                    "in_progress",

                riding:
                    "in_progress",

                completed:
                    "completed",

                finished:
                    "completed",

                cancelled:
                    "cancelled",

                canceled:
                    "cancelled"
            };


            return (
                aliases[value] ||
                value
            );
        };


    /* ========================================================
       STATUS ORDER
       ======================================================== */

    Flow.statusOrder =
        {

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


            if (
                to ===
                "cancelled"
            ) {

                return true;
            }


            if (
                !Flow.statusOrder
                    .hasOwnProperty(
                        from
                    ) ||
                !Flow.statusOrder
                    .hasOwnProperty(
                        to
                    )
            ) {

                return true;
            }


            return (
                Flow.statusOrder[to] >=
                Flow.statusOrder[from]
            );
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


            const existing =
                await Flow.loadRide(
                    rideId
                );


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

                    status:
                        "accepted",

                    acceptedAt:
                        existing?.acceptedAt ||
                        Date.now(),

                    updatedAt:
                        Date.now()
                };


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


            Flow.startRideListener(
                rideId
            );


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
                "arriving"
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


            if (
                Flow.state.otpAttempts >=
                Flow.config.maxOtpAttempts
            ) {

                return {

                    success:
                        false,

                    error:
                        "Too many OTP attempts."
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


            /*
             * Accept multiple possible field names
             * so the customer and rider systems
             * remain compatible.
             */

            const expected =
                String(
                    ride.otp ||
                    ride.rideOtp ||
                    ride.pickupOtp ||
                    ride.customerOtp ||
                    ""
                )
                .replace(
                    /\D/g,
                    "");


            /*
             * If OTP is not stored in ride object,
             * try Firebase customer record.
             */

            let valid =
                expected &&
                expected === otp;


            if (
                !valid &&
                !expected
            ) {

                const database =
                    Flow.getDatabase();


                const customerId =
                    ride.customerId ||
                    ride.userId ||
                    ride.passengerId;


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
                            String(
                                customer.rideOtp ||
                                customer.otp ||
                                ""
                            )
                            .replace(
                                /\D/g,
                                "");


                        valid =
                            customerOtp ===
                            otp;

                    } catch (error) {

                        console.warn(
                            "Customer OTP lookup failed:",
                            error
                        );
                    }
                }
            }


            if (
                !valid
            ) {

                Flow.state.otpAttempts++;


                Flow.emit(
                    "otp-invalid",
                    {

                        attempts:
                            Flow.state.otpAttempts
                    }
                );


                return {

                    success:
                        false,

                    error:
                        "Incorrect OTP.",

                    attempts:
                        Flow.state.otpAttempts
                };
            }


            /*
             * OTP verified.
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


            Flow.state.otpAttempts =
                0;


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
             * Normally OTP must be verified
             * before starting.
             */

            if (
                status !==
                    "otp_verified" &&
                status !==
                    "arrived" &&
                status !==
                    "accepted"
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride cannot be started from the current status."
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
                            ride.otpVerified ||
                            status ===
                                "otp_verified"
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


            /*
             * Handoff to ride-complete.js
             */

            if (
                RX.rideComplete &&
                typeof RX.rideComplete
                    .complete ===
                "function"
            ) {

                const result =
                    await RX.rideComplete
                        .complete(
                            ride,
                            options
                        );


                if (
                    result.success
                ) {

                    Flow.state.status =
                        "completed";

                    Flow.state.ride =
                        result.ride ||
                        ride;


                    Flow.clearActiveRide();


                    Flow.notifyCustomer(
                        Flow.state.ride,
                        "completed"
                    );


                    Flow.emit(
                        "completed",
                        result
                    );
                }


                return result;
            }


            /*
             * Fallback if ride-complete.js
             * is not loaded.
             */

            const result =
                await Flow.setStatus(
                    "completed",
                    {

                        completedAt:
                            Date.now(),

                        endedAt:
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

                Flow.clearActiveRide();

                Flow.notifyCustomer(
                    Flow.state.ride,
                    "completed"
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

                Flow.clearActiveRide();


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


            const updated =
                {

                    ...ride,
                    ...extra,

                    rideId:
                        Flow.getRideId(
                            ride
                        ),

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

                Flow.state.status =
                    status;


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
       UPDATE FIREBASE RIDE
       ======================================================== */

    Flow.updateRide =
        async function (
            ride,
            extra
        ) {

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

                    status:
                        ride.status,

                    updatedAt:
                        Date.now(),

                    ...(extra || {})
                };


            /*
             * Keep important rider information.
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
                database
            ) {

                try {

                    await database
                        .ref(
                            Flow.config
                                .ridesPath +
                            "/" +
                            rideId
                        )
                        .update(
                            payload
                        );


                    /*
                     * Keep request status in sync.
                     */

                    try {

                        await database
                            .ref(
                                Flow.config
                                    .requestsPath +
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
                            true
                    };

                } catch (error) {

                    console.error(
                        "Ride Firebase update failed:",
                        error
                    );


                    return {

                        success:
                            false,

                        error:
                            error.message ||
                            "Firebase update failed."
                    };
                }
            }


            /*
             * Offline/local fallback.
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
                                Flow.config
                                    .ridesPath +
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
                            {

                                ...data,

                                rideId:
                                    data.rideId ||
                                    rideId
                            };


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

                    const ride =
                        JSON.parse(
                            saved
                        );


                    if (
                        Flow.getRideId(
                            ride
                        ) === rideId
                    ) {

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
                    Flow.config
                        .ridesPath +
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


                    const ride =
                        {

                            ...data,

                            rideId:
                                data.rideId ||
                                rideId
                        };


                    Flow.state.ride =
                        ride;

                    Flow.state.rideId =
                        rideId;

                    Flow.state.status =
                        Flow.normalizeStatus(
                            ride.status
                        );


                    Flow.setActiveRide(
                        ride
                    );


                    Flow.updateStatusUI(
                        ride
                    );


                    Flow.emit(
                        "remote-update",
                        {

                            ride:
                                ride
                        }
                    );


                    /*
                     * Stop listener after completed/cancelled.
                     */

                    if (
                        [
                            "completed",
                            "cancelled"
                        ].includes(
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

                        item.ref.off(
                            item.event,
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
        };


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
                    JSON.parse(
                        saved
                    );


                const rideId =
                    Flow.getRideId(
                        localRide
                    );


                if (
                    !rideId
                ) {

                    return null;
                }


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
                    [
                        "completed",
                        "cancelled"
                    ].includes(
                        status
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
                ride.customerId ||
                ride.userId ||
                ride.passengerId;


            if (
                !customerId
            ) {

                return false;
            }


            const messages =
                {

                    accepted:
                        "Your RiderX ride has been accepted.",

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
                "Your ride has been updated.";


            try {

                await database
                    .ref(
                        "notifications/" +
                        customerId
                    )
                    .push(
                        {

                            type:
                                "ride",

                            rideId:
                                Flow.getRideId(
                                    ride
                                ),

                            title:
                                "RiderX",

                            message:
                                message,

                            rideStatus:
                                ride.status,

                            read:
                                false,

                            createdAt:
                                Date.now()
                        }
                    );


                /*
                 * Also keep customer ride record
                 * synchronized.
                 */

                await database
                    .ref(
                        Flow.config
                            .customersPath +
                        "/" +
                        customerId +
                        "/activeRide"
                    )
                    .update(
                        {

                            rideId:
                                Flow.getRideId(
                                    ride
                                ),

                            status:
                                ride.status,

                            updatedAt:
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


                        element.disabled =
                            !Flow.canUseAction(
                                action,
                                status
                            );

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


            const rules =
                {

                    accept:
                        [
                            "accepted"
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
                            "arrived",
                            "otp_verified"
                        ],

                    complete:
                        [
                            "in_progress"
                        ],

                    cancel:
                        [
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

            const labels =
                {

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

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-flow-" +
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


            const event =
                "riderx-ride-flow-" +
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


    /* ========================================================
       DOM EVENT HANDLERS
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
                            typeof RX.notification
                                .show ===
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

                    }

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


            Flow.state.initialized =
                true;


            /*
             * Recover active ride after refresh.
             */

            await Flow.restoreActiveRide();


            /*
             * If ride exists, update UI.
             */

            if (
                Flow.state.ride
            ) {

                Flow.updateStatusUI(
                    Flow.state.ride
                );
            }


            console.log(
                "RiderX ride-flow.js loaded."
            );
        };


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
