/* ============================================================
   RIDERX - RIDER RIDE
   File: js/rider-ride.js

   Handles:
   - Current rider ride
   - Ride request details
   - Accept ride
   - Arrive at pickup
   - Start ride with OTP
   - Complete ride
   - Cancel ride
   - Ride status synchronization
   - Firebase Realtime Database
   - Local fallback
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Ride = RX.riderRide =
        RX.riderRide || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Ride.config = {

        ridesPath:
            "rides",

        requestsPath:
            "rideRequests",

        ridersPath:
            "riders",

        currentRideKey:
            "riderx_current_ride",

        activeStatuses:
            [
                "requested",
                "searching",
                "accepted",
                "arriving",
                "arrived",
                "started",
                "in_progress"
            ],

        completedStatus:
            "completed",

        cancelledStatus:
            "cancelled"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Ride.state = {

        initialized:
            false,

        loading:
            false,

        actionInProgress:
            false,

        riderId:
            null,

        currentRide:
            null,

        listener:
            null
    };


    /* ========================================================
       FIREBASE DATABASE
       ======================================================== */

    Ride.getDatabase =
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

    Ride.getRiderId =
        function () {

            if (
                Ride.state.riderId
            ) {

                return Ride.state.riderId;
            }


            const profile =
                RX.getRiderProfile
                    ? RX.getRiderProfile()
                    : null;


            if (
                profile &&
                (
                    profile.uid ||
                    profile.id
                )
            ) {

                Ride.state.riderId =
                    profile.uid ||
                    profile.id;

                return Ride.state.riderId;
            }


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_uid"
                    );


                if (
                    saved
                ) {

                    Ride.state.riderId =
                        saved;

                    return saved;
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       GET CURRENT RIDE
       ======================================================== */

    Ride.getCurrent =
        function () {

            return Ride.state.currentRide;
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Ride.saveCache =
        function (
            ride
        ) {

            try {

                if (
                    ride
                ) {

                    localStorage.setItem(
                        Ride.config.currentRideKey,
                        JSON.stringify(
                            ride
                        )
                    );

                } else {

                    localStorage.removeItem(
                        Ride.config.currentRideKey
                    );
                }

            } catch (error) {}
        };


    Ride.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Ride.config.currentRideKey
                    );


                if (
                    saved
                ) {

                    Ride.state.currentRide =
                        JSON.parse(
                            saved
                        );


                    return Ride.state.currentRide;
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       NORMALIZE RIDE
       ======================================================== */

    Ride.normalize =
        function (
            ride,
            rideId
        ) {

            if (
                !ride
            ) {

                return null;
            }


            return {

                ...ride,

                id:
                    ride.id ||
                    rideId ||
                    ride.rideId ||
                    "",

                rideId:
                    ride.rideId ||
                    ride.id ||
                    rideId ||
                    "",

                riderId:
                    ride.riderId ||
                    ride.driverId ||
                    Ride.getRiderId(),

                customerId:
                    ride.customerId ||
                    ride.userId ||
                    ride.passengerId ||
                    "",

                customerName:
                    ride.customerName ||
                    ride.passengerName ||
                    ride.userName ||
                    "Customer",

                customerPhone:
                    ride.customerPhone ||
                    ride.passengerPhone ||
                    ride.userPhone ||
                    "",

                pickup:
                    ride.pickup ||
                    ride.pickupLocation ||
                    null,

                destination:
                    ride.destination ||
                    ride.dropoff ||
                    ride.dropoffLocation ||
                    null,

                pickupAddress:
                    ride.pickupAddress ||
                    ride.pickup?.address ||
                    "",

                destinationAddress:
                    ride.destinationAddress ||
                    ride.destination?.address ||
                    ride.dropoff?.address ||
                    "",

                status:
                    String(
                        ride.status ||
                        "requested"
                    ).toLowerCase(),

                fare:
                    Number(
                        ride.fare ??
                        ride.estimatedFare ??
                        ride.totalFare ??
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

                otp:
                    ride.otp ||
                    ride.startOtp ||
                    "",

                paymentMethod:
                    ride.paymentMethod ||
                    ride.payment ||
                    "cash",

                serviceType:
                    ride.serviceType ||
                    ride.rideType ||
                    "Bike Taxi",

                createdAt:
                    ride.createdAt ||
                    Date.now(),

                updatedAt:
                    ride.updatedAt ||
                    Date.now()
            };
        };


    /* ========================================================
       LOAD CURRENT RIDE
       ======================================================== */

    Ride.loadCurrent =
        async function () {

            if (
                Ride.state.loading
            ) {

                return Ride.state.currentRide;
            }


            Ride.state.loading =
                true;


            try {

                const riderId =
                    Ride.getRiderId();


                if (
                    !riderId
                ) {

                    Ride.loadCache();

                    Ride.render();

                    return Ride.state.currentRide;
                }


                const database =
                    Ride.getDatabase();


                if (
                    !database
                ) {

                    Ride.loadCache();

                    Ride.render();

                    return Ride.state.currentRide;
                }


                let found =
                    null;


                try {

                    const snapshot =
                        await database
                            .ref(
                                Ride.config.ridesPath
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


                    Object.entries(
                        data
                    )
                    .forEach(
                        function (
                            [
                                id,
                                ride
                            ]
                        ) {

                            const normalized =
                                Ride.normalize(
                                    ride,
                                    id
                                );


                            if (
                                !normalized
                            ) {

                                return;
                            }


                            if (
                                Ride.config
                                    .activeStatuses
                                    .includes(
                                        normalized.status
                                    )
                            ) {

                                if (
                                    !found ||
                                    normalized.createdAt >
                                    found.createdAt
                                ) {

                                    found =
                                        normalized;
                                }
                            }
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Current ride query failed:",
                        error
                    );
                }


                if (
                    found
                ) {

                    Ride.state.currentRide =
                        found;

                    Ride.saveCache(
                        found
                    );

                } else {

                    /*
                     * Preserve cache only if it is
                     * still active.
                     */

                    Ride.loadCache();


                    if (
                        Ride.state.currentRide &&
                        !Ride.config
                            .activeStatuses
                            .includes(
                                Ride.state
                                    .currentRide
                                    .status
                            )
                    ) {

                        Ride.state.currentRide =
                            null;

                        Ride.saveCache(
                            null
                        );
                    }
                }


                Ride.render();

                return Ride.state.currentRide;

            } finally {

                Ride.state.loading =
                    false;
            }
        };


    /* ========================================================
       SET CURRENT RIDE
       ======================================================== */

    Ride.setCurrent =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                Ride.state.currentRide =
                    null;

                Ride.saveCache(
                    null
                );

                Ride.render();

                return;
            }


            Ride.state.currentRide =
                Ride.normalize(
                    ride,
                    ride.id
                );


            Ride.saveCache(
                Ride.state.currentRide
            );


            Ride.render();


            Ride.emit(
                "changed",
                {

                    ride:
                        Ride.state.currentRide
                }
            );
        };


    /* ========================================================
       UPDATE RIDE
       ======================================================== */

    Ride.update =
        async function (
            rideId,
            updates
        ) {

            const id =
                rideId ||
                Ride.state.currentRide?.id;


            if (
                !id
            ) {

                throw new Error(
                    "Ride ID is missing."
                );
            }


            const database =
                Ride.getDatabase();


            const clean =
                {

                    ...updates,

                    updatedAt:
                        Date.now()
                };


            if (
                database
            ) {

                await database
                    .ref(
                        Ride.config.ridesPath +
                        "/" +
                        id
                    )
                    .update(
                        clean
                    );
            }


            if (
                Ride.state.currentRide &&
                Ride.state.currentRide.id ===
                id
            ) {

                Ride.state.currentRide =
                    Ride.normalize(
                        {

                            ...Ride.state.currentRide,

                            ...clean

                        },
                        id
                    );


                Ride.saveCache(
                    Ride.state.currentRide
                );


                Ride.render();
            }


            return Ride.state.currentRide;
        };


    /* ========================================================
       ACCEPT RIDE
       ======================================================== */

    Ride.accept =
        async function (
            ride
        ) {

            if (
                Ride.state.actionInProgress
            ) {

                return {

                    success:
                        false,

                    error:
                        "Another ride action is in progress."
                };
            }


            const riderId =
                Ride.getRiderId();


            if (
                !riderId
            ) {

                return Ride.fail(
                    "Rider login required."
                );
            }


            const normalized =
                Ride.normalize(
                    ride,
                    ride?.id ||
                    ride?.rideId
                );


            if (
                !normalized.id
            ) {

                return Ride.fail(
                    "Ride ID is missing."
                );
            }


            Ride.state.actionInProgress =
                true;


            try {

                const database =
                    Ride.getDatabase();


                const updates =
                    {

                        riderId:
                            riderId,

                        driverId:
                            riderId,

                        status:
                            "accepted",

                        acceptedAt:
                            Date.now(),

                        updatedAt:
                            Date.now()
                    };


                if (
                    database
                ) {

                    /*
                     * Transaction prevents two riders
                     * from accepting the same request.
                     */

                    const ref =
                        database.ref(
                            Ride.config.ridesPath +
                            "/" +
                            normalized.id
                        );


                    let accepted =
                        true;


                    try {

                        const result =
                            await ref.transaction(
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
                                            "requested"
                                        ).toLowerCase();


                                    if (
                                        status !==
                                        "requested" &&
                                        status !==
                                        "searching"
                                    ) {

                                        accepted =
                                            false;

                                        return;
                                    }


                                    return {

                                        ...current,

                                        ...updates
                                    };
                                }
                            );


                        if (
                            !result.committed ||
                            !accepted
                        ) {

                            return Ride.fail(
                                "This ride has already been accepted."
                            );
                        }

                    } catch (error) {

                        /*
                         * Fallback for databases where
                         * transaction is unavailable.
                         */

                        await ref.update(
                            updates
                        );
                    }


                    /*
                     * Remove request for this rider.
                     */

                    try {

                        await database
                            .ref(
                                Ride.config
                                    .requestsPath +
                                "/" +
                                normalized.id +
                                "/" +
                                riderId
                            )
                            .remove();

                    } catch (error) {}
                }


                Ride.setCurrent(
                    {

                        ...normalized,

                        ...updates
                    }
                );


                Ride.showMessage(
                    "Ride accepted successfully.",
                    "success"
                );


                Ride.emit(
                    "accepted",
                    {

                        ride:
                            Ride.state.currentRide
                    }
                );


                return {

                    success:
                        true,

                    ride:
                        Ride.state.currentRide
                };

            } catch (error) {

                console.error(
                    "Accept ride failed:",
                    error
                );


                return Ride.fail(
                    error.message ||
                    "Unable to accept ride."
                );

            } finally {

                Ride.state.actionInProgress =
                    false;
            }
        };


    /* ========================================================
       ARRIVE AT PICKUP
       ======================================================== */

    Ride.arrive =
        async function (
            rideId
        ) {

            const ride =
                Ride.state.currentRide;


            const id =
                rideId ||
                ride?.id;


            if (
                !id
            ) {

                return Ride.fail(
                    "No active ride found."
                );
            }


            try {

                const updated =
                    await Ride.update(
                        id,
                        {

                            status:
                                "arrived",

                            arrivedAt:
                                Date.now()
                        }
                    );


                Ride.showMessage(
                    "You have arrived at pickup.",
                    "success"
                );


                Ride.emit(
                    "arrived",
                    {

                        ride:
                            updated
                    }
                );


                return {

                    success:
                        true,

                    ride:
                        updated
                };

            } catch (error) {

                return Ride.fail(
                    error.message ||
                    "Unable to update ride."
                );
            }
        };


    /* ========================================================
       START RIDE
       ======================================================== */

    Ride.start =
        async function (
            otp
        ) {

            const ride =
                Ride.state.currentRide;


            if (
                !ride
            ) {

                return Ride.fail(
                    "No active ride found."
                );
            }


            const entered =
                String(
                    otp ||
                    ""
                )
                .trim();


            const expected =
                String(
                    ride.otp ||
                    ride.startOtp ||
                    ""
                )
                .trim();


            /*
             * If an OTP exists, verify it.
             */

            if (
                expected &&
                entered !==
                expected
            ) {

                return Ride.fail(
                    "Incorrect ride OTP."
                );
            }


            try {

                const updated =
                    await Ride.update(
                        ride.id,
                        {

                            status:
                                "started",

                            startedAt:
                                Date.now(),

                            tripStartedAt:
                                Date.now()
                        }
                    );


                Ride.showMessage(
                    "Ride started.",
                    "success"
                );


                Ride.emit(
                    "started",
                    {

                        ride:
                            updated
                    }
                );


                return {

                    success:
                        true,

                    ride:
                        updated
                };

            } catch (error) {

                return Ride.fail(
                    error.message ||
                    "Unable to start ride."
                );
            }
        };


    /* ========================================================
       COMPLETE RIDE
       ======================================================== */

    Ride.complete =
        async function (
            rideId,
            finalFare
        ) {

            const ride =
                Ride.state.currentRide;


            const id =
                rideId ||
                ride?.id;


            if (
                !id
            ) {

                return Ride.fail(
                    "No active ride found."
                );
            }


            try {

                const fare =
                    Number(
                        finalFare ??
                        ride?.fare ??
                        0
                    );


                const updates =
                    {

                        status:
                            "completed",

                        completedAt:
                            Date.now(),

                        tripCompletedAt:
                            Date.now(),

                        finalFare:
                            fare,

                        fare:
                            fare
                    };


                const updated =
                    await Ride.update(
                        id,
                        updates
                    );


                /*
                 * Clear active ride after completion.
                 */

                setTimeout(
                    function () {

                        if (
                            Ride.state.currentRide &&
                            Ride.state.currentRide.id ===
                            id
                        ) {

                            Ride.state.currentRide =
                                null;

                            Ride.saveCache(
                                null
                            );

                            Ride.render();
                        }

                    },
                    500
                );


                Ride.showMessage(
                    "Ride completed successfully.",
                    "success"
                );


                Ride.emit(
                    "completed",
                    {

                        ride:
                            updated,

                        fare:
                            fare
                    }
                );


                return {

                    success:
                        true,

                    ride:
                        updated,

                    fare:
                        fare
                };

            } catch (error) {

                return Ride.fail(
                    error.message ||
                    "Unable to complete ride."
                );
            }
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    Ride.cancel =
        async function (
            reason
        ) {

            const ride =
                Ride.state.currentRide;


            if (
                !ride
            ) {

                return Ride.fail(
                    "No active ride found."
                );
            }


            const riderId =
                Ride.getRiderId();


            try {

                const updated =
                    await Ride.update(
                        ride.id,
                        {

                            status:
                                "cancelled",

                            cancelledBy:
                                "rider",

                            cancelledById:
                                riderId,

                            cancellationReason:
                                reason ||
                                "Rider cancelled the ride.",

                            cancelledAt:
                                Date.now()
                        }
                    );


                /*
                 * Clear current ride.
                 */

                Ride.state.currentRide =
                    null;

                Ride.saveCache(
                    null
                );

                Ride.render();


                Ride.showMessage(
                    "Ride cancelled.",
                    "success"
                );


                Ride.emit(
                    "cancelled",
                    {

                        ride:
                            updated,

                        reason:
                            reason ||
                            "Rider cancelled the ride."
                    }
                );


                return {

                    success:
                        true,

                    ride:
                        updated
                };

            } catch (error) {

                return Ride.fail(
                    error.message ||
                    "Unable to cancel ride."
                );
            }
        };


    /* ========================================================
       FIND RIDE BY ID
       ======================================================== */

    Ride.getById =
        async function (
            rideId
        ) {

            if (
                !rideId
            ) {

                return null;
            }


            const database =
                Ride.getDatabase();


            if (
                !database
            ) {

                return null;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Ride.config.ridesPath +
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

                    return Ride.normalize(
                        data,
                        rideId
                    );
                }

            } catch (error) {

                console.error(
                    "Get ride failed:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       LISTEN TO CURRENT RIDE
       ======================================================== */

    Ride.listen =
        function (
            rideId
        ) {

            Ride.stopListening();


            const database =
                Ride.getDatabase();


            if (
                !database ||
                !rideId
            ) {

                return;
            }


            const ref =
                database.ref(
                    Ride.config.ridesPath +
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
                        Ride.normalize(
                            data,
                            rideId
                        );


                    Ride.setCurrent(
                        ride
                    );


                    /*
                     * Automatically clear completed
                     * or cancelled rides.
                     */

                    if (
                        ride.status ===
                        "completed" ||
                        ride.status ===
                        "cancelled"
                    ) {

                        setTimeout(
                            function () {

                                if (
                                    Ride.state.currentRide &&
                                    Ride.state.currentRide.id ===
                                    rideId
                                ) {

                                    Ride.state.currentRide =
                                        null;

                                    Ride.saveCache(
                                        null
                                    );

                                    Ride.render();
                                }

                            },
                            1000
                        );
                    }
                };


            ref.on(
                "value",
                callback
            );


            Ride.state.listener =
                {

                    ref:
                        ref,

                    callback:
                        callback
                };
        };


    /* ========================================================
       STOP LISTENING
       ======================================================== */

    Ride.stopListening =
        function () {

            const listener =
                Ride.state.listener;


            if (
                listener &&
                listener.ref
            ) {

                try {

                    listener.ref.off(
                        "value",
                        listener.callback
                    );

                } catch (error) {}
            }


            Ride.state.listener =
                null;
        };


    /* ========================================================
       RENDER RIDE
       ======================================================== */

    Ride.render =
        function () {

            const ride =
                Ride.state.currentRide;


            document
                .querySelectorAll(
                    "[data-current-ride]"
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


            /*
             * Generic ride values.
             */

            const values =
                {

                    id:
                        ride.id,

                    rideId:
                        ride.rideId,

                    customerName:
                        ride.customerName,

                    customerPhone:
                        ride.customerPhone,

                    pickupAddress:
                        ride.pickupAddress,

                    destinationAddress:
                        ride.destinationAddress,

                    fare:
                        Ride.formatMoney(
                            ride.fare
                        ),

                    distance:
                        ride.distance
                            ? ride.distance +
                              " km"
                            : "—",

                    duration:
                        ride.duration
                            ? ride.duration +
                              " min"
                            : "—",

                    status:
                        Ride.statusLabel(
                            ride.status
                        ),

                    paymentMethod:
                        ride.paymentMethod,

                    serviceType:
                        ride.serviceType,

                    otp:
                        ride.otp ||
                        "—"
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
                            `[data-ride-${key}]`
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.textContent =
                                    value ??
                                    "—";
                            }
                        );
                }
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
                            Ride.statusLabel(
                                ride.status
                            );

                        element.dataset.status =
                            ride.status;
                    }
                );
        };


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    Ride.statusLabel =
        function (
            status
        ) {

            const labels =
                {

                    requested:
                        "New request",

                    searching:
                        "Finding rider",

                    accepted:
                        "Ride accepted",

                    arriving:
                        "Heading to pickup",

                    arrived:
                        "Arrived at pickup",

                    started:
                        "Ride started",

                    in_progress:
                        "Ride in progress",

                    completed:
                        "Completed",

                    cancelled:
                        "Cancelled"
                };


            return (
                labels[
                    String(
                        status ||
                        ""
                    ).toLowerCase()
                ] ||
                "Ride"
            );
        };


    /* ========================================================
       MONEY
       ======================================================== */

    Ride.formatMoney =
        function (
            amount
        ) {

            const value =
                Number(
                    amount ||
                    0
                );


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
                    value
                );

            } catch (error) {

                return "₹" +
                    Math.round(
                        value
                    );
            }
        };


    /* ========================================================
       ERROR
       ======================================================== */

    Ride.fail =
        function (
            message
        ) {

            Ride.showMessage(
                message,
                "error"
            );


            return {

                success:
                    false,

                error:
                    message
            };
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Ride.showMessage =
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
                    "[data-ride-message]"
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

    Ride.emit =
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


    /* ========================================================
       BIND UI
       ======================================================== */

    Ride.bindEvents =
        function () {

            /*
             * Accept.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-accept-ride]"
                        );


                    if (
                        button
                    ) {

                        event.preventDefault();


                        const rideId =
                            button.dataset
                                .rideId;


                        const ride =
                            Ride.state
                                .currentRide;


                        Ride.accept(
                            ride ||
                            {
                                id:
                                    rideId
                            }
                        );
                    }
                }
            );


            /*
             * Arrive.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-arrive-ride]"
                        );


                    if (
                        button
                    ) {

                        event.preventDefault();


                        Ride.arrive(
                            button.dataset
                                .rideId
                        );
                    }
                }
            );


            /*
             * Start ride.
             */

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-start-ride]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const input =
                        document.querySelector(
                            "[data-ride-otp]"
                        );


                    const otp =
                        input
                            ? input.value
                            : "";


                    await Ride.start(
                        otp
                    );
                }
            );


            /*
             * Complete.
             */

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-complete-ride]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const fareInput =
                        document.querySelector(
                            "[data-final-fare]"
                        );


                    const fare =
                        fareInput
                            ? fareInput.value
                            : undefined;


                    await Ride.complete(
                        button.dataset
                            .rideId,
                        fare
                    );
                }
            );


            /*
             * Cancel.
             */

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-cancel-ride]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const reason =
                        button.dataset
                            .reason ||
                        "Rider cancelled the ride.";


                    await Ride.cancel(
                        reason
                    );
                }
            );


            /*
             * Refresh.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-refresh-ride]"
                        );


                    if (
                        button
                    ) {

                        Ride.loadCurrent();
                    }
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.getCurrentRiderRide =
        Ride.getCurrent;


    RX.acceptRiderRide =
        Ride.accept;


    RX.arriveRiderRide =
        Ride.arrive;


    RX.startRiderRide =
        Ride.start;


    RX.completeRiderRide =
        Ride.complete;


    RX.cancelRiderRide =
        Ride.cancel;


    RX.loadCurrentRiderRide =
        Ride.loadCurrent;


    RX.listenRiderRide =
        Ride.listen;


    /* ========================================================
       INIT
       ======================================================== */

    Ride.init =
        async function () {

            if (
                Ride.state.initialized
            ) {

                return;
            }


            Ride.state.initialized =
                true;


            Ride.bindEvents();


            await Ride.loadCurrent();


            if (
                Ride.state.currentRide &&
                Ride.state.currentRide.id
            ) {

                Ride.listen(
                    Ride.state.currentRide.id
                );
            }


            console.log(
                "RiderX rider-ride.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Ride.init
        );

    } else {

        Ride.init();

    }

})();
