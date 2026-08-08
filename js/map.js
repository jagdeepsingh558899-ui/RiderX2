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
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',

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
            1000
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

        routeDistance:
            0,

        routeDuration:
            0,

        locating:
            false,

        routing:
            false,

        geocoding:
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
                : 0;
        };


    MAP.round =
        function (value) {

            return Math.round(
                MAP.number(value) *
                100
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
        function (
            location
        ) {

            if (!location) {
                return null;
            }


            const lat =
                MAP.number(
                    location.lat
                );


            const lng =
                MAP.number(
                    location.lng
                );


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng) ||
                (
                    lat === 0 &&
                    lng === 0
                )
            ) {

                return null;
            }


            return [
                lat,
                lng
            ];
        };


    /* ========================================================
       MAP ELEMENT
       ======================================================== */

    MAP.findMapElement =
        function () {

            const selectors = [

                "#map",

                "#mapContainer",

                ".map",

                ".map-container",

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
        function (
            type
        ) {

            if (
                !MAP.isLeafletAvailable()
            ) {

                return null;
            }


            let emoji =
                "📍";


            if (
                type ===
                "user"
            ) {

                emoji =
                    "●";

            } else if (
                type ===
                "pickup"
            ) {

                emoji =
                    "●";

            } else if (
                type ===
                "destination"
            ) {

                emoji =
                    "◆";

            } else if (
                type ===
                "rider"
            ) {

                emoji =
                    "🏍️";
            }


            return L.divIcon({

                className:
                    "riderx-map-marker",

                html:
                    `
                    <div class="riderx-marker riderx-marker-${type}">
                        <span>${emoji}</span>
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
       INITIALIZE
       ======================================================== */

    MAP.init =
        function (
            element
        ) {

            if (
                MAP.state.initialized &&
                MAP.state.map
            ) {

                setTimeout(
                    function () {

                        MAP.state.map
                            .invalidateSize();

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


            MAP.state.map =
                L.map(
                    mapElement,
                    {

                        zoomControl:
                            false,

                        attributionControl:
                            true,

                        preferCanvas:
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


            /*
             * Custom zoom control.
             */

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


            /*
             * Fix maps inside hidden
             * sheets / tabs.
             */

            setTimeout(
                function () {

                    if (
                        MAP.state.map
                    ) {

                        MAP.state.map
                            .invalidateSize();
                    }

                },
                300
            );


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-map-ready",
                    {
                        detail:
                            MAP.state.map
                    }
                )
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
                                "Location is not supported."
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


                                MAP.state
                                    .userLocation =
                                    location;


                                MAP.updateUserMarker(
                                    location
                                );


                                window.dispatchEvent(
                                    new CustomEvent(
                                        "riderx-location-updated",
                                        {
                                            detail:
                                                location
                                        }
                                    )
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
                                    "Location error:",
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
       WATCH LOCATION
       ======================================================== */

    MAP.startLocationWatch =
        function () {

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
                                        .accuracy,

                                heading:
                                    position
                                        .coords
                                        .heading,

                                speed:
                                    position
                                        .coords
                                        .speed
                            };


                            MAP.state
                                .userLocation =
                                location;


                            MAP.updateUserMarker(
                                location
                            );


                            /*
                             * If pickup has not
                             * been manually selected,
                             * use current location.
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


                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx-live-location",
                                    {
                                        detail:
                                            location
                                    }
                                )
                            );
                        },

                        function (
                            error
                        ) {

                            console.warn(
                                "GPS watch error:",
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

                navigator.geolocation
                    .clearWatch(
                        MAP.state.watchId
                    );
            }


            MAP.state.watchId =
                null;
        };


    /* ========================================================
       USER MARKER
       ======================================================== */

    MAP.updateUserMarker =
        function (
            location
        ) {

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
                                900
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


            /*
             * Accuracy circle.
             */

            if (
                location.accuracy
            ) {

                if (
                    MAP.state
                        .accuracyCircle
                ) {

                    MAP.state
                        .accuracyCircle
                        .setLatLng(
                            position
                        )
                        .setRadius(
                            location.accuracy
                        );

                } else {

                    MAP.state
                        .accuracyCircle =
                        L.circle(
                            position,
                            {

                                radius:
                                    location
                                        .accuracy,

                                interactive:
                                    false
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


            /*
             * Connect to booking.js
             */

            if (
                RX.booking &&
                typeof RX.booking
                    .setPickup ===
                "function"
            ) {

                RX.booking.setPickup(
                    MAP.state
                        .pickupLocation
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-pickup-set",
                    {
                        detail:
                            MAP.state
                                .pickupLocation
                    }
                )
            );


            return MAP.state
                .pickupLocation;
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


            MAP.state
                .destinationLocation = {

                lat:
                    position[0],

                lng:
                    position[1],

                address:
                    address ||
                    "Destination"
            };


            MAP.updateDestinationMarker();


            /*
             * Connect to booking.js
             */

            if (
                RX.booking &&
                typeof RX.booking
                    .setDestination ===
                "function"
            ) {

                RX.booking.setDestination(
                    MAP.state
                        .destinationLocation
                );
            }


            /*
             * Draw route.
             */

            if (
                MAP.config.enableRoute &&
                MAP.state.pickupLocation
            ) {

                await MAP.drawRoute(
                    MAP.state.pickupLocation,
                    MAP.state.destinationLocation
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-destination-set",
                    {
                        detail:
                            MAP.state
                                .destinationLocation
                    }
                )
            );


            return MAP.state
                .destinationLocation;
        };


    /* ========================================================
       PICKUP MARKER
       ======================================================== */

    MAP.updatePickupMarker =
        function () {

            const map =
                MAP.state.map;


            const position =
                MAP.latLng(
                    MAP.state
                        .pickupLocation
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

                            const position =
                                event.target
                                    .getLatLng();


                            await MAP.setPickup(
                                {

                                    lat:
                                        position
                                            .lat,

                                    lng:
                                        position
                                            .lng

                                }
                            );
                        }
                    );
            }


            MAP.state.pickupMarker
                .bindTooltip(
                    MAP.state
                        .pickupLocation
                        .address ||
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


            const position =
                MAP.latLng(
                    MAP.state
                        .destinationLocation
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
                MAP.state
                    .destinationMarker
            ) {

                MAP.state
                    .destinationMarker
                    .setLatLng(
                        position
                    );

            } else {

                MAP.state
                    .destinationMarker =
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


                MAP.state
                    .destinationMarker
                    .bindPopup(
                        "Destination"
                    );


                MAP.state
                    .destinationMarker
                    .on(
                        "dragend",
                        async function (
                            event
                        ) {

                            const position =
                                event.target
                                    .getLatLng();


                            await MAP
                                .setDestination(
                                    {

                                        lat:
                                            position
                                                .lat,

                                        lng:
                                            position
                                                .lng

                                    }
                                );
                        }
                    );
            }


            MAP.state
                .destinationMarker
                .bindTooltip(
                    MAP.state
                        .destinationLocation
                        .address ||
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
                !end
            ) {

                return null;
            }


            if (
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
                        url
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
                        route.distance /
                        1000
                    );


                MAP.state.routeDuration =
                    MAP.round(
                        route.duration /
                        60
                    );


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


                /*
                 * Fit route.
                 */

                MAP.fitRoute();


                /*
                 * Update booking engine.
                 */

                if (
                    RX.booking
                ) {

                    RX.booking.state
                        .distanceKm =
                        MAP.state
                            .routeDistance;

                    RX.booking.state
                        .durationMin =
                        MAP.state
                            .routeDuration;


                    if (
                        typeof RX.booking
                            .recalculate ===
                        "function"
                    ) {

                        RX.booking
                            .recalculate();
                    }
                }


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-route-updated",
                        {
                            detail: {

                                distanceKm:
                                    MAP.state
                                        .routeDistance,

                                durationMin:
                                    MAP.state
                                        .routeDuration,

                                route:
                                    route
                            }
                        }
                    )
                );


                return route;

            } catch (error) {

                console.warn(
                    "Route error:",
                    error
                );


                /*
                 * Fallback straight line.
                 */

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
                RX.booking
            ) {

                RX.booking.state
                    .distanceKm =
                    MAP.state
                        .routeDistance;

                RX.booking.state
                    .durationMin =
                    MAP.state
                        .routeDuration;


                if (
                    typeof RX.booking
                        .recalculate ===
                    "function"
                ) {

                    RX.booking
                        .recalculate();
                }
            }


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

                points.push(
                    MAP.latLng(
                        MAP.state
                            .pickupLocation
                    )
                );
            }


            if (
                MAP.state.destinationLocation
            ) {

                points.push(
                    MAP.latLng(
                        MAP.state
                            .destinationLocation
                    )
                );
            }


            if (
                MAP.state.riderLocation
            ) {

                points.push(
                    MAP.latLng(
                        MAP.state
                            .riderLocation
                    )
                );
            }


            const validPoints =
                points.filter(
                    Boolean
                );


            if (
                validPoints.length === 1
            ) {

                MAP.state.map
                    .setView(
                        validPoints[0],
                        MAP.config
                            .locationZoom
                    );


                return;
            }


            if (
                validPoints.length > 1
            ) {

                MAP.state.map
                    .fitBounds(
                        L.latLngBounds(
                            validPoints
                        ),
                        {

                            padding:
                                [50, 50],

                            maxZoom:
                                16
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
                    Math.sqrt(1 - a)
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


            if (
                !query
            ) {

                return [];
            }


            MAP.state.geocoding =
                true;


            try {

                const url =
                    MAP.config
                        .geocodingUrl +
                    "?format=json" +
                    "&limit=5" +
                    "&countrycodes=in" +
                    "&q=" +
                    encodeURIComponent(
                        query +
                        ", Chandigarh, India"
                    );


                const response =
                    await fetch(
                        url,
                        {

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
                );

            } catch (error) {

                console.error(
                    "Geocoding error:",
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

            try {

                const url =
                    MAP.config
                        .reverseGeocodingUrl +
                    "?format=json" +
                    "&lat=" +
                    encodeURIComponent(
                        lat
                    ) +
                    "&lon=" +
                    encodeURIComponent(
                        lng
                    );


                const response =
                    await fetch(
                        url,
                        {

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
                    "Reverse geocoding error:",
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
                    location.heading ||
                    null
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


            if (
                follow
            ) {

                MAP.state.map
                    .panTo(
                        position,
                        {
                            animate:
                                true
                        }
                    );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-rider-location-updated",
                    {
                        detail:
                            MAP.state
                                .riderLocation
                    }
                )
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
                !end
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
                    MAP.state
                        .riderRouteLine
                ) {

                    MAP.state
                        .riderRouteLine
                        .setLatLngs(
                            coordinates
                        );

                } else {

                    MAP.state
                        .riderRouteLine =
                        L.polyline(
                            coordinates,
                            {

                                weight:
                                    4,

                                opacity:
                                    0.75,

                                dashArray:
                                    "8 7"
                            }
                        )
                        .addTo(
                            MAP.state.map
                        );
                }


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-rider-route-updated",
                        {
                            detail: {

                                distanceKm:
                                    MAP.round(
                                        route.distance /
                                        1000
                                    ),

                                durationMin:
                                    MAP.round(
                                        route.duration /
                                        60
                                    )
                            }
                        }
                    )
                );


                return route;

            } catch (error) {

                console.warn(
                    "Rider route failed:",
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
                    MAP.state
                        .userLocation ||
                    await MAP
                        .getCurrentLocation();


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
                            MAP.config
                                .locationZoom
                        );
                }


                return location;

            } catch (error) {

                console.warn(
                    "Unable to center user:",
                    error
                );


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

                MAP.state.map
                    .removeLayer(
                        MAP.state.routeLine
                    );
            }


            MAP.state.routeLine =
                null;


            MAP.state.currentRoute =
                null;


            MAP.state.routeDistance =
                0;


            MAP.state.routeDuration =
                0;
        };


    /* ========================================================
       CLEAR ALL MARKERS
       ======================================================== */

    MAP.clearBooking =
        function () {

            if (
                MAP.state.pickupMarker &&
                MAP.state.map
            ) {

                MAP.state.map
                    .removeLayer(
                        MAP.state
                            .pickupMarker
                    );
            }


            if (
                MAP.state.destinationMarker &&
                MAP.state.map
            ) {

                MAP.state.map
                    .removeLayer(
                        MAP.state
                            .destinationMarker
                    );
            }


            if (
                MAP.state.riderMarker &&
                MAP.state.map
            ) {

                MAP.state.map
                    .removeLayer(
                        MAP.state
                            .riderMarker
                    );
            }


            if (
                MAP.state.riderRouteLine &&
                MAP.state.map
            ) {

                MAP.state.map
                    .removeLayer(
                        MAP.state
                            .riderRouteLine
                    );
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


            MAP.clearRoute();
        };


    /* ========================================================
       MAP CLICK
       ======================================================== */

    MAP.enableMapSelection =
        function () {

            if (
                !MAP.state.map
            ) {

                return;
            }


            MAP.state.map.on(
                "click",
                async function (
                    event
                ) {

                    /*
                     * Only select destination
                     * when pickup already exists.
                     */

                    if (
                        !MAP.state
                            .pickupLocation
                    ) {

                        await MAP.setPickup(
                            {

                                lat:
                                    event.latlng
                                        .lat,

                                lng:
                                    event.latlng
                                        .lng
                            }
                        );

                    } else {

                        await MAP
                            .setDestination(
                                {

                                    lat:
                                        event.latlng
                                            .lat,

                                    lng:
                                        event.latlng
                                            .lng
                                }
                            );
                    }
                }
            );
        };


    /* ========================================================
       BUTTON EVENTS
       ======================================================== */

    MAP.bindButtons =
        function () {

            document
                .querySelectorAll(
                    "[data-current-location]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .mapBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .mapBound =
                            "true";


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

                                await MAP
                                    .centerOnUser();

                                if (
                                    MAP.state
                                        .userLocation
                                ) {

                                    await MAP
                                        .setPickup(
                                            MAP.state
                                                .userLocation
                                        );
                                }
                            }
                        );
                    }
                );
        };


    /* ========================================================
       INIT GPS + MAP
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
             * Try current location.
             */

            try {

                await MAP
                    .getCurrentLocation();


                MAP.startLocationWatch();

            } catch (error) {

                console.warn(
                    "GPS permission not available:",
                    error
                );
            }


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

                MAP.state
                    .pickupLocation =
                    event.detail;


                MAP.updatePickupMarker();
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

                MAP.state
                    .destinationLocation =
                    event.detail;


                MAP.updateDestinationMarker();
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


            if (
                ride &&
                ride.riderLat &&
                ride.riderLng
            ) {

                MAP.setRiderLocation(
                    {

                        lat:
                            ride.riderLat,

                        lng:
                            ride.riderLng
                    },

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
             * The next booking can clear it.
             */
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


    RX.setPickupLocation =
        MAP.setPickup;


    RX.setDestinationLocation =
        MAP.setDestination;


    RX.searchLocation =
        MAP.searchLocation;


    RX.setRiderLocation =
        MAP.setRiderLocation;


    RX.drawRoute =
        MAP.drawRoute;


    RX.centerOnUser =
        MAP.centerOnUser;


    RX.clearMapBooking =
        MAP.clearBooking;


    /* ========================================================
       AUTO INIT
       ======================================================== */

    function autoInit() {

        /*
         * Don't force map initialization if
         * the current page has no map.
         */

        const mapElement =
            MAP.findMapElement();


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
            autoInit
        );

    } else {

        autoInit();
    }


    console.log(
        "RiderX Map Engine loaded."
    );

})();
