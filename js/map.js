/* ============================================================
   RIDERX 2.0
   MAP ENGINE
   File: js/map.js

   RIDER FLOW
   ------------------------------------------------------------
   CUSTOMER:
   Book Ride
        ↓
   RIDER:
   Accept / Cancel
        ↓
   Accepted
        ↓
   Navigate to Customer Pickup
        ↓
   Live Rider GPS
        ↓
   Arrived at Pickup
        ↓
   Customer OTP Verification
        ↓
   OTP Verified
        ↓
   Start Ride
        ↓
   Destination Navigation
        ↓
   Complete Ride

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
   - Live rider → pickup navigation
   - Live rider → destination navigation
   - Pickup arrival detection
   - Ride lifecycle state
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

        navigationZoom:
            17,

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

        /*
         * Rider is considered to have reached
         * customer pickup when within this radius.
         */
        pickupArrivalRadius:
            100,

        /*
         * Rider is considered to have reached
         * destination when within this radius.
         */
        destinationArrivalRadius:
            100,

        /*
         * Minimum time between route refreshes.
         */
        routeRefreshInterval:
            5000
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

        riderRouteDistance:
            0,

        riderRouteDuration:
            0,

        locating:
            false,

        routing:
            false,

        geocoding:
            false,

        lastRouteUpdate:
            0,

        mapSelectionBound:
            false,

        buttonsBound:
            false,

        /*
         * IMPORTANT:
         *
         * requested
         * accepted
         * heading_to_pickup
         * arrived_pickup
         * otp_verified
         * in_progress
         * completed
         * cancelled
         */
        rideStatus:
            "idle",

        rideId:
            null,

        rideData:
            null,

        otpVerified:
            false,

        riderNavigationActive:
            false,

        destinationNavigationActive:
            false,

        pickupArrivalEmitted:
            false,

        destinationArrivalEmitted:
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
                Number(location.lat);

            const lng =
                Number(location.lng);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
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


    MAP.getRole =
        function () {

            try {

                const keys = [
                    "riderx_user",
                    "riderx_customer",
                    "riderx_rider"
                ];


                for (
                    const key of keys
                ) {

                    const raw =
                        localStorage.getItem(
                            key
                        );


                    if (!raw) {
                        continue;
                    }


                    const user =
                        JSON.parse(raw);


                    if (
                        user &&
                        user.role
                    ) {

                        return String(
                            user.role
                        ).toLowerCase();
                    }


                    if (
                        key ===
                        "riderx_rider"
                    ) {

                        return "rider";
                    }


                    if (
                        key ===
                        "riderx_customer"
                    ) {

                        return "customer";
                    }
                }

            } catch (error) {

                console.warn(
                    "Unable to detect RiderX role:",
                    error
                );
            }


            return "";
        };


    MAP.isRider =
        function () {

            return (
                MAP.getRole() ===
                "rider"
            );
        };


    MAP.isCustomer =
        function () {

            return (
                MAP.getRole() ===
                "customer"
            );
        };


    MAP.dispatch =
        function (
            name,
            detail
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail:
                            detail || {}
                    }
                )
            );
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
                             * Customer can use
                             * current location
                             * as pickup.
                             *
                             * Rider must NEVER
                             * automatically turn
                             * his own location
                             * into pickup.
                             */
                            if (
                                MAP.isCustomer() &&
                                !MAP.state
                                    .pickupLocation
                            ) {

                                MAP.setPickup(
                                    location,
                                    false
                                );
                            }


                            /*
                             * Rider live navigation.
                             */
                            if (
                                MAP.isRider()
                            ) {

                                MAP.setRiderLocation(
                                    location,
                                    false
                                );
                            }


                            MAP.checkRideProximity(
                                location
                            );


                            MAP.dispatch(
                                "riderx-live-location",
                                location
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


            MAP.dispatch(
                "riderx-pickup-set",
                MAP.state.pickupLocation
            );


            MAP.dispatch(
                "riderx-pickup-changed",
                MAP.state.pickupLocation
            );


            /*
             * If rider has already accepted
             * the ride, refresh navigation.
             */
            if (
                MAP.isRider() &&
                (
                    MAP.state.rideStatus ===
                    "heading_to_pickup"
                )
            ) {

                MAP.drawRiderToPickupRoute();
            }


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

                            /*
                             * Customer can move
                             * pickup.
                             *
                             * Rider pickup marker
                             * should not be draggable.
                             */
                            draggable:
                                MAP.isCustomer(),

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

                            if (
                                !MAP.isCustomer()
                            ) {

                                return;
                            }


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
                                MAP.isCustomer(),

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

                            if (
                                !MAP.isCustomer()
                            ) {

                                return;
                            }


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
       CUSTOMER ROUTE
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


                MAP.fitRoute();


                if (
                    RX.booking &&
                    RX.booking.state
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


                MAP.dispatch(
                    "riderx-route-updated",
                    {

                        distanceKm:
                            MAP.state
                                .routeDistance,

                        durationMin:
                            MAP.state
                                .routeDuration,

                        route:
                            route
                    }
                );


                return route;

            } catch (error) {

                console.warn(
                    "Route error:",
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
                    null,

                speed:
                    location.speed ||
                    null,

                accuracy:
                    location.accuracy ||
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


            /*
             * During active navigation,
             * keep rider map centered.
             */
            if (
                follow ||
                (
                    MAP.isRider() &&
                    (
                        MAP.state.rideStatus ===
                        "heading_to_pickup" ||
                        MAP.state.rideStatus ===
                        "otp_verified" ||
                        MAP.state.rideStatus ===
                        "in_progress"
                    )
                )
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


            MAP.checkRideProximity(
                MAP.state.riderLocation
            );


            MAP.dispatch(
                "riderx-rider-location-updated",
                MAP.state.riderLocation
            );
        };


    /* ========================================================
       RIDER → PICKUP ROUTE
       ======================================================== */

    MAP.drawRiderToPickupRoute =
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


            const now =
                Date.now();


            if (
                now -
                MAP.state.lastRouteUpdate <
                MAP.config
                    .routeRefreshInterval
            ) {

                return MAP.state
                    .riderCurrentRoute;
            }


            MAP.state.lastRouteUpdate =
                now;


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
                        "Pickup route unavailable."
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


                MAP.state
                    .riderCurrentRoute =
                    route;


                MAP.state
                    .riderRouteDistance =
                    MAP.round(
                        route.distance /
                        1000
                    );


                MAP.state
                    .riderRouteDuration =
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
                                    5,

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


                MAP.dispatch(
                    "riderx-pickup-navigation-updated",
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
                    "Rider → pickup route failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       RIDER → DESTINATION ROUTE
       ======================================================== */

    MAP.drawRiderToDestinationRoute =
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
                MAP.latLng(
                    rider
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
                        "Destination route unavailable."
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


                MAP.state
                    .riderCurrentRoute =
                    route;


                MAP.state
                    .riderRouteDistance =
                    MAP.round(
                        route.distance /
                        1000
                    );


                MAP.state
                    .riderRouteDuration =
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
                                    5,

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


                MAP.dispatch(
                    "riderx-destination-navigation-updated",
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
                    "Rider → destination route failed:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       START RIDER PICKUP NAVIGATION
       ======================================================== */

    MAP.startPickupNavigation =
        async function (
            ride
        ) {

            MAP.state.rideData =
                ride || {};

            MAP.state.rideId =
                ride &&
                (
                    ride.id ||
                    ride.rideId ||
                    ride.bookingId
                ) ||
                MAP.state.rideId;


            MAP.state.rideStatus =
                "heading_to_pickup";


            MAP.state.otpVerified =
                false;


            MAP.state.riderNavigationActive =
                true;


            MAP.state
                .destinationNavigationActive =
                false;


            MAP.state
                .pickupArrivalEmitted =
                false;


            /*
             * NEVER allow direct Start Ride
             * immediately after accepting.
             */
            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "heading_to_pickup",

                    ride:
                        MAP.state.rideData
                }
            );


            MAP.dispatch(
                "riderx-navigation-started",
                {

                    navigation:
                        "pickup",

                    ride:
                        MAP.state.rideData
                }
            );


            /*
             * If ride data contains pickup
             * coordinates, set them.
             */
            if (
                ride &&
                ride.pickupLat !== undefined &&
                ride.pickupLng !== undefined
            ) {

                await MAP.setPickup(
                    {

                        lat:
                            ride.pickupLat,

                        lng:
                            ride.pickupLng,

                        address:
                            ride.pickupAddress ||
                            ride.pickup ||
                            "Customer pickup"
                    },
                    false
                );
            }


            if (
                ride &&
                ride.destinationLat !== undefined &&
                ride.destinationLng !== undefined
            ) {

                await MAP.setDestination(
                    {

                        lat:
                            ride.destinationLat,

                        lng:
                            ride.destinationLng,

                        address:
                            ride.destinationAddress ||
                            ride.destination ||
                            "Destination"
                    },
                    false
                );
            }


            /*
             * Get rider GPS before drawing route.
             */
            if (
                !MAP.state.riderLocation
            ) {

                try {

                    await MAP.getCurrentLocation();

                } catch (error) {

                    console.warn(
                        "Rider GPS unavailable:",
                        error
                    );
                }
            }


            if (
                MAP.state.riderLocation &&
                MAP.state.pickupLocation
            ) {

                await MAP
                    .drawRiderToPickupRoute();
            }


            MAP.dispatch(
                "riderx-pickup-navigation-ready",
                {

                    ride:
                        MAP.state.rideData,

                    pickup:
                        MAP.state
                            .pickupLocation
                }
            );


            return true;
        };


    /* ========================================================
       MARK RIDER ARRIVED AT PICKUP
       ======================================================== */

    MAP.markArrivedAtPickup =
        function () {

            if (
                MAP.state.rideStatus !==
                "heading_to_pickup"
            ) {

                return false;
            }


            MAP.state.rideStatus =
                "arrived_pickup";


            MAP.state.riderNavigationActive =
                false;


            /*
             * Do NOT set otpVerified here.
             *
             * Rider must receive and verify
             * customer OTP first.
             */
            MAP.state.otpVerified =
                false;


            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "arrived_pickup",

                    ride:
                        MAP.state.rideData
                }
            );


            MAP.dispatch(
                "riderx-arrived-pickup",
                {

                    ride:
                        MAP.state.rideData,

                    pickup:
                        MAP.state
                            .pickupLocation,

                    requiresOtp:
                        true
                }
            );


            return true;
        };


    /* ========================================================
       VERIFY PICKUP OTP
       ======================================================== */

    MAP.verifyPickupOtp =
        function (
            otp
        ) {

            otp =
                String(
                    otp || ""
                )
                .trim();


            /*
             * Map engine does not know the
             * Firebase OTP secret.
             *
             * booking/auth backend must verify it.
             *
             * This method is called only after
             * backend verification succeeds.
             */
            if (
                MAP.state.rideStatus !==
                "arrived_pickup"
            ) {

                return false;
            }


            MAP.state.otpVerified =
                true;


            MAP.state.rideStatus =
                "otp_verified";


            MAP.dispatch(
                "riderx-otp-verified",
                {

                    ride:
                        MAP.state.rideData,

                    otpVerified:
                        true
                }
            );


            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "otp_verified",

                    ride:
                        MAP.state.rideData
                }
            );


            /*
             * Only now is Start Ride allowed.
             */
            MAP.dispatch(
                "riderx-start-ride-enabled",
                {

                    ride:
                        MAP.state.rideData,

                    allowed:
                        true
                }
            );


            return true;
        };


    /* ========================================================
       START ACTIVE RIDE
       ======================================================== */

    MAP.startRide =
        async function (
            ride
        ) {

            /*
             * HARD SAFETY CHECK:
             *
             * Start Ride is impossible until
             * rider reached pickup and OTP
             * has been verified.
             */
            if (
                MAP.state.rideStatus !==
                "otp_verified"
            ) {

                console.warn(
                    "RiderX: Start Ride blocked. Pickup OTP is not verified."
                );


                MAP.dispatch(
                    "riderx-start-ride-blocked",
                    {

                        reason:
                            "OTP verification required.",

                        status:
                            MAP.state
                                .rideStatus
                    }
                );


                return false;
            }


            MAP.state.rideStatus =
                "in_progress";


            MAP.state.riderNavigationActive =
                false;


            MAP.state
                .destinationNavigationActive =
                true;


            MAP.state
                .destinationArrivalEmitted =
                false;


            if (ride) {

                MAP.state.rideData =
                    ride;
            }


            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "in_progress",

                    ride:
                        MAP.state.rideData
                }
            );


            MAP.dispatch(
                "riderx-ride-started",
                {

                    ride:
                        MAP.state.rideData
                }
            );


            /*
             * Now route rider to destination.
             */
            if (
                MAP.state.riderLocation &&
                MAP.state.destinationLocation
            ) {

                await MAP
                    .drawRiderToDestinationRoute();
            }


            return true;
        };


    /* ========================================================
       COMPLETE RIDE
       ======================================================== */

    MAP.completeRide =
        function (
            ride
        ) {

            /*
             * Ride can only be completed
             * after it actually started.
             */
            if (
                MAP.state.rideStatus !==
                "in_progress"
            ) {

                return false;
            }


            MAP.state.rideStatus =
                "completed";


            MAP.state
                .destinationNavigationActive =
                false;


            if (ride) {

                MAP.state.rideData =
                    ride;
            }


            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "completed",

                    ride:
                        MAP.state.rideData
                }
            );


            MAP.dispatch(
                "riderx-ride-completed",
                {

                    ride:
                        MAP.state.rideData
                }
            );


            return true;
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    MAP.cancelRide =
        function (
            ride
        ) {

            MAP.state.rideStatus =
                "cancelled";


            MAP.state.riderNavigationActive =
                false;


            MAP.state
                .destinationNavigationActive =
                false;


            MAP.state.otpVerified =
                false;


            if (ride) {

                MAP.state.rideData =
                    ride;
            }


            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "cancelled",

                    ride:
                        MAP.state.rideData
                }
            );


            MAP.dispatch(
                "riderx-ride-cancelled",
                {

                    ride:
                        MAP.state.rideData
                }
            );


            return true;
        };


    /* ========================================================
       ACCEPT RIDE
       ======================================================== */

    MAP.acceptRide =
        async function (
            ride
        ) {

            if (
                !ride
            ) {

                return false;
            }


            /*
             * Accept means ONLY accepted.
             *
             * It does NOT mean Start Ride.
             */
            MAP.state.rideData =
                ride;


            MAP.state.rideId =
                ride.id ||
                ride.rideId ||
                ride.bookingId ||
                null;


            MAP.state.rideStatus =
                "accepted";


            MAP.state.otpVerified =
                false;


            MAP.dispatch(
                "riderx-ride-accepted",
                ride
            );


            MAP.dispatch(
                "riderx-ride-state-changed",
                {

                    status:
                        "accepted",

                    ride:
                        ride
                }
            );


            /*
             * Immediately move to
             * customer pickup navigation.
             */
            await MAP.startPickupNavigation(
                ride
            );


            return true;
        };


    /* ========================================================
       CHECK PICKUP / DESTINATION PROXIMITY
       ======================================================== */

    MAP.checkRideProximity =
        function (
            location
        ) {

            const position =
                MAP.latLng(
                    location
                );


            if (!position) {
                return;
            }


            /*
             * RIDER → PICKUP
             */
            if (
                MAP.state.rideStatus ===
                "heading_to_pickup"
            ) {

                const pickup =
                    MAP.latLng(
                        MAP.state
                            .pickupLocation
                    );


                if (pickup) {

                    const distance =
                        MAP.calculateDistance(
                            position[0],
                            position[1],
                            pickup[0],
                            pickup[1]
                        ) *
                        1000;


                    MAP.dispatch(
                        "riderx-pickup-distance-updated",
                        {

                            meters:
                                Math.round(
                                    distance
                                ),

                            kilometers:
                                MAP.round(
                                    distance /
                                    1000
                                )
                        }
                    );


                    if (
                        distance <=
                        MAP.config
                            .pickupArrivalRadius
                    ) {

                        if (
                            !MAP.state
                                .pickupArrivalEmitted
                        ) {

                            MAP.state
                                .pickupArrivalEmitted =
                                true;


                            MAP.markArrivedAtPickup();
                        }
                    }
                }
            }


            /*
             * RIDER → DESTINATION
             */
            if (
                MAP.state.rideStatus ===
                "in_progress"
            ) {

                const destination =
                    MAP.latLng(
                        MAP.state
                            .destinationLocation
                    );


                if (destination) {

                    const distance =
                        MAP.calculateDistance(
                            position[0],
                            position[1],
                            destination[0],
                            destination[1]
                        ) *
                        1000;


                    MAP.dispatch(
                        "riderx-destination-distance-updated",
                        {

                            meters:
                                Math.round(
                                    distance
                                ),

                            kilometers:
                                MAP.round(
                                    distance /
                                    1000
                                )
                        }
                    );


                    if (
                        distance <=
                        MAP.config
                            .destinationArrivalRadius
                    ) {

                        if (
                            !MAP.state
                                .destinationArrivalEmitted
                        ) {

                            MAP.state
                                .destinationArrivalEmitted =
                                true;


                            MAP.dispatch(
                                "riderx-near-destination",
                                {

                                    meters:
                                        Math.round(
                                            distance
                                        ),

                                    ride:
                                        MAP.state
                                            .rideData
                                }
                            );
                        }
                    }
                }
            }
        };


    /* ========================================================
       DRAW LEGACY RIDER ROUTE
       ======================================================== */

    MAP.drawRiderRoute =
        async function () {

            if (
                MAP.state.rideStatus ===
                "heading_to_pickup"
            ) {

                return MAP
                    .drawRiderToPickupRoute();
            }


            if (
                MAP.state.rideStatus ===
                "in_progress"
            ) {

                return MAP
                    .drawRiderToDestinationRoute();
            }


            /*
             * Legacy behavior:
             * rider → pickup.
             */
            return MAP
                .drawRiderToPickupRoute();
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
       CLEAR ALL MARKERS / BOOKING
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


            MAP.state.rideData =
                null;

            MAP.state.rideId =
                null;

            MAP.state.rideStatus =
                "idle";

            MAP.state.otpVerified =
                false;

            MAP.state.riderNavigationActive =
                false;

            MAP.state
                .destinationNavigationActive =
                false;

            MAP.state.pickupArrivalEmitted =
                false;

            MAP.state
                .destinationArrivalEmitted =
                false;

            MAP.state.riderCurrentRoute =
                null;

            MAP.state.riderRouteDistance =
                0;

            MAP.state.riderRouteDuration =
                0;


            MAP.clearRoute();


            MAP.dispatch(
                "riderx-map-booking-cleared"
            );
        };


    /* ========================================================
       MAP CLICK
       ======================================================== */

    MAP.enableMapSelection =
        function () {

            if (
                !MAP.state.map ||
                MAP.state.mapSelectionBound
            ) {

                return;
            }


            /*
             * Rider map must NOT create
             * pickup/destination by clicking.
             */
            if (
                MAP.isRider()
            ) {

                return;
            }


            MAP.state.mapSelectionBound =
                true;


            MAP.state.map.on(
                "click",
                async function (
                    event
                ) {

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

                                if (
                                    !MAP.isCustomer()
                                ) {

                                    return;
                                }


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


            try {

                await MAP
                    .getCurrentLocation();


                if (
                    MAP.config
                        .locationWatch
                ) {

                    MAP.startLocationWatch();
                }

            } catch (error) {

                console.warn(
                    "GPS permission not available:",
                    error
                );


                /*
                 * Still start watch if possible.
                 */
                MAP.startLocationWatch();
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


                if (
                    MAP.state
                        .rideStatus ===
                    "heading_to_pickup"
                ) {

                    MAP.drawRiderToPickupRoute();
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

                MAP.state
                    .destinationLocation =
                    event.detail;


                MAP.updateDestinationMarker();


                if (
                    MAP.state
                        .rideStatus ===
                    "in_progress"
                ) {

                    MAP.drawRiderToDestinationRoute();
                }
            }
        }
    );


    /* ========================================================
       RIDE ACCEPTED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-accepted",
        async function (
            event
        ) {

            const ride =
                event.detail;


            if (!ride) {
                return;
            }


            /*
             * IMPORTANT:
             *
             * This does NOT start the ride.
             *
             * It starts rider → customer
             * pickup navigation.
             */
            await MAP.startPickupNavigation(
                ride
            );
        }
    );


    /* ========================================================
       RIDE START REQUEST
       ======================================================== */

    window.addEventListener(
        "riderx-start-ride-request",
        async function (
            event
        ) {

            const ride =
                event.detail ||
                MAP.state.rideData;


            await MAP.startRide(
                ride
            );
        }
    );


    /* ========================================================
       OTP VERIFIED
       ======================================================== */

    window.addEventListener(
        "riderx-pickup-otp-verified",
        function (
            event
        ) {

            /*
             * Backend/booking.js should dispatch
             * this only AFTER actual OTP verification.
             */
            MAP.verifyPickupOtp(
                event.detail &&
                event.detail.otp
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
       RIDE COMPLETED
       ======================================================== */

    window.addEventListener(
        "riderx-ride-completed",
        function () {

            /*
             * Keep final route visible.
             * Next booking can clear it.
             */
            MAP.state.rideStatus =
                "completed";


            MAP.state
                .destinationNavigationActive =
                false;
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


    RX.drawRiderToPickupRoute =
        MAP.drawRiderToPickupRoute;


    RX.drawRiderToDestinationRoute =
        MAP.drawRiderToDestinationRoute;


    RX.centerOnUser =
        MAP.centerOnUser;


    RX.clearMapBooking =
        MAP.clearBooking;


    /*
     * New ride lifecycle API.
     */
    RX.acceptRide =
        MAP.acceptRide;


    RX.startPickupNavigation =
        MAP.startPickupNavigation;


    RX.markArrivedAtPickup =
        MAP.markArrivedAtPickup;


    RX.verifyPickupOtp =
        MAP.verifyPickupOtp;


    RX.startRide =
        MAP.startRide;


    RX.completeRide =
        MAP.completeRide;


    RX.cancelRide =
        MAP.cancelRide;


    RX.getRideStatus =
        function () {

            return MAP.state
                .rideStatus;
        };


    RX.getRideState =
        function () {

            return {

                status:
                    MAP.state
                        .rideStatus,

                rideId:
                    MAP.state
                        .rideId,

                otpVerified:
                    MAP.state
                        .otpVerified,

                ride:
                    MAP.state
                        .rideData
            };
        };


    /* ========================================================
       AUTO INIT
       ======================================================== */

    function autoInit() {

        /*
         * Don't force map initialization
         * on pages without a map.
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
        "RiderX Map Engine loaded — ride lifecycle enabled."
    );

})();
