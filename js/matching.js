/* ============================================================
   RIDERX MATCHING ENGINE
   File: js/matching.js

   RIDERX 2.0 - FINAL MATCHING ENGINE

   Handles:
   - Nearby rider discovery
   - Rider availability
   - Distance based matching
   - Firestore ride creation
   - RTDB ride mirror
   - Rider request dispatch
   - Firestore rider request
   - RTDB rider request
   - Multiple rider matching
   - Matching timeout
   - Accepted ride locking
   - Ride status synchronization
   - Firestore fallback
   - RTDB fallback

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

    const Matching =
        RX.matching =
        RX.matching || {};


    /* ============================================================
       CONFIG
       ============================================================ */

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

        riderRequestsCollection:
            "riderRequests",

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


    /* ============================================================
       STATE
       ============================================================ */

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


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    Matching.now = function () {

        return Date.now();

    };


    Matching.getDatabase = function () {

        try {

            if (
                RX.firebase &&
                RX.firebase.database
            ) {

                if (
                    typeof RX.firebase.database ===
                    "function"
                ) {

                    return RX.firebase.database();
                }

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

            console.error(
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
                RX.firebase.firestore
            ) {

                if (
                    typeof RX.firebase.firestore ===
                    "function"
                ) {

                    return RX.firebase.firestore();
                }

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

            console.error(
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
                firebase.auth
            ) {

                const user =
                    firebase.auth().currentUser;

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
                localStorage.getItem(
                    "riderx_user"
                );


            if (saved) {

                return JSON.parse(saved);

            }

        } catch (error) {

            console.warn(
                "Saved RiderX user parse failed:",
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
            localStorage.getItem(
                "riderx_uid"
            ) ||
            null
        );

    };


    Matching.normalizeRole = function (role) {

        role =
            String(
                role || ""
            )
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


    /* ============================================================
       LOCATION
       ============================================================ */

    Matching.normalizeLocation = function (
        location
    ) {

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


        let timestamp =
            Number(
                location.timestamp ??
                location.updatedAt ??
                Date.now()
            );


        /*
         * Support Firestore Timestamp.
         */

        if (
            location.timestamp &&
            typeof location.timestamp.toMillis ===
            "function"
        ) {

            timestamp =
                location.timestamp.toMillis();
        }


        if (
            location.updatedAt &&
            typeof location.updatedAt.toMillis ===
            "function"
        ) {

            timestamp =
                location.updatedAt.toMillis();
        }


        return {

            lat:
                lat,

            lng:
                lng,

            accuracy:
                Number(
                    location.accuracy || 0
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
                timestamp
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


    /* ============================================================
       LOCATION FRESHNESS
       ============================================================ */

    Matching.isLocationFresh = function (
        location
    ) {

        location =
            Matching.normalizeLocation(
                location
            );


        if (!location) {

            return false;
        }


        const timestamp =
            Number(
                location.timestamp || 0
            );


        if (!timestamp) {

            return false;
        }


        /*
         * Protect against future timestamps.
         */

        if (
            timestamp >
            Matching.now() + 60000
        ) {

            return true;
        }


        return (
            Matching.now() -
            timestamp
        ) <=
        Matching.config.locationFreshness;

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
            rider.uid ||
            rider.id ||
            rider.userId;


        if (!riderId) {

            return false;
        }


        if (
            Matching.config.requireOnline
        ) {

            const online =
                rider.online === true ||
                rider.isOnline === true ||
                rider.status === "online" ||
                rider.availability ===
                "online";


            if (!online) {

                return false;
            }
        }


        if (
            Matching.config.requireAvailable
        ) {

            const available =
                rider.available !== false &&
                rider.isAvailable !== false &&
                rider.busy !== true &&
                rider.onRide !== true &&
                rider.currentRideId == null;


            if (!available) {

                return false;
            }
        }


        if (
            rider.approved === false ||
            rider.verified === false ||
            rider.status === "blocked" ||
            rider.status === "suspended"
        ) {

            return false;
        }


        const location =
            Matching.getRiderLocation(
                rider
            );


        if (!location) {

            return false;
        }


        /*
         * A rider record without timestamp should
         * not automatically be rejected when the
         * rider is currently online and location
         * exists. This prevents old project data
         * from breaking matching.
         */

        if (
            location.timestamp &&
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


        return Number.isFinite(
            distance
        );

    };


    /* ============================================================
       GET RIDER LOCATION
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
            rider
        );

    };


    /* ============================================================
       RTDB RIDERS
       ============================================================ */

    Matching.getRidersFromRTDB = async function () {

        const database =
            Matching.getDatabase();


        if (!database) {

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


            if (!data) {

                return [];
            }


            return Object.keys(
                data
            ).map(
                function (key) {

                    return {

                        id:
                            key,

                        uid:
                            data[key]?.uid ||
                            key,

                        ...data[key]

                    };

                }
            );

        } catch (error) {

            console.error(
                "RiderX RTDB rider search failed:",
                error
            );


            return [];
        }

    };


    /* ============================================================
       FIRESTORE RIDERS
       ============================================================ */

    Matching.getRidersFromFirestore = async function () {

        const firestore =
            Matching.getFirestore();


        if (!firestore) {

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
                function (doc) {

                    const data =
                        doc.data() || {};


                    return {

                        id:
                            doc.id,

                        uid:
                            data.uid ||
                            doc.id,

                        ...data

                    };

                }
            );

        } catch (error) {

            console.error(
                "RiderX Firestore rider search failed:",
                error
            );


            return [];
        }

    };


    /* ============================================================
       LOAD RIDERS
       ============================================================ */

    Matching.loadRiders = async function () {

        let firestoreRiders =
            [];


        let rtdbRiders =
            [];


        /*
         * Firestore first.
         */

        firestoreRiders =
            await Matching
                .getRidersFromFirestore();


        /*
         * RTDB as additional source.
         */

        rtdbRiders =
            await Matching
                .getRidersFromRTDB();


        /*
         * Merge both sources.
         */

        const map =
            new Map();


        firestoreRiders.forEach(
            function (rider) {

                const id =
                    rider.uid ||
                    rider.id;


                if (id) {

                    map.set(
                        String(id),
                        rider
                    );
                }

            }
        );


        rtdbRiders.forEach(
            function (rider) {

                const id =
                    rider.uid ||
                    rider.id;


                if (!id) {

                    return;
                }


                const key =
                    String(id);


                const existing =
                    map.get(key);


                if (existing) {

                    map.set(
                        key,
                        {
                            ...existing,
                            ...rider,

                            /*
                             * Prefer RTDB live location.
                             */

                            location:
                                rider.location ||
                                rider.liveLocation ||
                                rider.currentLocation ||
                                existing.location
                        }
                    );

                } else {

                    map.set(
                        key,
                        rider
                    );
                }

            }
        );


        return Array.from(
            map.values()
        );

    };


    /* ============================================================
       SORT RIDERS
       ============================================================ */

    Matching.sortByDistance = function (
        riders,
        customerLocation
    ) {

        return riders
            .map(
                function (rider) {

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

                }
            )
            .filter(
                function (rider) {

                    return Number.isFinite(
                        rider.distance
                    );

                }
            )
            .sort(
                function (a, b) {

                    return (
                        a.distance -
                        b.distance
                    );

                }
            );

    };


    /* ============================================================
       FIND NEARBY RIDERS
       ============================================================ */

    Matching.findNearbyRiders = async function (
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


        const radius =
            Math.min(
                Math.max(
                    Number(
                        options.radius ||
                        Matching.config
                            .defaultSearchRadius
                    ),
                    Matching.config
                        .minimumSearchRadius
                ),
                Matching.config
                    .maximumSearchRadius
            );


        const riders =
            await Matching.loadRiders();


        const eligible =
            riders.filter(
                function (rider) {

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

    Matching.expandSearch = function () {

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


        Matching.state.searchRadius =
            radius;


        return radius;

    };


    /* ============================================================
       IDS
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
       FIRESTORE RIDE CREATE
       ============================================================ */

    Matching.createRideInFirestore = async function (
        ride
    ) {

        const firestore =
            Matching.getFirestore();


        if (!firestore) {

            throw new Error(
                "Firestore is not available."
            );
        }


        try {

            await firestore
                .collection(
                    Matching.config
                        .ridesCollection
                )
                .doc(
                    ride.rideId
                )
                .set(
                    ride,
                    {
                        merge:
                            false
                    }
                );


            console.log(
                "RiderX ride created in Firestore:",
                ride.rideId
            );


            Matching.emit(
                "ride-created",
                {
                    ride:
                        ride,

                    source:
                        "firestore"
                }
            );


            return true;

        } catch (error) {

            console.error(
                "RiderX Firestore ride creation FAILED:",
                error
            );


            Matching.emit(
                "ride-create-error",
                {
                    ride:
                        ride,

                    error:
                        error
                }
            );


            return false;
        }

    };


    /* ============================================================
       RTDB RIDE MIRROR
       ============================================================ */

    Matching.createRideInRTDB = async function (
        ride
    ) {

        const database =
            Matching.getDatabase();


        if (!database) {

            return false;
        }


        try {

            await database
                .ref(
                    Matching.config
                        .ridesCollection +
                    "/" +
                    ride.rideId
                )
                .set(
                    ride
                );


            console.log(
                "RiderX ride mirrored to RTDB:",
                ride.rideId
            );


            return true;

        } catch (error) {

            console.warn(
                "RiderX RTDB ride mirror failed:",
                error
            );


            return false;
        }

    };


    /* ============================================================
       CREATE RIDE
       ============================================================ */

    Matching.createRide = async function (
        data
    ) {

        data =
            data || {};


        const rideId =
            data.rideId ||
            Matching.createRideId();


        const customerId =
            data.customerId ||
            Matching.getUserId();


        if (!customerId) {

            throw new Error(
                "Customer ID is required to create ride."
            );
        }


        const ride = {

            rideId:
                rideId,

            customerId:
                customerId,

            riderId:
                data.riderId ||
                null,

            service:
                data.service ||
                data.serviceType ||
                "bike",

            serviceType:
                data.serviceType ||
                data.service ||
                "bike",

            status:
                data.status ||
                "searching",

            pickup:
                data.pickup ||
                data.pickupAddress ||
                data.pickupName ||
                "",

            destination:
                data.destination ||
                data.destinationAddress ||
                data.destinationName ||
                "",

            pickupLocation:
                Matching.normalizeLocation(
                    data.pickupLocation ||
                    data.pickup
                ),

            destinationLocation:
                Matching.normalizeLocation(
                    data.destinationLocation ||
                    data.destination
                ),

            fare:
                Number(
                    data.fare ??
                    data.estimatedFare ??
                    0
                ),

            estimatedFare:
                Number(
                    data.estimatedFare ??
                    data.fare ??
                    0
                ),

            paymentMethod:
                data.paymentMethod ||
                "cash",

            customerName:
                data.customerName ||
                "",

            customerPhone:
                data.customerPhone ||
                "",

            createdAt:
                Date.now(),

            updatedAt:
                Date.now(),

            matchingStartedAt:
                Date.now()

        };


        /*
         * --------------------------------------------------------
         * IMPORTANT:
         * Firestore is PRIMARY.
         * --------------------------------------------------------
         */

        const firestoreCreated =
            await Matching
                .createRideInFirestore(
                    ride
                );


        /*
         * If Firestore is available but write fails,
         * do NOT pretend ride creation succeeded.
         */

        if (!firestoreCreated) {

            /*
             * RTDB fallback only when Firestore
             * cannot be used.
             */

            const rtdbCreated =
                await Matching
                    .createRideInRTDB(
                        ride
                    );


            if (!rtdbCreated) {

                throw new Error(
                    "Ride could not be created in Firestore or RTDB."
                );
            }

        } else {

            /*
             * Keep RTDB synchronized too.
             */

            await Matching
                .createRideInRTDB(
                    ride
                );
        }


        return ride;

    };


    /* ============================================================
       SAVE GLOBAL REQUEST
       ============================================================ */

    Matching.saveRideRequest = async function (
        request
    ) {

        const firestore =
            Matching.getFirestore();


        const database =
            Matching.getDatabase();


        let firestoreSaved =
            false;


        let rtdbSaved =
            false;


        /*
         * Firestore primary.
         */

        if (firestore) {

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
                        request,
                        {
                            merge:
                                true
                        }
                    );


                firestoreSaved =
                    true;

            } catch (error) {

                console.error(
                    "RiderX Firestore request save failed:",
                    error
                );
            }
        }


        /*
         * RTDB mirror.
         */

        if (database) {

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


                rtdbSaved =
                    true;

            } catch (error) {

                console.warn(
                    "RiderX RTDB request save failed:",
                    error
                );
            }
        }


        return (
            firestoreSaved ||
            rtdbSaved
        );

    };


    /* ============================================================
       BUILD RIDER REQUEST
       ============================================================ */

    Matching.buildRiderRequest = function (
        ride,
        rider
    ) {

        const riderId =
            rider.uid ||
            rider.id;


        const now =
            Date.now();


        return {

            requestId:
                Matching.state
                    .requestId,

            rideId:
                ride.rideId,

            customerId:
                ride.customerId,

            riderId:
                riderId,

            service:
                ride.service,

            serviceType:
                ride.serviceType ||
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

            estimatedFare:
                ride.estimatedFare,

            paymentMethod:
                ride.paymentMethod,

            riderDistance:
                Number(
                    rider.distance || 0
                ),

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

    Matching.sendRequestToRider = async function (
        ride,
        rider
    ) {

        const riderId =
            rider.uid ||
            rider.id;


        if (!riderId) {

            return false;
        }


        const request =
            Matching.buildRiderRequest(
                ride,
                rider
            );


        const firestore =
            Matching.getFirestore();


        const database =
            Matching.getDatabase();


        let firestoreSent =
            false;


        let rtdbSent =
            false;


        /*
         * --------------------------------------------------------
         * FIRESTORE RIDER INBOX
         *
         * riderRequests/{riderId}/requests/{requestId}
         * --------------------------------------------------------
         */

        if (firestore) {

            try {

                await firestore
                    .collection(
                        Matching.config
                            .riderRequestsCollection
                    )
                    .doc(
                        String(riderId)
                    )
                    .collection(
                        "requests"
                    )
                    .doc(
                        request.requestId
                    )
                    .set(
                        request,
                        {
                            merge:
                                true
                        }
                    );


                firestoreSent =
                    true;


                /*
                 * Also write global request rider record.
                 */

                await firestore
                    .collection(
                        Matching.config
                            .requestsCollection
                    )
                    .doc(
                        request.requestId
                    )
                    .collection(
                        "riders"
                    )
                    .doc(
                        String(riderId)
                    )
                    .set(
                        request,
                        {
                            merge:
                                true
                        }
                    );

            } catch (error) {

                console.error(
                    "RiderX Firestore rider request FAILED:",
                    error
                );
            }
        }


        /*
         * --------------------------------------------------------
         * RTDB RIDER INBOX
         *
         * riderRequests/{riderId}/{requestId}
         * --------------------------------------------------------
         */

        if (database) {

            try {

                await database
                    .ref(
                        Matching.config
                            .riderRequestsCollection +
                        "/" +
                        riderId +
                        "/" +
                        request.requestId
                    )
                    .set(
                        request
                    );


                /*
                 * Also global request path.
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


                rtdbSent =
                    true;

            } catch (error) {

                console.error(
                    "RiderX RTDB rider request FAILED:",
                    error
                );
            }
        }


        const sent =
            firestoreSent ||
            rtdbSent;


        if (sent) {

            if (
                !Matching.state
                    .requestedRiders
                    .includes(
                        String(riderId)
                    )
            ) {

                Matching.state
                    .requestedRiders
                    .push(
                        String(riderId)
                    );
            }


            Matching.emit(
                "request-sent",
                {

                    ride:
                        ride,

                    rider:
                        rider,

                    request:
                        request,

                    firestore:
                        firestoreSent,

                    rtdb:
                        rtdbSent

                }
            );


            console.log(
                "RiderX request sent to rider:",
                riderId,
                request.requestId
            );

        }


        return sent;

    };


    /* ============================================================
       SEND BATCH
       ============================================================ */

    Matching.sendBatch = async function (
        ride,
        riders
    ) {

        if (
            !Array.isArray(riders) ||
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

            if (
                Matching.state.accepted
            ) {

                break;
            }


            const riderId =
                String(
                    rider.uid ||
                    rider.id ||
                    ""
                );


            if (!riderId) {

                continue;
            }


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


            if (sent) {

                count++;
            }

        }


        return count;

    };


    /* ============================================================
       UPDATE GLOBAL REQUEST
       ============================================================ */

    Matching.updateGlobalRequest = async function (
        update
    ) {

        const requestId =
            Matching.state.requestId;


        if (!requestId) {

            return false;
        }


        const firestore =
            Matching.getFirestore();


        const database =
            Matching.getDatabase();


        let done =
            false;


        if (firestore) {

            try {

                await firestore
                    .collection(
                        Matching.config
                            .requestsCollection
                    )
                    .doc(
                        requestId
                    )
                    .set(
                        update,
                        {
                            merge:
                                true
                        }
                    );


                done =
                    true;

            } catch (error) {

                console.warn(
                    "Global Firestore request update failed:",
                    error
                );
            }
        }


        if (database) {

            try {

                await database
                    .ref(
                        Matching.config
                            .requestsCollection +
                        "/" +
                        requestId
                    )
                    .update(
                        update
                    );


                done =
                    true;

            } catch (error) {

                console.warn(
                    "Global RTDB request update failed:",
                    error
                );
            }
        }


        return done;

    };


    /* ============================================================
       START MATCHING
       ============================================================ */

    Matching.start = async function (
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
                data.customerLocation ||
                data.pickup
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


        /*
         * Create ride FIRST.
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

                serviceType:
                    data.serviceType ||
                    data.service ||
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
                    data.destinationLocation ||
                    data.destination,

                fare:
                    data.fare ??
                    data.estimatedFare ??
                    0,

                estimatedFare:
                    data.estimatedFare ??
                    data.fare ??
                    0,

                paymentMethod:
                    data.paymentMethod ||
                    "cash",

                customerName:
                    data.customerName ||
                    "",

                customerPhone:
                    data.customerPhone ||
                    ""
            });


        const requestId =
            data.requestId ||
            Matching.createRequestId();


        /*
         * Set state only AFTER ride creation.
         */

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


        /*
         * Save global matching request.
         */

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

            serviceType:
                ride.serviceType,

            fare:
                ride.fare,

            estimatedFare:
                ride.estimatedFare,

            paymentMethod:
                ride.paymentMethod,

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
         * Global timeout.
         */

        Matching.state.timeoutId =
            setTimeout(
                function () {

                    if (
                        Matching.state.active &&
                        !Matching.state.accepted
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

        await Matching
            .searchAndDispatch(
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


    /* ============================================================
       SEARCH + DISPATCH
       ============================================================ */

    Matching.searchAndDispatch = async function (
        ride
    ) {

        if (
            !Matching.state.active ||
            Matching.state.accepted
        ) {

            return [];
        }


        try {

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
                            String(
                                rider.uid ||
                                rider.id ||
                                ""
                            );


                        return (
                            riderId &&
                            !Matching.state
                                .requestedRiders
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

                    ride:
                        ride,

                    riders:
                        riders,

                    radius:
                        Matching.state
                            .searchRadius

                }
            );


            if (!available.length) {

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
             * Search again after request timeout.
             */

            Matching.state
                .retryTimeoutId =
                setTimeout(
                    async function () {

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
                    Matching.config
                        .retryDelay
                );


            return batch;

        } catch (error) {

            console.error(
                "RiderX matching search failed:",
                error
            );


            Matching.emit(
                "matching-error",
                {
                    ride:
                        ride,

                    error:
                        error
                }
            );


            return [];
        }

    };


    /* ============================================================
       ACCEPT RIDE
       ============================================================ */

    Matching.riderAccepted = async function (
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
         * If already accepted by another rider,
         * reject this acceptance.
         */

        if (
            Matching.state.accepted &&
            Matching.state.matchedRiderId !==
            riderId
        ) {

            return false;
        }


        /*
         * Lock locally immediately.
         */

        Matching.state.accepted =
            true;


        Matching.state.active =
            false;


        Matching.state.matchedRiderId =
            riderId;


        Matching.clearTimers();


        /*
         * Update Firestore + RTDB.
         */

        const updated =
            await Matching
                .updateRideAfterAccept(
                    rideId,
                    riderId
                );


        if (!updated) {

            /*
             * Do not leave UI thinking ride
             * was accepted if database update failed.
             */

            Matching.state.accepted =
                false;


            Matching.state.active =
                true;


            Matching.state.matchedRiderId =
                null;


            return false;
        }


        /*
         * Cancel all other requests.
         */

        await Matching
            .cancelOtherRequests(
                riderId
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

    };


    /* ============================================================
       UPDATE RIDE AFTER ACCEPT
       ============================================================ */

    Matching.updateRideAfterAccept = async function (
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


        const firestore =
            Matching.getFirestore();


        const database =
            Matching.getDatabase();


        let firestoreUpdated =
            false;


        let rtdbUpdated =
            false;


        /*
         * Firestore primary.
         */

        if (firestore) {

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


                firestoreUpdated =
                    true;

            } catch (error) {

                console.error(
                    "RiderX Firestore ride accept update FAILED:",
                    error
                );
            }
        }


        /*
         * RTDB mirror.
         */

        if (database) {

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


                rtdbUpdated =
                    true;

            } catch (error) {

                console.warn(
                    "RiderX RTDB ride accept update failed:",
                    error
                );
            }
        }


        return (
            firestoreUpdated ||
            rtdbUpdated
        );

    };


    /* ============================================================
       CANCEL OTHER RIDER REQUESTS
       ============================================================ */

    Matching.cancelOtherRequests = async function (
        acceptedRiderId
    ) {

        const requestId =
            Matching.state.requestId;


        if (!requestId) {

            return;
        }


        const firestore =
            Matching.getFirestore();


        const database =
            Matching.getDatabase();


        /*
         * Firestore:
         * Read global rider request documents
         * and mark other riders cancelled.
         */

        if (firestore) {

            try {

                const snapshot =
                    await firestore
                        .collection(
                            Matching.config
                                .requestsCollection
                        )
                        .doc(
                            requestId
                        )
                        .collection(
                            "riders"
                        )
                        .get();


                const batch =
                    firestore.batch();


                snapshot.docs.forEach(
                    function (doc) {

                        if (
                            doc.id ===
                            String(
                                acceptedRiderId
                            )
                        ) {

                            return;
                        }


                        batch.set(
                            doc.ref,
                            {

                                status:
                                    "cancelled",

                                cancelledAt:
                                    Date.now(),

                                updatedAt:
                                    Date.now()

                            },
                            {
                                merge:
                                    true
                            }
                        );


                        const inboxRef =
                            firestore
                                .collection(
                                    Matching.config
                                        .riderRequestsCollection
                                )
                                .doc(
                                    doc.id
                                )
                                .collection(
                                    "requests"
                                )
                                .doc(
                                    requestId
                                );


                        batch.set(
                            inboxRef,
                            {

                                status:
                                    "cancelled",

                                cancelledAt:
                                    Date.now(),

                                updatedAt:
                                    Date.now()

                            },
                            {
                                merge:
                                    true
                            }
                        );

                    }
                );


                await batch.commit();

            } catch (error) {

                console.warn(
                    "Firestore cancel-other-requests failed:",
                    error
                );
            }
        }


        /*
         * RTDB:
         * Directly update known requested riders.
         */

        if (database) {

            try {

                const updates =
                    {};


                Matching.state
                    .requestedRiders
                    .forEach(
                        function (riderId) {

                            if (
                                String(riderId) ===
                                String(
                                    acceptedRiderId
                                )
                            ) {

                                return;
                            }


                            updates[
                                Matching.config
                                    .riderRequestsCollection +
                                "/" +
                                riderId +
                                "/" +
                                requestId +
                                "/status"
                            ] =
                                "cancelled";


                            updates[
                                Matching.config
                                    .riderRequestsCollection +
                                "/" +
                                riderId +
                                "/" +
                                requestId +
                                "/cancelledAt"
                            ] =
                                Date.now();


                            updates[
                                Matching.config
                                    .requestsCollection +
                                "/" +
                                requestId +
                                "/riders/" +
                                riderId +
                                "/status"
                            ] =
                                "cancelled";

                        }
                    );


                if (
                    Object.keys(
                        updates
                    ).length
                ) {

                    await database
                        .ref()
                        .update(
                            updates
                        );
                }

            } catch (error) {

                console.warn(
                    "RTDB cancel-other-requests failed:",
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


    /* ============================================================
       RIDER REJECTED
       ============================================================ */

    Matching.riderRejected = function (
        riderId
    ) {

        if (!riderId) {

            return;
        }


        riderId =
            String(
                riderId
            );


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


    /* ============================================================
       REQUEST EXPIRED
       ============================================================ */

    Matching.riderRequestExpired = function (
        riderId
    ) {

        if (!riderId) {

            return;
        }


        riderId =
            String(
                riderId
            );


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


    /* ============================================================
       CLEAR TIMERS
       ============================================================ */

    Matching.clearTimers = function () {

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


            Matching.state
                .timeoutId =
                null;
        }

    };


    /* ============================================================
       STOP MATCHING
       ============================================================ */

    Matching.stop = async function (
        timedOut
    ) {

        Matching.state.active =
            false;


        Matching.clearTimers();


        const rideId =
            Matching.state.rideId;


        const accepted =
            Matching.state.accepted;


        if (
            rideId &&
            !accepted
        ) {

            const update = {

                status:
                    timedOut
                        ? "no_driver"
                        : "cancelled",

                updatedAt:
                    Date.now(),

                matchingEndedAt:
                    Date.now()

            };


            const firestore =
                Matching.getFirestore();


            const database =
                Matching.getDatabase();


            if (firestore) {

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

                } catch (error) {

                    console.warn(
                        "Firestore stop ride update failed:",
                        error
                    );
                }
            }


            if (database) {

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

                } catch (error) {

                    console.warn(
                        "RTDB stop ride update failed:",
                        error
                    );
                }
            }


            await Matching
                .updateGlobalRequest({

                    status:
                        timedOut
                            ? "no_driver"
                            : "cancelled",

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


    /* ============================================================
       CANCEL
       ============================================================ */

    Matching.cancel = async function () {

        Matching.state.accepted =
            false;


        return Matching.stop(
            false
        );

    };


    /* ============================================================
       GET STATE
       ============================================================ */

    Matching.getState = function () {

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

    Matching.isActive = function () {

        return (
            Matching.state.active ===
            true
        );

    };


    /* ============================================================
       EVENT SYSTEM
       ============================================================ */

    Matching.emit = function (
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


    Matching.on = function (
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
            function (event) {

                callback(
                    event.detail || {},
                    event
                );

            }
        );

    };


    /* ============================================================
       INIT
       ============================================================ */

    Matching.init = function () {

        if (
            Matching.state
                .initialized
        ) {

            return;
        }


        Matching.state
            .initialized =
            true;


        console.log(
            "RiderX matching.js loaded."
        );


        Matching.emit(
            "ready"
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

    RX.matching =
        Matching;


    /* ============================================================
       INIT
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
