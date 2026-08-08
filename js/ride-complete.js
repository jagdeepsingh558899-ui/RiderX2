/* ============================================================
   RIDERX - RIDE COMPLETE
   File: js/ride-complete.js

   Handles:
   - Complete ride
   - Final fare
   - Cash / online payment status
   - Rider earnings
   - Customer ride history
   - Rider ride history
   - Rating trigger
   - Receipt data
   - Firebase synchronization
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Complete = RX.rideComplete =
        RX.rideComplete || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Complete.config = {

        ridesPath:
            "rides",

        requestsPath:
            "rideRequests",

        usersPath:
            "users",

        ridersPath:
            "riders",

        customersPath:
            "customers",

        earningsPath:
            "riderEarnings",

        historyPath:
            "rideHistory",

        activeRideKey:
            "riderx_active_ride",

        completedRideKey:
            "riderx_completed_ride"
    };


    /* ========================================================
       STATE
       ======================================================== */

    Complete.state = {

        initialized:
            false,

        completing:
            false,

        ride:
            null,

        completed:
            false
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Complete.getDatabase =
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
       AUTH USER
       ======================================================== */

    Complete.getUser =
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

    Complete.getRiderId =
        function () {

            const user =
                Complete.getUser() ||
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
       CUSTOMER ID
       ======================================================== */

    Complete.getCustomerId =
        function (
            ride
        ) {

            return (
                ride?.customerId ||
                ride?.userId ||
                ride?.passengerId ||
                ride?.customer?.id ||
                ride?.customer?.uid ||
                null
            );
        };


    /* ========================================================
       RIDE ID
       ======================================================== */

    Complete.getRideId =
        function (
            ride
        ) {

            return (
                ride?.rideId ||
                ride?.id ||
                localStorage.getItem(
                    Complete.config
                        .activeRideKey
                ) ||
                null
            );
        };


    /* ========================================================
       LOAD RIDE
       ======================================================== */

    Complete.loadRide =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                Complete.getRideId();


            if (
                !rideId
            ) {

                return null;
            }


            const database =
                Complete.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Complete.config
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

                        Complete.state.ride =
                            {

                                ...ride,

                                rideId:
                                    ride.rideId ||
                                    rideId
                            };

                        return Complete.state.ride;
                    }

                } catch (error) {

                    console.warn(
                        "Unable to load ride:",
                        error
                    );
                }
            }


            /*
             * Fallback to local storage.
             */

            try {

                const saved =
                    localStorage.getItem(
                        "riderx_active_ride"
                    );


                if (
                    saved
                ) {

                    const ride =
                        JSON.parse(
                            saved
                        );


                    if (
                        !rideId ||
                        Complete.getRideId(
                            ride
                        ) === rideId
                    ) {

                        Complete.state.ride =
                            ride;

                        return ride;
                    }
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       NORMALIZE FARE
       ======================================================== */

    Complete.getFare =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return 0;
            }


            let fare =
                ride.finalFare ??
                ride.totalFare ??
                ride.fare ??
                ride.amount ??
                ride.estimatedFare ??
                0;


            if (
                typeof fare ===
                "object"
            ) {

                fare =
                    fare.total ??
                    fare.finalFare ??
                    fare.amount ??
                    fare.customerFare ??
                    0;
            }


            fare =
                Number(
                    String(
                        fare
                    )
                    .replace(
                        /[^0-9.-]/g,
                        ""
                    )
                );


            return Number.isFinite(
                fare
            )
                ? Math.max(
                    0,
                    fare
                )
                : 0;
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    Complete.getDistance =
        function (
            ride
        ) {

            return Number(
                ride?.distanceKm ??
                ride?.distance ??
                ride?.tripDistance ??
                0
            ) || 0;
        };


    /* ========================================================
       PAYMENT TYPE
       ======================================================== */

    Complete.getPaymentMethod =
        function (
            ride
        ) {

            return String(
                ride?.paymentMethod ||
                ride?.payment ||
                ride?.paymentType ||
                "cash"
            )
            .toLowerCase();
        };


    /* ========================================================
       CALCULATE RIDER EARNING
       ======================================================== */

    Complete.calculateEarning =
        function (
            ride
        ) {

            const fare =
                Complete.getFare(
                    ride
                );


            /*
             * Admin commission can be supplied
             * by ride / pricing settings.
             */

            let commission =
                ride?.commission ??
                ride?.adminCommission ??
                0;


            commission =
                Number(
                    commission
                ) || 0;


            /*
             * Support both:
             *  - fixed amount
             *  - percentage
             */

            if (
                ride?.commissionType ===
                "percent" ||
                ride?.commissionType ===
                "percentage"
            ) {

                commission =
                    fare *
                    commission /
                    100;

            } else if (
                commission > 0 &&
                commission < 1
            ) {

                commission =
                    fare *
                    commission;
            }


            const earning =
                Math.max(
                    0,
                    fare -
                    commission
                );


            return {

                fare:
                    Number(
                        fare.toFixed(2)
                    ),

                commission:
                    Number(
                        commission.toFixed(2)
                    ),

                earning:
                    Number(
                        earning.toFixed(2)
                    )
            };
        };


    /* ========================================================
       COMPLETE RIDE
       ======================================================== */

    Complete.complete =
        async function (
            rideOrId,
            options
        ) {

            if (
                Complete.state.completing
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride completion already in progress."
                };
            }


            options =
                options ||
                {};


            Complete.state.completing =
                true;


            try {

                let ride;


                if (
                    typeof rideOrId ===
                    "object"
                ) {

                    ride =
                        {
                            ...rideOrId
                        };

                } else {

                    ride =
                        await Complete.loadRide(
                            rideOrId
                        );
                }


                if (
                    !ride
                ) {

                    throw new Error(
                        "Active ride not found."
                    );
                }


                const rideId =
                    Complete.getRideId(
                        ride
                    );


                if (
                    !rideId
                ) {

                    throw new Error(
                        "Ride ID missing."
                    );
                }


                /*
                 * Prevent double completion.
                 */

                const currentStatus =
                    String(
                        ride.status ||
                        ""
                    )
                    .toLowerCase();


                if (
                    [
                        "completed",
                        "finished"
                    ].includes(
                        currentStatus
                    )
                ) {

                    Complete.state.completed =
                        true;

                    Complete.state.ride =
                        ride;


                    return {

                        success:
                            true,

                        alreadyCompleted:
                            true,

                        ride:
                            ride,

                        rideId:
                            rideId
                    };
                }


                const now =
                    Date.now();


                const earning =
                    Complete.calculateEarning(
                        ride
                    );


                const paymentMethod =
                    options.paymentMethod ||
                    Complete.getPaymentMethod(
                        ride
                    );


                const paymentStatus =
                    options.paymentStatus ||
                    (
                        paymentMethod ===
                        "cash"
                            ? "pending"
                            : "paid"
                    );


                const completedRide =
                    {

                        ...ride,

                        rideId:
                            rideId,

                        status:
                            "completed",

                        completedAt:
                            now,

                        endedAt:
                            now,

                        updatedAt:
                            now,

                        finalFare:
                            earning.fare,

                        totalFare:
                            earning.fare,

                        paymentMethod:
                            paymentMethod,

                        paymentStatus:
                            paymentStatus,

                        riderEarning:
                            earning.earning,

                        adminCommission:
                            earning.commission,

                        distanceKm:
                            Complete.getDistance(
                                ride
                            ),

                        durationMinutes:
                            Complete.getDuration(
                                ride
                            )
                    };


                /*
                 * Firebase
                 */

                const database =
                    Complete.getDatabase();


                if (
                    database
                ) {

                    await Complete.saveCompletedRide(
                        database,
                        completedRide
                    );

                    await Complete.saveHistory(
                        database,
                        completedRide
                    );

                    await Complete.saveRiderEarning(
                        database,
                        completedRide
                    );

                    await Complete.updatePayment(
                        database,
                        completedRide
                    );

                    await Complete.updateRequest(
                        database,
                        completedRide
                    );
                }


                /*
                 * Local storage
                 */

                Complete.state.ride =
                    completedRide;

                Complete.state.completed =
                    true;


                try {

                    localStorage.setItem(
                        Complete.config
                            .completedRideKey,
                        JSON.stringify(
                            completedRide
                        )
                    );


                    localStorage.removeItem(
                        Complete.config
                            .activeRideKey
                    );


                    localStorage.setItem(
                        "riderx_last_ride",
                        JSON.stringify(
                            completedRide
                        )
                    );

                } catch (error) {}


                /*
                 * Notify customer/rider UI.
                 */

                Complete.emit(
                    "completed",
                    {

                        ride:
                            completedRide,

                        rideId:
                            rideId,

                        earning:
                            earning
                    }
                );


                /*
                 * Rating page / flow.
                 */

                Complete.openRating(
                    completedRide
                );


                return {

                    success:
                        true,

                    rideId:
                        rideId,

                    ride:
                        completedRide,

                    earning:
                        earning
                };

            } catch (error) {

                console.error(
                    "Ride completion error:",
                    error
                );


                Complete.emit(
                    "error",
                    {

                        error:
                            error
                    }
                );


                return {

                    success:
                        false,

                    error:
                        error.message ||
                        "Unable to complete ride."
                };

            } finally {

                Complete.state.completing =
                    false;
            }
        };


    /* ========================================================
       SAVE COMPLETED RIDE
       ======================================================== */

    Complete.saveCompletedRide =
        async function (
            database,
            ride
        ) {

            const rideId =
                Complete.getRideId(
                    ride
                );


            await database
                .ref(
                    Complete.config
                        .ridesPath +
                    "/" +
                    rideId
                )
                .update(
                    ride
                );


            return true;
        };


    /* ========================================================
       SAVE HISTORY
       ======================================================== */

    Complete.saveHistory =
        async function (
            database,
            ride
        ) {

            const rideId =
                Complete.getRideId(
                    ride
                );


            const riderId =
                Complete.getRiderId();


            const customerId =
                Complete.getCustomerId(
                    ride
                );


            /*
             * Main history.
             */

            await database
                .ref(
                    Complete.config
                        .historyPath +
                    "/" +
                    rideId
                )
                .set(
                    ride
                );


            /*
             * Rider-specific history.
             */

            if (
                riderId
            ) {

                await database
                    .ref(
                        "riderHistory/" +
                        riderId +
                        "/" +
                        rideId
                    )
                    .set(
                        ride
                    );
            }


            /*
             * Customer-specific history.
             */

            if (
                customerId
            ) {

                await database
                    .ref(
                        "customerHistory/" +
                        customerId +
                        "/" +
                        rideId
                    )
                    .set(
                        ride
                    );
            }


            return true;
        };


    /* ========================================================
       RIDER EARNING
       ======================================================== */

    Complete.saveRiderEarning =
        async function (
            database,
            ride
        ) {

            const riderId =
                Complete.getRiderId();


            if (
                !riderId
            ) {

                return false;
            }


            const earning =
                Complete.calculateEarning(
                    ride
                );


            const rideId =
                Complete.getRideId(
                    ride
                );


            const paymentMethod =
                Complete.getPaymentMethod(
                    ride
                );


            const data =
                {

                    rideId:
                        rideId,

                    riderId:
                        riderId,

                    fare:
                        earning.fare,

                    commission:
                        earning.commission,

                    earning:
                        earning.earning,

                    paymentMethod:
                        paymentMethod,

                    distanceKm:
                        Complete.getDistance(
                            ride
                        ),

                    createdAt:
                        Date.now(),

                    completedAt:
                        ride.completedAt
                };


            /*
             * Individual earning record.
             */

            await database
                .ref(
                    Complete.config
                        .earningsPath +
                    "/" +
                    riderId +
                    "/" +
                    rideId
                )
                .set(
                    data
                );


            /*
             * Rider wallet balance.

             * Cash rides are treated separately
             * because rider already collects cash.
             */

            const riderRef =
                database.ref(
                    Complete.config
                        .ridersPath +
                    "/" +
                    riderId
                );


            const snapshot =
                await riderRef.once(
                    "value"
                );


            const rider =
                snapshot.val() ||
                {};


            const currentWallet =
                Number(
                    rider.walletBalance ??
                    rider.wallet ??
                    0
                ) || 0;


            let walletChange =
                earning.earning;


            /*
             * For cash rides, platform commission
             * can be deducted from rider wallet if
             * required by the ride configuration.
             */

            if (
                paymentMethod ===
                    "cash" &&
                ride.cashCommissionDeduct
            ) {

                walletChange =
                    -earning.commission;
            }


            const newBalance =
                currentWallet +
                walletChange;


            await riderRef.update(
                {

                    walletBalance:
                        Number(
                            newBalance.toFixed(
                                2
                            )
                        ),

                    wallet:
                        Number(
                            newBalance.toFixed(
                                2
                            )
                        ),

                    lastRideAt:
                        Date.now(),

                    updatedAt:
                        Date.now()
                }
            );


            return true;
        };


    /* ========================================================
       PAYMENT UPDATE
       ======================================================== */

    Complete.updatePayment =
        async function (
            database,
            ride
        ) {

            const rideId =
                Complete.getRideId(
                    ride
                );


            const paymentMethod =
                Complete.getPaymentMethod(
                    ride
                );


            const paymentStatus =
                ride.paymentStatus ||
                (
                    paymentMethod ===
                    "cash"
                        ? "pending"
                        : "paid"
                );


            const payment =
                {

                    rideId:
                        rideId,

                    customerId:
                        Complete.getCustomerId(
                            ride
                        ),

                    riderId:
                        Complete.getRiderId(),

                    amount:
                        Complete.getFare(
                            ride
                        ),

                    method:
                        paymentMethod,

                    status:
                        paymentStatus,

                    updatedAt:
                        Date.now()
                };


            await database
                .ref(
                    "payments/" +
                    rideId
                )
                .update(
                    payment
                );


            return true;
        };


    /* ========================================================
       UPDATE REQUEST
       ======================================================== */

    Complete.updateRequest =
        async function (
            database,
            ride
        ) {

            const rideId =
                Complete.getRideId(
                    ride
                );


            try {

                await database
                    .ref(
                        Complete.config
                            .requestsPath +
                        "/" +
                        rideId
                    )
                    .update(
                        {

                            status:
                                "completed",

                            completedAt:
                                ride.completedAt,

                            finalFare:
                                ride.finalFare,

                            updatedAt:
                                Date.now()
                        }
                    );

            } catch (error) {

                console.warn(
                    "Ride request update failed:",
                    error
                );
            }


            return true;
        };


    /* ========================================================
       DURATION
       ======================================================== */

    Complete.getDuration =
        function (
            ride
        ) {

            const start =
                Number(
                    ride.startedAt ||
                    ride.tripStartedAt ||
                    ride.acceptedAt ||
                    0
                );


            const end =
                Number(
                    ride.completedAt ||
                    Date.now()
                );


            if (
                !start ||
                end <= start
            ) {

                return Number(
                    ride.durationMinutes ||
                    ride.duration ||
                    0
                ) || 0;
            }


            return Number(
                (
                    (
                        end -
                        start
                    ) /
                    60000
                )
                .toFixed(1)
            );
        };


    /* ========================================================
       GENERATE RECEIPT
       ======================================================== */

    Complete.createReceipt =
        function (
            ride
        ) {

            ride =
                ride ||
                Complete.state.ride;


            if (
                !ride
            ) {

                return null;
            }


            const fare =
                Complete.getFare(
                    ride
                );


            const earning =
                Complete.calculateEarning(
                    ride
                );


            return {

                rideId:
                    Complete.getRideId(
                        ride
                    ),

                date:
                    ride.completedAt ||
                    Date.now(),

                pickup:
                    ride.pickupAddress ||
                    ride.pickup?.address ||
                    "",

                destination:
                    ride.destinationAddress ||
                    ride.destination?.address ||
                    ride.dropoffAddress ||
                    "",

                distanceKm:
                    Complete.getDistance(
                        ride
                    ),

                durationMinutes:
                    Complete.getDuration(
                        ride
                    ),

                fare:
                    fare,

                commission:
                    earning.commission,

                riderEarning:
                    earning.earning,

                paymentMethod:
                    Complete.getPaymentMethod(
                        ride
                    ),

                paymentStatus:
                    ride.paymentStatus ||
                    "paid"
            };
        };


    /* ========================================================
       RATING
       ======================================================== */

    Complete.openRating =
        function (
            ride
        ) {

            Complete.emit(
                "rating-required",
                {

                    ride:
                        ride,

                    rideId:
                        Complete.getRideId(
                            ride
                        )
                }
            );


            /*
             * Existing rating.js can handle
             * the UI without forcing navigation.
             */

            try {

                if (
                    RX.rating &&
                    typeof RX.rating
                        .showAfterRide ===
                    "function"
                ) {

                    RX.rating.showAfterRide(
                        ride
                    );

                    return;
                }

            } catch (error) {}


            /*
             * Do not automatically redirect
             * if rating system is already active.
             */
        };


    /* ========================================================
       CANCEL COMPLETION
       ======================================================== */

    Complete.reset =
        function () {

            Complete.stop();

            Complete.state.ride =
                null;

            Complete.state.completed =
                false;

            Complete.state.completing =
                false;
        };


    Complete.stop =
        function () {

            return true;
        };


    /* ========================================================
       FINAL CASH PAYMENT
       ======================================================== */

    Complete.markCashCollected =
        async function (
            rideId
        ) {

            const ride =
                await Complete.loadRide(
                    rideId
                );


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride not found."
                };
            }


            const database =
                Complete.getDatabase();


            if (
                database
            ) {

                await database
                    .ref(
                        Complete.config
                            .ridesPath +
                        "/" +
                        rideId
                    )
                    .update(
                        {

                            paymentStatus:
                                "paid",

                            cashCollectedAt:
                                Date.now(),

                            updatedAt:
                                Date.now()
                        }
                    );


                await database
                    .ref(
                        "payments/" +
                        rideId
                    )
                    .update(
                        {

                            status:
                                "paid",

                            paidAt:
                                Date.now(),

                            updatedAt:
                                Date.now()
                        }
                    );
            }


            ride.paymentStatus =
                "paid";


            Complete.state.ride =
                ride;


            Complete.emit(
                "payment-paid",
                {

                    ride:
                        ride
                }
            );


            return {

                success:
                    true,

                ride:
                    ride
            };
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    Complete.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-complete-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    Complete.on =
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
                "riderx-ride-complete-" +
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

    RX.completeRide =
        Complete.complete;

    RX.markCashCollected =
        Complete.markCashCollected;

    RX.createRideReceipt =
        Complete.createReceipt;

    RX.loadCompletedRide =
        Complete.loadRide;


    /* ========================================================
       INIT
       ======================================================== */

    Complete.init =
        function () {

            if (
                Complete.state.initialized
            ) {

                return;
            }


            Complete.state.initialized =
                true;


            console.log(
                "RiderX ride-complete.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Complete.init
        );

    } else {

        Complete.init();

    }

})();
