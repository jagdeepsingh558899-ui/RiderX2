/* ============================================================
   RIDERX LIVE TRACKING ENGINE
   File: js/tracking.js

   Handles:
   - Rider live GPS
   - Customer live tracking
   - Ride status
   - ETA
   - Distance remaining
   - Rider online/offline
   - Firebase realtime listeners
   - Map integration events
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Tracking =
        RX.tracking =
        RX.tracking || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Tracking.config = {

        ridesPath:
            "rides",

        riderLocationsPath:
            "riderLocations",

        customerLocationsPath:
            "customerLocations",

        trackingPath:
            "tracking",

        locationInterval:
            3000,

        staleAfter:
            30000,

        maxAccuracy:
            100,

        maxSpeed:
            160,

        maxPoints:
            500
    };


    /* ========================================================
       STATE
       ======================================================== */

    Tracking.state = {

        initialized:
            false,

        active:
            false,

        rideId:
            null,

        riderId:
            null,

        customerId:
            null,

        role:
            null,

        status:
            "idle",

        riderLocation:
            null,

        customerLocation:
            null,

        destination:
            null,

        pickup:
            null,

        route:
            [],

        distanceRemaining:
            null,

        etaMinutes:
            null,

        riderSpeed:
            0,

        riderHeading:
            null,

        riderOnline:
            false,

        lastUpdate:
            0,

        watchId:
            null,

        listeners:
            [],

        firebaseUnsubscribers:
            []
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Tracking.getDatabase =
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
                    "RiderX tracking Firebase error:",
                    error
                );

            }


            return null;
        };


    Tracking.getAuth =
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


    Tracking.getUser =
        function () {

            const auth =
                Tracking.getAuth();


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


    Tracking.getUserId =
        function () {

            const user =
                Tracking.getUser();


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
       LOCATION NORMALIZATION
       ======================================================== */

    Tracking.normalizeLocation =
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
                    location.lon ??
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

                speed:
                    Number(
                        location.speed ||
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

                timestamp:
                    Number(
                        location.timestamp ||
                        Date.now()
                    )
            };
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    Tracking.distance =
        function (
            a,
            b
        ) {

            a =
                Tracking.normalizeLocation(
                    a
                );


            b =
                Tracking.normalizeLocation(
                    b
                );


            if (
                !a ||
                !b
            ) {

                return null;

            }


            const R =
                6371;


            const dLat =
                (
                    b.lat -
                    a.lat
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    b.lng -
                    a.lng
                ) *
                Math.PI /
                180;


            const lat1 =
                a.lat *
                Math.PI /
                180;


            const lat2 =
                b.lat *
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
                    lat1
                ) *
                Math.cos(
                    lat2
                ) *
                Math.sin(
                    dLng / 2
                ) *
                Math.sin(
                    dLng / 2
                );


            const y =
                2 *
                Math.atan2(
                    Math.sqrt(x),
                    Math.sqrt(
                        1 - x
                    )
                );


            return R * y;
        };


    /* ========================================================
       ETA
       ======================================================== */

    Tracking.calculateETA =
        function (
            distanceKm,
            speedKmh
        ) {

            distanceKm =
                Number(
                    distanceKm || 0
                );


            speedKmh =
                Number(
                    speedKmh || 0
                );


            if (
                distanceKm <= 0
            ) {

                return 0;

            }


            /*
             * Use a safe city-driving
             * fallback when GPS speed
             * is unavailable.
             */

            if (
                speedKmh < 5
            ) {

                speedKmh =
                    25;

            }


            const minutes =
                (
                    distanceKm /
                    speedKmh
                ) *
                60;


            return Math.max(
                1,
                Math.ceil(
                    minutes
                )
            );
        };


    /* ========================================================
       SET RIDE
       ======================================================== */

    Tracking.setRide =
        function (
            rideId,
            options
        ) {

            options =
                options || {};


            Tracking.state.rideId =
                rideId ||
                options.rideId ||
                null;


            Tracking.state.riderId =
                options.riderId ||
                Tracking.state.riderId ||
                null;


            Tracking.state.customerId =
                options.customerId ||
                Tracking.state.customerId ||
                null;


            Tracking.state.role =
                options.role ||
                Tracking.state.role ||
                null;


            Tracking.state.status =
                options.status ||
                Tracking.state.status ||
                "searching";


            Tracking.state.pickup =
                Tracking.normalizeLocation(
                    options.pickup
                );


            Tracking.state.destination =
                Tracking.normalizeLocation(
                    options.destination
                );


            Tracking.emit(
                "ride-set",
                {
                    rideId:
                        Tracking.state.rideId,

                    riderId:
                        Tracking.state.riderId,

                    customerId:
                        Tracking.state.customerId
                }
            );


            return Tracking.state.rideId;
        };


    /* ========================================================
       READ RIDE
       ======================================================== */

    Tracking.getRide =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                Tracking.state.rideId;


            if (
                !rideId
            ) {

                return null;

            }


            const database =
                Tracking.getDatabase();


            if (
                !database
            ) {

                return null;

            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Tracking.config
                                .ridesPath +
                            "/" +
                            rideId
                        )
                        .once(
                            "value"
                        );


                return snapshot.val();

            } catch (error) {

                console.warn(
                    "Unable to read ride:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       START TRACKING
       ======================================================== */

    Tracking.start =
        async function (
            rideId,
            options
        ) {

            options =
                options || {};


            if (
                rideId ||
                options.rideId
            ) {

                Tracking.setRide(
                    rideId ||
                    options.rideId,
                    options
                );

            }


            if (
                !Tracking.state.rideId
            ) {

                throw new Error(
                    "Ride ID is required."
                );

            }


            Tracking.stopFirebaseListeners();


            Tracking.state.active =
                true;


            Tracking.emit(
                "started",
                {
                    rideId:
                        Tracking.state.rideId
                }
            );


            await Tracking
                .loadInitialRide();


            Tracking.listenRide();


            if (
                options.role ===
                "rider"
            ) {

                Tracking.startGPS();

            }


            return true;
        };


    /* ========================================================
       LOAD INITIAL RIDE
       ======================================================== */

    Tracking.loadInitialRide =
        async function () {

            const ride =
                await Tracking.getRide();


            if (
                !ride
            ) {

                return null;
            }


            Tracking.updateRideState(
                ride
            );


            return ride;
        };


    /* ========================================================
       LISTEN RIDE
       ======================================================== */

    Tracking.listenRide =
        function () {

            const database =
                Tracking.getDatabase();


            if (
                !database ||
                !Tracking.state.rideId
            ) {

                return false;
            }


            const path =
                Tracking.config
                    .ridesPath +
                "/" +
                Tracking.state.rideId;


            const ref =
                database.ref(
                    path
                );


            const callback =
                function (
                    snapshot
                ) {

                    const ride =
                        snapshot.val();


                    if (
                        ride
                    ) {

                        Tracking.updateRideState(
                            ride
                        );

                    }

                };


            ref.on(
                "value",
                callback
            );


            Tracking.state
                .firebaseUnsubscribers
                .push(
                    function () {

                        ref.off(
                            "value",
                            callback
                        );

                    }
                );


            return true;
        };


    /* ========================================================
       UPDATE RIDE STATE
       ======================================================== */

    Tracking.updateRideState =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return;
            }


            Tracking.state.status =
                ride.status ||
                ride.rideStatus ||
                Tracking.state.status;


            Tracking.state.riderId =
                ride.riderId ||
                ride.driverId ||
                Tracking.state.riderId;


            Tracking.state.customerId =
                ride.customerId ||
                ride.userId ||
                Tracking.state.customerId;


            Tracking.state.pickup =
                Tracking.normalizeLocation(
                    ride.pickup ||
                    ride.pickupLocation
                ) ||
                Tracking.state.pickup;


            Tracking.state.destination =
                Tracking.normalizeLocation(
                    ride.destination ||
                    ride.dropoff ||
                    ride.dropoffLocation
                ) ||
                Tracking.state.destination;


            if (
                ride.riderLocation ||
                ride.driverLocation
            ) {

                Tracking.updateRiderLocation(
                    ride.riderLocation ||
                    ride.driverLocation,
                    false
                );

            }


            if (
                ride.customerLocation
            ) {

                Tracking.state.customerLocation =
                    Tracking.normalizeLocation(
                        ride.customerLocation
                    );

            }


            if (
                ride.distanceRemaining != null
            ) {

                Tracking.state
                    .distanceRemaining =
                    Number(
                        ride.distanceRemaining
                    );

            }


            if (
                ride.etaMinutes != null
            ) {

                Tracking.state
                    .etaMinutes =
                    Number(
                        ride.etaMinutes
                    );

            }


            Tracking.emit(
                "ride-updated",
                {
                    ride:
                        ride,

                    state:
                        {
                            ...Tracking.state
                        }
                }
            );


            Tracking.updateUI();
        };


    /* ========================================================
       START RIDER GPS
       ======================================================== */

    Tracking.startGPS =
        function () {

            if (
                !navigator.geolocation
            ) {

                Tracking.emit(
                    "gps-error",
                    {
                        message:
                            "Location is not supported on this device."
                    }
                );


                return false;
            }


            if (
                Tracking.state.watchId !==
                null
            ) {

                navigator
                    .geolocation
                    .clearWatch(
                        Tracking.state.watchId
                    );

            }


            Tracking.state.watchId =
                navigator
                    .geolocation
                    .watchPosition(

                        function (
                            position
                        ) {

                            Tracking
                                .handleGPSPosition(
                                    position
                                );

                        },

                        function (
                            error
                        ) {

                            Tracking.emit(
                                "gps-error",
                                {
                                    code:
                                        error.code,

                                    message:
                                        error.message
                                }
                            );

                        },

                        {

                            enableHighAccuracy:
                                true,

                            maximumAge:
                                3000,

                            timeout:
                                15000
                        }
                    );


            return true;
        };


    /* ========================================================
       GPS POSITION
       ======================================================== */

    Tracking.handleGPSPosition =
        async function (
            position
        ) {

            if (
                !position?.coords
            ) {

                return;
            }


            const coords =
                position.coords;


            const accuracy =
                Number(
                    coords.accuracy ||
                    0
                );


            if (
                accuracy >
                Tracking.config
                    .maxAccuracy
            ) {

                Tracking.emit(
                    "gps-low-accuracy",
                    {
                        accuracy:
                            accuracy
                    }
                );

            }


            let speedKmh =
                Number(
                    coords.speed || 0
                ) *
                3.6;


            if (
                !Number.isFinite(
                    speedKmh
                )
            ) {

                speedKmh =
                    0;
            }


            speedKmh =
                Math.min(
                    speedKmh,
                    Tracking.config
                        .maxSpeed
                );


            const location = {

                lat:
                    coords.latitude,

                lng:
                    coords.longitude,

                accuracy:
                    accuracy,

                speed:
                    speedKmh,

                heading:
                    Number.isFinite(
                        Number(
                            coords.heading
                        )
                    )
                        ? Number(
                            coords.heading
                        )
                        : null,

                timestamp:
                    Date.now()
            };


            Tracking.updateRiderLocation(
                location,
                true
            );


            await Tracking
                .publishRiderLocation(
                    location
                );


            Tracking.calculateRideETA(
                location
            );
        };


    /* ========================================================
       UPDATE RIDER LOCATION
       ======================================================== */

    Tracking.updateRiderLocation =
        function (
            location,
            emit
        ) {

            const normalized =
                Tracking.normalizeLocation(
                    location
                );


            if (
                !normalized
            ) {

                return null;
            }


            Tracking.state.riderLocation =
                normalized;


            Tracking.state.riderSpeed =
                normalized.speed || 0;


            Tracking.state.riderHeading =
                normalized.heading;


            Tracking.state.lastUpdate =
                Date.now();


            Tracking.state.riderOnline =
                true;


            if (
                emit !== false
            ) {

                Tracking.emit(
                    "rider-location",
                    {
                        location:
                            normalized,

                        rideId:
                            Tracking.state
                                .rideId
                    }
                );


                Tracking.updateUI();
            }


            return normalized;
        };


    /* ========================================================
       PUBLISH RIDER LOCATION
       ======================================================== */

    Tracking.publishRiderLocation =
        async function (
            location
        ) {

            const database =
                Tracking.getDatabase();


            if (
                !database ||
                !Tracking.state.rideId
            ) {

                return false;
            }


            const riderId =
                Tracking.state.riderId ||
                Tracking.getUserId();


            if (
                !riderId
            ) {

                return false;
            }


            const data = {

                ...location,

                riderId:
                    riderId,

                rideId:
                    Tracking.state.rideId,

                online:
                    true,

                updatedAt:
                    Date.now()
            };


            try {

                /*
                 * Rider-specific location.
                 */

                await database
                    .ref(
                        Tracking.config
                            .riderLocationsPath +
                        "/" +
                        riderId
                    )
                    .set(
                        data
                    );


                /*
                 * Ride-specific location.
                 */

                await database
                    .ref(
                        Tracking.config
                            .ridesPath +
                        "/" +
                        Tracking.state
                            .rideId +
                        "/riderLocation"
                    )
                    .set(
                        data
                    );


                /*
                 * Tracking node.
                 */

                await database
                    .ref(
                        Tracking.config
                            .trackingPath +
                        "/" +
                        Tracking.state
                            .rideId +
                        "/rider"
                    )
                    .set(
                        data
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Unable to publish rider location:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       LISTEN RIDER LOCATION
       ======================================================== */

    Tracking.listenRiderLocation =
        function (
            riderId
        ) {

            const database =
                Tracking.getDatabase();


            riderId =
                riderId ||
                Tracking.state.riderId;


            if (
                !database ||
                !riderId
            ) {

                return false;
            }


            Tracking.stopRiderLocationListener();


            const ref =
                database.ref(
                    Tracking.config
                        .riderLocationsPath +
                    "/" +
                    riderId
                );


            const callback =
                function (
                    snapshot
                ) {

                    const location =
                        snapshot.val();


                    if (
                        location
                    ) {

                        Tracking
                            .updateRiderLocation(
                                location,
                                true
                            );

                        Tracking
                            .calculateRideETA(
                                location
                            );

                    }

                };


            ref.on(
                "value",
                callback
            );


            Tracking.state
                .firebaseUnsubscribers
                .push(
                    function () {

                        ref.off(
                            "value",
                            callback
                        );

                    }
                );


            return true;
        };


    /* ========================================================
       STOP RIDER LOCATION LISTENER
       ======================================================== */

    Tracking.stopRiderLocationListener =
        function () {

            /*
             * General cleanup is handled
             * by stopFirebaseListeners().
             */

            return true;
        };


    /* ========================================================
       CUSTOMER LOCATION
       ======================================================== */

    Tracking.updateCustomerLocation =
        async function (
            location
        ) {

            const normalized =
                Tracking.normalizeLocation(
                    location
                );


            if (
                !normalized
            ) {

                return false;
            }


            Tracking.state.customerLocation =
                normalized;


            Tracking.emit(
                "customer-location",
                {
                    location:
                        normalized
                }
            );


            const database =
                Tracking.getDatabase();


            if (
                !database ||
                !Tracking.state.rideId
            ) {

                return false;
            }


            const customerId =
                Tracking.state.customerId ||
                Tracking.getUserId();


            if (
                !customerId
            ) {

                return false;
            }


            try {

                await database
                    .ref(
                        Tracking.config
                            .customerLocationsPath +
                        "/" +
                        customerId
                    )
                    .set(
                        {

                            ...normalized,

                            customerId:
                                customerId,

                            rideId:
                                Tracking.state
                                    .rideId,

                            updatedAt:
                                Date.now()
                        }
                    );


                await database
                    .ref(
                        Tracking.config
                            .ridesPath +
                        "/" +
                        Tracking.state
                            .rideId +
                        "/customerLocation"
                    )
                    .set(
                        normalized
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Unable to publish customer location:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       LISTEN CUSTOMER LOCATION
       ======================================================== */

    Tracking.listenCustomerLocation =
        function (
            customerId
        ) {

            const database =
                Tracking.getDatabase();


            customerId =
                customerId ||
                Tracking.state.customerId;


            if (
                !database ||
                !customerId
            ) {

                return false;
            }


            const ref =
                database.ref(
                    Tracking.config
                        .customerLocationsPath +
                    "/" +
                    customerId
                );


            const callback =
                function (
                    snapshot
                ) {

                    const location =
                        snapshot.val();


                    if (
                        location
                    ) {

                        Tracking.state
                            .customerLocation =
                            Tracking
                                .normalizeLocation(
                                    location
                                );


                        Tracking.emit(
                            "customer-location",
                            {
                                location:
                                    Tracking.state
                                        .customerLocation
                            }
                        );

                    }

                };


            ref.on(
                "value",
                callback
            );


            Tracking.state
                .firebaseUnsubscribers
                .push(
                    function () {

                        ref.off(
                            "value",
                            callback
                        );

                    }
                );


            return true;
        };


    /* ========================================================
       CALCULATE RIDE ETA
       ======================================================== */

    Tracking.calculateRideETA =
        function (
            riderLocation
        ) {

            riderLocation =
                Tracking.normalizeLocation(
                    riderLocation
                );


            if (
                !riderLocation
            ) {

                return null;
            }


            /*
             * If route distance is available,
             * prefer it.
             */

            let distanceKm =
                Tracking.state
                    .distanceRemaining;


            /*
             * Otherwise calculate direct
             * distance to destination.
             */

            if (
                distanceKm == null &&
                Tracking.state.destination
            ) {

                distanceKm =
                    Tracking.distance(
                        riderLocation,
                        Tracking.state
                            .destination
                    );

            }


            if (
                distanceKm == null
            ) {

                return null;
            }


            const eta =
                Tracking.calculateETA(
                    distanceKm,
                    riderLocation.speed
                );


            Tracking.state
                .distanceRemaining =
                Number(
                    distanceKm
                );


            Tracking.state
                .etaMinutes =
                eta;


            Tracking.emit(
                "eta-updated",
                {

                    distanceKm:
                        Number(
                            distanceKm
                        ),

                    etaMinutes:
                        eta
                }
            );


            Tracking.updateUI();


            return {

                distanceKm:
                    distanceKm,

                etaMinutes:
                    eta
            };
        };


    /* ========================================================
       SET ROUTE
       ======================================================== */

    Tracking.setRoute =
        function (
            route
        ) {

            if (
                !Array.isArray(
                    route
                )
            ) {

                Tracking.state.route =
                    [];

                return [];
            }


            Tracking.state.route =
                route.slice(
                    0,
                    Tracking.config
                        .maxPoints
                );


            Tracking.emit(
                "route-updated",
                {

                    route:
                        Tracking.state.route
                }
            );


            return Tracking.state.route;
        };


    /* ========================================================
       DISTANCE TO DESTINATION
       ======================================================== */

    Tracking.getDistanceToDestination =
        function (
            location
        ) {

            location =
                Tracking.normalizeLocation(
                    location ||
                    Tracking.state
                        .riderLocation
                );


            const destination =
                Tracking.state
                    .destination;


            if (
                !location ||
                !destination
            ) {

                return null;
            }


            return Tracking.distance(
                location,
                destination
            );
        };


    /* ========================================================
       ONLINE STATUS
       ======================================================== */

    Tracking.setOnline =
        async function (
            online
        ) {

            const database =
                Tracking.getDatabase();


            const riderId =
                Tracking.state.riderId ||
                Tracking.getUserId();


            if (
                !database ||
                !riderId
            ) {

                return false;
            }


            try {

                await database
                    .ref(
                        Tracking.config
                            .riderLocationsPath +
                        "/" +
                        riderId +
                        "/online"
                    )
                    .set(
                        Boolean(
                            online
                        )
                    );


                Tracking.state.riderOnline =
                    Boolean(
                        online
                    );


                Tracking.emit(
                    "online-changed",
                    {

                        online:
                            Boolean(
                                online
                            )
                    }
                );


                return true;

            } catch (error) {

                return false;
            }
        };


    /* ========================================================
       CHECK STALE LOCATION
       ======================================================== */

    Tracking.checkStale =
        function () {

            if (
                !Tracking.state
                    .riderLocation
            ) {

                return false;
            }


            const age =
                Date.now() -
                Number(
                    Tracking.state
                        .riderLocation
                        .timestamp ||
                    0
                );


            const online =
                age <=
                Tracking.config
                    .staleAfter;


            if (
                Tracking.state
                    .riderOnline !==
                online
            ) {

                Tracking.state
                    .riderOnline =
                    online;


                Tracking.emit(
                    "online-changed",
                    {

                        online:
                            online,

                        stale:
                            !online
                    }
                );

            }


            return online;
        };


    /* ========================================================
       UPDATE UI
       ======================================================== */

    Tracking.updateUI =
        function () {

            const state =
                Tracking.state;


            /*
             * Status.
             */

            document
                .querySelectorAll(
                    "[data-ride-status], #rideStatus"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            state.status ||
                            "Searching";

                    }
                );


            /*
             * ETA.
             */

            document
                .querySelectorAll(
                    "[data-eta], #rideEta"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            state.etaMinutes !=
                            null
                        ) {

                            element.textContent =
                                state.etaMinutes +
                                " min";

                        }

                    }
                );


            /*
             * Distance.
             */

            document
                .querySelectorAll(
                    "[data-distance-remaining], #distanceRemaining"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            state
                                .distanceRemaining !=
                            null
                        ) {

                            element.textContent =
                                Number(
                                    state
                                        .distanceRemaining
                                ).toFixed(
                                    1
                                ) +
                                " km";

                        }

                    }
                );


            /*
             * Rider speed.
             */

            document
                .querySelectorAll(
                    "[data-rider-speed], #riderSpeed"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Math.round(
                                state.riderSpeed ||
                                0
                            ) +
                            " km/h";

                    }
                );


            /*
             * Driver online.
             */

            document
                .querySelectorAll(
                    "[data-rider-online], #riderOnline"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            state.riderOnline
                                ? "Online"
                                : "Offline";

                        element.classList.toggle(
                            "online",
                            state.riderOnline
                        );

                        element.classList.toggle(
                            "offline",
                            !state.riderOnline
                        );

                    }
                );
        };


    /* ========================================================
       STOP GPS
       ======================================================== */

    Tracking.stopGPS =
        function () {

            if (
                Tracking.state.watchId !==
                null
            ) {

                try {

                    navigator
                        .geolocation
                        .clearWatch(
                            Tracking.state.watchId
                        );

                } catch (error) {}


                Tracking.state.watchId =
                    null;
            }


            return true;
        };


    /* ========================================================
       STOP FIREBASE LISTENERS
       ======================================================== */

    Tracking.stopFirebaseListeners =
        function () {

            Tracking.state
                .firebaseUnsubscribers
                .forEach(
                    function (
                        unsubscribe
                    ) {

                        try {

                            unsubscribe();

                        } catch (error) {}

                    }
                );


            Tracking.state
                .firebaseUnsubscribers =
                [];


            return true;
        };


    /* ========================================================
       STOP TRACKING
       ======================================================== */

    Tracking.stop =
        async function (
            options
        ) {

            options =
                options || {};


            Tracking.stopGPS();


            Tracking.stopFirebaseListeners();


            if (
                options.offline
            ) {

                await Tracking.setOnline(
                    false
                );

            }


            Tracking.state.active =
                false;


            Tracking.emit(
                "stopped",
                {

                    rideId:
                        Tracking.state
                            .rideId
                }
            );


            return true;
        };


    /* ========================================================
       RESET
       ======================================================== */

    Tracking.reset =
        function () {

            Tracking.stopGPS();

            Tracking.stopFirebaseListeners();


            Tracking.state.active =
                false;

            Tracking.state.rideId =
                null;

            Tracking.state.riderId =
                null;

            Tracking.state.customerId =
                null;

            Tracking.state.status =
                "idle";

            Tracking.state.riderLocation =
                null;

            Tracking.state.customerLocation =
                null;

            Tracking.state.destination =
                null;

            Tracking.state.pickup =
                null;

            Tracking.state.route =
                [];

            Tracking.state
                .distanceRemaining =
                null;

            Tracking.state.etaMinutes =
                null;

            Tracking.state.riderSpeed =
                0;

            Tracking.state.riderHeading =
                null;

            Tracking.state.riderOnline =
                false;


            Tracking.emit(
                "reset"
            );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Tracking.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-tracking-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Tracking.on =
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
                "riderx-tracking-" +
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
       MAP INTEGRATION
       ======================================================== */

    Tracking.sendToMap =
        function () {

            const location =
                Tracking.state
                    .riderLocation;


            if (
                !location
            ) {

                return;
            }


            /*
             * Existing map.js can listen
             * to this event.
             */

            Tracking.emit(
                "map-location",
                {

                    lat:
                        location.lat,

                    lng:
                        location.lng,

                    heading:
                        location.heading,

                    speed:
                        location.speed,

                    rideId:
                        Tracking.state
                            .rideId
                }
            );
        };


    /* ========================================================
       PERIODIC CHECK
       ======================================================== */

    Tracking.startHealthCheck =
        function () {

            if (
                Tracking.state
                    .healthTimer
            ) {

                clearInterval(
                    Tracking.state
                        .healthTimer
                );

            }


            Tracking.state.healthTimer =
                setInterval(
                    function () {

                        Tracking
                            .checkStale();

                    },
                    5000
                );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.startTracking =
        Tracking.start;

    RX.stopTracking =
        Tracking.stop;

    RX.setTrackingRide =
        Tracking.setRide;

    RX.getTrackingState =
        function () {

            return {
                ...Tracking.state
            };

        };

    RX.getTrackingDistance =
        Tracking.distance;


    /* ========================================================
       INIT
       ======================================================== */

    Tracking.init =
        function () {

            if (
                Tracking.state
                    .initialized
            ) {

                return;
            }


            Tracking.state
                .initialized =
                true;


            Tracking.startHealthCheck();


            console.log(
                "RiderX tracking.js loaded."
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
            Tracking.init
        );

    } else {

        Tracking.init();

    }


})();
