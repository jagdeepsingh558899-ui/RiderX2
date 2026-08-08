/* ============================================================
   RIDERX 2.0
   MAP ENGINE
   File: js/map.js

   Uses:
   - Leaflet
   - OpenStreetMap
   - OSRM routing
   - Geolocation API
   - Firebase Realtime Database
   - Firebase Firestore

   Features:
   - Customer current location
   - Pickup marker
   - Destination marker
   - Route drawing
   - Distance calculation
   - ETA calculation
   - Rider live location
   - Map recenter
   - Map fit bounds
   - Location permission handling
   - Multiple map instances
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       GLOBAL
       ======================================================== */

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    RX.map =
        RX.map || {};

    const MAP =
        RX.map;


    /* ========================================================
       CONFIG
       ======================================================== */

    MAP.config = {

        defaultCenter: [
            30.7333,
            76.7794
        ],

        defaultZoom: 13,

        maxZoom: 19,

        tileUrl:
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        tileAttribution:
            '&copy; OpenStreetMap contributors',

        routingUrl:
            "https://router.project-osrm.org/route/v1/driving/",

        geocodingUrl:
            "https://nominatim.openstreetmap.org/",

        locationTimeout:
            15000,

        locationMaximumAge:
            10000,

        riderLocationInterval:
            5000
    };


    /* ========================================================
       STATE
       ======================================================== */

    MAP.state = {

        instances: {},

        activeMapId: null,

        pickup: null,

        destination: null,

        rider: null,

        route: null,

        distanceKm: 0,

        durationMin: 0,

        locating: false,

        watchId: null,

        riderWatchId: null,

        routeRequest: 0,

        lastLocation: null,

        liveRideId: null,

        liveRideListener: null
    };


    /* ========================================================
       DEFAULT MAP ICONS
       ======================================================== */

    MAP.icons = {};


    /* ========================================================
       CREATE DIV ICON
       ======================================================== */

    MAP.createIcon = function (
        className,
        text
    ) {

        if (
            typeof L ===
            "undefined"
        ) {

            return null;
        }

        return L.divIcon({

            className:
                "riderx-map-icon-wrapper",

            html:
                '<div class="' +
                className +
                '">' +
                (text || "") +
                "</div>",

            iconSize: [
                44,
                44
            ],

            iconAnchor: [
                22,
                22
            ],

            popupAnchor: [
                0,
                -22
            ]
        });
    };


    MAP.icons.pickup =
        MAP.createIcon(
            "riderx-pickup-marker",
            "●"
        );

    MAP.icons.destination =
        MAP.createIcon(
            "riderx-destination-marker",
            "●"
        );

    MAP.icons.rider =
        MAP.createIcon(
            "riderx-rider-marker",
            "🏍"
        );

    MAP.icons.user =
        MAP.createIcon(
            "riderx-user-marker",
            "●"
        );


    /* ========================================================
       GET MAP INSTANCE
       ======================================================== */

    MAP.get =
        function (mapId) {

            return MAP.state
                .instances[
                    mapId
                ] || null;
        };


    /* ========================================================
       CREATE MAP
       ======================================================== */

    MAP.create =
        function (
            mapId,
            options
        ) {

            if (
                typeof L ===
                "undefined"
            ) {

                console.error(
                    "Leaflet is not loaded."
                );

                return null;
            }

            mapId =
                mapId ||
                "riderx-map";

            options =
                options || {};


            /* -----------------------------------------------
               Prevent duplicate map
               ----------------------------------------------- */

            if (
                MAP.get(mapId)
            ) {

                return MAP.get(mapId);
            }


            const element =
                typeof mapId ===
                "string"
                    ? document.getElementById(
                        mapId
                    )
                    : mapId;


            if (!element) {

                console.warn(
                    "Map container not found:",
                    mapId
                );

                return null;
            }


            const center =
                options.center ||
                MAP.config
                    .defaultCenter;


            const zoom =
                options.zoom ||
                MAP.config
                    .defaultZoom;


            const map =
                L.map(
                    element,
                    {

                        zoomControl:
                            options.zoomControl !==
                            false,

                        attributionControl:
                            true,

                        dragging:
                            true,

                        tap:
                            true,

                        scrollWheelZoom:
                            options.scrollWheelZoom !==
                            false,

                        doubleClickZoom:
                            true,

                        touchZoom:
                            true
                    }
                );


            map.setView(
                center,
                zoom
            );


            /* -----------------------------------------------
               OpenStreetMap
               ----------------------------------------------- */

            L.tileLayer(
                MAP.config.tileUrl,
                {

                    maxZoom:
                        MAP.config.maxZoom,

                    attribution:
                        MAP.config
                            .tileAttribution
                }
            ).addTo(
                map
            );


            /* -----------------------------------------------
               Instance state
               ----------------------------------------------- */

            MAP.state
                .instances[
                    mapId
                ] = {

                    id:
                        mapId,

                    map:
                        map,

                    pickupMarker:
                        null,

                    destinationMarker:
                        null,

                    userMarker:
                        null,

                    riderMarker:
                        null,

                    routeLine:
                        null,

                    accuracyCircle:
                        null
                };


            MAP.state.activeMapId =
                mapId;


            /* -----------------------------------------------
               Map events
               ----------------------------------------------- */

            map.on(
                "click",
                function (event) {

                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-map-click",
                            {
                                detail: {
                                    mapId:
                                        mapId,

                                    lat:
                                        event.latlng.lat,

                                    lng:
                                        event.latlng.lng
                                }
                            }
                        )
                    );
                }
            );


            setTimeout(
                function () {

                    map.invalidateSize();

                },
                300
            );


            return map;
        };


    /* ========================================================
       REMOVE MAP
       ======================================================== */

    MAP.remove =
        function (mapId) {

            const instance =
                MAP.get(
                    mapId
                );

            if (!instance) {
                return;
            }

            if (
                instance.map
            ) {

                instance.map.remove();
            }

            delete MAP.state
                .instances[
                    mapId
                ];
        };


    /* ========================================================
       INVALIDATE SIZE
       ======================================================== */

    MAP.invalidate =
        function (mapId) {

            const instance =
                MAP.get(
                    mapId
                );

            if (
                instance &&
                instance.map
            ) {

                setTimeout(
                    function () {

                        instance.map
                            .invalidateSize();

                    },
                    100
                );
            }
        };


    /* ========================================================
       SET VIEW
       ======================================================== */

    MAP.setView =
        function (
            lat,
            lng,
            zoom,
            mapId
        ) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );

            if (!instance) {
                return;
            }

            instance.map.setView(
                [
                    Number(lat),
                    Number(lng)
                ],
                zoom ||
                MAP.config.defaultZoom
            );
        };


    /* ========================================================
       ADD PICKUP MARKER
       ======================================================== */

    MAP.setPickup =
        function (
            lat,
            lng,
            address,
            mapId
        ) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );

            if (!instance) {
                return null;
            }


            lat =
                Number(lat);

            lng =
                Number(lng);


            if (
                instance.pickupMarker
            ) {

                instance.map.removeLayer(
                    instance.pickupMarker
                );
            }


            instance.pickupMarker =
                L.marker(
                    [
                        lat,
                        lng
                    ],
                    {

                        icon:
                            MAP.icons
                                .pickup,

                        draggable:
                            true,

                        zIndexOffset:
                            1000
                    }
                )
                .addTo(
                    instance.map
                );


            instance.pickupMarker
                .bindPopup(
                    address ||
                    "Pickup location"
                );


            instance.pickupMarker.on(
                "dragend",
                function () {

                    const position =
                        instance
                            .pickupMarker
                            .getLatLng();


                    MAP.state.pickup = {

                        lat:
                            position.lat,

                        lng:
                            position.lng,

                        address:
                            address || ""
                    };


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-pickup-moved",
                            {
                                detail:
                                    MAP.state
                                        .pickup
                            }
                        )
                    );


                    MAP.updateRoute();
                }
            );


            MAP.state.pickup = {

                lat:
                    lat,

                lng:
                    lng,

                address:
                    address || ""
            };


            return instance
                .pickupMarker;
        };


    /* ========================================================
       ADD DESTINATION MARKER
       ======================================================== */

    MAP.setDestination =
        function (
            lat,
            lng,
            address,
            mapId
        ) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );

            if (!instance) {
                return null;
            }


            lat =
                Number(lat);

            lng =
                Number(lng);


            if (
                instance.destinationMarker
            ) {

                instance.map.removeLayer(
                    instance
                        .destinationMarker
                );
            }


            instance.destinationMarker =
                L.marker(
                    [
                        lat,
                        lng
                    ],
                    {

                        icon:
                            MAP.icons
                                .destination,

                        draggable:
                            true,

                        zIndexOffset:
                            900
                    }
                )
                .addTo(
                    instance.map
                );


            instance.destinationMarker
                .bindPopup(
                    address ||
                    "Destination"
                );


            instance.destinationMarker.on(
                "dragend",
                function () {

                    const position =
                        instance
                            .destinationMarker
                            .getLatLng();


                    MAP.state.destination = {

                        lat:
                            position.lat,

                        lng:
                            position.lng,

                        address:
                            address || ""
                    };


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-destination-moved",
                            {
                                detail:
                                    MAP.state
                                        .destination
                            }
                        )
                    );


                    MAP.updateRoute();
                }
            );


            MAP.state.destination = {

                lat:
                    lat,

                lng:
                    lng,

                address:
                    address || ""
            };


            return instance
                .destinationMarker;
        };


    /* ========================================================
       REMOVE PICKUP
       ======================================================== */

    MAP.removePickup =
        function (mapId) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );

            if (
                !instance
            ) {
                return;
            }

            if (
                instance.pickupMarker
            ) {

                instance.map.removeLayer(
                    instance.pickupMarker
                );

                instance.pickupMarker =
                    null;
            }

            MAP.state.pickup =
                null;
        };


    /* ========================================================
       REMOVE DESTINATION
       ======================================================== */

    MAP.removeDestination =
        function (mapId) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );

            if (
                !instance
            ) {
                return;
            }

            if (
                instance.destinationMarker
            ) {

                instance.map.removeLayer(
                    instance.destinationMarker
                );

                instance.destinationMarker =
                    null;
            }

            MAP.state.destination =
                null;
        };


    /* ========================================================
       UPDATE ROUTE
       ======================================================== */

    MAP.updateRoute =
        async function (
            mapId
        ) {

            const pickup =
                MAP.state.pickup;

            const destination =
                MAP.state.destination;


            if (
                !pickup ||
                !destination
            ) {

                return null;
            }


            return MAP.route(
                pickup.lat,
                pickup.lng,
                destination.lat,
                destination.lng,
                mapId
            );
        };


    /* ========================================================
       ROUTE
       ======================================================== */

    MAP.route =
        async function (
            pickupLat,
            pickupLng,
            destinationLat,
            destinationLng,
            mapId
        ) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );

            if (!instance) {
                return null;
            }


            const requestId =
                ++MAP.state
                    .routeRequest;


            const url =
                MAP.config.routingUrl +
                pickupLng +
                "," +
                pickupLat +
                ";" +
                destinationLng +
                "," +
                destinationLat +
                "?overview=full&geometries=geojson";


            try {

                const response =
                    await fetch(
                        url
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Routing service unavailable"
                    );
                }


                const data =
                    await response.json();


                if (
                    requestId !==
                    MAP.state
                        .routeRequest
                ) {

                    return null;
                }


                if (
                    !data.routes ||
                    !data.routes.length
                ) {

                    throw new Error(
                        "No route found"
                    );
                }


                const route =
                    data.routes[0];


                const coordinates =
                    route.geometry
                        .coordinates
                        .map(
                            function (
                                point
                            ) {

                                return [
                                    point[1],
                                    point[0]
                                ];
                            }
                        );


                if (
                    instance.routeLine
                ) {

                    instance.map
                        .removeLayer(
                            instance.routeLine
                        );
                }


                instance.routeLine =
                    L.polyline(
                        coordinates,
                        {

                            weight:
                                6,

                            opacity:
                                0.9,

                            lineCap:
                                "round",

                            lineJoin:
                                "round"
                        }
                    ).addTo(
                        instance.map
                    );


                const distanceKm =
                    Number(
                        route.distance
                    ) / 1000;


                const durationMin =
                    Number(
                        route.duration
                    ) / 60;


                MAP.state.distanceKm =
                    distanceKm;


                MAP.state.durationMin =
                    durationMin;


                MAP.state.route = {

                    distanceKm:
                        distanceKm,

                    durationMin:
                        durationMin,

                    geometry:
                        coordinates
                };


                MAP.renderTripInfo();


                MAP.fitRoute(
                    mapId
                );


                /*
                 * Sync booking engine.
                 */

                if (
                    RX.booking
                ) {

                    if (
                        typeof RX.booking
                            .setDistance ===
                        "function"
                    ) {

                        RX.booking
                            .setDistance(
                                distanceKm
                            );
                    }


                    if (
                        typeof RX.booking
                            .setDuration ===
                        "function"
                    ) {

                        RX.booking
                            .setDuration(
                                durationMin
                            );
                    }
                }


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-route-updated",
                        {
                            detail:
                                MAP.state
                                    .route
                        }
                    )
                );


                return MAP.state.route;


            } catch (error) {

                console.error(
                    "Route error:",
                    error
                );


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-route-error",
                        {
                            detail:
                                error
                        }
                    )
                );


                return null;
            }
        };


    /* ========================================================
       FIT ROUTE
       ======================================================== */

    MAP.fitRoute =
        function (mapId) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );


            if (!instance) {
                return;
            }


            const points = [];


            if (
                instance.pickupMarker
            ) {

                points.push(
                    instance
                        .pickupMarker
                        .getLatLng()
                );
            }


            if (
                instance.destinationMarker
            ) {

                points.push(
                    instance
                        .destinationMarker
                        .getLatLng()
                );
            }


            if (
                instance.routeLine
            ) {

                const bounds =
                    instance
                        .routeLine
                        .getBounds();

                if (
                    bounds.isValid()
                ) {

                    instance.map.fitBounds(
                        bounds,
                        {
                            padding:
                                [
                                    50,
                                    50
                                ]
                        }
                    );

                    return;
                }
            }


            if (
                points.length
            ) {

                const bounds =
                    L.latLngBounds(
                        points
                    );

                instance.map.fitBounds(
                    bounds,
                    {
                        padding:
                            [
                                50,
                                50
                            ]
                    }
                );
            }
        };


    /* ========================================================
       CURRENT LOCATION
       ======================================================== */

    MAP.getCurrentLocation =
        function (
            options
        ) {

            options =
                options || {};


            if (
                !navigator.geolocation
            ) {

                MAP.locationError(
                    {
                        code:
                            0,

                        message:
                            "Geolocation is not supported."
                    }
                );

                return;
            }


            MAP.state.locating =
                true;


            navigator.geolocation.getCurrentPosition(

                function (
                    position
                ) {

                    MAP.state.locating =
                        false;


                    const location = {

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
                                .accuracy
                    };


                    MAP.state.lastLocation =
                        location;


                    MAP.setUserLocation(
                        location.lat,
                        location.lng,
                        options.mapId
                    );


                    if (
                        options.setPickup !==
                        false
                    ) {

                        MAP.setPickup(
                            location.lat,
                            location.lng,
                            options.address ||
                            "Current location",
                            options.mapId
                        );
                    }


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-location-found",
                            {
                                detail:
                                    location
                            }
                        )
                    );


                    if (
                        typeof options
                            .success ===
                        "function"
                    ) {

                        options.success(
                            location
                        );
                    }

                },

                function (
                    error
                ) {

                    MAP.state.locating =
                        false;

                    MAP.locationError(
                        error
                    );


                    if (
                        typeof options
                            .error ===
                        "function"
                    ) {

                        options.error(
                            error
                        );
                    }

                },

                {

                    enableHighAccuracy:
                        true,

                    timeout:
                        options.timeout ||
                        MAP.config
                            .locationTimeout,

                    maximumAge:
                        MAP.config
                            .locationMaximumAge
                }
            );
        };


    /* ========================================================
       LOCATION ERROR
       ======================================================== */

    MAP.locationError =
        function (error) {

            console.warn(
                "Location error:",
                error
            );


            let message =
                "Unable to get your location.";


            if (
                error &&
                error.code === 1
            ) {

                message =
                    "Location permission denied.";

            } else if (
                error &&
                error.code === 2
            ) {

                message =
                    "Location is unavailable.";

            } else if (
                error &&
                error.code === 3
            ) {

                message =
                    "Location request timed out.";
            }


            if (
                RX.showToast
            ) {

                RX.showToast(
                    "Location",
                    message,
                    "warning"
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-location-error",
                    {
                        detail:
                            error
                    }
                )
            );
        };


    /* ========================================================
       SET USER LOCATION
       ======================================================== */

    MAP.setUserLocation =
        function (
            lat,
            lng,
            mapId,
            accuracy
        ) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );


            if (!instance) {
                return null;
            }


            const position =
                [
                    Number(lat),
                    Number(lng)
                ];


            if (
                instance.userMarker
            ) {

                instance.userMarker
                    .setLatLng(
                        position
                    );

            } else {

                instance.userMarker =
                    L.marker(
                        position,
                        {

                            icon:
                                MAP.icons
                                    .user,

                            zIndexOffset:
                                1100
                        }
                    ).addTo(
                        instance.map
                    );
            }


            if (
                accuracy &&
                Number(accuracy) > 0
            ) {

                if (
                    instance.accuracyCircle
                ) {

                    instance
                        .accuracyCircle
                        .setLatLng(
                            position
                        );

                    instance
                        .accuracyCircle
                        .setRadius(
                            Number(accuracy)
                        );

                } else {

                    instance
                        .accuracyCircle =
                        L.circle(
                            position,
                            {

                                radius:
                                    Number(
                                        accuracy
                                    ),

                                weight:
                                    1,

                                fillOpacity:
                                    0.12
                            }
                        ).addTo(
                            instance.map
                        );
                }
            }


            return instance
                .userMarker;
        };


    /* ========================================================
       WATCH USER LOCATION
       ======================================================== */

    MAP.startLocationWatch =
        function (
            options
        ) {

            options =
                options || {};


            if (
                !navigator.geolocation
            ) {
                return null;
            }


            MAP.stopLocationWatch();


            MAP.state.watchId =
                navigator.geolocation
                    .watchPosition(

                        function (
                            position
                        ) {

                            const location = {

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
                                        .accuracy
                            };


                            MAP.state.lastLocation =
                                location;


                            MAP.setUserLocation(
                                location.lat,
                                location.lng,
                                options.mapId,
                                location.accuracy
                            );


                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx-live-location",
                                    {
                                        detail:
                                            location
                                    }
                                )
                            );


                            if (
                                typeof options
                                    .success ===
                                "function"
                            ) {

                                options.success(
                                    location
                                );
                            }

                        },

                        function (
                            error
                        ) {

                            MAP.locationError(
                                error
                            );

                        },

                        {

                            enableHighAccuracy:
                                true,

                            timeout:
                                MAP.config
                                    .locationTimeout,

                            maximumAge:
                                5000
                        }
                    );


            return MAP.state
                .watchId;
        };


    /* ========================================================
       STOP LOCATION WATCH
       ======================================================== */

    MAP.stopLocationWatch =
        function () {

            if (
                MAP.state.watchId !==
                null
            ) {

                navigator.geolocation
                    .clearWatch(
                        MAP.state
                            .watchId
                    );

                MAP.state.watchId =
                    null;
            }
        };


    /* ========================================================
       CENTER ON USER
       ======================================================== */

    MAP.centerOnUser =
        function (
            mapId,
            zoom
        ) {

            const location =
                MAP.state
                    .lastLocation;


            if (!location) {

                MAP.getCurrentLocation(
                    {
                        mapId:
                            mapId,

                        setPickup:
                            false,

                        success:
                            function (
                                position
                            ) {

                                MAP.setView(
                                    position.lat,
                                    position.lng,
                                    zoom ||
                                    16,
                                    mapId
                                );
                            }
                    }
                );

                return;
            }


            MAP.setView(
                location.lat,
                location.lng,
                zoom ||
                16,
                mapId
            );
        };


    /* ========================================================
       RIDER LIVE MARKER
       ======================================================== */

    MAP.setRiderLocation =
        function (
            lat,
            lng,
            options
        ) {

            options =
                options || {};


            const mapId =
                options.mapId ||
                MAP.state.activeMapId;


            const instance =
                MAP.get(
                    mapId
                );


            if (!instance) {
                return null;
            }


            const position =
                [
                    Number(lat),
                    Number(lng)
                ];


            if (
                instance.riderMarker
            ) {

                instance.riderMarker
                    .setLatLng(
                        position
                    );

            } else {

                instance.riderMarker =
                    L.marker(
                        position,
                        {

                            icon:
                                MAP.icons
                                    .rider,

                            zIndexOffset:
                                1200
                        }
                    ).addTo(
                        instance.map
                    );
            }


            if (
                options.name
            ) {

                instance.riderMarker
                    .bindPopup(
                        options.name
                    );
            }


            MAP.state.rider = {

                lat:
                    Number(lat),

                lng:
                    Number(lng),

                updatedAt:
                    Date.now()
            };


            if (
                options.follow
            ) {

                instance.map.panTo(
                    position
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-rider-location",
                    {
                        detail:
                            MAP.state.rider
                    }
                )
            );


            return instance
                .riderMarker;
        };


    /* ========================================================
       START RIDER LIVE TRACKING
       ======================================================== */

    MAP.startRiderTracking =
        function (
            rideId,
            options
        ) {

            options =
                options || {};


            MAP.stopRiderTracking();


            MAP.state.liveRideId =
                rideId;


            /*
             * Realtime Database path:
             *
             * liveRides/{rideId}
             *
             * Expected:
             * {
             *   lat: 30.73,
             *   lng: 76.77,
             *   heading: 120,
             *   updatedAt: ...
             * }
             */


            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                const ref =
                    RX.firebase
                        .rtdb
                        .ref(
                            "liveRides/" +
                            rideId
                        );


                MAP.state.liveRideListener =
                    ref.on(
                        "value",
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
                                data.lat ===
                                undefined ||
                                data.lng ===
                                undefined
                            ) {

                                return;
                            }


                            MAP.setRiderLocation(
                                data.lat,
                                data.lng,
                                {

                                    mapId:
                                        options
                                            .mapId,

                                    name:
                                        options
                                            .name,

                                    follow:
                                        options
                                            .follow
                                }
                            );
                        }
                    );


                return true;
            }


            /*
             * Firestore fallback.
             */

            const db =
                RX.firebase &&
                RX.firebase.db
                    ? RX.firebase.db
                    : null;


            if (!db) {
                return false;
            }


            MAP.state.liveRideListener =
                db
                    .collection(
                        "liveLocations"
                    )
                    .doc(
                        rideId
                    )
                    .onSnapshot(
                        function (
                            doc
                        ) {

                            if (
                                !doc.exists
                            ) {
                                return;
                            }


                            const data =
                                doc.data();


                            if (
                                data.lat ===
                                undefined ||
                                data.lng ===
                                undefined
                            ) {
                                return;
                            }


                            MAP.setRiderLocation(
                                data.lat,
                                data.lng,
                                {

                                    mapId:
                                        options
                                            .mapId,

                                    name:
                                        options
                                            .name,

                                    follow:
                                        options
                                            .follow
                                }
                            );
                        }
                    );


            return true;
        };


    /* ========================================================
       STOP RIDER TRACKING
       ======================================================== */

    MAP.stopRiderTracking =
        function () {

            if (
                typeof MAP.state
                    .liveRideListener ===
                "function"
            ) {

                try {

                    MAP.state
                        .liveRideListener();

                } catch (error) {

                    console.warn(
                        error
                    );
                }
            }


            MAP.state
                .liveRideListener =
                null;


            MAP.state.liveRideId =
                null;
        };


    /* ========================================================
       PUBLISH RIDER LOCATION
       ======================================================== */

    MAP.publishRiderLocation =
        async function (
            rideId,
            lat,
            lng,
            heading
        ) {

            if (
                !rideId
            ) {
                return false;
            }


            const data = {

                lat:
                    Number(lat),

                lng:
                    Number(lng),

                heading:
                    Number(heading) || 0,

                updatedAt:
                    Date.now()
            };


            /*
             * Realtime Database
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    await RX.firebase
                        .rtdb
                        .ref(
                            "liveRides/" +
                            rideId
                        )
                        .set(
                            data
                        );

                    return true;

                } catch (error) {

                    console.warn(
                        "RTDB location update failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            "liveLocations"
                        )
                        .doc(
                            rideId
                        )
                        .set(
                            data,
                            {
                                merge:
                                    true
                            }
                        );

                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore location update failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       RENDER TRIP INFO
       ======================================================== */

    MAP.renderTripInfo =
        function () {

            const distance =
                MAP.state.distanceKm;


            const duration =
                MAP.state.durationMin;


            document
                .querySelectorAll(
                    "[data-map-distance]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            distance
                                .toFixed(1) +
                            " km";
                    }
                );


            document
                .querySelectorAll(
                    "[data-map-duration]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Math.round(
                                duration
                            ) +
                            " min";
                    }
                );


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-trip-info",
                    {
                        detail: {

                            distanceKm:
                                distance,

                            durationMin:
                                duration
                        }
                    }
                )
            );
        };


    /* ========================================================
       GEOCODE
       ======================================================== */

    MAP.searchLocation =
        async function (
            query
        ) {

            query =
                String(
                    query || ""
                ).trim();


            if (
                !query
            ) {
                return [];
            }


            const url =
                MAP.config
                    .geocodingUrl +
                "search?format=jsonv2&limit=5&countrycodes=in&q=" +
                encodeURIComponent(
                    query
                );


            try {

                const response =
                    await fetch(
                        url,
                        {

                            headers: {

                                Accept:
                                    "application/json"
                            }
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Location search failed"
                    );
                }


                const data =
                    await response.json();


                return data.map(
                    function (
                        item
                    ) {

                        return {

                            lat:
                                Number(
                                    item.lat
                                ),

                            lng:
                                Number(
                                    item.lon
                                ),

                            address:
                                item.display_name,

                            name:
                                item.name ||
                                item.display_name
                        };
                    }
                );


            } catch (error) {

                console.error(
                    "Geocoding error:",
                    error
                );

                return [];
            }
        };


    /* ========================================================
       REVERSE GEOCODE
       ======================================================== */

    MAP.reverseGeocode =
        async function (
            lat,
            lng
        ) {

            const url =
                MAP.config
                    .geocodingUrl +
                "reverse?format=jsonv2&lat=" +
                encodeURIComponent(
                    lat
                ) +
                "&lon=" +
                encodeURIComponent(
                    lng
                );


            try {

                const response =
                    await fetch(
                        url
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Reverse geocoding failed"
                    );
                }


                const data =
                    await response.json();


                return {

                    lat:
                        Number(lat),

                    lng:
                        Number(lng),

                    address:
                        data.display_name ||
                        "",

                    name:
                        data.name ||
                        ""
                };


            } catch (error) {

                console.warn(
                    "Reverse geocode error:",
                    error
                );

                return {

                    lat:
                        Number(lat),

                    lng:
                        Number(lng),

                    address:
                        ""
                };
            }
        };


    /* ========================================================
       DISTANCE BETWEEN TWO POINTS
       ======================================================== */

    MAP.distance =
        function (
            lat1,
            lng1,
            lat2,
            lng2
        ) {

            const earthRadius =
                6371;


            const dLat =
                (
                    Number(lat2) -
                    Number(lat1)
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    Number(lng2) -
                    Number(lng1)
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

                Math.cos(
                    Number(lat1) *
                    Math.PI /
                    180
                ) *

                Math.cos(
                    Number(lat2) *
                    Math.PI /
                    180
                ) *

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


            return earthRadius * c;
        };


    /* ========================================================
       BOUNDS
       ======================================================== */

    MAP.fitPoints =
        function (
            points,
            mapId
        ) {

            const instance =
                MAP.get(
                    mapId ||
                    MAP.state
                        .activeMapId
                );


            if (
                !instance ||
                !Array.isArray(points) ||
                !points.length
            ) {

                return;
            }


            const latLngs =
                points.map(
                    function (
                        point
                    ) {

                        return [
                            Number(
                                point.lat
                            ),

                            Number(
                                point.lng
                            )
                        ];
                    }
                );


            const bounds =
                L.latLngBounds(
                    latLngs
                );


            if (
                bounds.isValid()
            ) {

                instance.map.fitBounds(
                    bounds,
                    {

                        padding:
                            [
                                50,
                                50
                            ]
                    }
                );
            }
        };


    /* ========================================================
       MAP CONTROLS
       ======================================================== */

    MAP.addLocateButton =
        function (
            mapId
        ) {

            const instance =
                MAP.get(
                    mapId
                );


            if (!instance) {
                return;
            }


            const control =
                L.control(
                    {
                        position:
                            "bottomright"
                    }
                );


            control.onAdd =
                function () {

                    const button =
                        L.DomUtil
                            .create(
                                "button",
                                "riderx-locate-button"
                            );


                    button.type =
                        "button";


                    button.innerHTML =
                        "⌖";


                    button.title =
                        "My location";


                    L.DomEvent
                        .disableClickPropagation(
                            button
                        );


                    L.DomEvent
                        .on(
                            button,
                            "click",
                            function () {

                                MAP.centerOnUser(
                                    mapId
                                );
                            }
                        );


                    return button;
                };


            control.addTo(
                instance.map
            );
        };


    /* ========================================================
       INITIALIZE ALL MAPS
       ======================================================== */

    MAP.init =
        function () {

            if (
                typeof L ===
                "undefined"
            ) {

                console.warn(
                    "Leaflet not available."
                );

                return;
            }


            document
                .querySelectorAll(
                    "[data-riderx-map]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const mapId =
                            element.id ||
                            (
                                "riderx-map-" +
                                Math.random()
                                    .toString(
                                        36
                                    )
                                    .slice(
                                        2
                                    )
                            );


                        if (
                            !element.id
                        ) {

                            element.id =
                                mapId;
                        }


                        const map =
                            MAP.create(
                                mapId,
                                {
                                    zoomControl:
                                        true
                                }
                            );


                        if (map) {

                            MAP.addLocateButton(
                                mapId
                            );
                        }
                    }
                );


            /*
             * Compatibility:
             * Automatically initialize
             * #map if it exists.
             */

            const defaultMap =
                document.getElementById(
                    "map"
                );


            if (
                defaultMap &&
                !MAP.get("map")
            ) {

                const map =
                    MAP.create(
                        "map"
                    );


                if (map) {

                    MAP.addLocateButton(
                        "map"
                    );
                }
            }


            /*
             * Listen to booking location
             * changes.
             */

            window.addEventListener(
                "riderx-pickup-changed",
                function (
                    event
                ) {

                    const data =
                        event.detail;


                    if (
                        data &&
                        data.lat &&
                        data.lng
                    ) {

                        MAP.setPickup(
                            data.lat,
                            data.lng,
                            data.address
                        );


                        MAP.updateRoute();
                    }
                }
            );


            window.addEventListener(
                "riderx-destination-changed",
                function (
                    event
                ) {

                    const data =
                        event.detail;


                    if (
                        data &&
                        data.lat &&
                        data.lng
                    ) {

                        MAP.setDestination(
                            data.lat,
                            data.lng,
                            data.address
                        );


                        MAP.updateRoute();
                    }
                }
            );


            console.log(
                "RiderX Map Engine loaded."
            );
        };


    /* ========================================================
       CLEANUP
       ======================================================== */

    window.addEventListener(
        "beforeunload",
        function () {

            MAP.stopLocationWatch();

            MAP.stopRiderTracking();
        }
    );


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            MAP.init
        );

    } else {

        MAP.init();
    }


})();
