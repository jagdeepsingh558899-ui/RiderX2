/* ============================================================
   RIDERX 2.0
   MAP ENGINE
   File: js/map.js

   FEATURES
   ------------------------------------------------------------
   - Leaflet / OpenStreetMap
   - Current GPS location
   - Live GPS watch
   - Pickup marker
   - Destination marker
   - Rider live location
   - Customer live location hooks
   - OSRM road routing
   - Rider -> Pickup route
   - Pickup -> Destination route
   - Distance + ETA
   - Route fallback
   - Auto fit
   - Chandigarh focused search
   - Reverse geocoding
   - Booking.js integration
   - Mobile friendly
   - Hidden sheet/tab map resize support
   - Safe duplicate event binding
   - Public RiderX API
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.map = RX.map || {};

    const MAP = RX.map;


    /* ============================================================
       CONFIG
       ============================================================ */

    MAP.config = {

        defaultCity:
            "Chandigarh, India",

        defaultCenter: [
            30.7333,
            76.7794
        ],

        defaultZoom:
            13,

        locationZoom:
            16,

        maxZoom:
            19,

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

        countryCode:
            "in",

        city:
            "Chandigarh",

        enableRoute:
            true,

        locationWatch:
            true,

        maxRoutePoints:
            1000,

        gpsTimeout:
            15000,

        gpsMaximumAge:
            10000,

        watchTimeout:
            20000,

        watchMaximumAge:
            5000,

        routePadding:
            [55, 55],

        maxFitZoom:
            16
    };


    /* ============================================================
       STATE
       ============================================================ */

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

        mapClickBound:
            false,

        buttonsBound:
            false,

        resizeObserver:
            null,

        currentRoute:
            null,

        riderRoute:
            null,

        routeDistance:
            0,

        routeDuration:
            0,

        riderRouteDistance:
            0,

        riderRouteDuration:
            0,

        locating:
            false,

        routing:
            false,

        riderRouting:
            false,

        geocoding:
            false
    };


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    MAP.number = function (value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    };


    MAP.round = function (value, decimals) {

        const places =
            Number.isFinite(Number(decimals))
                ? Number(decimals)
                : 2;

        const multiplier =
            Math.pow(10, places);

        return Math.round(
            MAP.number(value) * multiplier
        ) / multiplier;
    };


    MAP.isLeafletAvailable = function () {

        return (
            typeof window.L !== "undefined" &&
            typeof window.L.map === "function"
        );
    };


    MAP.isValidCoordinate = function (lat, lng) {

        const latitude =
            Number(lat);

        const longitude =
            Number(lng);

        return (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180 &&
            !(latitude === 0 && longitude === 0)
        );
    };


    MAP.latLng = function (location) {

        if (!location) {
            return null;
        }

        let lat;
        let lng;

        if (Array.isArray(location)) {

            lat =
                location[0];

            lng =
                location[1];

        } else {

            lat =
                location.lat ??
                location.latitude;

            lng =
                location.lng ??
                location.lon ??
                location.longitude;
        }

        if (
            !MAP.isValidCoordinate(
                lat,
                lng
            )
        ) {

            return null;
        }

        return [
            Number(lat),
            Number(lng)
        ];
    };


    MAP.delay = function (milliseconds) {

        return new Promise(
            function (resolve) {

                setTimeout(
                    resolve,
                    milliseconds
                );
            }
        );
    };


    /* ============================================================
       MAP ELEMENT
       ============================================================ */

    MAP.findMapElement = function () {

        const selectors = [

            "#map",

            "#mapContainer",

            "#map-container",

            ".map",

            ".map-container",

            ".map-wrapper",

            "[data-map]"
        ];


        for (
            const selector of selectors
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


    /* ============================================================
       MAP RESIZE
       ============================================================ */

    MAP.invalidateSize = function () {

        if (
            MAP.state.map
        ) {

            setTimeout(
                function () {

                    if (
                        MAP.state.map
                    ) {

                        MAP.state.map
                            .invalidateSize({
                                pan:
                                    false
                            });
                    }

                },
                50
            );
        }
    };


    MAP.observeMapSize = function (element) {

        if (
            MAP.state.resizeObserver
        ) {

            try {

                MAP.state.resizeObserver
                    .disconnect();

            } catch (error) {
                /* Ignore */
            }

            MAP.state.resizeObserver =
                null;
        }


        if (
            typeof ResizeObserver ===
            "undefined" ||
            !element
        ) {

            return;
        }


        MAP.state.resizeObserver =
            new ResizeObserver(
                function () {

                    MAP.invalidateSize();

                }
            );


        MAP.state.resizeObserver
            .observe(
                element
            );
    };


    /* ============================================================
       ICONS
       ============================================================ */

    MAP.createIcon = function (type) {

        if (
            !MAP.isLeafletAvailable()
        ) {

            return null;
        }


        let symbol =
            "●";


        if (type === "user") {

            symbol =
                "●";

        } else if (type === "pickup") {

            symbol =
                "●";

        } else if (type === "destination") {

            symbol =
                "◆";

        } else if (type === "rider") {

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


    /* ============================================================
       INITIALIZE MAP
       ============================================================ */

    MAP.init = function (element) {

        if (
            MAP.state.initialized &&
            MAP.state.map
        ) {

            MAP.invalidateSize();

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
                    "RiderX Map: Existing Leaflet element detected.",
                    error
                );

                return null;
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
                        true,

                    dragging:
                        true,

                    touchZoom:
                        true,

                    doubleClickZoom:
                        true,

                    scrollWheelZoom:
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


        MAP.observeMapSize(
            mapElement
        );


        setTimeout(
            function () {

                MAP.invalidateSize();

            },
            200
        );


        setTimeout(
            function () {

                MAP.invalidateSize();

            },
            700
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


    /* ============================================================
       CURRENT GPS LOCATION
       ============================================================ */

    MAP.getCurrentLocation = function () {

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
                            "Location is not supported by this device."
                        )
                    );

                    return;
                }


                MAP.state.locating =
                    true;


                navigator.geolocation
                    .getCurrentPosition(

                        function (position) {

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
                                    coords.speed
                            };


                            MAP.state.userLocation =
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

                        function (error) {

                            MAP.state.locating =
                                false;


                            console.warn(
                                "RiderX GPS error:",
                                error
                            );


                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx-location-error",
                                    {
                                        detail:
                                            error
                                    }
                                )
                            );


                            reject(
                                error
                            );

                        },

                        {

                            enableHighAccuracy:
                                true,

                            timeout:
                                MAP.config.gpsTimeout,

                            maximumAge:
                                MAP.config.gpsMaximumAge
                        }
                    );
            }
        );
    };


    /* ============================================================
       GPS WATCH
       ============================================================ */

    MAP.startLocationWatch = function () {

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
            MAP.state.watchId !== null
        ) {

            return true;
        }


        MAP.state.watchId =
            navigator.geolocation
                .watchPosition(

                    function (position) {

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
                                coords.speed
                        };


                        MAP.state.userLocation =
                            location;


                        MAP.updateUserMarker(
                            location
                        );


                        /*
                         * Auto pickup only until
                         * the customer selects
                         * another pickup.
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


                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx-customer-location-updated",
                                {
                                    detail:
                                        location
                                }
                            )
                        );

                    },

                    function (error) {

                        console.warn(
                            "RiderX GPS watch error:",
                            error
                        );


                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx-location-error",
                                {
                                    detail:
                                        error
                                }
                            )
                        );
                    },

                    {

                        enableHighAccuracy:
                            true,

                        timeout:
                            MAP.config.watchTimeout,

                        maximumAge:
                            MAP.config.watchMaximumAge
                    }
                );


        return true;
    };


    /* ============================================================
       STOP GPS WATCH
       ============================================================ */

    MAP.stopLocationWatch = function () {

        if (
            MAP.state.watchId !== null &&
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


    /* ============================================================
       USER MARKER
       ============================================================ */

    MAP.updateUserMarker = function (location) {

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

            return null;
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


        if (
            Number(location.accuracy) > 0
        ) {

            const accuracy =
                Number(
                    location.accuracy
                );


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
                        accuracy
                    );

            } else {

                MAP.state
                    .accuracyCircle =
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


        return MAP.state.userMarker;
    };


    /* ============================================================
       SET PICKUP
       ============================================================ */

    MAP.setPickup = async function (
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
                    "Booking pickup sync failed:",
                    error
                );
            }
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-pickup-set",
                {
                    detail:
                        MAP.state.pickupLocation
                }
            )
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx-pickup-changed",
                {
                    detail:
                        MAP.state.pickupLocation
                }
            )
        );


        if (
            MAP.state.destinationLocation &&
            MAP.config.enableRoute
        ) {

            await MAP.drawRoute(
                MAP.state.pickupLocation,
                MAP.state.destinationLocation
            );
        }


        return MAP.state.pickupLocation;
    };


    /* ============================================================
       SET DESTINATION
       ============================================================ */

    MAP.setDestination = async function (
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
                    "Booking destination sync failed:",
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


        window.dispatchEvent(
            new CustomEvent(
                "riderx-destination-set",
                {
                    detail:
                        MAP.state.destinationLocation
                }
            )
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx-destination-changed",
                {
                    detail:
                        MAP.state.destinationLocation
                }
            )
        );


        return MAP.state.destinationLocation;
    };


    /* ============================================================
       PICKUP MARKER
       ============================================================ */

    MAP.updatePickupMarker = function () {

        const map =
            MAP.state.map;


        const position =
            MAP.latLng(
                MAP.state.pickupLocation
            );


        if (
            !map ||
            !position
        ) {

            return null;
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
                    async function (event) {

                        const point =
                            event.target
                                .getLatLng();


                        await MAP.setPickup(
                            {

                                lat:
                                    point.lat,

                                lng:
                                    point.lng
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


        return MAP.state.pickupMarker;
    };


    /* ============================================================
       DESTINATION MARKER
       ============================================================ */

    MAP.updateDestinationMarker = function () {

        const map =
            MAP.state.map;


        const position =
            MAP.latLng(
                MAP.state.destinationLocation
            );


        if (
            !map ||
            !position
        ) {

            return null;
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
                    async function (event) {

                        const point =
                            event.target
                                .getLatLng();


                        await MAP.setDestination(
                            {

                                lat:
                                    point.lat,

                                lng:
                                    point.lng
                            }
                        );
                    }
                );
        }


        MAP.state.destinationMarker
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


        return MAP.state.destinationMarker;
    };


    /* ============================================================
       ROUTE URL
       ============================================================ */

    MAP.buildRouteUrl = function (
        start,
        end
    ) {

        return (
            MAP.config.routingUrl +

            start[1] +
            "," +
            start[0] +

            ";" +

            end[1] +
            "," +
            end[0] +

            "?overview=full&geometries=geojson"
        );
    };


    /* ============================================================
       DRAW CUSTOMER ROUTE
       ============================================================ */

    MAP.drawRoute = async function (
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
                MAP.buildRouteUrl(
                    start,
                    end
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
                    route.distance / 1000,
                    2
                );


            MAP.state.routeDuration =
                MAP.round(
                    route.duration / 60,
                    1
                );


            let coordinates =
                route.geometry &&
                route.geometry.coordinates
                    ? route.geometry.coordinates
                    : [];


            coordinates =
                coordinates
                    .slice(
                        0,
                        MAP.config.maxRoutePoints
                    )
                    .map(
                        function (point) {

                            return [
                                point[1],
                                point[0]
                            ];
                        }
                    );


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


            MAP.syncBookingRoute();


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


    /* ============================================================
       SYNC ROUTE WITH BOOKING ENGINE
       ============================================================ */

    MAP.syncBookingRoute = function () {

        if (
            !RX.booking ||
            !RX.booking.state
        ) {

            return;
        }


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
                    "Booking recalculation failed:",
                    error
                );
            }
        }
    };


    /* ============================================================
       FALLBACK ROUTE
       ============================================================ */

    MAP.drawFallbackRoute = function (
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
                            "10 10",

                        lineCap:
                            "round"
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


        /*
         * Approximate city traffic ETA.
         * Road routing is preferred whenever
         * OSRM is available.
         */

        const duration =
            Math.max(
                5,
                distance * 3
            );


        MAP.state.routeDistance =
            MAP.round(
                distance,
                2
            );


        MAP.state.routeDuration =
            MAP.round(
                duration,
                1
            );


        MAP.syncBookingRoute();


        window.dispatchEvent(
            new CustomEvent(
                "riderx-route-fallback",
                {
                    detail: {

                        distanceKm:
                            MAP.state
                                .routeDistance,

                        durationMin:
                            MAP.state
                                .routeDuration
                    }
                }
            )
        );


        MAP.fitRoute();
    };


    /* ============================================================
       FIT ROUTE
       ============================================================ */

    MAP.fitRoute = function () {

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
            points.length === 0
        ) {

            return;
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


        MAP.state.map
            .fitBounds(
                L.latLngBounds(
                    points
                ),
                {

                    padding:
                        MAP.config.routePadding,

                    maxZoom:
                        MAP.config.maxFitZoom
                }
            );
    };


    /* ============================================================
       DISTANCE
       ============================================================ */

    MAP.calculateDistance = function (
        lat1,
        lng1,
        lat2,
        lng2
    ) {

        const R =
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
            ) ** 2 +

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
            ) ** 2;


        const safeA =
            Math.min(
                1,
                Math.max(
                    0,
                    a
                )
            );


        const c =
            2 *
            Math.atan2(
                Math.sqrt(
                    safeA
                ),
                Math.sqrt(
                    1 - safeA
                )
            );


        return R * c;
    };


    /* ============================================================
       SEARCH LOCATION
       ============================================================ */

    MAP.searchLocation = async function (
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

            const url =
                MAP.config.geocodingUrl +
                "?format=json" +
                "&addressdetails=1" +
                "&limit=5" +
                "&countrycodes=" +
                MAP.config.countryCode +
                "&q=" +
                encodeURIComponent(
                    query +
                    ", Chandigarh, India"
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


            return results
                .map(
                    function (item) {

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
                                item.display_name ||
                                "Selected location",

                            name:
                                item.name ||
                                item.display_name ||
                                "Selected location"
                        };
                    }
                )
                .filter(
                    function (item) {

                        return MAP.isValidCoordinate(
                            item.lat,
                            item.lng
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


    /* ============================================================
       REVERSE GEOCODING
       ============================================================ */

    MAP.reverseGeocode = async function (
        lat,
        lng
    ) {

        if (
            !MAP.isValidCoordinate(
                lat,
                lng
            )
        ) {

            return "Selected location";
        }


        try {

            const url =
                MAP.config
                    .reverseGeocodingUrl +
                "?format=json" +
                "&addressdetails=1" +
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


    /* ============================================================
       RIDER LIVE LOCATION
       ============================================================ */

    MAP.setRiderLocation = function (
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

            return null;
        }


        MAP.state.riderLocation = {

            lat:
                position[0],

            lng:
                position[1],

            heading:
                location.heading ??
                null,

            accuracy:
                location.accuracy ??
                null,

            speed:
                location.speed ??
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
                            true,

                        duration:
                            0.5
                    }
                );
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-rider-location-updated",
                {
                    detail:
                        MAP.state.riderLocation
                }
            )
        );


        return MAP.state.riderLocation;
    };


    /* ============================================================
       DRAW RIDER -> PICKUP ROUTE
       ============================================================ */

    MAP.drawRiderRoute = async function () {

        const rider =
            MAP.state.riderLocation;


        const pickup =
            MAP.state.pickupLocation;


        if (
            !rider ||
            !pickup ||
            !MAP.state.map
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


        MAP.state.riderRouting =
            true;


        try {

            const url =
                MAP.buildRouteUrl(
                    start,
                    end
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
                    "Rider route unavailable."
                );
            }


            const data =
                await response.json();


            if (
                !data.routes ||
                !data.routes.length
            ) {

                throw new Error(
                    "No rider route found."
                );
            }


            const route =
                data.routes[0];


            MAP.state.riderRoute =
                route;


            MAP.state.riderRouteDistance =
                MAP.round(
                    route.distance / 1000,
                    2
                );


            MAP.state.riderRouteDuration =
                MAP.round(
                    route.duration / 60,
                    1
                );


            const coordinates =
                route.geometry &&
                route.geometry.coordinates
                    ? route.geometry.coordinates
                        .slice(
                            0,
                            MAP.config.maxRoutePoints
                        )
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
                !coordinates.length
            ) {

                throw new Error(
                    "Rider route geometry unavailable."
                );
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
                                "round"
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
                                MAP.state
                                    .riderRouteDistance,

                            durationMin:
                                MAP.state
                                    .riderRouteDuration,

                            route:
                                route
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

        } finally {

            MAP.state.riderRouting =
                false;
        }
    };


    /* ============================================================
       UPDATE RIDER + ROUTE
       ============================================================ */

    MAP.updateRiderLiveLocation = async function (
        location,
        follow = false
    ) {

        const result =
            MAP.setRiderLocation(
                location,
                follow
            );


        if (
            result &&
            MAP.state.pickupLocation
        ) {

            await MAP.drawRiderRoute();
        }


        return result;
    };


    /* ============================================================
       CENTER USER
       ============================================================ */

    MAP.centerOnUser = async function () {

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

                MAP.invalidateSize();
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


    /* ============================================================
       CLEAR ROUTE
       ============================================================ */

    MAP.clearRoute = function () {

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


        if (
            RX.booking &&
            RX.booking.state
        ) {

            RX.booking.state.distanceKm =
                0;

            RX.booking.state.durationMin =
                0;
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-route-cleared"
            )
        );
    };


    /* ============================================================
       CLEAR RIDER ROUTE
       ============================================================ */

    MAP.clearRiderRoute = function () {

        if (
            MAP.state.riderRouteLine &&
            MAP.state.map
        ) {

            MAP.state.map
                .removeLayer(
                    MAP.state.riderRouteLine
                );
        }


        MAP.state.riderRouteLine =
            null;


        MAP.state.riderRoute =
            null;


        MAP.state.riderRouteDistance =
            0;


        MAP.state.riderRouteDuration =
            0;
    };


    /* ============================================================
       CLEAR BOOKING
       ============================================================ */

    MAP.clearBooking = function () {

        if (
            MAP.state.pickupMarker &&
            MAP.state.map
        ) {

            MAP.state.map
                .removeLayer(
                    MAP.state.pickupMarker
                );
        }


        if (
            MAP.state.destinationMarker &&
            MAP.state.map
        ) {

            MAP.state.map
                .removeLayer(
                    MAP.state.destinationMarker
                );
        }


        if (
            MAP.state.riderMarker &&
            MAP.state.map
        ) {

            MAP.state.map
                .removeLayer(
                    MAP.state.riderMarker
                );
        }


        MAP.clearRoute();

        MAP.clearRiderRoute();


        MAP.state.pickupMarker =
            null;


        MAP.state.destinationMarker =
            null;


        MAP.state.riderMarker =
            null;


        MAP.state.pickupLocation =
            null;


        MAP.state.destinationLocation =
            null;


        MAP.state.riderLocation =
            null;


        /*
         * IMPORTANT:
         * User GPS marker is intentionally
         * preserved for the next booking.
         */

        if (
            MAP.state.userLocation
        ) {

            MAP.updateUserMarker(
                MAP.state.userLocation
            );
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-map-booking-cleared"
            )
        );
    };


    /* ============================================================
       MAP CLICK SELECTION
       ============================================================ */

    MAP.enableMapSelection = function () {

        if (
            !MAP.state.map ||
            MAP.state.mapClickBound
        ) {

            return;
        }


        MAP.state.map.on(
            "click",
            async function (event) {

                if (
                    !event ||
                    !event.latlng
                ) {

                    return;
                }


                const location = {

                    lat:
                        event.latlng.lat,

                    lng:
                        event.latlng.lng
                };


                /*
                 * First click = pickup.
                 * Second click = destination.
                 */

                if (
                    !MAP.state.pickupLocation
                ) {

                    await MAP.setPickup(
                        location
                    );

                } else {

                    await MAP.setDestination(
                        location
                    );
                }
            }
        );


        MAP.state.mapClickBound =
            true;
    };


    /* ============================================================
       BUTTON BINDING
       ============================================================ */

    MAP.bindButtons = function () {

        if (
            MAP.state.buttonsBound
        ) {

            return;
        }


        document
            .querySelectorAll(
                "[data-current-location]"
            )
            .forEach(
                function (button) {

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
                function (button) {

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
                        async function () {

                            const location =
                                await MAP
                                    .centerOnUser();


                            if (
                                location
                            ) {

                                await MAP
                                    .setPickup(
                                        location
                                    );
                            }
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-clear-map]"
            )
            .forEach(
                function (button) {

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

                            MAP.clearBooking();

                        }
                    );
                }
            );


        MAP.state.buttonsBound =
            true;
    };


    /* ============================================================
       START MAP
       ============================================================ */

    MAP.start = async function (
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
         * GPS is intentionally non-blocking
         * for map initialization.
         */

        try {

            const location =
                await MAP
                    .getCurrentLocation();


            if (
                location
            ) {

                MAP.updateUserMarker(
                    location
                );
            }


            MAP.startLocationWatch();

        } catch (error) {

            console.warn(
                "RiderX GPS permission unavailable:",
                error
            );
        }


        return map;
    };


    /* ============================================================
       BOOKING EVENT: PICKUP CHANGED
       ============================================================ */

    window.addEventListener(
        "riderx-pickup-changed",
        function (event) {

            if (
                !event.detail
            ) {

                return;
            }


            MAP.state.pickupLocation =
                event.detail;


            MAP.updatePickupMarker();


            if (
                MAP.state.destinationLocation &&
                MAP.config.enableRoute
            ) {

                MAP.drawRoute(
                    MAP.state.pickupLocation,
                    MAP.state.destinationLocation
                );
            }
        }
    );


    /* ============================================================
       BOOKING EVENT: DESTINATION CHANGED
       ============================================================ */

    window.addEventListener(
        "riderx-destination-changed",
        function (event) {

            if (
                !event.detail
            ) {

                return;
            }


            MAP.state.destinationLocation =
                event.detail;


            MAP.updateDestinationMarker();


            if (
                MAP.state.pickupLocation &&
                MAP.config.enableRoute
            ) {

                MAP.drawRoute(
                    MAP.state.pickupLocation,
                    MAP.state.destinationLocation
                );
            }
        }
    );


    /* ============================================================
       RIDE ACCEPTED
       ============================================================ */

    window.addEventListener(
        "riderx-ride-accepted",
        function (event) {

            const ride =
                event.detail;


            if (!ride) {

                return;
            }


            const riderLat =
                ride.riderLat ??
                ride.riderLatitude ??
                ride.driverLat ??
                ride.driverLatitude;


            const riderLng =
                ride.riderLng ??
                ride.riderLongitude ??
                ride.driverLng ??
                ride.driverLongitude;


            if (
                MAP.isValidCoordinate(
                    riderLat,
                    riderLng
                )
            ) {

                MAP.updateRiderLiveLocation(
                    {

                        lat:
                            riderLat,

                        lng:
                            riderLng,

                        heading:
                            ride.riderHeading ??
                            ride.driverHeading ??
                            null
                    },
                    false
                );
            }
        }
    );


    /* ============================================================
       LIVE RIDER LOCATION EVENT
       ============================================================ */

    window.addEventListener(
        "riderx-live-rider-location",
        function (event) {

            if (
                !event.detail
            ) {

                return;
            }


            MAP.updateRiderLiveLocation(
                event.detail,
                false
            );
        }
    );


    window.addEventListener(
        "riderx-rider-location",
        function (event) {

            if (
                !event.detail
            ) {

                return;
            }


            MAP.updateRiderLiveLocation(
                event.detail,
                false
            );
        }
    );


    /* ============================================================
       RIDE CANCELLED
       ============================================================ */

    window.addEventListener(
        "riderx-ride-cancelled",
        function () {

            MAP.clearBooking();

        }
    );


    /* ============================================================
       RIDE COMPLETED
       ============================================================ */

    window.addEventListener(
        "riderx-ride-completed",
        function () {

            /*
             * Keep final route visible.
             * clearBooking() can be called
             * when a new booking starts.
             */

            MAP.clearRiderRoute();

        }
    );


    /* ============================================================
       PAGE VISIBILITY
       ============================================================ */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                !document.hidden
            ) {

                MAP.invalidateSize();

            }
        }
    );


    /* ============================================================
       WINDOW RESIZE
       ============================================================ */

    window.addEventListener(
        "resize",
        function () {

            MAP.invalidateSize();

        }
    );


    /* ============================================================
       PUBLIC API
       ============================================================ */

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


    RX.updateRiderLiveLocation =
        MAP.updateRiderLiveLocation;


    RX.drawRoute =
        MAP.drawRoute;


    RX.drawRiderRoute =
        MAP.drawRiderRoute;


    RX.centerOnUser =
        MAP.centerOnUser;


    RX.clearMapRoute =
        MAP.clearRoute;


    RX.clearMapBooking =
        MAP.clearBooking;


    RX.invalidateMap =
        MAP.invalidateSize;


    /* ============================================================
       AUTO INIT
       ============================================================ */

    function autoInit() {

        const mapElement =
            MAP.findMapElement();


        if (
            mapElement
        ) {

            /*
             * Small delay helps when the map
             * is inside a customer/rider
             * dashboard or bottom sheet.
             */

            setTimeout(
                function () {

                    MAP.start(
                        mapElement
                    );

                },
                50
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
        "RiderX 2.0 Map Engine loaded."
    );

})();
