/* ============================================================
   RIDERX MATCHING ENGINE
   File: js/matching.js

   Handles:
   - Nearby rider discovery
   - Rider availability
   - Distance based matching
   - Ride request dispatch
   - Multiple rider matching
   - Matching timeout
   - Accepted ride locking
   - Firebase Realtime Database
   - Firestore fallback

   Works with:
   js/booking.js
   js/requests.js
   js/ride-accept.js
   js/rider-location.js
   js/distance.js
   js/fare-calculator.js

   IMPORTANT:
   This file does NOT create a map.
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Matching =
        RX.matching =
        RX.matching || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Matching.config = {

        ridersCollection:
            "riders",

        customersCollection:
            "customers",

        ridesCollection:
            "rides",

        requestsCollection:
            "rideRequests",

        liveLocationsCollection:
            "liveLocations",

        defaultSearchRadius:
            8,

        minimumSearchRadius:
            2,

        maximumSearchRadius:
            20,

        initialBatchSize:
            5,

        maximumBatchSize:
            15,

        riderRequestTimeout:
            15000,

        totalMatchingTimeout:
            90000,

        retryDelay:
            3000,

        locationFreshness:
            45000,

        maxDriverAge:
            60,

        allowMultipleRequests:
            true,

        requireOnline:
            true,

        requireAvailable:
            true
    };


    /* ========================================================
       STATE
       ======================================================== */

    Matching.state = {

        initialized:
            false,

        active:
            false,

        rideId:
            null,

        requestId:
            null,

        customerId:
            null,

        matchedRiderId:
            null,

        candidateRiders:
            [],

        requestedRiders:
            [],

        rejectedRiders:
            [],

        expiredRiders:
            [],

        searchRadius:
            8,

        startedAt:
            null,

        timeoutId:
            null,

        retryTimeoutId:
            null,

        listener:
            null,

        accepted:
            false
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    Matching.now =
        function () {

            return Date.now();
        };


    Matching.getDatabase =
        function () {

            try {

                if (
                    RX.firebase?.database
                ) {

                    return RX.firebase.database;
                }


                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {

                console.warn(
                    "RiderX RTDB unavailable:",
                    error
                );
            }


            return null;
        };


    Matching.getFirestore =
        function () {

            try {

                if (
                    RX.firebase?.firestore
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
                    "RiderX Firestore unavailable:",
                    error
                );
            }


            return null;
        };


    Matching.getAuthUser =
        function () {

            try {

                if (
                    RX.auth?.currentUser
                ) {

                    return RX.auth.currentUser;
                }


                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    return firebase.auth()
                        .currentUser;
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


    Matching.getUserId =
        function () {

            const user =
                Matching.getAuthUser();


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


    Matching.normalizeRole =
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
                role === "driver"
            ) {

                return "rider";
            }


            if (
                role === "user" ||
                role === "passenger"
            ) {

                return "customer";
            }


            return role;
        };


    /* ========================================================
       LOCATION NORMALIZATION
       ======================================================== */

    Matching.normalizeLocation =
        function (
            location
        ) {

            if (
                !location
            ) {

                return null;
            }


            const lat =
                Number(
                    location.lat ??
                    location.latitude
                );


            const lng =
                Number(
                    location.lng ??
                    location.longitude
                );


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return null;
            }


            return {

                lat:
                    lat,

                lng:
                    lng,

                accuracy:
                    Number(
                        location.accuracy ||
                        0
                    ),

                heading:
                    Number.isFinite(
                        Number(
                            location.heading
                        )
                    )
                        ? Number(
                            location.heading
                        )
                        : null,

                speed:
                    Number.isFinite(
                        Number(
                            location.speed
                        )
                    )
                        ? Number(
                            location.speed
                        )
                        : null,

                timestamp:
                    Number(
                        location.timestamp ||
                        location.updatedAt ||
                        Date.now()
                    )
            };
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    Matching.distance =
        function (
            from,
            to
        ) {

            from =
                Matching.normalizeLocation(
                    from
                );


            to =
                Matching.normalizeLocation(
                    to
                );


            if (
                !from ||
                !to
            ) {

                return Infinity;
            }


            const earth =
                6371;


            const lat1 =
                from.lat *
                Math.PI /
                180;


            const lat2 =
                to.lat *
                Math.PI /
                180;


            const dLat =
                (
                    to.lat -
                    from.lat
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    to.lng -
                    from.lng
                ) *
                Math.PI /
                180;


            const a =
                Math.sin(
                    dLat / 2
                ) *
                Math.sin(
                    dLat / 2
                ) +
                Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(
                    dLng / 2
                ) *
                Math.sin(
                    dLng / 2
                );


            const c =
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(
                        1 - a
                    )
                );


            return earth * c;
        };


    /* ========================================================
       LOCATION FRESHNESS
       ======================================================== */

    Matching.isLocationFresh =
        function (
            location
        ) {

            location =
                Matching.normalizeLocation(
                    location
                );


            if (
                !location
            ) {

                return false;
            }


            const timestamp =
                Number(
                    location.timestamp ||
                    0
                );


            if (
                !timestamp
            ) {

                return false;
            }


            return (
                Matching.now() -
                timestamp
            ) <=
            Matching.config
                .locationFreshness;
        };


    /* ========================================================
       RIDER ELIGIBILITY
       ======================================================== */

    Matching.isRiderEligible =
        function (
            rider,
            customerLocation
        ) {

            if (
                !rider
            ) {

                return false;
            }


            const riderId =
                rider.uid ||
                rider.id ||
                rider.userId;


            if (
                !riderId
            ) {

                return false;
            }


            /*
             * Rider must be online.
             */

            if (
                Matching.config
                    .requireOnline
            ) {

                const online =
                    rider.online === true ||
                    rider.isOnline === true ||
                    rider.status === "online" ||
                    rider.availability ===
                        "online";


                if (
                    !online
                ) {

                    return false;
                }
            }


            /*
             * Rider must be available.
             */

            if (
                Matching.config
                    .requireAvailable
            ) {

                const available =
                    rider.available !== false &&
                    rider.isAvailable !== false &&
                    rider.busy !== true &&
                    rider.onRide !== true &&
                    rider.currentRideId == null;


                if (
                    !available
                ) {

                    return false;
                }
            }


            /*
             * Approved rider check.
             */

            if (
                rider.approved === false ||
                rider.verified === false ||
                rider.status === "blocked" ||
                rider.status === "suspended"
            ) {

                return false;
            }


            /*
             * Location.
             */

            const location =
                Matching.normalizeLocation(
                    rider.location ||
                    rider.liveLocation ||
                    rider.currentLocation ||
                    rider
                );


            if (
                !location
            ) {

                return false;
            }


            if (
                !Matching.isLocationFresh(
                    location
                )
            ) {

                return false;
            }


            const distance =
                Matching.distance(
                    customerLocation,
                    location
                );


            if (
                !Number.isFinite(
                    distance
                )
            ) {

                return false;
            }


            return true;
        };


    /* ========================================================
       GET RIDER LOCATION
       ======================================================== */

    Matching.getRiderLocation =
        function (
            rider
        ) {

            return Matching.normalizeLocation(
                rider?.location ||
                rider?.liveLocation ||
                rider?.currentLocation ||
                rider
            );
        };


    /* ========================================================
       GET AVAILABLE RIDERS FROM RTDB
       ======================================================== */

    Matching.getRidersFromRTDB =
        async function () {

            const database =
                Matching.getDatabase();


            if (
                !database
            ) {

                return [];
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Matching.config
                                .ridersCollection
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val();


                if (
                    !data
                ) {

                    return [];
                }


                return Object.keys(
                    data
                ).map(
                    function (
                        key
                    ) {

                        return {

                            id:
                                key,

                            uid:
                                data[key]
                                    ?.uid ||
                                key,

                            ...data[key]
                        };
                    }
                );

            } catch (error) {

                console.warn(
                    "RTDB rider search failed:",
                    error
                );


                return [];
            }
        };


    /* ========================================================
       GET AVAILABLE RIDERS FROM FIRESTORE
       ======================================================== */

    Matching.getRidersFromFirestore =
        async function () {

            const firestore =
                Matching.getFirestore();


            if (
                !firestore
            ) {

                return [];
            }


            try {

                const snapshot =
                    await firestore
                        .collection(
                            Matching.config
                                .ridersCollection
                        )
                        .get();


                return snapshot.docs.map(
                    function (
                        doc
                    ) {

                        return {

                            id:
                                doc.id,

                            uid:
                                doc.data()
                                    ?.uid ||
                                doc.id,

                            ...doc.data()
                        };
                    }
                );

            } catch (error) {

                console.warn(
                    "Firestore rider search failed:",
                    error
                );


                return [];
            }
        };


    /* ========================================================
       LOAD ALL AVAILABLE RIDERS
       ======================================================== */

    Matching.loadRiders =
        async function () {

            let riders =
                [];


            /*
             * RTDB first.
             */

            riders =
                await Matching
                    .getRidersFromRTDB();


            /*
             * Firestore fallback.
             */

            if (
                !riders.length
            ) {

                riders =
                    await Matching
                        .getRidersFromFirestore();
            }


            return riders;
        };


    /* ========================================================
       SORT RIDERS BY DISTANCE
       ======================================================== */

    Matching.sortByDistance =
        function (
            riders,
            customerLocation
        ) {

            return riders
                .map(
                    function (
                        rider
                    ) {

                        const location =
                            Matching
                                .getRiderLocation(
                                    rider
                                );


                        const distance =
                            Matching
                                .distance(
                                    customerLocation,
                                    location
                                );


                        return {

                            ...rider,

                            location:
                                location,

                            distance:
                                distance
                        };
                    }
                )
                .sort(
                    function (
                        a,
                        b
                    ) {

                        return (
                            a.distance -
                            b.distance
                        );
                    }
                );
        };


    /* ========================================================
       FIND NEARBY RIDERS
       ======================================================== */

    Matching.findNearbyRiders =
        async function (
            customerLocation,
            options
        ) {

            options =
                options || {};


            customerLocation =
                Matching.normalizeLocation(
                    customerLocation
                );


            if (
                !customerLocation
            ) {

                throw new Error(
                    "Customer location is required."
                );
            }


            const radius =
                Math.min(
                    Number(
                        options.radius ||
                        Matching.config
                            .defaultSearchRadius
                    ),
                    Matching.config
                        .maximumSearchRadius
                );


            const riders =
                await Matching.loadRiders();


            const eligible =
                riders.filter(
                    function (
                        rider
                    ) {

                        return Matching
                            .isRiderEligible(
                                rider,
                                customerLocation
                            );
                    }
                );


            const sorted =
                Matching.sortByDistance(
                    eligible,
                    customerLocation
                );


            const nearby =
                sorted.filter(
                    function (
                        rider
                    ) {

                        return (
                            rider.distance <=
                            radius
                        );
                    }
                );


            return nearby;
        };


    /* ========================================================
       EXPAND SEARCH
       ======================================================== */

    Matching.expandSearch =
        function () {

            let radius =
                Number(
                    Matching.state
                        .searchRadius
                );


            radius =
                Math.max(
                    radius,
                    Matching.config
                        .minimumSearchRadius
                );


            radius =
                Math.min(
                    radius * 1.5,
                    Matching.config
                        .maximumSearchRadius
                );


            Matching.state
                .searchRadius =
                radius;


            return radius;
        };


    /* ========================================================
       CREATE REQUEST ID
       ======================================================== */

    Matching.createRequestId =
        function () {

            return (
                "req_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(
                        2,
                        10
                    )
            );
        };


    /* ========================================================
       CREATE RIDE ID
       ======================================================== */

    Matching.createRideId =
        function () {

            return (
                "ride_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(
                        2,
                        10
                    )
            );
        };


    /* ========================================================
       SAVE RIDE REQUEST
       ======================================================== */

    Matching.saveRideRequest =
        async function (
            request
        ) {

            const database =
                Matching.getDatabase();


            const firestore =
                Matching.getFirestore();


            let saved =
                false;


            /*
             * RTDB.
             */

            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Matching.config
                                .requestsCollection +
                            "/" +
                            request.requestId
                        )
                        .set(
                            request
                        );


                    saved =
                        true;

                } catch (error) {

                    console.warn(
                        "RTDB request save failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            if (
                !saved &&
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Matching.config
                                .requestsCollection
                        )
                        .doc(
                            request.requestId
                        )
                        .set(
                            request
                        );


                    saved =
                        true;

                } catch (error) {

                    console.warn(
                        "Firestore request save failed:",
                        error
                    );
                }
            }


            return saved;
        };


    /* ========================================================
       CREATE RIDE
       ======================================================== */

    Matching.createRide =
        async function (
            data
        ) {

            const rideId =
                data.rideId ||
                Matching.createRideId();


            const ride = {

                rideId:
                    rideId,

                customerId:
                    data.customerId ||
                    Matching.getUserId(),

                riderId:
                    data.riderId ||
                    null,

                service:
                    data.service ||
                    "bike",

                status:
                    data.status ||
                    "searching",

                pickup:
                    data.pickup ||
                    null,

                destination:
                    data.destination ||
                    null,

                pickupLocation:
                    data.pickupLocation ||
                    null,

                destinationLocation:
                    data.destinationLocation ||
                    null,

                fare:
                    Number(
                        data.fare ||
                        0
                    ),

                paymentMethod:
                    data.paymentMethod ||
                    "cash",

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now()
            };


            const database =
                Matching.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Matching.config
                                .ridesCollection +
                            "/" +
                            rideId
                        )
                        .set(
                            ride
                        );


                    return ride;

                } catch (error) {

                    console.warn(
                        "RTDB ride create failed:",
                        error
                    );
                }
            }


            const firestore =
                Matching.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Matching.config
                                .ridesCollection
                        )
                        .doc(
                            rideId
                        )
                        .set(
                            ride
                        );


                    return ride;

                } catch (error) {

                    console.warn(
                        "Firestore ride create failed:",
                        error
                    );
                }
            }


            return ride;
        };


    /* ========================================================
       BUILD RIDER REQUEST
       ======================================================== */

    Matching.buildRiderRequest =
        function (
            ride,
            rider
        ) {

            return {

                requestId:
                    Matching.state
                        .requestId,

                rideId:
                    ride.rideId,

                customerId:
                    ride.customerId,

                riderId:
                    rider.uid ||
                    rider.id,

                service:
                    ride.service,

                pickup:
                    ride.pickup,

                destination:
                    ride.destination,

                pickupLocation:
                    ride.pickupLocation,

                destinationLocation:
                    ride.destinationLocation,

                fare:
                    ride.fare,

                paymentMethod:
                    ride.paymentMethod,

                riderDistance:
                    rider.distance,

                status:
                    "pending",

                createdAt:
                    Date.now(),

                expiresAt:
                    Date.now() +
                    Matching.config
                        .riderRequestTimeout
            };
        };


    /* ========================================================
       SEND REQUEST TO RIDER
       ======================================================== */

    Matching.sendRequestToRider =
        async function (
            ride,
            rider
        ) {

            const riderId =
                rider.uid ||
                rider.id;


            if (
                !riderId
            ) {

                return false;
            }


            const request =
                Matching.buildRiderRequest(
                    ride,
                    rider
                );


            const database =
                Matching.getDatabase();


            let sent =
                false;


            /*
             * Rider inbox in RTDB.
             */

            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            "riderRequests/" +
                            riderId +
                            "/" +
                            request.requestId
                        )
                        .set(
                            request
                        );


                    /*
                     * Also store under global
                     * request path.
                     */

                    await database
                        .ref(
                            Matching.config
                                .requestsCollection +
                            "/" +
                            request.requestId +
                            "/riders/" +
                            riderId
                        )
                        .set(
                            request
                        );


                    sent =
                        true;

                } catch (error) {

                    console.warn(
                        "Rider request failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            if (
                !sent
            ) {

                const firestore =
                    Matching.getFirestore();


                if (
                    firestore
                ) {

                    try {

                        await firestore
                            .collection(
                                "riderRequests"
                            )
                            .doc(
                                riderId
                            )
                            .collection(
                                "requests"
                            )
                            .doc(
                                request.requestId
                            )
                            .set(
                                request
                            );


                        sent =
                            true;

                    } catch (error) {

                        console.warn(
                            "Firestore rider request failed:",
                            error
                        );
                    }
                }
            }


            if (
                sent
            ) {

                Matching.state
                    .requestedRiders
                    .push(
                        riderId
                    );


                Matching.emit(
                    "request-sent",
                    {
                        ride:
                            ride,

                        rider:
                            rider,

                        request:
                            request
                    }
                );
            }


            return sent;
        };


    /* ========================================================
       SEND BATCH
       ======================================================== */

    Matching.sendBatch =
        async function (
            ride,
            riders
        ) {

            if (
                !Array.isArray(
                    riders
                ) ||
                !riders.length
            ) {

                return 0;
            }


            let count =
                0;


            const batch =
                riders.slice(
                    0,
                    Matching.config
                        .maximumBatchSize
                );


            for (
                const rider of batch
            ) {

                const riderId =
                    rider.uid ||
                    rider.id;


                /*
                 * Don't request same rider twice.
                 */

                if (
                    Matching.state
                        .requestedRiders
                        .includes(
                            riderId
                        )
                ) {

                    continue;
                }


                if (
                    Matching.state
                        .rejectedRiders
                        .includes(
                            riderId
                        )
                ) {

                    continue;
                }


                if (
                    Matching.state
                        .expiredRiders
                        .includes(
                            riderId
                        )
                ) {

                    continue;
                }


                const sent =
                    await Matching
                        .sendRequestToRider(
                            ride,
                            rider
                        );


                if (
                    sent
                ) {

                    count++;
                }


                /*
                 * Stop if another rider
                 * has already accepted.
                 */

                if (
                    Matching.state.accepted
                ) {

                    break;
                }
            }


            return count;
        };


    /* ========================================================
       START MATCHING
       ======================================================== */

    Matching.start =
        async function (
            data
        ) {

            data =
                data || {};


            if (
                Matching.state.active
            ) {

                await Matching.stop(
                    false
                );
            }


            const customerId =
                data.customerId ||
                Matching.getUserId();


            const pickupLocation =
                Matching.normalizeLocation(
                    data.pickupLocation ||
                    data.pickup ||
                    data.customerLocation
                );


            if (
                !customerId
            ) {

                throw new Error(
                    "Customer ID is required."
                );
            }


            if (
                !pickupLocation
            ) {

                throw new Error(
                    "Pickup location is required."
                );
            }


            /*
             * Create ride first.
             */

            const ride =
                await Matching.createRide({

                    rideId:
                        data.rideId,

                    customerId:
                        customerId,

                    service:
                        data.service ||
                        data.serviceType ||
                        "bike",

                    pickup:
                        data.pickupAddress ||
                        data.pickupName ||
                        "",

                    destination:
                        data.destinationAddress ||
                        data.destinationName ||
                        "",

                    pickupLocation:
                        pickupLocation,

                    destinationLocation:
                        Matching.normalizeLocation(
                            data.destinationLocation ||
                            data.destination
                        ),

                    fare:
                        data.fare ||
                        data.estimatedFare ||
                        0,

                    paymentMethod:
                        data.paymentMethod ||
                        "cash"
                });


            const requestId =
                data.requestId ||
                Matching.createRequestId();


            Matching.state.active =
                true;


            Matching.state.rideId =
                ride.rideId;


            Matching.state.requestId =
                requestId;


            Matching.state.customerId =
                customerId;


            Matching.state.matchedRiderId =
                null;


            Matching.state.candidateRiders =
                [];


            Matching.state.requestedRiders =
                [];


            Matching.state.rejectedRiders =
                [];


            Matching.state.expiredRiders =
                [];


            Matching.state.searchRadius =
                Number(
                    data.radius ||
                    Matching.config
                        .defaultSearchRadius
                );


            Matching.state.startedAt =
                Date.now();


            Matching.state.accepted =
                false;


            /*
             * Save global request.
             */

            await Matching.saveRideRequest({

                requestId:
                    requestId,

                rideId:
                    ride.rideId,

                customerId:
                    customerId,

                pickupLocation:
                    pickupLocation,

                destinationLocation:
                    ride.destinationLocation,

                service:
                    ride.service,

                fare:
                    ride.fare,

                status:
                    "searching",

                createdAt:
                    Date.now(),

                expiresAt:
                    Date.now() +
                    Matching.config
                        .totalMatchingTimeout
            });


            Matching.emit(
                "matching-started",
                {
                    ride:
                        ride,

                    requestId:
                        requestId,

                    radius:
                        Matching.state
                            .searchRadius
                }
            );


            /*
             * Start global timeout.
             */

            Matching.state.timeoutId =
                setTimeout(
                    function () {

                        if (
                            Matching.state
                                .active &&
                            !Matching.state
                                .accepted
                        ) {

                            Matching.emit(
                                "matching-timeout"
                            );

                            Matching.stop(
                                true
                            );
                        }

                    },
                    Matching.config
                        .totalMatchingTimeout
                );


            /*
             * First search.
             */

            await Matching.searchAndDispatch(
                ride
            );


            return {

                success:
                    true,

                ride:
                    ride,

                rideId:
                    ride.rideId,

                requestId:
                    requestId,

                riders:
                    Matching.state
                        .candidateRiders
            };
        };


    /* ========================================================
       SEARCH + DISPATCH
       ======================================================== */

    Matching.searchAndDispatch =
        async function (
            ride
        ) {

            if (
                !Matching.state.active ||
                Matching.state.accepted
            ) {

                return [];
            }


            const riders =
                await Matching
                    .findNearbyRiders(
                        ride.pickupLocation,
                        {
                            radius:
                                Matching.state
                                    .searchRadius
                        }
                    );


            /*
             * Remove riders already requested.
             */

            const available =
                riders.filter(
                    function (
                        rider
                    ) {

                        const riderId =
                            rider.uid ||
                            rider.id;


                        return !Matching
                            .state
                            .requestedRiders
                            .includes(
                                riderId
                            );
                    }
                );


            Matching.state
                .candidateRiders =
                riders;


            Matching.emit(
                "riders-found",
                {
                    ride:
                        ride,

                    riders:
                        riders,

                    radius:
                        Matching.state
                            .searchRadius
                }
            );


            if (
                !available.length
            ) {

                /*
                 * Expand search if no riders.
                 */

                const elapsed =
                    Date.now() -
                    Matching.state
                        .startedAt;


                if (
                    elapsed <
                    Matching.config
                        .totalMatchingTimeout
                ) {

                    Matching.expandSearch();


                    Matching.state
                        .retryTimeoutId =
                        setTimeout(
                            function () {

                                Matching
                                    .searchAndDispatch(
                                        ride
                                    );

                            },
                            Matching.config
                                .retryDelay
                        );
                }


                return [];
            }


            /*
             * Limit initial requests.
             */

            const batch =
                available.slice(
                    0,
                    Matching.config
                        .initialBatchSize
                );


            await Matching.sendBatch(
                ride,
                batch
            );


            /*
             * If fewer riders are found,
             * search again after timeout.
             */

            Matching.state
                .retryTimeoutId =
                setTimeout(
                    async function () {

                        if (
                            !Matching.state
                                .active ||
                            Matching.state
                                .accepted
                        ) {

                            return;
                        }


                        await Matching
                            .searchAndDispatch(
                                ride
                            );

                    },
                    Matching.config
                        .retryDelay
                );


            return batch;
        };


    /* ========================================================
       RIDER ACCEPTED
       ======================================================== */

    Matching.riderAccepted =
        async function (
            riderId,
            rideId
        ) {

            riderId =
                riderId ||
                null;


            rideId =
                rideId ||
                Matching.state
                    .rideId;


            if (
                !riderId ||
                !rideId
            ) {

                return false;
            }


            /*
             * First rider wins.
             */

            if (
                Matching.state.accepted &&
                Matching.state
                    .matchedRiderId !==
                riderId
            ) {

                return false;
            }


            Matching.state.accepted =
                true;


            Matching.state.active =
                false;


            Matching.state.matchedRiderId =
                riderId;


            /*
             * Stop retry timers.
             */

            if (
                Matching.state
                    .retryTimeoutId
            ) {

                clearTimeout(
                    Matching.state
                        .retryTimeoutId
                );

                Matching.state
                    .retryTimeoutId =
                    null;
            }


            if (
                Matching.state
                    .timeoutId
            ) {

                clearTimeout(
                    Matching.state
                        .timeoutId
                );

                Matching.state.timeoutId =
                    null;
            }


            /*
             * Cancel all other rider requests.
             */

            await Matching
                .cancelOtherRequests(
                    riderId
                );


            /*
             * Update ride.
             */

            await Matching
                .updateRideAfterAccept(
                    rideId,
                    riderId
                );


            Matching.emit(
                "rider-accepted",
                {
                    rideId:
                        rideId,

                    riderId:
                        riderId
                }
            );


            return true;
        };


    /* ========================================================
       UPDATE RIDE AFTER ACCEPT
       ======================================================== */

    Matching.updateRideAfterAccept =
        async function (
            rideId,
            riderId
        ) {

            const update = {

                riderId:
                    riderId,

                status:
                    "accepted",

                acceptedAt:
                    Date.now(),

                updatedAt:
                    Date.now()
            };


            const database =
                Matching.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Matching.config
                                .ridesCollection +
                            "/" +
                            rideId
                        )
                        .update(
                            update
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "RTDB ride update failed:",
                        error
                    );
                }
            }


            const firestore =
                Matching.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Matching.config
                                .ridesCollection
                        )
                        .doc(
                            rideId
                        )
                        .set(
                            update,
                            {
                                merge:
                                    true
                            }
                        );


                    return true;

                } catch (error) {}
            }


            return false;
        };


    /* ========================================================
       CANCEL OTHER REQUESTS
       ======================================================== */

    Matching.cancelOtherRequests =
        async function (
            acceptedRiderId
        ) {

            const requestId =
                Matching.state
                    .requestId;


            const database =
                Matching.getDatabase();


            if (
                database &&
                requestId
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                "riderRequests"
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val();


                    if (
                        data
                    ) {

                        const updates =
                            {};


                        Object.keys(
                            data
                        ).forEach(
                            function (
                                riderId
                            ) {

                                if (
                                    riderId ===
                                    acceptedRiderId
                                ) {

                                    return;
                                }


                                if (
                                    data[
                                        riderId
                                    ]?.[
                                        requestId
                                    ]
                                ) {

                                    updates[
                                        riderId +
                                        "/" +
                                        requestId +
                                        "/status"
                                    ] =
                                        "cancelled";

                                    updates[
                                        riderId +
                                        "/" +
                                        requestId +
                                        "/cancelledAt"
                                    ] =
                                        Date.now();
                                }
                            }
                        );


                        if (
                            Object.keys(
                                updates
                            ).length
                        ) {

                            await database
                                .ref(
                                    "riderRequests"
                                )
                                .update(
                                    updates
                                );
                        }
                    }

                } catch (error) {

                    console.warn(
                        "Cancel requests failed:",
                        error
                    );
                }
            }


            Matching.emit(
                "other-requests-cancelled",
                {
                    acceptedRiderId:
                        acceptedRiderId
                }
            );
        };


    /* ========================================================
       RIDER REJECTED
       ======================================================== */

    Matching.riderRejected =
        function (
            riderId
        ) {

            if (
                !riderId
            ) {
                return;
            }


            if (
                !Matching.state
                    .rejectedRiders
                    .includes(
                        riderId
                    )
            ) {

                Matching.state
                    .rejectedRiders
                    .push(
                        riderId
                    );
            }


            Matching.emit(
                "rider-rejected",
                {
                    riderId:
                        riderId
                }
            );
        };


    /* ========================================================
       REQUEST EXPIRED
       ======================================================== */

    Matching.riderRequestExpired =
        function (
            riderId
        ) {

            if (
                !riderId
            ) {
                return;
            }


            if (
                !Matching.state
                    .expiredRiders
                    .includes(
                        riderId
                    )
            ) {

                Matching.state
                    .expiredRiders
                    .push(
                        riderId
                    );
            }


            Matching.emit(
                "rider-request-expired",
                {
                    riderId:
                        riderId
                }
            );
        };


    /* ========================================================
       STOP MATCHING
       ======================================================== */

    Matching.stop =
        async function (
            timedOut
        ) {

            Matching.state.active =
                false;


            if (
                Matching.state
                    .retryTimeoutId
            ) {

                clearTimeout(
                    Matching.state
                        .retryTimeoutId
                );

                Matching.state
                    .retryTimeoutId =
                    null;
            }


            if (
                Matching.state
                    .timeoutId
            ) {

                clearTimeout(
                    Matching.state
                        .timeoutId
                );

                Matching.state.timeoutId =
                    null;
            }


            /*
             * Update ride if not accepted.
             */

            if (
                Matching.state.rideId &&
                !Matching.state.accepted
            ) {

                const update = {

                    status:
                        timedOut
                            ? "no_driver"
                            : "cancelled",

                    updatedAt:
                        Date.now()
                };


                const database =
                    Matching.getDatabase();


                if (
                    database
                ) {

                    try {

                        await database
                            .ref(
                                Matching.config
                                    .ridesCollection +
                                "/" +
                                Matching.state
                                    .rideId
                            )
                            .update(
                                update
                            );

                    } catch (error) {}
                }


                const firestore =
                    Matching.getFirestore();


                if (
                    firestore
                ) {

                    try {

                        await firestore
                            .collection(
                                Matching.config
                                    .ridesCollection
                            )
                            .doc(
                                Matching.state
                                    .rideId
                            )
                            .set(
                                update,
                                {
                                    merge:
                                        true
                                }
                            );

                    } catch (error) {}
                }
            }


            Matching.emit(
                "matching-stopped",
                {

                    rideId:
                        Matching.state
                            .rideId,

                    requestId:
                        Matching.state
                            .requestId,

                    timedOut:
                        Boolean(
                            timedOut
                        ),

                    accepted:
                        Matching.state
                            .accepted,

                    riderId:
                        Matching.state
                            .matchedRiderId
                }
            );


            return true;
        };


    /* ========================================================
       CANCEL MATCHING
       ======================================================== */

    Matching.cancel =
        async function () {

            Matching.state.accepted =
                false;


            return Matching.stop(
                false
            );
        };


    /* ========================================================
       GET STATE
       ======================================================== */

    Matching.getState =
        function () {

            return {

                ...Matching.state,

                candidateRiders:
                    [
                        ...Matching.state
                            .candidateRiders
                    ],

                requestedRiders:
                    [
                        ...Matching.state
                            .requestedRiders
                    ],

                rejectedRiders:
                    [
                        ...Matching.state
                            .rejectedRiders
                    ],

                expiredRiders:
                    [
                        ...Matching.state
                            .expiredRiders
                    ]
            };
        };


    /* ========================================================
       IS ACTIVE
       ======================================================== */

    Matching.isActive =
        function () {

            return (
                Matching.state.active ===
                true
            );
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    Matching.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-matching-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Matching.on =
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
                "riderx-matching-" +
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
       INIT
       ======================================================== */

    Matching.init =
        function () {

            if (
                Matching.state
                    .initialized
            ) {

                return;
            }


            Matching.state
                .initialized =
                true;


            Matching.emit(
                "ready"
            );


            console.log(
                "RiderX matching.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.findNearbyRiders =
        Matching.findNearbyRiders;

    RX.startMatching =
        Matching.start;

    RX.stopMatching =
        Matching.stop;

    RX.cancelMatching =
        Matching.cancel;

    RX.acceptedRider =
        Matching.riderAccepted;


    /* ========================================================
       INIT
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Matching.init
        );

    } else {

        Matching.init();
    }


})();
