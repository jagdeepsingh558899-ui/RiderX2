/* ============================================================
   RIDERX 2.0
   MATCHING ENGINE
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
   - Request cleanup
   - Duplicate search protection
   - Rider location freshness
   - Atomic RTDB ride acceptance

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

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Matching = RX.matching = RX.matching || {};


    /* ============================================================
       CONFIG
       ============================================================ */

    Matching.config = {

        ridersCollection: "riders",

        customersCollection: "customers",

        ridesCollection: "rides",

        requestsCollection: "rideRequests",

        liveLocationsCollection: "liveLocations",

        riderRequestsCollection: "riderRequests",

        defaultSearchRadius: 8,

        minimumSearchRadius: 2,

        maximumSearchRadius: 20,

        initialBatchSize: 5,

        maximumBatchSize: 15,

        riderRequestTimeout: 15000,

        totalMatchingTimeout: 90000,

        retryDelay: 3000,

        locationFreshness: 45000,

        maxDriverAge: 60,

        allowMultipleRequests: true,

        requireOnline: true,

        requireAvailable: true,

        maxSearchAttempts: 30
    };


    /* ============================================================
       STATE
       ============================================================ */

    Matching.state = {

        initialized: false,

        active: false,

        searching: false,

        accepting: false,

        rideId: null,

        requestId: null,

        customerId: null,

        matchedRiderId: null,

        candidateRiders: [],

        requestedRiders: [],

        rejectedRiders: [],

        expiredRiders: [],

        searchRadius: 8,

        searchAttempts: 0,

        startedAt: null,

        timeoutId: null,

        retryTimeoutId: null,

        listener: null,

        accepted: false
    };


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    Matching.now = function () {

        return Date.now();
    };


    Matching.safeNumber = function (value, fallback) {

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    };


    Matching.getDatabase = function () {

        try {

            if (
                RX.firebase &&
                typeof RX.firebase.database === "function"
            ) {

                return RX.firebase.database();
            }

            if (
                RX.firebase &&
                RX.firebase.database &&
                typeof RX.firebase.database.ref === "function"
            ) {

                return RX.firebase.database;
            }

            if (
                window.firebase &&
                typeof firebase.database === "function"
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


    Matching.getFirestore = function () {

        try {

            if (
                RX.firebase &&
                typeof RX.firebase.firestore === "function"
            ) {

                return RX.firebase.firestore();
            }

            if (
                RX.firebase &&
                RX.firebase.firestore &&
                typeof RX.firebase.firestore.collection === "function"
            ) {

                return RX.firebase.firestore;
            }

            if (
                window.firebase &&
                typeof firebase.firestore === "function"
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


    Matching.getAuthUser = function () {

        try {

            if (
                RX.auth &&
                RX.auth.currentUser
            ) {

                return RX.auth.currentUser;
            }

            if (
                window.firebase &&
                typeof firebase.auth === "function"
            ) {

                const user = firebase.auth().currentUser;

                if (user) {

                    return user;
                }
            }

        } catch (error) {

            console.warn(
                "RiderX auth lookup failed:",
                error
            );
        }


        try {

            const saved =
                localStorage.getItem("riderx_user");

            if (saved) {

                return JSON.parse(saved);
            }

        } catch (error) {

            console.warn(
                "RiderX saved user lookup failed:",
                error
            );
        }

        return null;
    };


    Matching.getUserId = function () {

        const user =
            Matching.getAuthUser();

        return (
            user?.uid ||
            user?.id ||
            user?.userId ||
            localStorage.getItem("riderx_uid") ||
            null
        );
    };


    Matching.normalizeRole = function (role) {

        role =
            String(role || "")
                .toLowerCase()
                .trim();

        if (role === "driver") {

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


    Matching.getRiderId = function (rider) {

        if (!rider) {

            return null;
        }

        return (
            rider.uid ||
            rider.userId ||
            rider.riderId ||
            rider.id ||
            null
        );
    };


    /* ============================================================
       ID GENERATORS
       ============================================================ */

    Matching.createRequestId = function () {

        return (
            "req_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    };


    Matching.createRideId = function () {

        return (
            "ride_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    };


    /* ============================================================
       LOCATION NORMALIZATION
       ============================================================ */

    Matching.normalizeTimestamp = function (timestamp) {

        let value =
            Number(timestamp);

        if (!Number.isFinite(value) || value <= 0) {

            return Date.now();
        }

        /*
         * Convert Unix seconds to milliseconds.
         */

        if (value < 100000000000) {

            value *= 1000;
        }

        return value;
    };


    Matching.normalizeLocation = function (location) {

        if (!location) {

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


        if (
            lat < -90 ||
            lat > 90 ||
            lng < -180 ||
            lng > 180
        ) {

            return null;
        }


        return {

            lat: lat,

            lng: lng,

            accuracy:
                Matching.safeNumber(
                    location.accuracy,
                    0
                ),

            heading:
                Number.isFinite(
                    Number(location.heading)
                )
                    ? Number(location.heading)
                    : null,

            speed:
                Number.isFinite(
                    Number(location.speed)
                )
                    ? Number(location.speed)
                    : null,

            timestamp:
                Matching.normalizeTimestamp(
                    location.timestamp ??
                    location.updatedAt ??
                    location.lastUpdated ??
                    Date.now()
                )
        };
    };


    /* ============================================================
       DISTANCE
       ============================================================ */

    Matching.distance = function (
        from,
        to
    ) {

        from =
            Matching.normalizeLocation(from);

        to =
            Matching.normalizeLocation(to);


        if (!from || !to) {

            return Infinity;
        }


        const earthRadius = 6371;


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
            Math.sin(dLat / 2) *
            Math.sin(dLat / 2) +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);


        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );


        return earthRadius * c;
    };


    /* ============================================================
       LOCATION FRESHNESS
       ============================================================ */

    Matching.isLocationFresh = function (
        location
    ) {

        location =
            Matching.normalizeLocation(location);


        if (!location) {

            return false;
        }


        const age =
            Matching.now() -
            location.timestamp;


        /*
         * Future timestamps are accepted with
         * a small clock-skew tolerance.
         */

        if (age < -10000) {

            return true;
        }


        return (
            age <=
            Matching.config.locationFreshness
        );
    };


    /* ============================================================
       RIDER LOCATION
       ============================================================ */

    Matching.getRiderLocation = function (
        rider
    ) {

        if (!rider) {

            return null;
        }


        return Matching.normalizeLocation(
            rider.location ||
            rider.liveLocation ||
            rider.currentLocation ||
            rider.coordinates ||
            rider
        );
    };


    /* ============================================================
       RIDER ELIGIBILITY
       ============================================================ */

    Matching.isRiderEligible = function (
        rider,
        customerLocation
    ) {

        if (!rider) {

            return false;
        }


        const riderId =
            Matching.getRiderId(rider);


        if (!riderId) {

            return false;
        }


        /*
         * Online.
         */

        if (
            Matching.config.requireOnline
        ) {

            const online =
                rider.online === true ||
                rider.isOnline === true ||
                rider.status === "online" ||
                rider.availability === "online";


            if (!online) {

                return false;
            }
        }


        /*
         * Available.
         */

        if (
            Matching.config.requireAvailable
        ) {

            const available =
                rider.available !== false &&
                rider.isAvailable !== false &&
                rider.busy !== true &&
                rider.onRide !== true &&
                rider.currentRideId == null &&
                rider.activeRideId == null;


            if (!available) {

                return false;
            }
        }


        /*
         * Blocked / suspended.
         */

        if (
            rider.approved === false ||
            rider.verified === false ||
            rider.status === "blocked" ||
            rider.status === "suspended" ||
            rider.status === "rejected"
        ) {

            return false;
        }


        /*
         * Location.
         */

        const location =
            Matching.getRiderLocation(rider);


        if (!location) {

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


        return Number.isFinite(distance);
    };


    /* ============================================================
       RTDB RIDERS
       ============================================================ */

    Matching.getRidersFromRTDB =
        async function () {

            const database =
                Matching.getDatabase();


            if (!database) {

                return [];
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Matching.config.ridersCollection
                        )
                        .once("value");


                const data =
                    snapshot.val();


                if (!data) {

                    return [];
                }


                return Object.keys(data)
                    .map(function (key) {

                        const rider =
                            data[key] || {};


                        return {

                            ...rider,

                            id: key,

                            uid:
                                rider.uid ||
                                rider.userId ||
                                key
                        };
                    });

            } catch (error) {

                console.warn(
                    "RTDB rider search failed:",
                    error
                );

                return [];
            }
        };


    /* ============================================================
       FIRESTORE RIDERS
       ============================================================ */

    Matching.getRidersFromFirestore =
        async function () {

            const firestore =
                Matching.getFirestore();


            if (!firestore) {

                return [];
            }


            try {

                const snapshot =
                    await firestore
                        .collection(
                            Matching.config.ridersCollection
                        )
                        .get();


                return snapshot.docs.map(
                    function (doc) {

                        const data =
                            doc.data() || {};


                        return {

                            ...data,

                            id: doc.id,

                            uid:
                                data.uid ||
                                data.userId ||
                                doc.id
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


    /* ============================================================
       LOAD RIDERS
       ============================================================ */

    Matching.loadRiders =
        async function () {

            let riders =
                await Matching
                    .getRidersFromRTDB();


            if (riders.length) {

                return riders;
            }


            riders =
                await Matching
                    .getRidersFromFirestore();


            return riders;
        };


    /* ============================================================
       SORT RIDERS
       ============================================================ */

    Matching.sortByDistance =
        function (
            riders,
            customerLocation
        ) {

            return riders
                .map(function (rider) {

                    const location =
                        Matching
                            .getRiderLocation(
                                rider
                            );


                    const distance =
                        Matching.distance(
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

                })
                .filter(function (rider) {

                    return Number.isFinite(
                        rider.distance
                    );

                })
                .sort(function (a, b) {

                    return (
                        a.distance -
                        b.distance
                    );
                });
        };


    /* ============================================================
       FIND NEARBY RIDERS
       ============================================================ */

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


            if (!customerLocation) {

                throw new Error(
                    "Customer location is required."
                );
            }


            let radius =
                Number(
                    options.radius ??
                    Matching.config.defaultSearchRadius
                );


            if (!Number.isFinite(radius)) {

                radius =
                    Matching.config.defaultSearchRadius;
            }


            radius =
                Math.max(
                    radius,
                    Matching.config.minimumSearchRadius
                );


            radius =
                Math.min(
                    radius,
                    Matching.config.maximumSearchRadius
                );


            const riders =
                await Matching.loadRiders();


            const eligible =
                riders.filter(function (rider) {

                    return Matching
                        .isRiderEligible(
                            rider,
                            customerLocation
                        );
                });


            const sorted =
                Matching.sortByDistance(
                    eligible,
                    customerLocation
                );


            return sorted.filter(
                function (rider) {

                    return (
                        rider.distance <=
                        radius
                    );
                }
            );
        };


    /* ============================================================
       EXPAND SEARCH
       ============================================================ */

    Matching.expandSearch =
        function () {

            let radius =
                Number(
                    Matching.state.searchRadius
                );


            if (!Number.isFinite(radius)) {

                radius =
                    Matching.config
                        .defaultSearchRadius;
            }


            radius =
                Math.max(
                    radius,
                    Matching.config.minimumSearchRadius
                );


            radius =
                Math.min(
                    radius * 1.5,
                    Matching.config.maximumSearchRadius
                );


            Matching.state.searchRadius =
                radius;


            return radius;
        };


    /* ============================================================
       CREATE RIDE
       ============================================================ */

    Matching.createRide =
        async function (data) {

            data =
                data || {};


            const rideId =
                data.rideId ||
                Matching.createRideId();


            const now =
                Date.now();


            const ride = {

                rideId: rideId,

                customerId:
                    data.customerId ||
                    Matching.getUserId(),

                riderId:
                    data.riderId ||
                    null,

                service:
                    data.service ||
                    data.serviceType ||
                    "bike",

                status:
                    data.status ||
                    "searching",

                pickup:
                    data.pickup ||
                    "",

                destination:
                    data.destination ||
                    "",

                pickupLocation:
                    data.pickupLocation ||
                    null,

                destinationLocation:
                    data.destinationLocation ||
                    null,

                fare:
                    Matching.safeNumber(
                        data.fare,
                        0
                    ),

                paymentMethod:
                    data.paymentMethod ||
                    "cash",

                createdAt:
                    now,

                updatedAt:
                    now
            };


            const database =
                Matching.getDatabase();


            if (database) {

                try {

                    await database
                        .ref(
                            Matching.config.ridesCollection +
                            "/" +
                            rideId
                        )
                        .set(ride);


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


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            Matching.config.ridesCollection
                        )
                        .doc(rideId)
                        .set(ride);


                    return ride;

                } catch (error) {

                    console.warn(
                        "Firestore ride create failed:",
                        error
                    );
                }
            }


            throw new Error(
                "Unable to save ride."
            );
        };


    /* ============================================================
       SAVE GLOBAL RIDE REQUEST
       ============================================================ */

    Matching.saveRideRequest =
        async function (request) {

            const database =
                Matching.getDatabase();


            if (database) {

                try {

                    await database
                        .ref(
                            Matching.config.requestsCollection +
                            "/" +
                            request.requestId
                        )
                        .set(request);


                    return true;

                } catch (error) {

                    console.warn(
                        "RTDB request save failed:",
                        error
                    );
                }
            }


            const firestore =
                Matching.getFirestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            Matching.config.requestsCollection
                        )
                        .doc(request.requestId)
                        .set(request);


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore request save failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       UPDATE GLOBAL REQUEST
       ============================================================ */

    Matching.updateGlobalRequest =
        async function (updates) {

            const requestId =
                Matching.state.requestId;


            if (!requestId) {

                return false;
            }


            const database =
                Matching.getDatabase();


            if (database) {

                try {

                    await database
                        .ref(
                            Matching.config.requestsCollection +
                            "/" +
                            requestId
                        )
                        .update(updates);


                    return true;

                } catch (error) {

                    console.warn(
                        "RTDB global request update failed:",
                        error
                    );
                }
            }


            const firestore =
                Matching.getFirestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            Matching.config.requestsCollection
                        )
                        .doc(requestId)
                        .set(
                            updates,
                            {
                                merge: true
                            }
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore global request update failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       BUILD RIDER REQUEST
       ============================================================ */

    Matching.buildRiderRequest =
        function (
            ride,
            rider
        ) {

            const now =
                Date.now();


            const riderId =
                Matching.getRiderId(rider);


            return {

                requestId:
                    Matching.state.requestId,

                rideId:
                    ride.rideId,

                customerId:
                    ride.customerId,

                riderId:
                    riderId,

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
                    now,

                expiresAt:
                    now +
                    Matching.config
                        .riderRequestTimeout
            };
        };


    /* ============================================================
       SEND REQUEST TO RIDER
       ============================================================ */

    Matching.sendRequestToRider =
        async function (
            ride,
            rider
        ) {

            const riderId =
                Matching.getRiderId(rider);


            if (!riderId) {

                return false;
            }


            if (
                Matching.state
                    .requestedRiders
                    .includes(riderId)
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


            if (database) {

                try {

                    /*
                     * Rider inbox.
                     */

                    await database
                        .ref(
                            Matching.config
                                .riderRequestsCollection +
                            "/" +
                            riderId +
                            "/" +
                            request.requestId
                        )
                        .set(request);


                    /*
                     * Global request rider record.
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
                        .set(request);


                    Matching.state
                        .requestedRiders
                        .push(riderId);


                    Matching.emit(
                        "request-sent",
                        {
                            ride: ride,
                            rider: rider,
                            request: request
                        }
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "RTDB rider request failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            const firestore =
                Matching.getFirestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            "riderRequests"
                        )
                        .doc(riderId)
                        .collection("requests")
                        .doc(request.requestId)
                        .set(request);


                    Matching.state
                        .requestedRiders
                        .push(riderId);


                    Matching.emit(
                        "request-sent",
                        {
                            ride: ride,
                            rider: rider,
                            request: request
                        }
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore rider request failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       SEND BATCH
       ============================================================ */

    Matching.sendBatch =
        async function (
            ride,
            riders
        ) {

            if (
                !Array.isArray(riders) ||
                !riders.length
            ) {

                return 0;
            }


            const batch =
                riders.slice(
                    0,
                    Matching.config.maximumBatchSize
                );


            let count = 0;


            if (
                !Matching.config
                    .allowMultipleRequests
            ) {

                batch.splice(
                    1
                );
            }


            for (
                const rider of batch
            ) {

                if (
                    Matching.state.accepted
                ) {

                    break;
                }


                const riderId =
                    Matching.getRiderId(rider);


                if (!riderId) {

                    continue;
                }


                if (
                    Matching.state
                        .requestedRiders
                        .includes(riderId)
                ) {

                    continue;
                }


                if (
                    Matching.state
                        .rejectedRiders
                        .includes(riderId)
                ) {

                    continue;
                }


                if (
                    Matching.state
                        .expiredRiders
                        .includes(riderId)
                ) {

                    continue;
                }


                const sent =
                    await Matching
                        .sendRequestToRider(
                            ride,
                            rider
                        );


                if (sent) {

                    count++;
                }
            }


            return count;
        };


    /* ============================================================
       START MATCHING
       ============================================================ */

    Matching.start =
        async function (data) {

            data =
                data || {};


            if (
                Matching.state.active
            ) {

                await Matching.stop(false);
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


            if (!customerId) {

                throw new Error(
                    "Customer ID is required."
                );
            }


            if (!pickupLocation) {

                throw new Error(
                    "Pickup location is required."
                );
            }


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
                        data.pickup ||
                        "",

                    destination:
                        data.destinationAddress ||
                        data.destinationName ||
                        data.destination ||
                        "",

                    pickupLocation:
                        pickupLocation,

                    destinationLocation:
                        Matching.normalizeLocation(
                            data.destinationLocation ||
                            data.destinationCoordinates
                        ),

                    fare:
                        data.fare ??
                        data.estimatedFare ??
                        0,

                    paymentMethod:
                        data.paymentMethod ||
                        "cash"
                });


            const requestId =
                data.requestId ||
                Matching.createRequestId();


            Matching.clearTimers();


            Matching.state.active =
                true;

            Matching.state.searching =
                false;

            Matching.state.accepting =
                false;

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

            Matching.state.searchAttempts =
                0;

            Matching.state.searchRadius =
                Math.min(
                    Math.max(
                        Number(
                            data.radius ||
                            Matching.config
                                .defaultSearchRadius
                        ),
                        Matching.config
                            .minimumSearchRadius
                    ),
                    Matching.config
                        .maximumSearchRadius
                );

            Matching.state.startedAt =
                Date.now();

            Matching.state.accepted =
                false;


            const requestSaved =
                await Matching.saveRideRequest({

                    requestId:
                        requestId,

                    rideId:
                        ride.rideId,

                    customerId:
                        customerId,

                    pickup:
                        ride.pickup,

                    destination:
                        ride.destination,

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


            if (!requestSaved) {

                console.warn(
                    "RiderX: global ride request could not be saved."
                );
            }


            Matching.emit(
                "matching-started",
                {
                    ride: ride,

                    requestId:
                        requestId,

                    radius:
                        Matching.state
                            .searchRadius
                }
            );


            Matching.state.timeoutId =
                setTimeout(
                    async function () {

                        if (
                            Matching.state.active &&
                            !Matching.state.accepted
                        ) {

                            Matching.emit(
                                "matching-timeout",
                                {
                                    rideId:
                                        ride.rideId,

                                    requestId:
                                        requestId
                                }
                            );


                            await Matching.stop(
                                true
                            );
                        }

                    },
                    Matching.config
                        .totalMatchingTimeout
                );


            await Matching.searchAndDispatch(
                ride
            );


            return {

                success: true,

                ride: ride,

                rideId:
                    ride.rideId,

                requestId:
                    requestId,

                riders:
                    Matching.state
                        .candidateRiders
            };
        };


    /* ============================================================
       SEARCH + DISPATCH
       ============================================================ */

    Matching.searchAndDispatch =
        async function (ride) {

            if (
                !Matching.state.active ||
                Matching.state.accepted
            ) {

                return [];
            }


            /*
             * Prevent overlapping searches.
             */

            if (
                Matching.state.searching
            ) {

                return [];
            }


            Matching.state.searching =
                true;


            try {

                Matching.state.searchAttempts++;


                if (
                    Matching.state.searchAttempts >
                    Matching.config.maxSearchAttempts
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


                const available =
                    riders.filter(
                        function (rider) {

                            const riderId =
                                Matching
                                    .getRiderId(
                                        rider
                                    );


                            if (!riderId) {

                                return false;
                            }


                            return (
                                !Matching.state
                                    .requestedRiders
                                    .includes(
                                        riderId
                                    ) &&
                                !Matching.state
                                    .rejectedRiders
                                    .includes(
                                        riderId
                                    ) &&
                                !Matching.state
                                    .expiredRiders
                                    .includes(
                                        riderId
                                    )
                            );
                        }
                    );


                Matching.state
                    .candidateRiders =
                    riders;


                Matching.emit(
                    "riders-found",
                    {
                        ride: ride,

                        riders: riders,

                        radius:
                            Matching.state
                                .searchRadius
                    }
                );


                if (
                    !available.length
                ) {

                    const elapsed =
                        Date.now() -
                        Matching.state
                            .startedAt;


                    if (
                        elapsed <
                        Matching.config
                            .totalMatchingTimeout &&
                        Matching.state.active
                    ) {

                        Matching.expandSearch();

                        Matching.scheduleRetry(
                            ride
                        );
                    }


                    return [];
                }


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


                if (
                    Matching.state.active &&
                    !Matching.state.accepted
                ) {

                    Matching.scheduleRetry(
                        ride
                    );
                }


                return batch;

            } finally {

                Matching.state.searching =
                    false;
            }
        };


    /* ============================================================
       RETRY SCHEDULER
       ============================================================ */

    Matching.scheduleRetry =
        function (ride) {

            if (
                Matching.state.retryTimeoutId
            ) {

                clearTimeout(
                    Matching.state.retryTimeoutId
                );
            }


            Matching.state.retryTimeoutId =
                setTimeout(
                    async function () {

                        Matching.state
                            .retryTimeoutId =
                            null;


                        if (
                            !Matching.state.active ||
                            Matching.state.accepted
                        ) {

                            return;
                        }


                        await Matching
                            .searchAndDispatch(
                                ride
                            );

                    },
                    Matching.config.retryDelay
                );
        };


    /* ============================================================
       RIDER ACCEPTANCE
       ============================================================ */

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
                Matching.state.rideId;


            if (
                !riderId ||
                !rideId
            ) {

                return false;
            }


            /*
             * Local duplicate protection.
             */

            if (
                Matching.state.accepted
            ) {

                return (
                    Matching.state
                        .matchedRiderId ===
                    riderId
                );
            }


            if (
                Matching.state.accepting
            ) {

                return false;
            }


            Matching.state.accepting =
                true;


            try {

                /*
                 * Atomic RTDB lock.
                 */

                const locked =
                    await Matching
                        .atomicallyAcceptRide(
                            rideId,
                            riderId
                        );


                if (!locked) {

                    Matching.emit(
                        "acceptance-lost",
                        {
                            rideId:
                                rideId,

                            riderId:
                                riderId
                        }
                    );


                    return false;
                }


                Matching.state.accepted =
                    true;

                Matching.state.active =
                    false;

                Matching.state.matchedRiderId =
                    riderId;


                Matching.clearTimers();


                await Matching
                    .markAcceptedRiderRequest(
                        riderId
                    );


                await Matching
                    .cancelOtherRequests(
                        riderId
                    );


                await Matching
                    .updateRideAfterAccept(
                        rideId,
                        riderId,
                        true
                    );


                await Matching
                    .updateGlobalRequest({

                        status:
                            "accepted",

                        riderId:
                            riderId,

                        acceptedAt:
                            Date.now(),

                        updatedAt:
                            Date.now()
                    });


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

            } finally {

                Matching.state.accepting =
                    false;
            }
        };


    /* ============================================================
       ATOMIC RIDE ACCEPTANCE
       ============================================================ */

    Matching.atomicallyAcceptRide =
        async function (
            rideId,
            riderId
        ) {

            const database =
                Matching.getDatabase();


            if (!database) {

                /*
                 * Firestore fallback cannot use the same
                 * RTDB transaction mechanism.
                 */

                return Matching
                    .firestoreAcceptRide(
                        rideId,
                        riderId
                    );
            }


            try {

                const rideRef =
                    database
                        .ref(
                            Matching.config
                                .ridesCollection +
                            "/" +
                            rideId
                        );


                const result =
                    await rideRef.transaction(
                        function (ride) {

                            if (!ride) {

                                return ride;
                            }


                            /*
                             * Already accepted by
                             * another rider.
                             */

                            if (
                                ride.status ===
                                    "accepted" &&
                                ride.riderId &&
                                ride.riderId !==
                                    riderId
                            ) {

                                return;
                            }


                            /*
                             * Ride is no longer available.
                             */

                            if (
                                ride.status !==
                                    "searching" &&
                                ride.status !==
                                    "requested" &&
                                ride.status !==
                                    "pending"
                            ) {

                                return;
                            }


                            ride.riderId =
                                riderId;

                            ride.status =
                                "accepted";

                            ride.acceptedAt =
                                Date.now();

                            ride.updatedAt =
                                Date.now();


                            return ride;
                        }
                    );


                return (
                    result.committed === true &&
                    result.snapshot &&
                    result.snapshot.val() &&
                    result.snapshot.val()
                        .riderId === riderId
                );

            } catch (error) {

                console.warn(
                    "Atomic ride acceptance failed:",
                    error
                );


                return false;
            }
        };


    /* ============================================================
       FIRESTORE ACCEPTANCE FALLBACK
       ============================================================ */

    Matching.firestoreAcceptRide =
        async function (
            rideId,
            riderId
        ) {

            const firestore =
                Matching.getFirestore();


            if (!firestore) {

                return false;
            }


            try {

                const rideRef =
                    firestore
                        .collection(
                            Matching.config
                                .ridesCollection
                        )
                        .doc(rideId);


                if (
                    typeof firestore.runTransaction ===
                    "function"
                ) {

                    return await firestore
                        .runTransaction(
                            async function (
                                transaction
                            ) {

                                const snapshot =
                                    await transaction
                                        .get(
                                            rideRef
                                        );


                                if (
                                    !snapshot.exists
                                ) {

                                    return false;
                                }


                                const ride =
                                    snapshot.data() ||
                                    {};


                                if (
                                    ride.status ===
                                        "accepted" &&
                                    ride.riderId &&
                                    ride.riderId !==
                                        riderId
                                ) {

                                    return false;
                                }


                                if (
                                    ride.status !==
                                        "searching" &&
                                    ride.status !==
                                        "requested" &&
                                    ride.status !==
                                        "pending"
                                ) {

                                    return false;
                                }


                                transaction.update(
                                    rideRef,
                                    {
                                        riderId:
                                            riderId,

                                        status:
                                            "accepted",

                                        acceptedAt:
                                            Date.now(),

                                        updatedAt:
                                            Date.now()
                                    }
                                );


                                return true;
                            }
                        );
                }


                return false;

            } catch (error) {

                console.warn(
                    "Firestore atomic acceptance failed:",
                    error
                );


                return false;
            }
        };


    /* ============================================================
       UPDATE RIDE AFTER ACCEPT
       ============================================================ */

    Matching.updateRideAfterAccept =
        async function (
            rideId,
            riderId,
            alreadyLocked
        ) {

            if (
                alreadyLocked
            ) {

                return true;
            }


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


            if (database) {

                try {

                    await database
                        .ref(
                            Matching.config
                                .ridesCollection +
                            "/" +
                            rideId
                        )
                        .update(update);


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


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            Matching.config
                                .ridesCollection
                        )
                        .doc(rideId)
                        .set(
                            update,
                            {
                                merge: true
                            }
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore ride update failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       MARK ACCEPTED RIDER REQUEST
       ============================================================ */

    Matching.markAcceptedRiderRequest =
        async function (
            riderId
        ) {

            const requestId =
                Matching.state.requestId;


            if (
                !requestId ||
                !riderId
            ) {

                return false;
            }


            const database =
                Matching.getDatabase();


            if (database) {

                try {

                    await database
                        .ref(
                            Matching.config
                                .riderRequestsCollection +
                            "/" +
                            riderId +
                            "/" +
                            requestId
                        )
                        .update({

                            status:
                                "accepted",

                            acceptedAt:
                                Date.now()
                        });


                    return true;

                } catch (error) {

                    console.warn(
                        "Accepted rider request update failed:",
                        error
                    );
                }
            }


            const firestore =
                Matching.getFirestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            "riderRequests"
                        )
                        .doc(riderId)
                        .collection("requests")
                        .doc(requestId)
                        .set(
                            {
                                status:
                                    "accepted",

                                acceptedAt:
                                    Date.now()
                            },
                            {
                                merge: true
                            }
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore accepted request update failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       CANCEL OTHER REQUESTS
       ============================================================ */

    Matching.cancelOtherRequests =
        async function (
            acceptedRiderId
        ) {

            const requestId =
                Matching.state.requestId;


            if (!requestId) {

                return false;
            }


            const database =
                Matching.getDatabase();


            if (database) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Matching.config
                                    .riderRequestsCollection
                            )
                            .once("value");


                    const data =
                        snapshot.val();


                    if (data) {

                        const updates = {};


                        Object.keys(data)
                            .forEach(
                                function (riderId) {

                                    if (
                                        riderId ===
                                        acceptedRiderId
                                    ) {

                                        return;
                                    }


                                    const request =
                                        data[riderId]?.[
                                            requestId
                                        ];


                                    if (
                                        request &&
                                        request.status ===
                                            "pending"
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
                            Object.keys(updates)
                                .length
                        ) {

                            await database
                                .ref(
                                    Matching.config
                                        .riderRequestsCollection
                                )
                                .update(updates);
                        }
                    }


                    Matching.emit(
                        "other-requests-cancelled",
                        {
                            acceptedRiderId:
                                acceptedRiderId
                        }
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "Cancel requests failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            const firestore =
                Matching.getFirestore();


            if (firestore) {

                try {

                    const requested =
                        Matching.state
                            .requestedRiders;


                    await Promise.all(
                        requested.map(
                            async function (riderId) {

                                if (
                                    riderId ===
                                    acceptedRiderId
                                ) {

                                    return;
                                }


                                await firestore
                                    .collection(
                                        "riderRequests"
                                    )
                                    .doc(riderId)
                                    .collection(
                                        "requests"
                                    )
                                    .doc(requestId)
                                    .set(
                                        {
                                            status:
                                                "cancelled",

                                            cancelledAt:
                                                Date.now()
                                        },
                                        {
                                            merge: true
                                        }
                                    );
                            }
                        )
                    );


                    Matching.emit(
                        "other-requests-cancelled",
                        {
                            acceptedRiderId:
                                acceptedRiderId
                        }
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore request cancellation failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       RIDER REJECTED
       ============================================================ */

    Matching.riderRejected =
        function (riderId) {

            if (!riderId) {

                return;
            }


            if (
                !Matching.state
                    .rejectedRiders
                    .includes(riderId)
            ) {

                Matching.state
                    .rejectedRiders
                    .push(riderId);
            }


            Matching.emit(
                "rider-rejected",
                {
                    riderId:
                        riderId
                }
            );
        };


    /* ============================================================
       REQUEST EXPIRED
       ============================================================ */

    Matching.riderRequestExpired =
        function (riderId) {

            if (!riderId) {

                return;
            }


            if (
                !Matching.state
                    .expiredRiders
                    .includes(riderId)
            ) {

                Matching.state
                    .expiredRiders
                    .push(riderId);
            }


            Matching.emit(
                "rider-request-expired",
                {
                    riderId:
                        riderId
                }
            );
        };


    /* ============================================================
       CLEANUP REQUESTS
       ============================================================ */

    Matching.cleanupRequests =
        async function (
            finalStatus
        ) {

            const requestId =
                Matching.state.requestId;


            if (!requestId) {

                return false;
            }


            const database =
                Matching.getDatabase();


            if (database) {

                try {

                    const updates = {};


                    Matching.state
                        .requestedRiders
                        .forEach(
                            function (riderId) {

                                updates[
                                    riderId +
                                    "/" +
                                    requestId +
                                    "/status"
                                ] =
                                    finalStatus;

                                updates[
                                    riderId +
                                    "/" +
                                    requestId +
                                    "/updatedAt"
                                ] =
                                    Date.now();
                            }
                        );


                    if (
                        Object.keys(updates)
                            .length
                    ) {

                        await database
                            .ref(
                                Matching.config
                                    .riderRequestsCollection
                            )
                            .update(updates);
                    }


                    return true;

                } catch (error) {

                    console.warn(
                        "Request cleanup failed:",
                        error
                    );
                }
            }


            const firestore =
                Matching.getFirestore();


            if (firestore) {

                try {

                    await Promise.all(
                        Matching.state
                            .requestedRiders
                            .map(
                                async function (
                                    riderId
                                ) {

                                    await firestore
                                        .collection(
                                            "riderRequests"
                                        )
                                        .doc(riderId)
                                        .collection(
                                            "requests"
                                        )
                                        .doc(requestId)
                                        .set(
                                            {
                                                status:
                                                    finalStatus,

                                                updatedAt:
                                                    Date.now()
                                            },
                                            {
                                                merge: true
                                            }
                                        );
                                }
                            )
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore request cleanup failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ============================================================
       CLEAR TIMERS
       ============================================================ */

    Matching.clearTimers =
        function () {

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
        };


    /* ============================================================
       STOP MATCHING
       ============================================================ */

    Matching.stop =
        async function (
            timedOut
        ) {

            const wasAccepted =
                Matching.state.accepted;


            Matching.state.active =
                false;

            Matching.state.searching =
                false;


            Matching.clearTimers();


            /*
             * Do not overwrite an accepted ride.
             */

            if (
                Matching.state.rideId &&
                !wasAccepted
            ) {

                const finalStatus =
                    timedOut
                        ? "no_driver"
                        : "cancelled";


                const update = {

                    status:
                        finalStatus,

                    updatedAt:
                        Date.now()
                };


                const database =
                    Matching.getDatabase();


                if (database) {

                    try {

                        await database
                            .ref(
                                Matching.config
                                    .ridesCollection +
                                "/" +
                                Matching.state
                                    .rideId
                            )
                            .update(update);

                    } catch (error) {

                        console.warn(
                            "RTDB stop update failed:",
                            error
                        );
                    }
                }


                const firestore =
                    Matching.getFirestore();


                if (firestore) {

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
                                    merge: true
                                }
                            );

                    } catch (error) {

                        console.warn(
                            "Firestore stop update failed:",
                            error
                        );
                    }
                }


                await Matching
                    .cleanupRequests(
                        finalStatus
                    );


                await Matching
                    .updateGlobalRequest({

                        status:
                            finalStatus,

                        updatedAt:
                            Date.now()
                    });
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
                        Boolean(timedOut),

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


    /* ============================================================
       CANCEL MATCHING
       ============================================================ */

    Matching.cancel =
        async function () {

            if (
                Matching.state.accepted
            ) {

                return false;
            }


            return Matching.stop(false);
        };


    /* ============================================================
       GET STATE
       ============================================================ */

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


    /* ============================================================
       IS ACTIVE
       ============================================================ */

    Matching.isActive =
        function () {

            return (
                Matching.state.active ===
                true
            );
        };


    /* ============================================================
       EVENT SYSTEM
       ============================================================ */

    Matching.emit =
        function (
            name,
            data
        ) {

            try {

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

            } catch (error) {

                console.warn(
                    "RiderX matching event failed:",
                    error
                );
            }
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

                return function () {};
            }


            const eventName =
                "riderx-matching-" +
                name;


            const handler =
                function (event) {

                    callback(
                        event.detail || {},
                        event
                    );
                };


            window.addEventListener(
                eventName,
                handler
            );


            /*
             * Return unsubscribe function.
             */

            return function () {

                window.removeEventListener(
                    eventName,
                    handler
                );
            };
        };


    /* ============================================================
       INIT
       ============================================================ */

    Matching.init =
        function () {

            if (
                Matching.state.initialized
            ) {

                return;
            }


            Matching.state.initialized =
                true;


            Matching.emit(
                "ready"
            );


            console.log(
                "RiderX matching.js loaded."
            );
        };


    /* ============================================================
       GLOBAL API
       ============================================================ */

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


    RX.rejectRider =
        Matching.riderRejected;


    RX.expireRiderRequest =
        Matching.riderRequestExpired;


    /* ============================================================
       AUTO INIT
       ============================================================ */

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
