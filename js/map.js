/* ============================================================
   RIDERX 2.0
   MAP ENGINE
   File: js/map.js

   Features:
   - Leaflet / OpenStreetMap
   - Current GPS location
   - Pickup marker
   - Destination marker
   - Route line
   - Distance + ETA
   - Map auto-fit
   - Rider live location
   - Customer live location
   - Booking.js integration
   - Geolocation fallback
   - Mobile friendly
   - Safe repeated initialization
   - Safe repeated event binding
   - Chandigarh focused geocoding
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.map = RX.map || {};

    const MAP = RX.map;


    /* ========================================================
       CONFIG
       ======================================================== */

    MAP.config = {

        defaultCity:
            "Chandigarh, India",

        defaultCenter: [
            30.7333,
            76.7794
        ],

        defaultZoom:
            13,

        maxZoom:
            19,

        locationZoom:
            16,

        tileUrl:
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        tileAttribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',

        routingUrl:
            "https://router.project-osrm.org/route/v1/driving/",

        geocodingUrl:
            "https://nominatim.openstreetmap.org/search",

        reverseGeocodingUrl:
            "https://nominatim.openstreetmap.org/reverse",

        locationWatch:
            true,

        enableRoute:
            true,

        maxRoutePoints:
            1000,

        routeFitPadding:
            [50, 80],

        routeMaxZoom:
            16
    };


    /* ========================================================
       STATE
       ======================================================== */

    MAP.state = {

        map:
            null,

        initialized:
            false,

        userLocation:
            null,

        pickupLocation:
            null,

        destinationLocation:
            null,

        riderLocation:
            null,

        userMarker:
            null,

        pickupMarker:
            null,

        destinationMarker:
            null,

        riderMarker:
            null,

        routeLine:
            null,

        riderRouteLine:
            null,

        accuracyCircle:
            null,

        watchId:
            null,

        currentRoute:
            null,

        riderCurrentRoute:
            null,

        routeDistance:
            0,

        routeDuration:
            0,

        locating:
            false,

        routing:
            false,

        geocoding:
            false,

        mapSelectionBound:
            false,

        buttonsBound:
            false,

        destroyed:
            false
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    MAP.number =
        function (value) {

            const n =
                Number(value);

            return Number.isFinite(n)
                ? n
                : NaN;
        };


    MAP.round =
        function (value) {

            const number =
                MAP.number(value);

            if (
                !Number.isFinite(number)
            ) {

                return 0;
            }

            return Math.round(
                number * 100
            ) / 100;
        };


    MAP.isLeafletAvailable =
        function () {

            return (
                typeof window.L !==
                "undefined"
            );
        };


    MAP.latLng =
        function (location) {

            if (!location) {
                return null;
            }

            let lat;
            let lng;

            if (
                Array.isArray(location) &&
                location.length >= 2
            ) {

                lat =
                    MAP.number(
                        location[0]
                    );

                lng =
                    MAP.number(
                        location[1]
                    );

            } else {

                lat =
                    MAP.number(
                        location.lat
                    );

                lng =
                    MAP.number(
                        location.lng
                    );
            }


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


            if (
                lat === 0 &&
                lng === 0
            ) {

                return null;
            }


            return [
                lat,
                lng
            ];
        };


    MAP.dispatch =
        function (
            eventName,
            detail
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        eventName,
                        {
                            detail:
                                detail
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX event error:",
                    error
                );
            }
        };


    /* ========================================================
       MAP ELEMENT
       ======================================================== */

    MAP.findMapElement =
        function () {

            const selectors = [

                "#map",

                "#mapContainer",

                ".map-container",

                ".map",

                "[data-map]"
            ];


            for (
                const selector
                of selectors
            ) {

                const element =
                    document.querySelector(
                        selector
                    );


                if (element) {

                    return element;
                }
            }


            return null;
        };


    /* ========================================================
       ICONS
       ======================================================== */

    MAP.createIcon =
        function (type) {

            if (
                !MAP.isLeafletAvailable()
            ) {

                return null;
            }


            let symbol =
                "●";


            if (
                type === "user"
            ) {

                symbol =
                    "●";

            } else if (
                type === "pickup"
            ) {

                symbol =
                    "●";

            } else if (
                type === "destination"
            ) {

                symbol =
                    "◆";

            } else if (
                type === "rider"
            ) {

                symbol =
                    "🏍️";
            }


            return L.divIcon({

                className:
                    "riderx-map-marker",

                html:
                    `
                    <div class="riderx-marker riderx-marker-${type}">
                        <span>${symbol}</span>
                    </div>
                    `,

                iconSize:
                    [42, 42],

                iconAnchor:
                    [21, 38],

                popupAnchor:
                    [0, -38]
            });
        };


    /* ========================================================
       INITIALIZE MAP
       ======================================================== */

    MAP.init =
        function (element) {

            if (
                MAP.state.map &&
                MAP.state.initialized
            ) {

                setTimeout(
                    function () {

                        try {

                            MAP.state.map
                                .invalidateSize();

                        } catch (error) {}

                    },
                    100
                );


                return MAP.state.map;
            }


            if (
                !MAP.isLeafletAvailable()
            ) {

                console.error(
                    "RiderX Map: Leaflet is not loaded."
                );


                return null;
            }


            const mapElement =
                element ||
                MAP.findMapElement();


            if (!mapElement) {

                console.warn(
                    "RiderX Map: Map element not found."
                );


                return null;
            }


            /*
             * Prevent duplicate Leaflet
             * initialization on the same DOM element.
             */

            if (
                mapElement._leaflet_id
            ) {

                try {

                    MAP.state.map =
                        L.map(
                            mapElement
                        );

                    MAP.state.initialized =
                        true;

                    return MAP.state.map;

                } catch (error) {

                    console.warn(
                        "Existing Leaflet map detected.",
                        error
                    );
                }
            }


            MAP.state.map =
                L.map(
                    mapElement,
                    {

                        zoomControl:
                            false,

                        attributionControl:
                            true,

                        preferCanvas:
                            true,

                        tap:
                            true
                    }
                );


            L.tileLayer(
                MAP.config.tileUrl,
                {

                    maxZoom:
                        MAP.config.maxZoom,

                    attribution:
                        MAP.config.tileAttribution
                }
            )
            .addTo(
                MAP.state.map
            );


            MAP.state.map.setView(
                MAP.config.defaultCenter,
                MAP.config.defaultZoom
            );


            L.control
                .zoom({
                    position:
                        "bottomright"
                })
                .addTo(
                    MAP.state.map
                );


            MAP.state.initialized =
                true;


            MAP.state.destroyed =
                false;


            setTimeout(
                function () {

                    if (
                        MAP.state.map
                    ) {

                        try {

                            MAP.state.map
                                .invalidateSize();

                        } catch (error) {}

                    }

                },
                300
            );


            MAP.dispatch(
                "riderx-map-ready",
                MAP.state.map
            );


            return MAP.state.map;
        };


    /* ========================================================
       GET CURRENT LOCATION
       ======================================================== */

    MAP.getCurrentLocation =
        function () {

            return new Promise(
                function (
                    resolve,
                    reject
                ) {

                    if (
                        !navigator.geolocation
                    ) {

                        reject(
                            new Error(
                                "Location is not supported on this device."
                            )
                        );

                        return;
                    }


                    MAP.state.locating =
                        true;


                    navigator.geolocation
                        .getCurrentPosition(

                            function (
                                position
                            ) {

                                MAP.state.locating =
                                    false;


                                const coords =
                                    position.coords;


                                const location = {

                                    lat:
                                        coords.latitude,

                                    lng:
                                        coords.longitude,

                                    accuracy:
                                        coords.accuracy,

                                    heading:
                                        coords.heading,

                                    speed:
                                        coords.speed,

                                    timestamp:
                                        position.timestamp
                                };


                                MAP.state.userLocation =
                                    location;


                                MAP.updateUserMarker(
                                    location
                                );


                                MAP.dispatch(
                                    "riderx-location-updated",
                                    location
                                );


                                resolve(
                                    location
                                );
                            },


                            function (
                                error
                            ) {

                                MAP.state.locating =
                                    false;


                                console.warn(
                                    "RiderX GPS error:",
                                    error
                                );


                                reject(
                                    error
                                );
                            },


                            {

                                enableHighAccuracy:
                                    true,

                                timeout:
                                    15000,

                                maximumAge:
                                    10000
                            }
                        );
                }
            );
        };


    /* ========================================================
       START LOCATION WATCH
       ======================================================== */

    MAP.startLocationWatch =
        function () {

            if (
                !MAP.config.locationWatch
            ) {

                return false;
            }


            if (
                !navigator.geolocation
            ) {

                return false;
            }


            if (
                MAP.state.watchId !==
                null
            ) {

                return true;
            }


            MAP.state.watchId =
                navigator.geolocation
                    .watchPosition(

                        function (
                            position
                        ) {

                            const coords =
                                position.coords;


                            const location = {

                                lat:
                                    coords.latitude,

                                lng:
                                    coords.longitude,

                                accuracy:
                                    coords.accuracy,

                                heading:
                                    coords.heading,

                                speed:
                                    coords.speed,

                                timestamp:
                                    position.timestamp
                            };


                            MAP.state.userLocation =
                                location;


                            MAP.updateUserMarker(
                                location
                            );


                            /*
                             * Only use GPS as pickup
                             * while no pickup exists.
                             */

                            if (
                                !MAP.state
                                    .pickupLocation
                            ) {

                                MAP.setPickup(
                                    location,
                                    false
                                );
                            }


                            MAP.dispatch(
                                "riderx-live-location",
                                location
                            );
                        },


                        function (
                            error
                        ) {

                            console.warn(
                                "RiderX GPS watch error:",
                                error
                            );
                        },


                        {

                            enableHighAccuracy:
                                true,

                            timeout:
                                20000,

                            maximumAge:
                                5000
                        }
                    );


            return true;
        };


    /* ========================================================
       STOP LOCATION WATCH
       ======================================================== */

    MAP.stopLocationWatch =
        function () {

            if (
                MAP.state.watchId !==
                null &&
                navigator.geolocation
            ) {

                try {

                    navigator.geolocation
                        .clearWatch(
                            MAP.state.watchId
                        );

                } catch (error) {

                    console.warn(
                        "Unable to stop GPS watch:",
                        error
                    );
                }
            }


            MAP.state.watchId =
                null;
        };


    /* ========================================================
       USER MARKER
       ======================================================== */

    MAP.updateUserMarker =
        function (location) {

            const map =
                MAP.state.map;


            const position =
                MAP.latLng(
                    location
                );


            if (
                !map ||
                !position
            ) {

                return;
            }


            const icon =
                MAP.createIcon(
                    "user"
                );


            if (
                MAP.state.userMarker
            ) {

                MAP.state.userMarker
                    .setLatLng(
                        position
                    );

            } else {

                MAP.state.userMarker =
                    L.marker(
                        position,
                        {

                            icon:
                                icon,

                            zIndexOffset:
                                900,

                            keyboard:
                                false
                        }
                    )
                    .addTo(
                        map
                    );


                MAP.state.userMarker
                    .bindTooltip(
                        "Your location",
                        {
                            direction:
                                "top"
                        }
                    );
            }


            if (
                Number.isFinite(
                    Number(
                        location.accuracy
                    )
                )
            ) {

                const accuracy =
                    Number(
                        location.accuracy
                    );


                if (
                    MAP.state.accuracyCircle
                ) {

                    MAP.state.accuracyCircle
                        .setLatLng(
                            position
                        )
                        .setRadius(
                            accuracy
                        );

                } else {

                    MAP.state.accuracyCircle =
                        L.circle(
                            position,
                            {

                                radius:
                                    accuracy,

                                interactive:
                                    false,

                                weight:
                                    1,

                                fillOpacity:
                                    0.08
                            }
                        )
                        .addTo(
                            map
                        );
                }
            }
        };


    /* ========================================================
       SET PICKUP
       ======================================================== */

    MAP.setPickup =
        async function (
            location,
            reverseGeocode = true
        ) {

            const position =
                MAP.latLng(
                    location
                );


            if (!position) {

                return null;
            }


            let address =
                location.address ||
                location.name ||
                "";


            if (
                reverseGeocode &&
                !address
            ) {

                try {

                    address =
                        await MAP.reverseGeocode(
                            position[0],
                            position[1]
                        );

                } catch (error) {

                    address =
                        "Current location";
                }
            }


            MAP.state.pickupLocation = {

                lat:
                    position[0],

                lng:
                    position[1],

                address:
                    address ||
                    "Pickup location"
            };


            MAP.updatePickupMarker();


            if (
                RX.booking &&
                typeof RX.booking.setPickup ===
                "function"
            ) {

                try {

                    RX.booking.setPickup(
                        MAP.state.pickupLocation
                    );

                } catch (error) {

                    console.warn(
                        "Booking pickup integration error:",
                        error
                    );
                }
            }


            MAP.dispatch(
                "riderx-pickup-set",
                MAP.state.pickupLocation
            );


            return MAP.state.pickupLocation;
        };


    /* ========================================================
       SET DESTINATION
       ======================================================== */

    MAP.setDestination =
        async function (
            location,
            reverseGeocode = true
        ) {

            const position =
                MAP.latLng(
                    location
                );


            if (!position) {

                return null;
            }


            let address =
                location.address ||
                location.name ||
                "";


            if (
                reverseGeocode &&
                !address
            ) {

                try {

                    address =
                        await MAP.reverseGeocode(
                            position[0],
                            position[1]
                        );

                } catch (error) {

                    address =
                        "Destination";
                }
            }


            MAP.state.destinationLocation = {

                lat:
                    position[0],

                lng:
                    position[1],

                address:
                    address ||
                    "Destination"
            };


            MAP.updateDestinationMarker();


            if (
                RX.booking &&
                typeof RX.booking.setDestination ===
                "function"
            ) {

                try {

                    RX.booking.setDestination(
                        MAP.state.destinationLocation
                    );

                } catch (error) {

                    console.warn(
                        "Booking destination integration error:",
                        error
                    );
                }
            }


            if (
                MAP.config.enableRoute &&
                MAP.state.pickupLocation
            ) {

                await MAP.drawRoute(
                    MAP.state.pickupLocation,
                    MAP.state.destinationLocation
                );
            }


            MAP.dispatch(
                "riderx-destination-set",
                MAP.state.destinationLocation
            );


            return MAP.state.destinationLocation;
        };


    /* ========================================================
       PICKUP MARKER
       ======================================================== */

    MAP.updatePickupMarker =
        function () {

            const map =
                MAP.state.map;


            const pickup =
                MAP.state.pickupLocation;


            const position =
                MAP.latLng(
                    pickup
                );


            if (
                !map ||
                !position
            ) {

                return;
            }


            const icon =
                MAP.createIcon(
                    "pickup"
                );


            if (
                MAP.state.pickupMarker
            ) {

                MAP.state.pickupMarker
                    .setLatLng(
                        position
                    );

            } else {

                MAP.state.pickupMarker =
                    L.marker(
                        position,
                        {

                            icon:
                                icon,

                            draggable:
                                true,

                            zIndexOffset:
                                1000
                        }
                    )
                    .addTo(
                        map
                    );


                MAP.state.pickupMarker
                    .bindPopup(
                        "Pickup location"
                    );


                MAP.state.pickupMarker
                    .on(
                        "dragend",
                        async function (
                            event
                        ) {

                            const point =
                                event.target
                                    .getLatLng();


                            await MAP.setPickup(
                                {

                                    lat:
                                        point.lat,

                                    lng:
                                        point.lng

                                },
                                true
                            );
                        }
                    );
            }


            MAP.state.pickupMarker
                .bindTooltip(
                    pickup.address ||
                    "Pickup",
                    {
                        direction:
                            "top"
                    }
                );
        };


    /* ========================================================
       DESTINATION MARKER
       ======================================================== */

    MAP.updateDestinationMarker =
        function () {

            const map =
                MAP.state.map;


            const destination =
                MAP.state.destinationLocation;


            const position =
                MAP.latLng(
                    destination
                );


            if (
                !map ||
                !position
            ) {

                return;
            }


            const icon =
                MAP.createIcon(
                    "destination"
                );


            if (
                MAP.state.destinationMarker
            ) {

                MAP.state.destinationMarker
                    .setLatLng(
                        position
                    );

            } else {

                MAP.state.destinationMarker =
                    L.marker(
                        position,
                        {

                            icon:
                                icon,

                            draggable:
                                true,

                            zIndexOffset:
                                1000
                        }
                    )
                    .addTo(
                        map
                    );


                MAP.state.destinationMarker
                    .bindPopup(
                        "Destination"
                    );


                MAP.state.destinationMarker
                    .on(
                        "dragend",
                        async function (
                            event
                        ) {

                            const point =
                                event.target
                                    .getLatLng();


                            await MAP.setDestination(
                                {

                                    lat:
                                        point.lat,

                                    lng:
                                        point.lng

                                },
                                true
                            );
                        }
                    );
            }


            MAP.state.destinationMarker
                .bindTooltip(
                    destination.address ||
                    "Destination",
                    {
                        direction:
                            "top"
                    }
                );
        };


    /* ========================================================
       ROUTE
       ======================================================== */

    MAP.drawRoute =
        async function (
            pickup,
            destination
        ) {

            const start =
                MAP.latLng(
                    pickup
                );


            const end =
                MAP.latLng(
                    destination
                );


            if (
                !start ||
                !end ||
                !MAP.state.map
            ) {

                return null;
            }


            MAP.state.routing =
                true;


            try {

                const url =
                    MAP.config.routingUrl +
                    start[1] +
                    "," +
                    start[0] +
                    ";" +
                    end[1] +
                    "," +
                    end[0] +
                    "?overview=full&geometries=geojson";


                const response =
                    await fetch(
                        url,
                        {
                            method:
                                "GET"
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Route service unavailable."
                    );
                }


                const data =
                    await response.json();


                if (
                    !data.routes ||
                    !data.routes.length
                ) {

                    throw new Error(
                        "No route found."
                    );
                }


                const route =
                    data.routes[0];


                MAP.state.currentRoute =
                    route;


                MAP.state.routeDistance =
                    MAP.round(
                        Number(route.distance || 0) /
                        1000
                    );


                MAP.state.routeDuration =
                    MAP.round(
                        Number(route.duration || 0) /
                        60
                    );


                let coordinates =
                    route.geometry &&
                    route.geometry.coordinates
                        ? route.geometry.coordinates
                            .map(
                                function (point) {

                                    return [
                                        point[1],
                                        point[0]
                                    ];
                                }
                            )
                        : [];


                if (
                    MAP.config.maxRoutePoints &&
                    coordinates.length >
                    MAP.config.maxRoutePoints
                ) {

                    const step =
                        Math.ceil(
                            coordinates.length /
                            MAP.config.maxRoutePoints
                        );


                    coordinates =
                        coordinates.filter(
                            function (
                                point,
                                index
                            ) {

                                return (
                                    index %
                                    step ===
                                    0
                                );
                            }
                        );
                }


                if (
                    !coordinates.length
                ) {

                    throw new Error(
                        "Route geometry unavailable."
                    );
                }


                if (
                    MAP.state.routeLine
                ) {

                    MAP.state.routeLine
                        .setLatLngs(
                            coordinates
                        );

                } else {

                    MAP.state.routeLine =
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
                        )
                        .addTo(
                            MAP.state.map
                        );
                }


                MAP.fitRoute();


                /*
                 * Booking integration.
                 */

                if (
                    RX.booking &&
                    RX.booking.state
                ) {

                    RX.booking.state.distanceKm =
                        MAP.state.routeDistance;

                    RX.booking.state.durationMin =
                        MAP.state.routeDuration;


                    if (
                        typeof RX.booking.recalculate ===
                        "function"
                    ) {

                        try {

                            RX.booking.recalculate();

                        } catch (error) {

                            console.warn(
                                "Booking recalculation error:",
                                error
                            );
                        }
                    }
                }


                MAP.dispatch(
                    "riderx-route-updated",
                    {

                        distanceKm:
                            MAP.state.routeDistance,

                        durationMin:
                            MAP.state.routeDuration,

                        route:
                            route
                    }
                );


                return route;

            } catch (error) {

                console.warn(
                    "RiderX route error:",
                    error
                );


                MAP.drawFallbackRoute(
                    start,
                    end
                );


                return null;

            } finally {

                MAP.state.routing =
                    false;
            }
        };


    /* ========================================================
       FALLBACK ROUTE
       ======================================================== */

    MAP.drawFallbackRoute =
        function (
            start,
            end
        ) {

            if (
                !MAP.state.map
            ) {

                return;
            }


            const points = [

                start,

                end
            ];


            if (
                MAP.state.routeLine
            ) {

                MAP.state.routeLine
                    .setLatLngs(
                        points
                    );

            } else {

                MAP.state.routeLine =
                    L.polyline(
                        points,
                        {

                            weight:
                                5,

                            opacity:
                                0.75,

                            dashArray:
                                "10 10"
                        }
                    )
                    .addTo(
                        MAP.state.map
                    );
            }


            const distance =
                MAP.calculateDistance(
                    start[0],
                    start[1],
                    end[0],
                    end[1]
                );


            const duration =
                Math.max(
                    5,
                    distance * 3
                );


            MAP.state.routeDistance =
                MAP.round(
                    distance
                );


            MAP.state.routeDuration =
                MAP.round(
                    duration
                );


            if (
                RX.booking &&
                RX.booking.state
            ) {

                RX.booking.state.distanceKm =
                    MAP.state.routeDistance;

                RX.booking.state.durationMin =
                    MAP.state.routeDuration;


                if (
                    typeof RX.booking.recalculate ===
                    "function"
                ) {

                    try {

                        RX.booking.recalculate();

                    } catch (error) {

                        console.warn(
                            "Booking fallback recalculation error:",
                            error
                        );
                    }
                }
            }


            MAP.dispatch(
                "riderx-route-updated",
                {

                    distanceKm:
                        MAP.state.routeDistance,

                    durationMin:
                        MAP.state.routeDuration,

                    fallback:
                        true
                }
            );


            MAP.fitRoute();
        };


    /* ========================================================
       FIT ROUTE
       ======================================================== */

    MAP.fitRoute =
        function () {

            if (
                !MAP.state.map
            ) {

                return;
            }


            const points = [];


            if (
                MAP.state.pickupLocation
            ) {

                const pickup =
                    MAP.latLng(
                        MAP.state.pickupLocation
                    );


                if (pickup) {
                    points.push(pickup);
                }
            }


            if (
                MAP.state.destinationLocation
            ) {

                const destination =
                    MAP.latLng(
                        MAP.state.destinationLocation
                    );


                if (destination) {
                    points.push(destination);
                }
            }


            if (
                MAP.state.riderLocation
            ) {

                const rider =
                    MAP.latLng(
                        MAP.state.riderLocation
                    );


                if (rider) {
                    points.push(rider);
                }
            }


            if (
                points.length === 1
            ) {

                MAP.state.map
                    .setView(
                        points[0],
                        MAP.config.locationZoom
                    );


                return;
            }


            if (
                points.length > 1
            ) {

                MAP.state.map
                    .fitBounds(
                        L.latLngBounds(
                            points
                        ),
                        {

                            padding:
                                MAP.config
                                    .routeFitPadding,

                            maxZoom:
                                MAP.config.routeMaxZoom
                        }
                    );
            }
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    MAP.calculateDistance =
        function (
            lat1,
            lng1,
            lat2,
            lng2
        ) {

            lat1 =
                MAP.number(lat1);

            lng1 =
                MAP.number(lng1);

            lat2 =
                MAP.number(lat2);

            lng2 =
                MAP.number(lng2);


            if (
                !Number.isFinite(lat1) ||
                !Number.isFinite(lng1) ||
                !Number.isFinite(lat2) ||
                !Number.isFinite(lng2)
            ) {

                return 0;
            }


            const R =
                6371;


            const dLat =
                (
                    lat2 -
                    lat1
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    lng2 -
                    lng1
                ) *
                Math.PI /
                180;


            const a =
                Math.sin(
                    dLat / 2
                ) ** 2 +

                Math.cos(
                    lat1 *
                    Math.PI /
                    180
                ) *

                Math.cos(
                    lat2 *
                    Math.PI /
                    180
                ) *

                Math.sin(
                    dLng / 2
                ) ** 2;


            const c =
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(
                        1 - a
                    )
                );


            return R * c;
        };


    /* ========================================================
       GEOCODING
       ======================================================== */

    MAP.searchLocation =
        async function (
            query
        ) {

            query =
                String(
                    query || ""
                )
                .trim();


            if (!query) {

                return [];
            }


            MAP.state.geocoding =
                true;


            try {

                const searchQuery =
                    query.toLowerCase()
                        .includes("chandigarh")
                        ? query
                        : query +
                          ", Chandigarh, India";


                const url =
                    MAP.config.geocodingUrl +
                    "?format=json" +
                    "&limit=5" +
                    "&countrycodes=in" +
                    "&q=" +
                    encodeURIComponent(
                        searchQuery
                    );


                const response =
                    await fetch(
                        url,
                        {

                            method:
                                "GET",

                            headers: {

                                "Accept":
                                    "application/json"
                            }
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Location search failed."
                    );
                }


                const results =
                    await response.json();


                return results.map(
                    function (
                        item
                    ) {

                        return {

                            lat:
                                MAP.number(
                                    item.lat
                                ),

                            lng:
                                MAP.number(
                                    item.lon
                                ),

                            address:
                                item.display_name,

                            name:
                                item.display_name
                        };
                    }
                )
                .filter(
                    function (item) {

                        return (
                            Number.isFinite(
                                item.lat
                            ) &&
                            Number.isFinite(
                                item.lng
                            )
                        );
                    }
                );

            } catch (error) {

                console.error(
                    "RiderX geocoding error:",
                    error
                );


                return [];

            } finally {

                MAP.state.geocoding =
                    false;
            }
        };


    /* ========================================================
       REVERSE GEOCODING
       ======================================================== */

    MAP.reverseGeocode =
        async function (
            lat,
            lng
        ) {

            if (
                !Number.isFinite(
                    Number(lat)
                ) ||
                !Number.isFinite(
                    Number(lng)
                )
            ) {

                return "Selected location";
            }


            try {

                const url =
                    MAP.config
                        .reverseGeocodingUrl +
                    "?format=json" +
                    "&lat=" +
                    encodeURIComponent(lat) +
                    "&lon=" +
                    encodeURIComponent(lng);


                const response =
                    await fetch(
                        url,
                        {

                            method:
                                "GET",

                            headers: {

                                "Accept":
                                    "application/json"
                            }
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Reverse geocoding failed."
                    );
                }


                const data =
                    await response.json();


                return (
                    data.display_name ||
                    "Selected location"
                );

            } catch (error) {

                console.warn(
                    "RiderX reverse geocoding error:",
                    error
                );


                return "Selected location";
            }
        };


    /* ========================================================
       RIDER LIVE LOCATION
       ======================================================== */

    MAP.setRiderLocation =
        function (
            location,
            follow = false
        ) {

            const position =
                MAP.latLng(
                    location
                );


            if (
                !position ||
                !MAP.state.map
            ) {

                return;
            }


            MAP.state.riderLocation = {

                lat:
                    position[0],

                lng:
                    position[1],

                heading:
                    Number.isFinite(
                        Number(
                            location.heading
                        )
                    )
                    ? Number(
                        location.heading
                    )
                    : null
            };


            const icon =
                MAP.createIcon(
                    "rider"
                );


            if (
                MAP.state.riderMarker
            ) {

                MAP.state.riderMarker
                    .setLatLng(
                        position
                    );

            } else {

                MAP.state.riderMarker =
                    L.marker(
                        position,
                        {

                            icon:
                                icon,

                            zIndexOffset:
                                1200
                        }
                    )
                    .addTo(
                        MAP.state.map
                    );


                MAP.state.riderMarker
                    .bindTooltip(
                        "Rider",
                        {
                            direction:
                                "top"
                        }
                    );
            }


            /*
             * Update rider icon rotation
             * when heading is available.
             */

            if (
                location.heading !== null &&
                location.heading !== undefined
            ) {

                const markerElement =
                    MAP.state.riderMarker
                        .getElement();


                if (
                    markerElement
                ) {

                    const marker =
                        markerElement
                            .querySelector(
                                ".riderx-marker"
                            );


                    if (marker) {

                        marker.style
                            .transform =
                            "rotate(" +
                            Number(
                                location.heading
                            ) +
                            "deg)";
                    }
                }
            }


            if (follow) {

                MAP.state.map
                    .panTo(
                        position,
                        {
                            animate:
                                true,

                            duration:
                                0.5
                        }
                    );
            }


            MAP.dispatch(
                "riderx-rider-location-updated",
                MAP.state.riderLocation
            );
        };


    /* ========================================================
       DRAW RIDER → PICKUP ROUTE
       ======================================================== */

    MAP.drawRiderRoute =
        async function () {

            const rider =
                MAP.state.riderLocation;


            const pickup =
                MAP.state.pickupLocation;


            if (
                !rider ||
                !pickup
            ) {

                return null;
            }


            const start =
                MAP.latLng(
                    rider
                );


            const end =
                MAP.latLng(
                    pickup
                );


            if (
                !start ||
                !end ||
                !MAP.state.map
            ) {

                return null;
            }


            try {

                const url =
                    MAP.config.routingUrl +
                    start[1] +
                    "," +
                    start[0] +
                    ";" +
                    end[1] +
                    "," +
                    end[0] +
                    "?overview=full&geometries=geojson";


                const response =
                    await fetch(
                        url
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Rider route unavailable."
                    );
                }


                const data =
                    await response.json();


                if (
                    !data.routes ||
                    !data.routes.length
                ) {

                    return null;
                }


                const route =
                    data.routes[0];


                MAP.state.riderCurrentRoute =
                    route;


                let coordinates =
                    route.geometry &&
                    route.geometry.coordinates
                        ? route.geometry.coordinates
                            .map(
                                function (
                                    point
                                ) {

                                    return [
                                        point[1],
                                        point[0]
                                    ];
                                }
                            )
                        : [];


                if (
                    MAP.config.maxRoutePoints &&
                    coordinates.length >
                    MAP.config.maxRoutePoints
                ) {

                    const step =
                        Math.ceil(
                            coordinates.length /
                            MAP.config.maxRoutePoints
                        );


                    coordinates =
                        coordinates.filter(
                            function (
                                point,
                                index
                            ) {

                                return (
                                    index %
                                    step ===
                                    0
                                );
                            }
                        );
                }


                if (
                    !coordinates.length
                ) {

                    return null;
                }


                if (
                    MAP.state.riderRouteLine
                ) {

                    MAP.state.riderRouteLine
                        .setLatLngs(
                            coordinates
                        );

                } else {

                    MAP.state.riderRouteLine =
                        L.polyline(
                            coordinates,
                            {

                                weight:
                                    4,

                                opacity:
                                    0.75,

                                dashArray:
                                    "8 7",

                                lineCap:
                                    "round",

                                lineJoin:
                                    "round"
                            }
                        )
                        .addTo(
                            MAP.state.map
                        );
                }


                MAP.dispatch(
                    "riderx-rider-route-updated",
                    {

                        distanceKm:
                            MAP.round(
                                route.distance /
                                1000
                            ),

                        durationMin:
                            MAP.round(
                                route.duration /
                                60
                            ),

                        route:
                            route
                    }
                );


                return route;

            } catch (error) {

                console.warn(
                    "RiderX rider route failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       CENTER USER
       ======================================================== */

    MAP.centerOnUser =
        async function () {

            try {

                const location =
                    MAP.state.userLocation ||
                    await MAP.getCurrentLocation();


                const position =
                    MAP.latLng(
                        location
                    );


                if (
                    position &&
                    MAP.state.map
                ) {

                    MAP.state.map
                        .setView(
                            position,
                            MAP.config.locationZoom,
                            {
                                animate:
                                    true
                            }
                        );
                }


                return location;

            } catch (error) {

                console.warn(
                    "Unable to center user:",
                    error
                );


                /*
                 * Fallback to Chandigarh.
                 */

                if (
                    MAP.state.map
                ) {

                    MAP.state.map
                        .setView(
                            MAP.config.defaultCenter,
                            MAP.config.defaultZoom
                        );
                }


                return null;
            }
        };


    /* ========================================================
       CLEAR ROUTE
       ======================================================== */

    MAP.clearRoute =
        function () {

            if (
                MAP.state.routeLine &&
                MAP.state.map
            ) {

                try {

                    MAP.state.map
                        .removeLayer(
                            MAP.state.routeLine
                        );

                } catch (error) {}
            }


            MAP.state.routeLine =
                null;


            MAP.state.currentRoute =
                null;


            MAP.state.routeDistance =
                0;


            MAP.state.routeDuration =
                0;


            MAP.dispatch(
                "riderx-route-cleared"
            );
        };


    /* ========================================================
       CLEAR BOOKING
       ======================================================== */

    MAP.clearBooking =
        function () {

            const map =
                MAP.state.map;


            if (
                map &&
                MAP.state.pickupMarker
            ) {

                try {

                    map.removeLayer(
                        MAP.state.pickupMarker
                    );

                } catch (error) {}
            }


            if (
                map &&
                MAP.state.destinationMarker
            ) {

                try {

                    map.removeLayer(
                        MAP.state.destinationMarker
                    );

                } catch (error) {}
            }


            if (
                map &&
                MAP.state.riderMarker
            ) {

                try {

                    map.removeLayer(
                        MAP.state.riderMarker
                    );

                } catch (error) {}
            }


            if (
                map &&
                MAP.state.riderRouteLine
            ) {

                try {

                    map.removeLayer(
                        MAP.state.riderRouteLine
                    );

                } catch (error) {}
            }


            MAP.state.pickupMarker =
                null;


            MAP.state.destinationMarker =
                null;


            MAP.state.riderMarker =
                null;


            MAP.state.riderRouteLine =
                null;


            MAP.state.pickupLocation =
                null;


            MAP.state.destinationLocation =
                null;


            MAP.state.riderLocation =
                null;


            MAP.state.riderCurrentRoute =
                null;


            MAP.clearRoute();


            MAP.dispatch(
                "riderx-booking-map-cleared"
            );
        };


    /* ========================================================
       MAP CLICK SELECTION
       ======================================================== */

    MAP.enableMapSelection =
        function () {

            if (
                !MAP.state.map
            ) {

                return false;
            }


            /*
             * Prevent duplicate click listeners.
             */

            if (
                MAP.state.mapSelectionBound
            ) {

                return true;
            }


            MAP.state.mapSelectionBound =
                true;


            MAP.state.map.on(
                "click",
                async function (
                    event
                ) {

                    if (
                        !event ||
                        !event.latlng
                    ) {

                        return;
                    }


                    /*
                     * First click = pickup.
                     * Second click = destination.
                     */

                    if (
                        !MAP.state.pickupLocation
                    ) {

                        await MAP.setPickup(
                            {

                                lat:
                                    event.latlng.lat,

                                lng:
                                    event.latlng.lng
                            }
                        );

                    } else {

                        await MAP.setDestination(
                            {

                                lat:
                                    event.latlng.lat,

                                lng:
                                    event.latlng.lng
                            }
                        );
                    }
                }
            );


            return true;
        };


    /* ========================================================
       BUTTON EVENTS
       ======================================================== */

    MAP.bindButtons =
        function () {

            if (
                MAP.state.buttonsBound
            ) {

                return;
            }


            MAP.state.buttonsBound =
                true;


            document
                .querySelectorAll(
                    "[data-current-location]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.addEventListener(
                            "click",
                            function () {

                                MAP.centerOnUser();

                            }
                        );
                    }
                );


            document
                .querySelectorAll(
                    "[data-map-pickup]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.addEventListener(
                            "click",
                            async function () {

                                const location =
                                    await MAP
                                        .centerOnUser();


                                if (
                                    location
                                ) {

                                    await MAP.setPickup(
                                        location
                                    );
                                }
                            }
                        );
                    }
                );
        };


    /* ========================================================
       RESIZE MAP
       ======================================================== */

    MAP.invalidateSize =
        function () {

            if (
                MAP.state.map
            ) {

                setTimeout(
                    function () {

                        try {

                            MAP.state.map
                                .invalidateSize();

                        } catch (error) {}

                    },
                    100
                );
            }
        };


    /* ========================================================
       START MAP + GPS
       ======================================================== */

    MAP.start =
        async function (
            element
        ) {

            const map =
                MAP.init(
                    element
                );


            if (!map) {

                return null;
            }


            MAP.bindButtons();

            MAP.enableMapSelection();


            /*
             * Try GPS.
             */

            try {

                await MAP.getCurrentLocation();


                MAP.startLocationWatch();

            } catch (error) {

                console.warn(
                    "RiderX GPS permission not available:",
                    error
                );


                /*
                 * Map still works without GPS.
                 */

                if (
                    MAP.state.map
                ) {

                    MAP.state.map
                        .setView(
                            MAP.config.defaultCenter,
                            MAP.config.defaultZoom
                        );
                }
            }


            MAP.invalidateSize();


            return map;
        };


    /* ========================================================
       BOOKING EVENTS
       ======================================================== */

    window.addEventListener(
        "riderx-pickup-changed",
        function (
            event
        ) {

            if (
                event.detail
            ) {

                MAP.state.pickupLocation =
                    event.detail;


                MAP.updatePickupMarker();


                if (
                    MAP.state.destinationLocation
                ) {

                    MAP.drawRoute(
                        MAP.state.pickupLocation,
                        MAP.state.destinationLocation
                    );
                }
            }
        }
    );


    window.addEventListener(
        "riderx-destination-changed",
        function (
            event
        ) {

            if (
                event.detail
            ) {

                MAP.state.destinationLocation =
                    event.detail;


                MAP.updateDestinationMarker();


                if (
                    MAP.state.pickupLocation
                ) {

                    MAP.drawRoute(
                        MAP.state.pickupLocation,
                        MAP.state.destinationLocation
                    );
                }
            }
        }
    );


    window.addEventListener(
        "riderx-ride-accepted",
        function (
            event
        ) {

            const ride =
                event.detail;


            if (!ride) {

                return;
            }


            const riderLat =
                ride.riderLat ??
                ride.riderLatitude;


            const riderLng =
                ride.riderLng ??
                ride.riderLongitude;


            if (
                riderLat !== undefined &&
                riderLng !== undefined
            ) {

                MAP.setRiderLocation(
                    {

                        lat:
                            riderLat,

                        lng:
                            riderLng,

                        heading:
                            ride.riderHeading
                    },
                    false
                );


                MAP.drawRiderRoute();
            }
        }
    );


    /*
     * Firebase/live rider update compatibility.
     */

    window.addEventListener(
        "riderx-rider-location",
        function (
            event
        ) {

            if (
                event.detail
            ) {

                MAP.setRiderLocation(
                    event.detail,
                    false
                );


                MAP.drawRiderRoute();
            }
        }
    );


    window.addEventListener(
        "riderx-ride-cancelled",
        function () {

            MAP.clearBooking();

        }
    );


    window.addEventListener(
        "riderx-ride-completed",
        function () {

            /*
             * Keep final route visible.
             * Next booking clears it.
             */

            MAP.stopLocationWatch();

        }
    );


    /* ========================================================
       PAGE VISIBILITY
       ======================================================== */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState ===
                "visible"
            ) {

                MAP.invalidateSize();
            }
        }
    );


    window.addEventListener(
        "resize",
        function () {

            MAP.invalidateSize();

        }
    );


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.initMap =
        MAP.init;


    RX.startMap =
        MAP.start;


    RX.getCurrentLocation =
        MAP.getCurrentLocation;


    RX.startLocationWatch =
        MAP.startLocationWatch;


    RX.stopLocationWatch =
        MAP.stopLocationWatch;


    RX.setPickupLocation =
        MAP.setPickup;


    RX.setDestinationLocation =
        MAP.setDestination;


    RX.searchLocation =
        MAP.searchLocation;


    RX.reverseGeocode =
        MAP.reverseGeocode;


    RX.setRiderLocation =
        MAP.setRiderLocation;


    RX.drawRoute =
        MAP.drawRoute;


    RX.drawRiderRoute =
        MAP.drawRiderRoute;


    RX.centerOnUser =
        MAP.centerOnUser;


    RX.invalidateMap =
        MAP.invalidateSize;


    RX.clearMapBooking =
        MAP.clearBooking;


    /* ========================================================
       AUTO INIT
       ======================================================== */

    function autoInit() {

        const mapElement =
            MAP.findMapElement();


        /*
         * Do not initialize on pages
         * without a map.
         */

        if (
            mapElement
        ) {

            MAP.start(
                mapElement
            );
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            autoInit,
            {
                once:
                    true
            }
        );

    } else {

        autoInit();
    }


    console.log(
        "RiderX Map Engine 2.0 loaded."
    );

})();
