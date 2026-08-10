/* ============================================================
   RIDERX 2.0
   LIVE MAP ENGINE
   File: js/map.js

   FLOW:
   Customer:
   GPS -> Pickup -> Destination -> Route

   Rider:
   GPS -> Online -> Ride Request
   -> Accept / Cancel
   -> Navigate to Pickup
   -> Arrive
   -> OTP Verification
   -> Start Ride
   -> Navigate to Destination
   -> Complete

   IMPORTANT:
   - No Chandigarh hard-lock
   - GPS-first map positioning
   - Live rider/customer location
   - Pickup/destination route
   - Rider -> pickup navigation
   - Pickup -> destination navigation
   - Booking.js integration
   - Ride lifecycle events
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

        /*
         * Chandigarh is NOT used as the user's location.
         * It is only a harmless visual fallback if GPS has
         * not been obtained yet.
         */
        defaultCenter: [
            30.7333,
            76.7794
        ],

        defaultZoom: 12,

        maxZoom: 19,

        locationZoom: 16,

        navigationZoom: 16,

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
            1000,

        gpsTimeout:
            15000,

        gpsMaximumAge:
            5000,

        riderLocationThrottle:
            1500,

        routeRefreshDistance:
            0.05
    };


    /* ========================================================
       STATE
       ======================================================== */

    MAP.state = {

        map: null,

        initialized: false,

        mapElement: null,

        userLocation: null,

        customerLocation: null,

        pickupLocation: null,

        destinationLocation: null,

        riderLocation: null,

        userMarker: null,

        customerMarker: null,

        pickupMarker: null,

        destinationMarker: null,

        riderMarker: null,

        routeLine: null,

        riderRouteLine: null,

        navigationRouteLine: null,

        accuracyCircle: null,

        watchId: null,

        currentRoute: null,

        riderRoute: null,

        navigationRoute: null,

        routeDistance: 0,

        routeDuration: 0,

        riderRouteDistance: 0,

        riderRouteDuration: 0,

        navigationDistance: 0,

        navigationDuration: 0,

        locating: false,

        routing: false,

        geocoding: false,

        locationWatchStarted: false,

        selectionEnabled: false,

        buttonsBound: false,

        autoCentered: false,

        currentRole: null,

        rideStatus: "idle",

        otpVerified: false,

        rideStarted: false,

        lastRiderRouteAt: 0,

        lastRiderRouteLocation: null,

        lastLocationDispatch: 0
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    MAP.number = function (value) {

        const n = Number(value);

        return Number.isFinite(n) ? n : 0;
    };


    MAP.round = function (value) {

        return Math.round(
            MAP.number(value) * 100
        ) / 100;
    };


    MAP.isLeafletAvailable = function () {

        return (
            typeof window.L !== "undefined"
        );
    };


    MAP.latLng = function (location) {

        if (!location) {
            return null;
        }

        const lat = MAP.number(
            location.lat
        );

        const lng = MAP.number(
            location.lng
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


    MAP.distanceBetweenLocations = function (
        first,
        second
    ) {

        const a = MAP.latLng(first);
        const b = MAP.latLng(second);

        if (!a || !b) {
            return Infinity;
        }

        return MAP.calculateDistance(
            a[0],
            a[1],
            b[0],
            b[1]
        );
    };


    MAP.getRole = function () {

        if (MAP.state.currentRole) {
            return MAP.state.currentRole;
        }

        try {

            const rider =
                localStorage.getItem(
                    "riderx_rider"
                );

            const customer =
                localStorage.getItem(
                    "riderx_customer"
                );

            const user =
                localStorage.getItem(
                    "riderx_user"
                );

            if (rider) {
                MAP.state.currentRole =
                    "rider";

                return "rider";
            }

            if (customer) {
                MAP.state.currentRole =
                    "customer";

                return "customer";
            }

            if (user) {

                try {

                    const parsed =
                        JSON.parse(user);

                    if (
                        parsed &&
                        (
                            parsed.role ===
                            "rider" ||
                            parsed.role ===
                            "driver"
                        )
                    ) {

                        MAP.state.currentRole =
                            "rider";

                        return "rider";
                    }

                    if (
                        parsed &&
                        (
                            parsed.role ===
                            "customer" ||
                            parsed.role ===
                            "user"
                        )
                    ) {

                        MAP.state.currentRole =
                            "customer";

                        return "customer";
                    }

                } catch (error) {
                    /* Ignore malformed localStorage. */
                }
            }

        } catch (error) {
            /* localStorage can be unavailable. */
        }

        return null;
    };


    MAP.dispatch = function (
        eventName,
        detail
    ) {

        window.dispatchEvent(
            new CustomEvent(
                eventName,
                {
                    detail:
                        detail
                }
            )
        );
    };


    /* ========================================================
       MAP ELEMENT
       ======================================================== */

    MAP.findMapElement = function () {

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

    MAP.createIcon = function (
        type
    ) {

        if (
            !MAP.isLeafletAvailable()
        ) {
            return null;
        }

        let emoji = "📍";

        if (type === "user") {
            emoji = "●";
        }

        if (type === "customer") {
            emoji = "●";
        }

        if (type === "pickup") {
            emoji = "●";
        }

        if (type === "destination") {
            emoji = "◆";
        }

        if (type === "rider") {
            emoji = "🏍️";
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
       INITIALIZE MAP
       ======================================================== */

    MAP.init = function (
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

        MAP.state.mapElement =
            mapElement;

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
        ).addTo(
            MAP.state.map
        );

        /*
         * Temporary visual view only.
         * This is NOT considered the user's location.
         */
        MAP.state.map.setView(
            MAP.config.defaultCenter,
            MAP.config.defaultZoom
        );

        L.control.zoom({
            position:
                "bottomright"
        }).addTo(
            MAP.state.map
        );

        MAP.state.initialized =
            true;

        setTimeout(
            function () {

                if (MAP.state.map) {

                    MAP.state.map
                        .invalidateSize();

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
       CENTER ON GPS LOCATION
       ======================================================== */

    MAP.centerOnLocation = function (
        location,
        zoom
    ) {

        const position =
            MAP.latLng(location);

        if (
            !position ||
            !MAP.state.map
        ) {
            return false;
        }

        MAP.state.map.setView(
            position,
            zoom ||
            MAP.config.locationZoom,
            {
                animate: true
            }
        );

        MAP.state.autoCentered =
            true;

        return true;
    };


    /* ========================================================
       CURRENT GPS LOCATION
       ======================================================== */

    MAP.getCurrentLocation = function () {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                if (
                    !navigator.geolocation
                ) {

                    const error =
                        new Error(
                            "Location is not supported on this device."
                        );

                    MAP.dispatch(
                        "riderx-location-error",
                        error
                    );

                    reject(error);

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

                            MAP.state.userLocation =
                                location;

                            /*
                             * Customer and rider both use
                             * their real GPS position.
                             */
                            const role =
                                MAP.getRole();

                            if (
                                role === "rider"
                            ) {

                                MAP.state.riderLocation =
                                    location;

                            }

                            if (
                                role === "customer"
                            ) {

                                MAP.state.customerLocation =
                                    location;

                            }

                            MAP.updateUserMarker(
                                location
                            );

                            if (
                                role === "rider"
                            ) {

                                MAP.updateRiderMarker(
                                    location
                                );
                            }

                            if (
                                role === "customer"
                            ) {

                                MAP.updateCustomerMarker(
                                    location
                                );
                            }

                            /*
                             * IMPORTANT:
                             * First successful GPS location
                             * becomes the map center.
                             */
                            if (
                                !MAP.state
                                    .autoCentered
                            ) {

                                MAP.centerOnLocation(
                                    location,
                                    MAP.config.locationZoom
                                );
                            }

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

                            MAP.dispatch(
                                "riderx-location-error",
                                error
                            );

                            reject(error);
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


    /* ========================================================
       LIVE LOCATION WATCH
       ======================================================== */

    MAP.startLocationWatch = function () {

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

        MAP.state.locationWatchStarted =
            true;

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

                        MAP.state.userLocation =
                            location;

                        const role =
                            MAP.getRole();

                        if (
                            role === "rider"
                        ) {

                            MAP.state.riderLocation =
                                location;

                            MAP.updateRiderMarker(
                                location
                            );

                            MAP.handleRiderLiveRoute(
                                location
                            );
                        }

                        if (
                            role === "customer"
                        ) {

                            MAP.state.customerLocation =
                                location;

                            MAP.updateCustomerMarker(
                                location
                            );
                        }

                        MAP.updateUserMarker(
                            location
                        );

                        /*
                         * Never force the map back to
                         * Chandigarh. Follow the real GPS.
                         */
                        if (
                            !MAP.state.autoCentered
                        ) {

                            MAP.centerOnLocation(
                                location
                            );
                        }

                        MAP.dispatch(
                            "riderx-live-location",
                            location
                        );

                        /*
                         * Rider-specific event.
                         * Firebase/RTDB rider code can listen
                         * and save this location.
                         */
                        if (
                            role === "rider"
                        ) {

                            MAP.dispatch(
                                "riderx-rider-gps-updated",
                                location
                            );
                        }

                        /*
                         * Customer-specific event.
                         */
                        if (
                            role === "customer"
                        ) {

                            MAP.dispatch(
                                "riderx-customer-gps-updated",
                                location
                            );
                        }
                    },

                    function (
                        error
                    ) {

                        console.warn(
                            "RiderX live GPS error:",
                            error
                        );

                        MAP.dispatch(
                            "riderx-location-error",
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
       STOP GPS
       ======================================================== */

    MAP.stopLocationWatch = function () {

        if (
            MAP.state.watchId !== null &&
            navigator.geolocation
        ) {

            navigator.geolocation
                .clearWatch(
                    MAP.state.watchId
                );
        }

        MAP.state.watchId =
            null;

        MAP.state.locationWatchStarted =
            false;
    };


    /* ========================================================
       USER MARKER
       ======================================================== */

    MAP.updateUserMarker = function (
        location
    ) {

        const map =
            MAP.state.map;

        const position =
            MAP.latLng(location);

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
                ).addTo(
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
            location.accuracy &&
            Number(location.accuracy) > 0
        ) {

            if (
                MAP.state.accuracyCircle
            ) {

                MAP.state.accuracyCircle
                    .setLatLng(
                        position
                    )
                    .setRadius(
                        location.accuracy
                    );

            } else {

                MAP.state.accuracyCircle =
                    L.circle(
                        position,
                        {

                            radius:
                                location.accuracy,

                            interactive:
                                false
                        }
                    ).addTo(
                        map
                    );
            }
        }
    };


    /* ========================================================
       CUSTOMER MARKER
       ======================================================== */

    MAP.updateCustomerMarker = function (
        location
    ) {

        const map =
            MAP.state.map;

        const position =
            MAP.latLng(location);

        if (
            !map ||
            !position
        ) {
            return;
        }

        const icon =
            MAP.createIcon(
                "customer"
            );

        if (
            MAP.state.customerMarker
        ) {

            MAP.state.customerMarker
                .setLatLng(
                    position
                );

        } else {

            MAP.state.customerMarker =
                L.marker(
                    position,
                    {

                        icon:
                            icon,

                        zIndexOffset:
                            1100
                    }
                ).addTo(
                    map
                );

            MAP.state.customerMarker
                .bindTooltip(
                    "Customer",
                    {
                        direction:
                            "top"
                    }
                );
        }
    };


    /* ========================================================
       RIDER MARKER
       ======================================================== */

    MAP.updateRiderMarker = function (
        location
    ) {

        const map =
            MAP.state.map;

        const position =
            MAP.latLng(location);

        if (
            !map ||
            !position
        ) {
            return;
        }

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
                ).addTo(
                    map
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
    };


    /* ========================================================
       SET PICKUP
       ======================================================== */

    MAP.setPickup = async function (
        location,
        reverseGeocode = true
    ) {

        const position =
            MAP.latLng(location);

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

            address =
                await MAP.reverseGeocode(
                    position[0],
                    position[1]
                );
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

            RX.booking.setPickup(
                MAP.state.pickupLocation
            );
        }

        MAP.dispatch(
            "riderx-pickup-set",
            MAP.state.pickupLocation
        );

        MAP.dispatch(
            "riderx-pickup-changed",
            MAP.state.pickupLocation
        );

        return MAP.state.pickupLocation;
    };


    /* ========================================================
       SET DESTINATION
       ======================================================== */

    MAP.setDestination = async function (
        location,
        reverseGeocode = true
    ) {

        const position =
            MAP.latLng(location);

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

            address =
                await MAP.reverseGeocode(
                    position[0],
                    position[1]
                );
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

            RX.booking.setDestination(
                MAP.state.destinationLocation
            );
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

        MAP.dispatch(
            "riderx-destination-changed",
            MAP.state.destinationLocation
        );

        return MAP.state.destinationLocation;
    };


    /* ========================================================
       PICKUP MARKER
       ======================================================== */

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
                ).addTo(
                    map
                );

            MAP.state.pickupMarker
                .bindPopup(
                    "Pickup location"
                );

            MAP.state.pickupMarker.on(
                "dragend",
                async function (
                    event
                ) {

                    const p =
                        event.target
                            .getLatLng();

                    await MAP.setPickup(
                        {

                            lat:
                                p.lat,

                            lng:
                                p.lng
                        }
                    );
                }
            );
        }

        MAP.state.pickupMarker
            .bindTooltip(
                MAP.state.pickupLocation
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
                    ).addTo(
                        map
                    );

                MAP.state.destinationMarker
                    .bindPopup(
                        "Destination"
                    );

                MAP.state.destinationMarker.on(
                    "dragend",
                    async function (
                        event
                    ) {

                        const p =
                            event.target
                                .getLatLng();

                        await MAP.setDestination(
                            {

                                lat:
                                    p.lat,

                                lng:
                                    p.lng
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
        };


    /* ========================================================
       DRAW CUSTOMER ROUTE
       ======================================================== */

    MAP.drawRoute = async function (
        pickup,
        destination
    ) {

        const start =
            MAP.latLng(pickup);

        const end =
            MAP.latLng(destination);

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
                await fetch(url);

            if (!response.ok) {
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
                    route.distance / 1000
                );

            MAP.state.routeDuration =
                MAP.round(
                    route.duration / 60
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
                coordinates.length >
                MAP.config.maxRoutePoints
            ) {

                coordinates.length =
                    MAP.config.maxRoutePoints;
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
                    ).addTo(
                        MAP.state.map
                    );
            }

            if (
                RX.booking &&
                RX.booking.state
            ) {

                RX.booking.state.distanceKm =
                    MAP.state.routeDistance;

                RX.booking.state.durationMin =
                    MAP.state.routeDuration;

                if (
                    typeof RX.booking
                        .recalculate ===
                    "function"
                ) {

                    RX.booking.recalculate();
                }
            }

            MAP.fitRoute();

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
       RIDER -> PICKUP ROUTE
       ======================================================== */

    MAP.drawRiderRoute = async function () {

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
            MAP.latLng(rider);

        const end =
            MAP.latLng(pickup);

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
                await fetch(url);

            if (!response.ok) {
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

            MAP.state.riderRoute =
                route;

            MAP.state.riderRouteDistance =
                MAP.round(
                    route.distance / 1000
                );

            MAP.state.riderRouteDuration =
                MAP.round(
                    route.duration / 60
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
                                5,

                            opacity:
                                0.85,

                            lineCap:
                                "round",

                            lineJoin:
                                "round",

                            dashArray:
                                "9 7"
                        }
                    ).addTo(
                        MAP.state.map
                    );
            }

            MAP.dispatch(
                "riderx-rider-route-updated",
                {

                    distanceKm:
                        MAP.state
                            .riderRouteDistance,

                    durationMin:
                        MAP.state
                            .riderRouteDuration,

                    route:
                        route
                }
            );

            return route;

        } catch (error) {

            console.warn(
                "Rider -> pickup route failed:",
                error
            );

            return null;
        }
    };


    /* ========================================================
       RIDER -> DESTINATION ROUTE
       ======================================================== */

    MAP.drawNavigationRoute =
        async function () {

            const rider =
                MAP.state.riderLocation;

            const destination =
                MAP.state.destinationLocation;

            if (
                !rider ||
                !destination
            ) {
                return null;
            }

            const start =
                MAP.latLng(rider);

            const end =
                MAP.latLng(destination);

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
                    await fetch(url);

                if (!response.ok) {
                    throw new Error(
                        "Navigation unavailable."
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

                MAP.state.navigationRoute =
                    route;

                MAP.state.navigationDistance =
                    MAP.round(
                        route.distance / 1000
                    );

                MAP.state.navigationDuration =
                    MAP.round(
                        route.duration / 60
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
                    MAP.state.navigationRouteLine
                ) {

                    MAP.state.navigationRouteLine
                        .setLatLngs(
                            coordinates
                        );

                } else {

                    MAP.state.navigationRouteLine =
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
                            MAP.state.map
                        );
                }

                MAP.dispatch(
                    "riderx-navigation-updated",
                    {

                        distanceKm:
                            MAP.state
                                .navigationDistance,

                        durationMin:
                            MAP.state
                                .navigationDuration,

                        route:
                            route
                    }
                );

                return route;

            } catch (error) {

                console.warn(
                    "Rider destination navigation failed:",
                    error
                );

                return null;
            }
        };


    /* ========================================================
       LIVE RIDER ROUTE REFRESH
       ======================================================== */

    MAP.handleRiderLiveRoute =
        function (
            location
        ) {

            if (
                MAP.state.rideStatus !==
                "accepted" &&
                MAP.state.rideStatus !==
                "arriving" &&
                MAP.state.rideStatus !==
                "started"
            ) {
                return;
            }

            const now =
                Date.now();

            if (
                now -
                MAP.state.lastRiderRouteAt <
                MAP.config.riderLocationThrottle
            ) {
                return;
            }

            const last =
                MAP.state
                    .lastRiderRouteLocation;

            if (
                last &&
                MAP.distanceBetweenLocations(
                    last,
                    location
                ) <
                MAP.config.routeRefreshDistance
            ) {
                return;
            }

            MAP.state.lastRiderRouteAt =
                now;

            MAP.state.lastRiderRouteLocation =
                {
                    lat:
                        location.lat,

                    lng:
                        location.lng
                };

            if (
                MAP.state.rideStatus ===
                "started"
            ) {

                MAP.drawNavigationRoute();

            } else {

                MAP.drawRiderRoute();
            }
        };


    /* ========================================================
       FALLBACK ROUTE
       ======================================================== */

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
                            "10 10"
                    }
                ).addTo(
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
            MAP.round(distance);

        MAP.state.routeDuration =
            MAP.round(duration);

        if (
            RX.booking &&
            RX.booking.state
        ) {

            RX.booking.state.distanceKm =
                MAP.state.routeDistance;

            RX.booking.state.durationMin =
                MAP.state.routeDuration;

            if (
                typeof RX.booking
                    .recalculate ===
                "function"
            ) {

                RX.booking.recalculate();
            }
        }

        MAP.fitRoute();
    };


    /* ========================================================
       FIT ROUTE
       ======================================================== */

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
            MAP.state.riderLocation &&
            (
                MAP.state.rideStatus ===
                "accepted" ||
                MAP.state.rideStatus ===
                "arriving" ||
                MAP.state.rideStatus ===
                "started"
            )
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

            MAP.state.map.setView(
                points[0],
                MAP.config.locationZoom
            );

            return;
        }

        if (
            points.length > 1
        ) {

            MAP.state.map.fitBounds(
                L.latLngBounds(points),
                {

                    padding:
                        [50, 50],

                    maxZoom:
                        MAP.config.navigationZoom
                }
            );
        }
    };


    /* ========================================================
       DISTANCE
       ======================================================== */

    MAP.calculateDistance = function (
        lat1,
        lng1,
        lat2,
        lng2
    ) {

        const R = 6371;

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
       SEARCH LOCATION
       ======================================================== */

    MAP.searchLocation = async function (
        query
    ) {

        query =
            String(
                query || ""
            ).trim();

        if (!query) {
            return [];
        }

        MAP.state.geocoding =
            true;

        try {

            const url =
                MAP.config.geocodingUrl +
                "?format=json" +
                "&limit=5" +
                "&countrycodes=in" +
                "&q=" +
                encodeURIComponent(query);

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

            if (!response.ok) {

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

    MAP.reverseGeocode = async function (
        lat,
        lng
    ) {

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

                        headers: {

                            "Accept":
                                "application/json"
                        }
                    }
                );

            if (!response.ok) {

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
       SET RIDER LOCATION
       ======================================================== */

    MAP.setRiderLocation = function (
        location,
        follow = false
    ) {

        const position =
            MAP.latLng(location);

        if (
            !position ||
            !MAP.state.map
        ) {
            return false;
        }

        MAP.state.riderLocation = {

            lat:
                position[0],

            lng:
                position[1],

            accuracy:
                location.accuracy ||
                null,

            heading:
                location.heading ||
                null,

            speed:
                location.speed ||
                null
        };

        MAP.updateRiderMarker(
            MAP.state.riderLocation
        );

        if (follow) {

            MAP.centerOnLocation(
                MAP.state.riderLocation,
                MAP.config.navigationZoom
            );
        }

        MAP.dispatch(
            "riderx-rider-location-updated",
            MAP.state.riderLocation
        );

        return true;
    };


    /* ========================================================
       CENTER USER
       ======================================================== */

    MAP.centerOnUser = async function () {

        try {

            const location =
                MAP.state.userLocation ||
                await MAP.getCurrentLocation();

            if (
                location &&
                MAP.state.map
            ) {

                MAP.centerOnLocation(
                    location,
                    MAP.config.locationZoom
                );
            }

            return location;

        } catch (error) {

            console.warn(
                "Unable to center on user:",
                error
            );

            return null;
        }
    };


    /* ========================================================
       RIDE STATUS
       ======================================================== */

    MAP.setRideStatus = function (
        status,
        ride
    ) {

        MAP.state.rideStatus =
            String(
                status ||
                "idle"
            ).toLowerCase();

        if (
            ride
        ) {

            if (
                ride.pickup ||
                ride.pickupLocation
            ) {

                const pickup =
                    ride.pickup ||
                    ride.pickupLocation;

                if (
                    MAP.latLng(pickup)
                ) {

                    MAP.state.pickupLocation =
                        {

                            lat:
                                MAP.number(
                                    pickup.lat
                                ),

                            lng:
                                MAP.number(
                                    pickup.lng
                                ),

                            address:
                                pickup.address ||
                                pickup.name ||
                                "Pickup"
                        };

                    MAP.updatePickupMarker();
                }
            }

            if (
                ride.destination ||
                ride.destinationLocation
            ) {

                const destination =
                    ride.destination ||
                    ride.destinationLocation;

                if (
                    MAP.latLng(destination)
                ) {

                    MAP.state.destinationLocation =
                        {

                            lat:
                                MAP.number(
                                    destination.lat
                                ),

                            lng:
                                MAP.number(
                                    destination.lng
                                ),

                            address:
                                destination.address ||
                                destination.name ||
                                "Destination"
                        };

                    MAP.updateDestinationMarker();
                }
            }
        }

        /*
         * ACCEPTED:
         * Rider goes to customer pickup.
         */
        if (
            MAP.state.rideStatus ===
            "accepted"
        ) {

            MAP.state.otpVerified =
                false;

            MAP.state.rideStarted =
                false;

            MAP.drawRiderRoute();

            MAP.dispatch(
                "riderx-navigation-mode",
                "pickup"
            );
        }

        /*
         * ARRIVING / ARRIVED:
         * Keep rider -> pickup navigation.
         */
        if (
            MAP.state.rideStatus ===
            "arriving" ||
            MAP.state.rideStatus ===
            "arrived"
        ) {

            MAP.drawRiderRoute();

            MAP.dispatch(
                "riderx-navigation-mode",
                "pickup"
            );
        }

        /*
         * STARTED:
         * Rider -> destination navigation.
         */
        if (
            MAP.state.rideStatus ===
            "started"
        ) {

            MAP.state.rideStarted =
                true;

            MAP.drawNavigationRoute();

            MAP.dispatch(
                "riderx-navigation-mode",
                "destination"
            );
        }

        /*
         * COMPLETED / CANCELLED
         */
        if (
            MAP.state.rideStatus ===
            "completed" ||
            MAP.state.rideStatus ===
            "cancelled"
        ) {

            MAP.state.rideStarted =
                false;
        }

        MAP.dispatch(
            "riderx-ride-status-changed",
            {

                status:
                    MAP.state.rideStatus,

                ride:
                    ride ||
                    null
            }
        );
    };


    /* ========================================================
       OTP VERIFIED
       ======================================================== */

    MAP.markOtpVerified = function (
        ride
    ) {

        MAP.state.otpVerified =
            true;

        MAP.dispatch(
            "riderx-otp-verified",
            {

                ride:
                    ride ||
                    null,

                canStartRide:
                    true
            }
        );

        /*
         * IMPORTANT:
         * Start Ride is only allowed after this state.
         */
        MAP.dispatch(
            "riderx-start-ride-enabled",
            {

                enabled:
                    true,

                ride:
                    ride ||
                    null
            }
        );

        return true;
    };


    /* ========================================================
       RIDE STARTED
       ======================================================== */

    MAP.markRideStarted = function (
        ride
    ) {

        if (
            !MAP.state.otpVerified
        ) {

            console.warn(
                "RiderX: Ride cannot start before OTP verification."
            );

            MAP.dispatch(
                "riderx-start-ride-blocked",
                {

                    reason:
                        "OTP verification required."
                }
            );

            return false;
        }

        MAP.state.rideStarted =
            true;

        MAP.setRideStatus(
            "started",
            ride
        );

        MAP.dispatch(
            "riderx-ride-started",
            ride ||
            null
        );

        return true;
    };


    /* ========================================================
       CLEAR ROUTE
       ======================================================== */

    MAP.clearRoute = function () {

        if (
            MAP.state.routeLine &&
            MAP.state.map
        ) {

            MAP.state.map.removeLayer(
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
       CLEAR RIDER ROUTE
       ======================================================== */

    MAP.clearRiderRoute = function () {

        if (
            MAP.state.riderRouteLine &&
            MAP.state.map
        ) {

            MAP.state.map.removeLayer(
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


    /* ========================================================
       CLEAR NAVIGATION ROUTE
       ======================================================== */

    MAP.clearNavigationRoute = function () {

        if (
            MAP.state.navigationRouteLine &&
            MAP.state.map
        ) {

            MAP.state.map.removeLayer(
                MAP.state.navigationRouteLine
            );
        }

        MAP.state.navigationRouteLine =
            null;

        MAP.state.navigationRoute =
            null;

        MAP.state.navigationDistance =
            0;

        MAP.state.navigationDuration =
            0;
    };


    /* ========================================================
       CLEAR BOOKING
       ======================================================== */

    MAP.clearBooking = function () {

        const map =
            MAP.state.map;

        const layers = [

            "pickupMarker",

            "destinationMarker",

            "riderMarker",

            "customerMarker",

            "riderRouteLine",

            "navigationRouteLine"
        ];

        layers.forEach(
            function (
                key
            ) {

                const layer =
                    MAP.state[key];

                if (
                    layer &&
                    map
                ) {

                    try {

                        map.removeLayer(
                            layer
                        );

                    } catch (error) {
                        /* Ignore already removed layer. */
                    }
                }

                MAP.state[key] =
                    null;
            }
        );

        MAP.clearRoute();

        MAP.state.pickupLocation =
            null;

        MAP.state.destinationLocation =
            null;

        MAP.state.riderLocation =
            null;

        MAP.state.customerLocation =
            null;

        MAP.state.riderRoute =
            null;

        MAP.state.navigationRoute =
            null;

        MAP.state.rideStatus =
            "idle";

        MAP.state.otpVerified =
            false;

        MAP.state.rideStarted =
            false;

        MAP.state.lastRiderRouteLocation =
            null;

        MAP.state.lastRiderRouteAt =
            0;

        MAP.dispatch(
            "riderx-map-booking-cleared"
        );
    };


    /* ========================================================
       MAP SELECTION
       ======================================================== */

    MAP.enableMapSelection = function () {

        if (
            !MAP.state.map ||
            MAP.state.selectionEnabled
        ) {
            return;
        }

        MAP.state.selectionEnabled =
            true;

        MAP.state.map.on(
            "click",
            async function (
                event
            ) {

                /*
                 * Do not change pickup/destination
                 * while a ride is active.
                 */
                if (
                    MAP.state.rideStatus ===
                    "accepted" ||
                    MAP.state.rideStatus ===
                    "arriving" ||
                    MAP.state.rideStatus ===
                    "arrived" ||
                    MAP.state.rideStatus ===
                    "started"
                ) {
                    return;
                }

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

                    return;
                }

                await MAP.setDestination(
                    {

                        lat:
                            event.latlng.lat,

                        lng:
                            event.latlng.lng
                    }
                );
            }
        );
    };


    /* ========================================================
       BUTTON EVENTS
       ======================================================== */

    MAP.bindButtons = function () {

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
                        function (
                            event
                        ) {

                            event.preventDefault();

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
                        async function (
                            event
                        ) {

                            event.preventDefault();

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
       START MAP
       ======================================================== */

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
         * ALWAYS try GPS first.
         */
        try {

            const location =
                await MAP
                    .getCurrentLocation();

            /*
             * GPS location has priority.
             */
            if (location) {

                const role =
                    MAP.getRole();

                if (
                    role === "customer"
                ) {

                    MAP.state.customerLocation =
                        location;

                    MAP.updateCustomerMarker(
                        location
                    );
                }

                if (
                    role === "rider"
                ) {

                    MAP.state.riderLocation =
                        location;

                    MAP.updateRiderMarker(
                        location
                    );
                }

                MAP.centerOnLocation(
                    location,
                    MAP.config.locationZoom
                );
            }

            if (
                MAP.config.locationWatch
            ) {

                MAP.startLocationWatch();
            }

        } catch (error) {

            /*
             * IMPORTANT:
             * Do NOT pretend Chandigarh is the user's
             * actual location.
             */
            console.warn(
                "RiderX: GPS permission/location unavailable.",
                error
            );

            MAP.dispatch(
                "riderx-gps-required",
                {

                    error:
                        error,

                    message:
                        "Please allow location permission to use your live map."
                }
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

                MAP.state.pickupLocation =
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


    /* ========================================================
       RIDE REQUESTED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-requested",
        function (
            event
        ) {

            MAP.setRideStatus(
                "requested",
                event.detail
            );
        }
    );


    /* ========================================================
       RIDE ACCEPTED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-accepted",
        function (
            event
        ) {

            const ride =
                event.detail ||
                {};

            /*
             * Rider location from ride data.
             */
            if (
                ride.riderLat !==
                undefined &&
                ride.riderLng !==
                undefined
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
            }

            MAP.setRideStatus(
                "accepted",
                ride
            );

            MAP.dispatch(
                "riderx-rider-navigation-started",
                {

                    phase:
                        "pickup",

                    ride:
                        ride
                }
            );
        }
    );


    /* ========================================================
       RIDE ARRIVING
       ======================================================== */

    window.addEventListener(
        "riderx-ride-arriving",
        function (
            event
        ) {

            MAP.setRideStatus(
                "arriving",
                event.detail
            );
        }
    );


    /* ========================================================
       RIDER ARRIVED
       ======================================================== */

    window.addEventListener(
        "riderx-rider-arrived",
        function (
            event
        ) {

            MAP.setRideStatus(
                "arrived",
                event.detail
            );

            /*
             * OTP must be requested now.
             */
            MAP.dispatch(
                "riderx-request-otp",
                event.detail ||
                null
            );
        }
    );


    /* ========================================================
       OTP VERIFIED
       ======================================================== */

    window.addEventListener(
        "riderx-otp-verified",
        function (
            event
        ) {

            MAP.markOtpVerified(
                event.detail
            );
        }
    );


    /* ========================================================
       START RIDE
       ======================================================== */

    window.addEventListener(
        "riderx-start-ride",
        function (
            event
        ) {

            MAP.markRideStarted(
                event.detail
            );
        }
    );


    /* ========================================================
       RIDE STARTED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-started",
        function (
            event
        ) {

            MAP.setRideStatus(
                "started",
                event.detail
            );
        }
    );


    /* ========================================================
       RIDE COMPLETED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-completed",
        function (
            event
        ) {

            MAP.setRideStatus(
                "completed",
                event.detail
            );

            /*
             * Final route can remain visible.
             */
            MAP.dispatch(
                "riderx-navigation-finished",
                event.detail ||
                null
            );
        }
    );


    /* ========================================================
       RIDE CANCELLED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-cancelled",
        function () {

            MAP.clearBooking();
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

    RX.drawRiderRoute =
        MAP.drawRiderRoute;

    RX.drawNavigationRoute =
        MAP.drawNavigationRoute;

    RX.centerOnUser =
        MAP.centerOnUser;

    RX.clearMapBooking =
        MAP.clearBooking;

    RX.setRideStatus =
        MAP.setRideStatus;

    RX.markOtpVerified =
        MAP.markOtpVerified;

    RX.markRideStarted =
        MAP.markRideStarted;


    /* ========================================================
       AUTO INIT
       ======================================================== */

    function autoInit() {

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
        "RiderX Live Map Engine loaded."
    );

})();
