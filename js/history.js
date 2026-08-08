/* ============================================================
   RIDERX HISTORY ENGINE
   File: js/history.js

   Handles:
   - Customer ride history
   - Rider ride history
   - Completed rides
   - Cancelled rides
   - Ongoing rides
   - Search
   - Filters
   - Sorting
   - Pagination
   - Firestore
   - Local fallback/cache
   - Ride details
   - Realtime updates
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const History =
        RX.history =
        RX.history || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    History.config = {

        collection:
            "rides",

        pageSize:
            20,

        cacheKey:
            "riderx_ride_history",

        cacheLimit:
            100,

        realtime:
            true,

        defaultRole:
            "customer"
    };


    /* ========================================================
       STATE
       ======================================================== */

    History.state = {

        role:
            History.config.defaultRole,

        userId:
            null,

        rides:
            [],

        filtered:
            [],

        page:
            1,

        pageSize:
            History.config.pageSize,

        search:
            "",

        status:
            "all",

        service:
            "all",

        payment:
            "all",

        sort:
            "newest",

        loading:
            false,

        hasMore:
            false,

        unsubscribe:
            null
    };


    /* ========================================================
       FIREBASE HELPERS
       ======================================================== */

    History.getFirestore =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.firestore
                ) {

                    return RX.firebase.firestore;
                }


                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {

                console.warn(
                    "Firestore unavailable:",
                    error
                );
            }


            return null;
        };


    History.getAuth =
        function () {

            try {

                if (
                    RX.auth &&
                    RX.auth.currentUser
                ) {

                    return RX.auth.currentUser;
                }


                if (
                    window.firebase &&
                    firebase.auth &&
                    firebase.auth().currentUser
                ) {

                    return firebase.auth().currentUser;
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       CURRENT USER
       ======================================================== */

    History.getCurrentUserId =
        function () {

            const user =
                History.getAuth();


            if (
                user &&
                user.uid
            ) {

                return user.uid;
            }


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    const data =
                        JSON.parse(
                            saved
                        );


                    return (
                        data.uid ||
                        data.id ||
                        null
                    );
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       ROLE NORMALIZATION
       ======================================================== */

    History.normalizeRole =
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
                [
                    "rider",
                    "driver",
                    "captain"
                ].includes(
                    role
                )
            ) {

                return "rider";
            }


            if (
                [
                    "admin",
                    "administrator"
                ].includes(
                    role
                )
            ) {

                return "admin";
            }


            return "customer";
        };


    /* ========================================================
       STATUS NORMALIZATION
       ======================================================== */

    History.normalizeStatus =
        function (
            status
        ) {

            status =
                String(
                    status ||
                    ""
                )
                .toLowerCase()
                .trim()
                .replace(
                    /[\s-]+/g,
                    "_"
                );


            const aliases = {

                complete:
                    "completed",

                completed:
                    "completed",

                success:
                    "completed",

                finished:
                    "completed",

                finish:
                    "completed",


                cancel:
                    "cancelled",

                canceled:
                    "cancelled",

                cancelled:
                    "cancelled",


                pending:
                    "pending",

                searching:
                    "searching",

                requested:
                    "requested",

                accepted:
                    "accepted",

                arrived:
                    "arrived",

                picked_up:
                    "picked_up",

                pickup:
                    "picked_up",

                ongoing:
                    "ongoing",

                in_progress:
                    "ongoing",

                started:
                    "ongoing",


                rejected:
                    "rejected",

                expired:
                    "expired"
            };


            return (
                aliases[status] ||
                status ||
                "unknown"
            );
        };


    /* ========================================================
       SERVICE NORMALIZATION
       ======================================================== */

    History.normalizeService =
        function (
            service
        ) {

            service =
                String(
                    service ||
                    ""
                )
                .toLowerCase()
                .trim();


            const aliases = {

                bike:
                    "bike",

                biketaxi:
                    "bike",

                "bike-taxi":
                    "bike",

                "bike taxi":
                    "bike",


                cab:
                    "cab",

                car:
                    "cab",

                taxi:
                    "cab",


                parcel:
                    "parcel",

                delivery:
                    "parcel",


                food:
                    "food",

                "food-delivery":
                    "food",

                "food delivery":
                    "food"
            };


            return (
                aliases[service] ||
                service ||
                "bike"
            );
        };


    /* ========================================================
       DATE HELPERS
       ======================================================== */

    History.toDate =
        function (
            value
        ) {

            if (
                !value
            ) {

                return null;
            }


            if (
                value instanceof Date
            ) {

                return value;
            }


            if (
                typeof value.toDate ===
                "function"
            ) {

                try {

                    return value.toDate();

                } catch (error) {}
            }


            if (
                typeof value ===
                "number"
            ) {

                const date =
                    new Date(
                        value
                    );


                if (
                    !isNaN(
                        date.getTime()
                    )
                ) {

                    return date;
                }
            }


            const date =
                new Date(
                    value
                );


            return isNaN(
                date.getTime()
            )
                ? null
                : date;
        };


    History.timestamp =
        function (
            ride
        ) {

            const value =
                ride.completedAt ||
                ride.cancelledAt ||
                ride.updatedAt ||
                ride.createdAt ||
                ride.timestamp ||
                ride.date;


            const date =
                History.toDate(
                    value
                );


            return date
                ? date.getTime()
                : 0;
        };


    /* ========================================================
       NUMBER HELPERS
       ======================================================== */

    History.number =
        function (
            value,
            fallback
        ) {

            const number =
                Number(value);


            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;
            }


            return (
                fallback ??
                0
            );
        };


    /* ========================================================
       RIDE NORMALIZATION
       ======================================================== */

    History.normalizeRide =
        function (
            data,
            id
        ) {

            if (
                !data
            ) {

                return null;
            }


            const ride =
                {
                    ...data
                };


            ride.id =
                id ||
                ride.id ||
                ride.rideId ||
                (
                    "ride_" +
                    Date.now()
                );


            ride.rideId =
                ride.rideId ||
                ride.id;


            ride.status =
                History.normalizeStatus(
                    ride.status ||
                    ride.rideStatus
                );


            ride.service =
                History.normalizeService(
                    ride.service ||
                    ride.serviceType ||
                    ride.vehicleType
                );


            ride.paymentMethod =
                String(
                    ride.paymentMethod ||
                    ride.payment ||
                    "cash"
                )
                .toLowerCase();


            ride.fare =
                History.number(
                    ride.fare ??
                    ride.totalFare ??
                    ride.total ??
                    ride.amount
                );


            ride.distance =
                History.number(
                    ride.distance ??
                    ride.distanceKm
                );


            /*
             * If distance is stored in meters,
             * convert to KM.
             */

            if (
                ride.distance >
                1000 &&
                ride.distanceUnit ===
                "m"
            ) {

                ride.distance =
                    ride.distance /
                    1000;
            }


            ride.duration =
                History.number(
                    ride.duration ??
                    ride.durationMinutes
                );


            ride.pickup =
                ride.pickup ||
                ride.pickupAddress ||
                ride.from ||
                "";


            ride.destination =
                ride.destination ||
                ride.destinationAddress ||
                ride.to ||
                "";


            ride.customerId =
                ride.customerId ||
                ride.userId ||
                ride.customer?.uid ||
                null;


            ride.riderId =
                ride.riderId ||
                ride.driverId ||
                ride.rider?.uid ||
                null;


            ride.createdDate =
                History.toDate(
                    ride.createdAt ||
                    ride.timestamp ||
                    ride.date
                );


            ride.completedDate =
                History.toDate(
                    ride.completedAt
                );


            ride.cancelledDate =
                History.toDate(
                    ride.cancelledAt
                );


            return ride;
        };


    /* ========================================================
       ROLE FILTER
       ======================================================== */

    History.belongsToUser =
        function (
            ride,
            userId,
            role
        ) {

            if (
                role ===
                "admin"
            ) {

                return true;
            }


            if (
                !userId
            ) {

                return false;
            }


            if (
                role ===
                "rider"
            ) {

                return (
                    ride.riderId ===
                    userId
                );
            }


            return (
                ride.customerId ===
                userId
            );
        };


    /* ========================================================
       LOCAL CACHE
       ======================================================== */

    History.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        History.config.cacheKey
                    );


                if (
                    !saved
                ) {

                    return [];
                }


                const data =
                    JSON.parse(
                        saved
                    );


                if (
                    !Array.isArray(data)
                ) {

                    return [];
                }


                return data
                    .map(
                        function (
                            ride
                        ) {

                            return History
                                .normalizeRide(
                                    ride
                                );
                        }
                    )
                    .filter(
                        Boolean
                    );

            } catch (error) {

                console.warn(
                    "History cache error:",
                    error
                );


                return [];
            }
        };


    History.saveCache =
        function (
            rides
        ) {

            try {

                const data =
                    rides
                        .slice(
                            0,
                            History.config
                                .cacheLimit
                        )
                        .map(
                            function (
                                ride
                            ) {

                                return {
                                    ...ride,

                                    createdDate:
                                        undefined,

                                    completedDate:
                                        undefined,

                                    cancelledDate:
                                        undefined
                                };
                            }
                        );


                localStorage.setItem(
                    History.config.cacheKey,
                    JSON.stringify(
                        data
                    )
                );

            } catch (error) {

                console.warn(
                    "History cache save failed:",
                    error
                );
            }
        };


    /* ========================================================
       FIRESTORE QUERY
       ======================================================== */

    History.load =
        async function (
            options
        ) {

            options =
                options ||
                {};


            History.state.loading =
                true;


            History.emit(
                "loading",
                {
                    loading:
                        true
                }
            );


            const role =
                History.normalizeRole(
                    options.role ||
                    History.state.role
                );


            const userId =
                options.userId ||
                History.state.userId ||
                History.getCurrentUserId();


            History.state.role =
                role;


            History.state.userId =
                userId;


            try {

                const db =
                    History.getFirestore();


                /*
                 * Admin can load all rides.
                 * Customer/rider load their own rides.
                 */

                if (
                    db
                ) {

                    let query =
                        db.collection(
                            History.config.collection
                        );


                    if (
                        role ===
                        "rider"
                    ) {

                        if (
                            userId
                        ) {

                            query =
                                query.where(
                                    "riderId",
                                    "==",
                                    userId
                                );
                        }

                    } else if (
                        role ===
                        "customer"
                    ) {

                        if (
                            userId
                        ) {

                            query =
                                query.where(
                                    "customerId",
                                    "==",
                                    userId
                                );
                        }

                    }


                    query =
                        query.orderBy(
                            "createdAt",
                            "desc"
                        );


                    const snapshot =
                        await query.get();


                    const rides =
                        [];


                    snapshot.forEach(
                        function (
                            doc
                        ) {

                            const ride =
                                History
                                    .normalizeRide(
                                        doc.data(),
                                        doc.id
                                    );


                            if (
                                ride
                            ) {

                                rides.push(
                                    ride
                                );
                            }
                        }
                    );


                    History.state.rides =
                        rides;


                    History.saveCache(
                        rides
                    );


                } else {

                    /*
                     * Offline/local fallback.
                     */

                    const cached =
                        History.loadCache();


                    History.state.rides =
                        cached.filter(
                            function (
                                ride
                            ) {

                                return History
                                    .belongsToUser(
                                        ride,
                                        userId,
                                        role
                                    );
                            }
                        );
                }


                History.applyFilters();


                History.emit(
                    "loaded",
                    {
                        rides:
                            History.state.rides,

                        filtered:
                            History.state.filtered
                    }
                );


                return History.state.rides;

            } catch (error) {

                console.error(
                    "RiderX history load error:",
                    error
                );


                /*
                 * Fallback to cache.
                 */

                const cached =
                    History.loadCache();


                History.state.rides =
                    cached.filter(
                        function (
                            ride
                        ) {

                            return History
                                .belongsToUser(
                                    ride,
                                    userId,
                                    role
                                );
                        }
                    );


                History.applyFilters();


                History.emit(
                    "error",
                    {
                        error:
                            error,

                        fallback:
                            true
                    }
                );


                return History.state.rides;

            } finally {

                History.state.loading =
                    false;


                History.emit(
                    "loading",
                    {
                        loading:
                            false
                    }
                );
            }
        };


    /* ========================================================
       REALTIME LISTENER
       ======================================================== */

    History.listen =
        function (
            options
        ) {

            options =
                options ||
                {};


            History.stopListening();


            const db =
                History.getFirestore();


            if (
                !db
            ) {

                return null;
            }


            const role =
                History.normalizeRole(
                    options.role ||
                    History.state.role
                );


            const userId =
                options.userId ||
                History.state.userId ||
                History.getCurrentUserId();


            if (
                role !==
                "admin" &&
                !userId
            ) {

                return null;
            }


            let query =
                db.collection(
                    History.config.collection
                );


            if (
                role ===
                "rider"
            ) {

                query =
                    query.where(
                        "riderId",
                        "==",
                        userId
                    );

            } else if (
                role ===
                "customer"
            ) {

                query =
                    query.where(
                        "customerId",
                        "==",
                        userId
                    );
            }


            query =
                query.orderBy(
                    "createdAt",
                    "desc"
                );


            History.state.unsubscribe =
                query.onSnapshot(
                    function (
                        snapshot
                    ) {

                        const rides =
                            [];


                        snapshot.forEach(
                            function (
                                doc
                            ) {

                                const ride =
                                    History
                                        .normalizeRide(
                                            doc.data(),
                                            doc.id
                                        );


                                if (
                                    ride
                                ) {

                                    rides.push(
                                        ride
                                    );
                                }
                            }
                        );


                        History.state.rides =
                            rides;


                        History.saveCache(
                            rides
                        );


                        History.applyFilters();


                        History.emit(
                            "updated",
                            {
                                rides:
                                    rides
                            }
                        );
                    },

                    function (
                        error
                    ) {

                        console.error(
                            "History realtime error:",
                            error
                        );


                        History.emit(
                            "error",
                            {
                                error:
                                    error
                            }
                        );
                    }
                );


            return History.state.unsubscribe;
        };


    History.stopListening =
        function () {

            if (
                typeof History.state
                    .unsubscribe ===
                "function"
            ) {

                try {

                    History.state
                        .unsubscribe();

                } catch (error) {}
            }


            History.state.unsubscribe =
                null;
        };


    /* ========================================================
       FILTERS
       ======================================================== */

    History.setSearch =
        function (
            value
        ) {

            History.state.search =
                String(
                    value ||
                    ""
                )
                .trim()
                .toLowerCase();


            History.state.page =
                1;


            History.applyFilters();


            return History.state.filtered;
        };


    History.setStatus =
        function (
            status
        ) {

            History.state.status =
                String(
                    status ||
                    "all"
                )
                .toLowerCase();


            History.state.page =
                1;


            History.applyFilters();


            return History.state.filtered;
        };


    History.setService =
        function (
            service
        ) {

            History.state.service =
                String(
                    service ||
                    "all"
                )
                .toLowerCase();


            History.state.page =
                1;


            History.applyFilters();


            return History.state.filtered;
        };


    History.setPayment =
        function (
            payment
        ) {

            History.state.payment =
                String(
                    payment ||
                    "all"
                )
                .toLowerCase();


            History.state.page =
                1;


            History.applyFilters();


            return History.state.filtered;
        };


    History.setSort =
        function (
            sort
        ) {

            History.state.sort =
                String(
                    sort ||
                    "newest"
                )
                .toLowerCase();


            History.state.page =
                1;


            History.applyFilters();


            return History.state.filtered;
        };


    /* ========================================================
       APPLY FILTERS
       ======================================================== */

    History.applyFilters =
        function () {

            let rides =
                [
                    ...History.state.rides
                ];


            const search =
                History.state.search;


            const status =
                History.state.status;


            const service =
                History.state.service;


            const payment =
                History.state.payment;


            /*
             * Search
             */

            if (
                search
            ) {

                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            const text =
                                [
                                    ride.id,
                                    ride.rideId,
                                    ride.pickup,
                                    ride.destination,
                                    ride.service,
                                    ride.status,
                                    ride.paymentMethod,
                                    ride.customerName,
                                    ride.riderName
                                ]
                                .join(" ")
                                .toLowerCase();


                            return text.includes(
                                search
                            );
                        }
                    );
            }


            /*
             * Status
             */

            if (
                status &&
                status !==
                "all"
            ) {

                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            return (
                                History
                                    .normalizeStatus(
                                        ride.status
                                    ) ===
                                History
                                    .normalizeStatus(
                                        status
                                    )
                            );
                        }
                    );
            }


            /*
             * Service
             */

            if (
                service &&
                service !==
                "all"
            ) {

                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            return (
                                History
                                    .normalizeService(
                                        ride.service
                                    ) ===
                                History
                                    .normalizeService(
                                        service
                                    )
                            );
                        }
                    );
            }


            /*
             * Payment
             */

            if (
                payment &&
                payment !==
                "all"
            ) {

                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            return (
                                String(
                                    ride.paymentMethod
                                )
                                .toLowerCase() ===
                                payment
                            );
                        }
                    );
            }


            /*
             * Sorting
             */

            rides.sort(
                function (
                    a,
                    b
                ) {

                    const dateA =
                        History.timestamp(
                            a
                        );


                    const dateB =
                        History.timestamp(
                            b
                        );


                    if (
                        History.state.sort ===
                        "oldest"
                    ) {

                        return (
                            dateA -
                            dateB
                        );
                    }


                    if (
                        History.state.sort ===
                        "fare_high"
                    ) {

                        return (
                            b.fare -
                            a.fare
                        );
                    }


                    if (
                        History.state.sort ===
                        "fare_low"
                    ) {

                        return (
                            a.fare -
                            b.fare
                        );
                    }


                    return (
                        dateB -
                        dateA
                    );
                }
            );


            History.state.filtered =
                rides;


            History.state.hasMore =
                (
                    History.state.page *
                    History.state.pageSize
                ) <
                rides.length;


            History.emit(
                "filter",
                {
                    results:
                        rides
                }
            );


            return rides;
        };


    /* ========================================================
       PAGINATION
       ======================================================== */

    History.getPage =
        function (
            page
        ) {

            const requested =
                History.number(
                    page,
                    1
                );


            const total =
                History.state.filtered
                    .length;


            const totalPages =
                Math.max(
                    1,
                    Math.ceil(
                        total /
                        History.state.pageSize
                    )
                );


            History.state.page =
                Math.min(
                    Math.max(
                        1,
                        requested
                    ),
                    totalPages
                );


            const start =
                (
                    History.state.page -
                    1
                ) *
                History.state.pageSize;


            const end =
                start +
                History.state.pageSize;


            return {

                items:
                    History.state.filtered
                        .slice(
                            start,
                            end
                        ),

                page:
                    History.state.page,

                pageSize:
                    History.state.pageSize,

                total:
                    total,

                totalPages:
                    totalPages,

                hasNext:
                    end <
                    total,

                hasPrevious:
                    start >
                    0
            };
        };


    History.nextPage =
        function () {

            return History.getPage(
                History.state.page +
                1
            );
        };


    History.previousPage =
        function () {

            return History.getPage(
                History.state.page -
                1
            );
        };


    /* ========================================================
       FIND RIDE
       ======================================================== */

    History.get =
        function (
            rideId
        ) {

            if (
                !rideId
            ) {

                return null;
            }


            return (
                History.state.rides
                    .find(
                        function (
                            ride
                        ) {

                            return (
                                ride.id ===
                                rideId ||
                                ride.rideId ===
                                rideId
                            );
                        }
                    ) ||
                null
            );
        };


    /* ========================================================
       FIRESTORE SINGLE RIDE
       ======================================================== */

    History.getRemote =
        async function (
            rideId
        ) {

            const db =
                History.getFirestore();


            if (
                !db ||
                !rideId
            ) {

                return History.get(
                    rideId
                );
            }


            try {

                const doc =
                    await db
                        .collection(
                            History.config
                                .collection
                        )
                        .doc(
                            rideId
                        )
                        .get();


                if (
                    !doc.exists
                ) {

                    return null;
                }


                return History
                    .normalizeRide(
                        doc.data(),
                        doc.id
                    );

            } catch (error) {

                console.error(
                    "Ride details error:",
                    error
                );


                return History.get(
                    rideId
                );
            }
        };


    /* ========================================================
       STATUS GROUPS
       ======================================================== */

    History.isCompleted =
        function (
            ride
        ) {

            return (
                History.normalizeStatus(
                    ride?.status
                ) ===
                "completed"
            );
        };


    History.isCancelled =
        function (
            ride
        ) {

            return (
                History.normalizeStatus(
                    ride?.status
                ) ===
                "cancelled"
            );
        };


    History.isOngoing =
        function (
            ride
        ) {

            const status =
                History.normalizeStatus(
                    ride?.status
                );


            return [
                "searching",
                "requested",
                "accepted",
                "arrived",
                "picked_up",
                "ongoing"
            ]
            .includes(
                status
            );
        };


    /* ========================================================
       SUMMARY
       ======================================================== */

    History.summary =
        function (
            rides
        ) {

            rides =
                Array.isArray(
                    rides
                )
                    ? rides
                    : History.state.rides;


            let completed =
                0;

            let cancelled =
                0;

            let ongoing =
                0;

            let totalFare =
                0;

            let totalDistance =
                0;


            rides.forEach(
                function (
                    ride
                ) {

                    const status =
                        History
                            .normalizeStatus(
                                ride.status
                            );


                    if (
                        status ===
                        "completed"
                    ) {

                        completed++;

                        totalFare +=
                            History.number(
                                ride.fare
                            );

                        totalDistance +=
                            History.number(
                                ride.distance
                            );

                    } else if (
                        status ===
                        "cancelled"
                    ) {

                        cancelled++;

                    } else if (
                        History.isOngoing(
                            ride
                        )
                    ) {

                        ongoing++;
                    }
                }
            );


            return {

                total:
                    rides.length,

                completed:
                    completed,

                cancelled:
                    cancelled,

                ongoing:
                    ongoing,

                totalFare:
                    Math.round(
                        totalFare
                    ),

                totalDistance:
                    Math.round(
                        totalDistance *
                        100
                    ) /
                    100
            };
        };


    /* ========================================================
       GROUP BY DATE
       ======================================================== */

    History.groupByDate =
        function (
            rides
        ) {

            rides =
                Array.isArray(
                    rides
                )
                    ? rides
                    : History.state.filtered;


            const groups =
                {};


            rides.forEach(
                function (
                    ride
                ) {

                    const date =
                        History.toDate(
                            ride.createdAt ||
                            ride.completedAt ||
                            ride.date
                        );


                    const key =
                        date
                            ? date
                                .toISOString()
                                .slice(
                                    0,
                                    10
                                )
                            : "unknown";


                    if (
                        !groups[key]
                    ) {

                        groups[key] =
                            [];
                    }


                    groups[key].push(
                        ride
                    );
                }
            );


            return groups;
        };


    /* ========================================================
       DATE FORMAT
       ======================================================== */

    History.formatDate =
        function (
            value
        ) {

            const date =
                History.toDate(
                    value
                );


            if (
                !date
            ) {

                return "Date unavailable";
            }


            return date.toLocaleDateString(
                "en-IN",
                {
                    day:
                        "2-digit",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );
        };


    History.formatTime =
        function (
            value
        ) {

            const date =
                History.toDate(
                    value
                );


            if (
                !date
            ) {

                return "";
            }


            return date.toLocaleTimeString(
                "en-IN",
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );
        };


    History.formatFare =
        function (
            value
        ) {

            const amount =
                History.number(
                    value
                );


            return (
                "₹" +
                Math.round(
                    amount
                ).toLocaleString(
                    "en-IN"
                )
            );
        };


    /* ========================================================
       RIDE CARD DATA
       ======================================================== */

    History.toCard =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return null;
            }


            const status =
                History.normalizeStatus(
                    ride.status
                );


            return {

                id:
                    ride.id,

                rideId:
                    ride.rideId,

                service:
                    ride.service,

                serviceName:
                    History.serviceName(
                        ride.service
                    ),

                status:
                    status,

                statusLabel:
                    History.statusLabel(
                        status
                    ),

                pickup:
                    ride.pickup,

                destination:
                    ride.destination,

                fare:
                    ride.fare,

                fareLabel:
                    History.formatFare(
                        ride.fare
                    ),

                distance:
                    ride.distance,

                distanceLabel:
                    ride.distance
                        ? (
                            ride.distance +
                            " km"
                        )
                        : "",

                duration:
                    ride.duration,

                paymentMethod:
                    ride.paymentMethod,

                paymentLabel:
                    History.paymentLabel(
                        ride.paymentMethod
                    ),

                date:
                    History.formatDate(
                        ride.createdAt
                    ),

                time:
                    History.formatTime(
                        ride.createdAt
                    ),

                riderName:
                    ride.riderName ||
                    ride.rider?.name ||
                    "",

                customerName:
                    ride.customerName ||
                    ride.customer?.name ||
                    "",

                rating:
                    History.number(
                        ride.rating
                    )
            };
        };


    /* ========================================================
       SERVICE LABEL
       ======================================================== */

    History.serviceName =
        function (
            service
        ) {

            const names = {

                bike:
                    "Bike Taxi",

                cab:
                    "Cab",

                parcel:
                    "Parcel",

                food:
                    "Food Delivery"
            };


            return (
                names[
                    History.normalizeService(
                        service
                    )
                ] ||
                "Ride"
            );
        };


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    History.statusLabel =
        function (
            status
        ) {

            const labels = {

                completed:
                    "Completed",

                cancelled:
                    "Cancelled",

                searching:
                    "Searching",

                requested:
                    "Requested",

                accepted:
                    "Accepted",

                arrived:
                    "Driver Arrived",

                picked_up:
                    "Trip Started",

                ongoing:
                    "On Trip",

                pending:
                    "Pending",

                rejected:
                    "Rejected",

                expired:
                    "Expired"
            };


            const normalized =
                History.normalizeStatus(
                    status
                );


            return (
                labels[
                    normalized
                ] ||
                "Ride"
            );
        };


    /* ========================================================
       PAYMENT LABEL
       ======================================================== */

    History.paymentLabel =
        function (
            payment
        ) {

            const value =
                String(
                    payment ||
                    "cash"
                )
                .toLowerCase();


            const labels = {

                cash:
                    "Cash",

                online:
                    "Online",

                card:
                    "Card",

                upi:
                    "UPI",

                wallet:
                    "Wallet"
            };


            return (
                labels[value] ||
                "Payment"
            );
        };


    /* ========================================================
       DELETE LOCAL RIDE
       ======================================================== */

    History.removeLocal =
        function (
            rideId
        ) {

            History.state.rides =
                History.state.rides.filter(
                    function (
                        ride
                    ) {

                        return (
                            ride.id !==
                            rideId &&
                            ride.rideId !==
                            rideId
                        );
                    }
                );


            History.applyFilters();


            History.saveCache(
                History.state.rides
            );


            History.emit(
                "removed",
                {
                    rideId:
                        rideId
                }
            );
        };


    /* ========================================================
       CLEAR FILTERS
       ======================================================== */

    History.clearFilters =
        function () {

            History.state.search =
                "";

            History.state.status =
                "all";

            History.state.service =
                "all";

            History.state.payment =
                "all";

            History.state.sort =
                "newest";

            History.state.page =
                1;


            return History.applyFilters();
        };


    /* ========================================================
       RENDER
       ======================================================== */

    History.render =
        function (
            container,
            options
        ) {

            options =
                options ||
                {};


            const element =
                typeof container ===
                "string"
                    ? document.querySelector(
                        container
                    )
                    : container;


            if (
                !element
            ) {

                return;
            }


            const page =
                History.getPage(
                    options.page ||
                    History.state.page
                );


            if (
                page.items.length ===
                0
            ) {

                element.innerHTML =
                    `
                    <div class="rx-history-empty">
                        <div class="rx-history-empty-icon">
                            🛵
                        </div>

                        <h3>No rides found</h3>

                        <p>
                            Your completed and past rides
                            will appear here.
                        </p>
                    </div>
                    `;

                return;
            }


            element.innerHTML =
                page.items
                    .map(
                        function (
                            ride
                        ) {

                            const card =
                                History.toCard(
                                    ride
                                );


                            return `
                                <article
                                    class="rx-history-card"
                                    data-ride-id="${History.escape(
                                        card.id
                                    )}"
                                >

                                    <div class="rx-history-card-top">

                                        <div class="rx-history-service">

                                            <strong>
                                                ${History.escape(
                                                    card.serviceName
                                                )}
                                            </strong>

                                            <span>
                                                ${History.escape(
                                                    card.date
                                                )}
                                                ${History.escape(
                                                    card.time
                                                )}
                                            </span>

                                        </div>

                                        <div class="rx-history-fare">
                                            ${History.escape(
                                                card.fareLabel
                                            )}
                                        </div>

                                    </div>


                                    <div class="rx-history-route">

                                        <div class="rx-history-route-point">
                                            <span class="rx-dot pickup"></span>

                                            <span>
                                                ${History.escape(
                                                    card.pickup ||
                                                    "Pickup location"
                                                )}
                                            </span>
                                        </div>


                                        <div class="rx-history-route-line"></div>


                                        <div class="rx-history-route-point">
                                            <span class="rx-dot destination"></span>

                                            <span>
                                                ${History.escape(
                                                    card.destination ||
                                                    "Destination"
                                                )}
                                            </span>
                                        </div>

                                    </div>


                                    <div class="rx-history-card-bottom">

                                        <span class="rx-history-status status-${History.escape(
                                            card.status
                                        )}">
                                            ${History.escape(
                                                card.statusLabel
                                            )}
                                        </span>

                                        <span>
                                            ${History.escape(
                                                card.paymentLabel
                                            )}
                                        </span>

                                        <button
                                            type="button"
                                            class="rx-history-details"
                                            data-history-details="${History.escape(
                                                card.id
                                            )}"
                                        >
                                            Details
                                        </button>

                                    </div>

                                </article>
                            `;
                        }
                    )
                    .join("");


            History.emit(
                "rendered",
                {
                    container:
                        element,

                    page:
                        page
                }
            );
        };


    /* ========================================================
       HTML ESCAPE
       ======================================================== */

    History.escape =
        function (
            value
        ) {

            return String(
                value ??
                ""
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
       AUTO BIND DETAILS
       ======================================================== */

    History.bind =
        function (
            container
        ) {

            const element =
                typeof container ===
                "string"
                    ? document.querySelector(
                        container
                    )
                    : (
                        container ||
                        document
                    );


            if (
                !element
            ) {

                return;
            }


            element.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-history-details]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    const rideId =
                        button.getAttribute(
                            "data-history-details"
                        );


                    const ride =
                        History.get(
                            rideId
                        );


                    if (
                        ride
                    ) {

                        History.emit(
                            "details",
                            {
                                ride:
                                    ride
                            }
                        );
                    }
                }
            );
        };


    /* ========================================================
       EXPORT
       ======================================================== */

    RX.loadRideHistory =
        History.load;


    RX.getRideHistory =
        function () {

            return History.state.rides;
        };


    RX.getRide =
        History.get;


    RX.getHistorySummary =
        History.summary;


    /* ========================================================
       INIT
       ======================================================== */

    History.ready =
        true;


    History.emit(
        "ready",
        {
            version:
                "1.0.0"
        }
    );


    console.log(
        "RiderX history.js loaded."
    );

})();
