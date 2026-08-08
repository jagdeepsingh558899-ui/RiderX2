/* ============================================================
   RIDERX LIVE TRACKING
   File: js/live-tracking.js

   Handles:
   - Customer live location
   - Rider live location
   - Firebase Realtime Database sync
   - Ride tracking
   - GPS watch
   - Location sharing
   - Customer -> Rider location
   - Rider -> Customer location
   - Map update events

   NOTE:
   This file does NOT create another map.
   js/map.js remains responsible for map rendering.
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const LiveTracking =
        RX.liveTracking =
        RX.liveTracking || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    LiveTracking.config = {

        locationInterval:
            3000,

        minimumDistance:
            5,

        highAccuracy:
            true,

        timeout:
            15000,

        maximumAge:
            2000,

        collection:
            "liveLocations",

        ridesCollection:
            "rides",

        ridersCollection:
            "riders",

        customersCollection:
            "customers"
    };


    /* ========================================================
       STATE
       ======================================================== */

    LiveTracking.state = {

        initialized:
            false,

        tracking:
            false,

        sharing:
            false,

        role:
            null,

        userId:
            null,

        rideId:
            null,

        location:
            null,

        previousLocation:
            null,

        watchId:
            null,

        intervalId:
            null,

        firebaseListener:
            null,

        unsubscribe:
            null,

        remoteLocation:
            null,

        remoteRole:
            null,

        lastSentAt:
            0,

        lastSentLocation:
            null,

        error:
            null
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    LiveTracking.now =
        function () {

            return Date.now();
        };


    LiveTracking.getRole =
        function () {

            const role =
                LiveTracking.state.role ||
                document.body?.dataset?.role ||
                localStorage.getItem(
                    "riderx_role"
                ) ||
                "customer";


            return String(
                role
            )
            .toLowerCase()
            .trim();
        };


    LiveTracking.getUser =
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


    LiveTracking.getUserId =
        function () {

            const user =
                LiveTracking.getUser();


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


    LiveTracking.getFirebaseDatabase =
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
                    "Firebase Database unavailable:",
                    error
                );
            }


            return null;
        };


    LiveTracking.getFirestore =
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
                    "Firestore unavailable:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    LiveTracking.distance =
        function (
            a,
            b
        ) {

            if (
                !a ||
                !b ||
                typeof a.lat !==
                    "number" ||
                typeof a.lng !==
                    "number" ||
                typeof b.lat !==
                    "number" ||
                typeof b.lng !==
                    "number"
            ) {

                return 0;
            }


            const earth =
                6371000;


            const lat1 =
                a.lat *
                Math.PI /
                180;


            const lat2 =
                b.lat *
                Math.PI /
                180;


            const dLat =
                (b.lat - a.lat) *
                Math.PI /
                180;


            const dLng =
                (b.lng - a.lng) *
                Math.PI /
                180;


            const x =
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
                    Math.sqrt(x),
                    Math.sqrt(
                        1 - x
                    )
                );


            return earth * c;
        };


    /* ========================================================
       NORMALIZE LOCATION
       ======================================================== */

    LiveTracking.normalizeLocation =
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
                        Date.now()
                    )
            };
        };


    /* ========================================================
       GET CURRENT GPS LOCATION
       ======================================================== */

    LiveTracking.getCurrentLocation =
        function () {

            if (
                !navigator.geolocation
            ) {

                return Promise.reject(
                    new Error(
                        "Geolocation is not supported."
                    )
                );
            }


            return new Promise(
                function (
                    resolve,
                    reject
                ) {

                    navigator.geolocation
                        .getCurrentPosition(

                            function (
                                position
                            ) {

                                const location =
                                    LiveTracking
                                        .normalizeLocation({

                                            lat:
                                                position
                                                    .coords
                                                    .latitude,

                                            lng:
                                                position
                                                    .coords
                                                    .longitude,

                                            accuracy:
                                                position
                                                    .coords
                                                    .accuracy,

                                            heading:
                                                position
                                                    .coords
                                                    .heading,

                                            speed:
                                                position
                                                    .coords
                                                    .speed,

                                            timestamp:
                                                position
                                                    .timestamp
                                        });


                                if (
                                    !location
                                ) {

                                    reject(
                                        new Error(
                                            "Invalid location."
                                        )
                                    );

                                    return;
                                }


                                resolve(
                                    location
                                );
                            },

                            function (
                                error
                            ) {

                                reject(
                                    error
                                );
                            },

                            {

                                enableHighAccuracy:
                                    LiveTracking
                                        .config
                                        .highAccuracy,

                                timeout:
                                    LiveTracking
                                        .config
                                        .timeout,

                                maximumAge:
                                    LiveTracking
                                        .config
                                        .maximumAge
                            }
                        );
                }
            );
        };


    /* ========================================================
       START GPS WATCH
       ======================================================== */

    LiveTracking.startGPS =
        function () {

            if (
                !navigator.geolocation
            ) {

                LiveTracking.state.error =
                    new Error(
                        "Geolocation unavailable."
                    );


                LiveTracking.emit(
                    "error",
                    {
                        error:
                            LiveTracking.state
                                .error
                    }
                );


                return null;
            }


            LiveTracking.stopGPS();


            LiveTracking.state.tracking =
                true;


            LiveTracking.state.watchId =
                navigator.geolocation
                    .watchPosition(

                        function (
                            position
                        ) {

                            LiveTracking
                                .handleLocation(
                                    position
                                );
                        },

                        function (
                            error
                        ) {

                            LiveTracking.state.error =
                                error;


                            LiveTracking.emit(
                                "gps-error",
                                {
                                    error:
                                        error
                                }
                            );
                        },

                        {

                            enableHighAccuracy:
                                LiveTracking
                                    .config
                                    .highAccuracy,

                            timeout:
                                LiveTracking
                                    .config
                                    .timeout,

                            maximumAge:
                                LiveTracking
                                    .config
                                    .maximumAge
                        }
                    );


            LiveTracking.emit(
                "gps-started",
                {
                    watchId:
                        LiveTracking.state
                            .watchId
                }
            );


            return LiveTracking.state
                .watchId;
        };


    /* ========================================================
       STOP GPS
       ======================================================== */

    LiveTracking.stopGPS =
        function () {

            if (
                LiveTracking.state
                    .watchId !==
                null
            ) {

                try {

                    navigator.geolocation
                        .clearWatch(
                            LiveTracking.state
                                .watchId
                        );

                } catch (error) {}
            }


            LiveTracking.state.watchId =
                null;


            LiveTracking.state.tracking =
                false;


            LiveTracking.emit(
                "gps-stopped"
            );
        };


    /* ========================================================
       HANDLE LOCATION
       ======================================================== */

    LiveTracking.handleLocation =
        function (
            position
        ) {

            const location =
                LiveTracking
                    .normalizeLocation({

                        lat:
                            position.coords
                                .latitude,

                        lng:
                            position.coords
                                .longitude,

                        accuracy:
                            position.coords
                                .accuracy,

                        heading:
                            position.coords
                                .heading,

                        speed:
                            position.coords
                                .speed,

                        timestamp:
                            position.timestamp
                    });


            if (
                !location
            ) {
                return;
            }


            const previous =
                LiveTracking.state
                    .location;


            LiveTracking.state
                .previousLocation =
                previous;


            LiveTracking.state
                .location =
                location;


            /*
             * Notify map.js and other
             * controllers.
             */

            LiveTracking.emit(
                "location",
                {
                    location:
                        location,

                    previous:
                        previous
                }
            );


            /*
             * Do not send every GPS tick.
             * This prevents Firebase overload.
             */

            if (
                LiveTracking.state.sharing
            ) {

                LiveTracking
                    .maybeShareLocation(
                        location
                    );
            }
        };


    /* ========================================================
       SHOULD SEND LOCATION
       ======================================================== */

    LiveTracking.shouldSend =
        function (
            location
        ) {

            const previous =
                LiveTracking.state
                    .lastSentLocation;


            const now =
                LiveTracking.now();


            const elapsed =
                now -
                LiveTracking.state
                    .lastSentAt;


            if (
                !previous
            ) {

                return true;
            }


            const distance =
                LiveTracking.distance(
                    previous,
                    location
                );


            if (
                distance >=
                LiveTracking.config
                    .minimumDistance
            ) {

                return true;
            }


            if (
                elapsed >=
                LiveTracking.config
                    .locationInterval
            ) {

                return true;
            }


            return false;
        };


    /* ========================================================
       SHARE LOCATION
       ======================================================== */

    LiveTracking.maybeShareLocation =
        async function (
            location
        ) {

            if (
                !LiveTracking.shouldSend(
                    location
                )
            ) {

                return false;
            }


            return LiveTracking
                .shareLocation(
                    location
                );
        };


    /* ========================================================
       BUILD LOCATION DATA
       ======================================================== */

    LiveTracking.buildLocationData =
        function (
            location
        ) {

            const role =
                LiveTracking.getRole();


            const userId =
                LiveTracking.state
                    .userId ||
                LiveTracking.getUserId();


            return {

                userId:
                    userId || null,

                role:
                    role,

                rideId:
                    LiveTracking.state
                        .rideId ||
                    null,

                lat:
                    location.lat,

                lng:
                    location.lng,

                accuracy:
                    location.accuracy,

                heading:
                    location.heading,

                speed:
                    location.speed,

                timestamp:
                    location.timestamp,

                updatedAt:
                    Date.now(),

                active:
                    true
            };
        };


    /* ========================================================
       SHARE TO FIREBASE
       ======================================================== */

    LiveTracking.shareLocation =
        async function (
            location
        ) {

            location =
                LiveTracking
                    .normalizeLocation(
                        location
                    );


            if (
                !location
            ) {

                return false;
            }


            const userId =
                LiveTracking.state
                    .userId ||
                LiveTracking.getUserId();


            if (
                !userId
            ) {

                LiveTracking.emit(
                    "share-error",
                    {
                        error:
                            new Error(
                                "User ID unavailable."
                            )
                    }
                );


                return false;
            }


            const role =
                LiveTracking.getRole();


            const data =
                LiveTracking
                    .buildLocationData(
                        location
                    );


            let success =
                false;


            /*
             * Firebase Realtime Database
             */

            const database =
                LiveTracking
                    .getFirebaseDatabase();


            if (
                database
            ) {

                try {

                    const ref =
                        database.ref(
                            LiveTracking
                                .config
                                .collection +
                            "/" +
                            userId
                        );


                    await ref.set(
                        data
                    );


                    success =
                        true;

                } catch (error) {

                    console.warn(
                        "RTDB location sync failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback
             */

            if (
                !success
            ) {

                const firestore =
                    LiveTracking
                        .getFirestore();


                if (
                    firestore
                ) {

                    try {

                        await firestore
                            .collection(
                                LiveTracking
                                    .config
                                    .collection
                            )
                            .doc(
                                userId
                            )
                            .set(
                                data,
                                {
                                    merge:
                                        true
                                }
                            );


                        success =
                            true;

                    } catch (error) {

                        console.warn(
                            "Firestore location sync failed:",
                            error
                        );
                    }
                }
            }


            /*
             * Update local state.
             */

            if (
                success
            ) {

                LiveTracking.state
                    .lastSentLocation =
                    location;


                LiveTracking.state
                    .lastSentAt =
                    Date.now();


                LiveTracking.emit(
                    "location-shared",
                    {
                        location:
                            location,

                        role:
                            role,

                        rideId:
                            LiveTracking.state
                                .rideId
                    }
                );
            }


            return success;
        };


    /* ========================================================
       REMOVE SHARED LOCATION
       ======================================================== */

    LiveTracking.removeSharedLocation =
        async function () {

            const userId =
                LiveTracking.state
                    .userId ||
                LiveTracking.getUserId();


            if (
                !userId
            ) {

                return false;
            }


            let success =
                false;


            const database =
                LiveTracking
                    .getFirebaseDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            LiveTracking
                                .config
                                .collection +
                            "/" +
                            userId
                        )
                        .update(
                            {
                                active:
                                    false,

                                updatedAt:
                                    Date.now()
                            }
                        );


                    success =
                        true;

                } catch (error) {}
            }


            if (
                !success
            ) {

                const firestore =
                    LiveTracking
                        .getFirestore();


                if (
                    firestore
                ) {

                    try {

                        await firestore
                            .collection(
                                LiveTracking
                                    .config
                                    .collection
                            )
                            .doc(
                                userId
                            )
                            .set(
                                {
                                    active:
                                        false,

                                    updatedAt:
                                        Date.now()
                                },
                                {
                                    merge:
                                        true
                                }
                            );


                        success =
                            true;

                    } catch (error) {}
                }
            }


            return success;
        };


    /* ========================================================
       START SHARING
       ======================================================== */

    LiveTracking.startSharing =
        async function (
            options
        ) {

            options =
                options || {};


            LiveTracking.state.role =
                options.role ||
                LiveTracking.getRole();


            LiveTracking.state.userId =
                options.userId ||
                LiveTracking.getUserId();


            LiveTracking.state.rideId =
                options.rideId ||
                LiveTracking.state
                    .rideId ||
                null;


            LiveTracking.state.sharing =
                true;


            /*
             * Get first location immediately.
             */

            try {

                const location =
                    await LiveTracking
                        .getCurrentLocation();


                LiveTracking.state
                    .location =
                    location;


                await LiveTracking
                    .shareLocation(
                        location
                    );

            } catch (error) {

                LiveTracking.emit(
                    "gps-error",
                    {
                        error:
                            error
                    }
                );
            }


            /*
             * Start continuous GPS.
             */

            LiveTracking.startGPS();


            LiveTracking.emit(
                "sharing-started",
                {

                    role:
                        LiveTracking.state
                            .role,

                    userId:
                        LiveTracking.state
                            .userId,

                    rideId:
                        LiveTracking.state
                            .rideId
                }
            );


            return true;
        };


    /* ========================================================
       STOP SHARING
       ======================================================== */

    LiveTracking.stopSharing =
        async function () {

            LiveTracking.state.sharing =
                false;


            LiveTracking.stopGPS();


            await LiveTracking
                .removeSharedLocation();


            LiveTracking.emit(
                "sharing-stopped"
            );


            return true;
        };


    /* ========================================================
       SET RIDE
       ======================================================== */

    LiveTracking.setRide =
        function (
            rideId
        ) {

            LiveTracking.state.rideId =
                rideId ||
                null;


            LiveTracking.emit(
                "ride-changed",
                {
                    rideId:
                        rideId
                }
            );


            return rideId;
        };


    /* ========================================================
       CLEAR RIDE
       ======================================================== */

    LiveTracking.clearRide =
        function () {

            LiveTracking.state.rideId =
                null;


            LiveTracking.emit(
                "ride-cleared"
            );
        };


    /* ========================================================
       LISTEN TO REMOTE USER
       ======================================================== */

    LiveTracking.listen =
        function (
            userId,
            options
        ) {

            options =
                options || {};


            userId =
                userId ||
                options.userId;


            if (
                !userId
            ) {

                return null;
            }


            LiveTracking.stopListening();


            LiveTracking.state.remoteRole =
                options.role ||
                null;


            const database =
                LiveTracking
                    .getFirebaseDatabase();


            /*
             * Prefer RTDB because live
             * location updates are frequent.
             */

            if (
                database
            ) {

                try {

                    const ref =
                        database.ref(
                            LiveTracking
                                .config
                                .collection +
                            "/" +
                            userId
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


                            const location =
                                LiveTracking
                                    .normalizeLocation(
                                        data
                                    );


                            if (
                                !location
                            ) {
                                return;
                            }


                            LiveTracking.state
                                .remoteLocation =
                                location;


                            LiveTracking.emit(
                                "remote-location",
                                {

                                    location:
                                        location,

                                    data:
                                        data,

                                    userId:
                                        userId
                                }
                            );
                        };


                    ref.on(
                        "value",
                        callback
                    );


                    LiveTracking.state
                        .firebaseListener = {
                            ref:
                                ref,

                            callback:
                                callback
                        };


                    return true;

                } catch (error) {

                    console.warn(
                        "RTDB listener failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            const firestore =
                LiveTracking
                    .getFirestore();


            if (
                firestore
            ) {

                try {

                    const unsubscribe =
                        firestore
                            .collection(
                                LiveTracking
                                    .config
                                    .collection
                            )
                            .doc(
                                userId
                            )
                            .onSnapshot(
                                function (
                                    snapshot
                                ) {

                                    const data =
                                        snapshot.data();


                                    if (
                                        !data
                                    ) {
                                        return;
                                    }


                                    const location =
                                        LiveTracking
                                            .normalizeLocation(
                                                data
                                            );


                                    if (
                                        !location
                                    ) {
                                        return;
                                    }


                                    LiveTracking
                                        .state
                                        .remoteLocation =
                                        location;


                                    LiveTracking.emit(
                                        "remote-location",
                                        {

                                            location:
                                                location,

                                            data:
                                                data,

                                            userId:
                                                userId
                                        }
                                    );
                                }
                            );


                    LiveTracking.state
                        .unsubscribe =
                        unsubscribe;


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore listener failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       STOP LISTENING
       ======================================================== */

    LiveTracking.stopListening =
        function () {

            const listener =
                LiveTracking.state
                    .firebaseListener;


            if (
                listener?.ref &&
                listener?.callback
            ) {

                try {

                    listener.ref.off(
                        "value",
                        listener.callback
                    );

                } catch (error) {}
            }


            LiveTracking.state
                .firebaseListener =
                null;


            if (
                typeof LiveTracking.state
                    .unsubscribe ===
                "function"
            ) {

                try {

                    LiveTracking.state
                        .unsubscribe();

                } catch (error) {}
            }


            LiveTracking.state
                .unsubscribe =
                null;


            LiveTracking.state
                .remoteLocation =
                null;


            LiveTracking.emit(
                "listening-stopped"
            );
        };


    /* ========================================================
       LISTEN TO RIDE
       ======================================================== */

    LiveTracking.listenToRide =
        function (
            rideId,
            options
        ) {

            options =
                options || {};


            if (
                !rideId
            ) {

                return false;
            }


            LiveTracking.setRide(
                rideId
            );


            /*
             * If explicit user ID is given,
             * listen directly.
             */

            if (
                options.userId
            ) {

                return LiveTracking.listen(
                    options.userId,
                    options
                );
            }


            /*
             * Otherwise listen to ride
             * participant locations.
             */

            const database =
                LiveTracking
                    .getFirebaseDatabase();


            if (
                database
            ) {

                try {

                    const ref =
                        database.ref(
                            LiveTracking
                                .config
                                .ridesCollection +
                            "/" +
                            rideId +
                            "/locations"
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


                            if (
                                data.rider
                            ) {

                                const riderLocation =
                                    LiveTracking
                                        .normalizeLocation(
                                            data.rider
                                        );


                                if (
                                    riderLocation
                                ) {

                                    LiveTracking.emit(
                                        "rider-location",
                                        {
                                            location:
                                                riderLocation,

                                            rideId:
                                                rideId
                                        }
                                    );
                                }
                            }


                            if (
                                data.customer
                            ) {

                                const customerLocation =
                                    LiveTracking
                                        .normalizeLocation(
                                            data.customer
                                        );


                                if (
                                    customerLocation
                                ) {

                                    LiveTracking.emit(
                                        "customer-location",
                                        {
                                            location:
                                                customerLocation,

                                            rideId:
                                                rideId
                                        }
                                    );
                                }
                            }
                        };


                    ref.on(
                        "value",
                        callback
                    );


                    LiveTracking.state
                        .firebaseListener = {
                            ref:
                                ref,

                            callback:
                                callback
                        };


                    return true;

                } catch (error) {}
            }


            return false;
        };


    /* ========================================================
       GET REMOTE LOCATION
       ======================================================== */

    LiveTracking.getRemoteLocation =
        function () {

            return LiveTracking.state
                .remoteLocation;
        };


    /* ========================================================
       GET CURRENT LOCATION
       ======================================================== */

    LiveTracking.getLocation =
        function () {

            return LiveTracking.state
                .location;
        };


    /* ========================================================
       LOCATION AGE
       ======================================================== */

    LiveTracking.getLocationAge =
        function () {

            const location =
                LiveTracking.state
                    .remoteLocation ||
                LiveTracking.state
                    .location;


            if (
                !location?.timestamp
            ) {

                return Infinity;
            }


            return (
                Date.now() -
                location.timestamp
            );
        };


    /* ========================================================
       CHECK LOCATION FRESHNESS
       ======================================================== */

    LiveTracking.isFresh =
        function (
            maxAge
        ) {

            maxAge =
                Number(
                    maxAge ||
                    30000
                );


            return (
                LiveTracking
                    .getLocationAge() <=
                maxAge
            );
        };


    /* ========================================================
       SHARE RIDE LOCATION
       ======================================================== */

    LiveTracking.shareRideLocation =
        async function (
            rideId,
            role,
            location
        ) {

            rideId =
                rideId ||
                LiveTracking.state
                    .rideId;


            role =
                role ||
                LiveTracking.getRole();


            location =
                LiveTracking
                    .normalizeLocation(
                        location ||
                        LiveTracking.state
                            .location
                    );


            if (
                !rideId ||
                !location
            ) {

                return false;
            }


            const database =
                LiveTracking
                    .getFirebaseDatabase();


            const data = {

                lat:
                    location.lat,

                lng:
                    location.lng,

                accuracy:
                    location.accuracy,

                heading:
                    location.heading,

                speed:
                    location.speed,

                timestamp:
                    location.timestamp,

                updatedAt:
                    Date.now(),

                userId:
                    LiveTracking
                        .getUserId()
            };


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            LiveTracking
                                .config
                                .ridesCollection +
                            "/" +
                            rideId +
                            "/locations/" +
                            role
                        )
                        .set(
                            data
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Ride location sync failed:",
                        error
                    );
                }
            }


            const firestore =
                LiveTracking
                    .getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            LiveTracking
                                .config
                                .ridesCollection
                        )
                        .doc(
                            rideId
                        )
                        .set(
                            {
                                locations: {

                                    [role]:
                                        data
                                }
                            },
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
       START RIDE TRACKING
       ======================================================== */

    LiveTracking.startRideTracking =
        async function (
            rideId,
            role
        ) {

            LiveTracking.setRide(
                rideId
            );


            LiveTracking.state.role =
                role ||
                LiveTracking.getRole();


            LiveTracking.state.sharing =
                true;


            /*
             * Start local GPS.
             */

            LiveTracking.startGPS();


            /*
             * Send ride location whenever
             * GPS changes.
             */

            LiveTracking.on(
                "location",
                function (
                    data
                ) {

                    if (
                        data?.location
                    ) {

                        LiveTracking
                            .shareRideLocation(
                                rideId,
                                LiveTracking
                                    .state
                                    .role,
                                data.location
                            );
                    }
                }
            );


            /*
             * Listen for opposite side.
             */

            LiveTracking.emit(
                "ride-tracking-started",
                {
                    rideId:
                        rideId,

                    role:
                        LiveTracking
                            .state
                            .role
                }
            );


            return true;
        };


    /* ========================================================
       STOP RIDE TRACKING
       ======================================================== */

    LiveTracking.stopRideTracking =
        async function () {

            LiveTracking.stopGPS();

            LiveTracking.stopListening();

            LiveTracking.state.sharing =
                false;


            LiveTracking.emit(
                "ride-tracking-stopped",
                {
                    rideId:
                        LiveTracking.state
                            .rideId
                }
            );


            LiveTracking.clearRide();


            return true;
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    LiveTracking.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-live-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    LiveTracking.on =
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
                "riderx-live-" +
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
       CLEANUP
       ======================================================== */

    LiveTracking.destroy =
        async function () {

            try {

                await LiveTracking
                    .removeSharedLocation();

            } catch (error) {}


            LiveTracking.stopGPS();

            LiveTracking.stopListening();


            LiveTracking.state = {

                initialized:
                    false,

                tracking:
                    false,

                sharing:
                    false,

                role:
                    null,

                userId:
                    null,

                rideId:
                    null,

                location:
                    null,

                previousLocation:
                    null,

                watchId:
                    null,

                intervalId:
                    null,

                firebaseListener:
                    null,

                unsubscribe:
                    null,

                remoteLocation:
                    null,

                remoteRole:
                    null,

                lastSentAt:
                    0,

                lastSentLocation:
                    null,

                error:
                    null
            };


            LiveTracking.emit(
                "destroyed"
            );
        };


    /* ========================================================
       INIT
       ======================================================== */

    LiveTracking.init =
        function (
            options
        ) {

            options =
                options || {};


            LiveTracking.state.role =
                options.role ||
                LiveTracking.getRole();


            LiveTracking.state.userId =
                options.userId ||
                LiveTracking.getUserId();


            LiveTracking.state.initialized =
                true;


            /*
             * Do not automatically start
             * sharing unless explicitly requested.
             */

            if (
                options.startSharing ===
                true
            ) {

                LiveTracking
                    .startSharing(
                        options
                    );
            }


            LiveTracking.emit(
                "ready",
                {
                    role:
                        LiveTracking.state
                            .role,

                    userId:
                        LiveTracking.state
                            .userId
                }
            );


            return true;
        };


    /* ========================================================
       GLOBAL SHORTCUTS
       ======================================================== */

    RX.startLiveTracking =
        LiveTracking.startSharing;

    RX.stopLiveTracking =
        LiveTracking.stopSharing;

    RX.getLiveLocation =
        LiveTracking.getLocation;

    RX.listenLiveLocation =
        LiveTracking.listen;


    /* ========================================================
       AUTO INIT
       ======================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            LiveTracking.init();

        }
    );


    LiveTracking.init();


    console.log(
        "RiderX live-tracking.js loaded."
    );

})();
