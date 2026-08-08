/* ============================================================
   RIDERX CUSTOMER MAP
   File: js/customer-map.js

   Customer-side map controller
   - Leaflet / OpenStreetMap
   - Current customer location
   - Pickup marker
   - Destination marker
   - Route drawing
   - Driver live location
   - Map fitting
   - Location permission handling
   - Booking page integration
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const CM = RX.customerMap = RX.customerMap || {};

    CM.state = {
        initialized: false,
        map: null,
        customerMarker: null,
        pickupMarker: null,
        destinationMarker: null,
        riderMarker: null,
        routeLine: null,
        accuracyCircle: null,
        watchId: null,
        pickup: null,
        destination: null,
        riderLocation: null,
        currentLocation: null,
        geocoderBusy: false
    };


    /* ========================================================
       CONFIG
       ======================================================== */

    CM.config = {
        defaultCenter: [30.7333, 76.7794],
        defaultZoom: 13,
        locationZoom: 16,
        routeColor: "#f7c600",
        riderColor: "#111111",
        maxZoom: 17,
        locationTimeout: 12000
    };


    /* ========================================================
       LEAFLET CHECK
       ======================================================== */

    CM.isLeafletReady = function () {

        return (
            typeof window.L !== "undefined"
        );
    };


    /* ========================================================
       MAP ELEMENT
       ======================================================== */

    CM.getMapElement = function () {

        return (
            document.querySelector("[data-customer-map]") ||
            document.getElementById("customerMap") ||
            document.getElementById("map") ||
            document.querySelector(".customer-map")
        );
    };


    /* ========================================================
       INIT
       ======================================================== */

    CM.init = function (element) {

        if (CM.state.initialized) {
            return CM.state.map;
        }

        if (!CM.isLeafletReady()) {

            console.error(
                "RiderX: Leaflet is not loaded."
            );

            return null;
        }


        const mapElement =
            element ||
            CM.getMapElement();


        if (!mapElement) {

            console.warn(
                "RiderX: Customer map element not found."
            );

            return null;
        }


        CM.state.map =
            L.map(
                mapElement,
                {
                    zoomControl: false,
                    attributionControl: true,
                    preferCanvas: true
                }
            )
            .setView(
                CM.config.defaultCenter,
                CM.config.defaultZoom
            );


        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        )
        .addTo(
            CM.state.map
        );


        CM.addControls();

        CM.bindEvents();

        CM.state.initialized = true;


        setTimeout(
            function () {

                try {
                    CM.state.map.invalidateSize();
                } catch (error) {}

            },
            300
        );


        CM.locateCustomer();


        RX.emit =
            RX.emit ||
            function (name, detail) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-" + name,
                        {
                            detail:
                                detail || {}
                        }
                    )
                );
            };


        return CM.state.map;
    };


    /* ========================================================
       CONTROLS
       ======================================================== */

    CM.addControls = function () {

        if (!CM.state.map) {
            return;
        }


        const ZoomControl =
            L.Control.extend({

                options: {
                    position: "bottomright"
                },

                onAdd: function () {

                    const container =
                        L.DomUtil.create(
                            "div",
                            "riderx-map-controls"
                        );


                    const zoomIn =
                        L.DomUtil.create(
                            "button",
                            "riderx-map-control",
                            container
                        );


                    zoomIn.type = "button";
                    zoomIn.innerHTML = "+";
                    zoomIn.setAttribute(
                        "aria-label",
                        "Zoom in"
                    );


                    const locate =
                        L.DomUtil.create(
                            "button",
                            "riderx-map-control",
                            container
                        );


                    locate.type = "button";
                    locate.innerHTML = "⌖";
                    locate.setAttribute(
                        "aria-label",
                        "My location"
                    );


                    const zoomOut =
                        L.DomUtil.create(
                            "button",
                            "riderx-map-control",
                            container
                        );


                    zoomOut.type = "button";
                    zoomOut.innerHTML = "−";
                    zoomOut.setAttribute(
                        "aria-label",
                        "Zoom out"
                    );


                    L.DomEvent.disableClickPropagation(
                        container
                    );


                    L.DomEvent.on(
                        zoomIn,
                        "click",
                        function () {

                            CM.state.map.zoomIn();

                        }
                    );


                    L.DomEvent.on(
                        zoomOut,
                        "click",
                        function () {

                            CM.state.map.zoomOut();

                        }
                    );


                    L.DomEvent.on(
                        locate,
                        "click",
                        function () {

                            CM.locateCustomer(
                                true
                            );

                        }
                    );


                    return container;
                }
            });


        CM.state.map.addControl(
            new ZoomControl()
        );
    };


    /* ========================================================
       EVENTS
       ======================================================== */

    CM.bindEvents = function () {

        if (!CM.state.map) {
            return;
        }


        CM.state.map.on(
            "click",
            function (event) {

                const point = {
                    lat:
                        event.latlng.lat,

                    lng:
                        event.latlng.lng
                };


                CM.setDestination(
                    point,
                    true
                );
            }
        );
    };


    /* ========================================================
       CUSTOMER LOCATION
       ======================================================== */

    CM.locateCustomer = function (
        force
    ) {

        if (
            !navigator.geolocation
        ) {

            CM.showLocationError(
                "Location is not supported on this device."
            );

            return;
        }


        navigator.geolocation.getCurrentPosition(

            function (position) {

                const point = {
                    lat:
                        position.coords.latitude,

                    lng:
                        position.coords.longitude
                };


                CM.state.currentLocation =
                    point;


                CM.setCustomerLocation(
                    point,
                    position.coords.accuracy
                );


                if (
                    force ||
                    !CM.state.pickup
                ) {

                    CM.setPickup(
                        point,
                        false
                    );
                }


                CM.startLocationTracking();
            },


            function (error) {

                console.warn(
                    "RiderX location error:",
                    error
                );


                CM.showLocationError(
                    "Location permission is required for accurate pickup."
                );
            },

            {
                enableHighAccuracy: true,
                timeout:
                    CM.config.locationTimeout,
                maximumAge: 5000
            }
        );
    };


    /* ========================================================
       LIVE LOCATION TRACKING
       ======================================================== */

    CM.startLocationTracking = function () {

        if (
            !navigator.geolocation
        ) {
            return;
        }


        CM.stopLocationTracking();


        CM.state.watchId =
            navigator.geolocation.watchPosition(

                function (position) {

                    const point = {
                        lat:
                            position.coords.latitude,

                        lng:
                            position.coords.longitude
                    };


                    CM.state.currentLocation =
                        point;


                    CM.setCustomerLocation(
                        point,
                        position.coords.accuracy
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-customer-location",
                            {
                                detail: {
                                    lat:
                                        point.lat,

                                    lng:
                                        point.lng,

                                    accuracy:
                                        position.coords.accuracy
                                }
                            }
                        )
                    );
                },

                function (error) {

                    console.warn(
                        "Customer location tracking error:",
                        error
                    );
                },

                {
                    enableHighAccuracy: true,
                    maximumAge: 3000,
                    timeout: 15000
                }
            );
    };


    CM.stopLocationTracking = function () {

        if (
            CM.state.watchId !== null &&
            navigator.geolocation
        ) {

            navigator.geolocation.clearWatch(
                CM.state.watchId
            );
        }


        CM.state.watchId = null;
    };


    /* ========================================================
       CUSTOMER MARKER
       ======================================================== */

    CM.createCustomerIcon = function () {

        return L.divIcon({

            className:
                "riderx-customer-marker-wrapper",

            html:
                `
                <div class="riderx-customer-marker">
                    <span></span>
                </div>
                `,

            iconSize: [34, 34],

            iconAnchor: [17, 17]
        });
    };


    CM.setCustomerLocation = function (
        point,
        accuracy
    ) {

        if (!CM.state.map) {
            return;
        }


        const latLng =
            [point.lat, point.lng];


        if (
            !CM.state.customerMarker
        ) {

            CM.state.customerMarker =
                L.marker(
                    latLng,
                    {
                        icon:
                            CM.createCustomerIcon(),
                        zIndexOffset:
                            1000
                    }
                )
                .addTo(
                    CM.state.map
                );

        } else {

            CM.state.customerMarker.setLatLng(
                latLng
            );
        }


        if (
            accuracy &&
            Number(accuracy) > 0
        ) {

            if (
                !CM.state.accuracyCircle
            ) {

                CM.state.accuracyCircle =
                    L.circle(
                        latLng,
                        {
                            radius:
                                accuracy,
                            weight:
                                1,
                            fillOpacity:
                                0.08
                        }
                    )
                    .addTo(
                        CM.state.map
                    );

            } else {

                CM.state.accuracyCircle
                    .setLatLng(
                        latLng
                    )
                    .setRadius(
                        accuracy
                    );
            }
        }
    };


    /* ========================================================
       PICKUP
       ======================================================== */

    CM.createPickupIcon = function () {

        return L.divIcon({

            className:
                "riderx-pickup-marker-wrapper",

            html:
                `
                <div class="riderx-pickup-marker">
                    <span></span>
                </div>
                `,

            iconSize: [34, 34],

            iconAnchor: [17, 17]
        });
    };


    CM.setPickup = function (
        point,
        moveMap
    ) {

        if (!point) {
            return;
        }


        CM.state.pickup =
            {
                lat:
                    Number(point.lat),

                lng:
                    Number(point.lng),

                address:
                    point.address ||
                    ""
            };


        if (!CM.state.map) {
            return;
        }


        const latLng = [
            CM.state.pickup.lat,
            CM.state.pickup.lng
        ];


        if (
            !CM.state.pickupMarker
        ) {

            CM.state.pickupMarker =
                L.marker(
                    latLng,
                    {
                        icon:
                            CM.createPickupIcon(),
                        draggable:
                            true,
                        zIndexOffset:
                            800
                    }
                )
                .addTo(
                    CM.state.map
                );


            CM.state.pickupMarker.on(
                "dragend",
                function () {

                    const position =
                        CM.state.pickupMarker
                            .getLatLng();


                    CM.state.pickup = {
                        lat:
                            position.lat,

                        lng:
                            position.lng,

                        address:
                            ""
                    };


                    CM.reverseGeocode(
                        CM.state.pickup
                    );
                }
            );

        } else {

            CM.state.pickupMarker.setLatLng(
                latLng
            );
        }


        if (moveMap) {

            CM.state.map.setView(
                latLng,
                CM.config.locationZoom
            );
        }


        CM.reverseGeocode(
            CM.state.pickup
        );


        CM.emitLocationChange();
    };


    /* ========================================================
       DESTINATION
       ======================================================== */

    CM.createDestinationIcon =
        function () {

            return L.divIcon({

                className:
                    "riderx-destination-marker-wrapper",

                html:
                    `
                    <div class="riderx-destination-marker">
                        <span></span>
                    </div>
                    `,

                iconSize: [36, 36],

                iconAnchor: [18, 36]
            });
        };


    CM.setDestination = function (
        point,
        reverseGeocode
    ) {

        if (!point) {
            return;
        }


        CM.state.destination =
            {
                lat:
                    Number(point.lat),

                lng:
                    Number(point.lng),

                address:
                    point.address ||
                    ""
            };


        if (!CM.state.map) {
            return;
        }


        const latLng = [
            CM.state.destination.lat,
            CM.state.destination.lng
        ];


        if (
            !CM.state.destinationMarker
        ) {

            CM.state.destinationMarker =
                L.marker(
                    latLng,
                    {
                        icon:
                            CM.createDestinationIcon(),
                        draggable:
                            true,
                        zIndexOffset:
                            900
                    }
                )
                .addTo(
                    CM.state.map
                );


            CM.state.destinationMarker.on(
                "dragend",
                function () {

                    const position =
                        CM.state.destinationMarker
                            .getLatLng();


                    CM.state.destination = {
                        lat:
                            position.lat,

                        lng:
                            position.lng,

                        address:
                            ""
                    };


                    CM.reverseGeocode(
                        CM.state.destination
                    );


                    CM.emitLocationChange();
                }
            );

        } else {

            CM.state.destinationMarker
                .setLatLng(
                    latLng
                );
        }


        if (reverseGeocode !== false) {

            CM.reverseGeocode(
                CM.state.destination
            );
        }


        CM.fitPickupDestination();


        CM.emitLocationChange();


        if (
            RX.booking &&
            typeof RX.booking
                .setDestination ===
            "function"
        ) {

            RX.booking.setDestination(
                CM.state.destination
            );
        }
    };


    /* ========================================================
       CLEAR DESTINATION
       ======================================================== */

    CM.clearDestination = function () {

        if (
            CM.state.destinationMarker &&
            CM.state.map
        ) {

            CM.state.map.removeLayer(
                CM.state.destinationMarker
            );
        }


        CM.state.destinationMarker =
            null;

        CM.state.destination =
            null;


        CM.clearRoute();


        CM.emitLocationChange();
    };


    /* ========================================================
       CLEAR PICKUP
       ======================================================== */

    CM.clearPickup = function () {

        if (
            CM.state.pickupMarker &&
            CM.state.map
        ) {

            CM.state.map.removeLayer(
                CM.state.pickupMarker
            );
        }


        CM.state.pickupMarker =
            null;

        CM.state.pickup =
            null;


        CM.clearRoute();


        CM.emitLocationChange();
    };


    /* ========================================================
       ROUTE
       ======================================================== */

    CM.drawRoute = async function (
        start,
        end
    ) {

        if (
            !start ||
            !end ||
            !CM.state.map
        ) {
            return null;
        }


        const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            encodeURIComponent(
                start.lng
            ) +
            "," +
            encodeURIComponent(
                start.lat
            ) +
            ";" +
            encodeURIComponent(
                end.lng
            ) +
            "," +
            encodeURIComponent(
                end.lat
            ) +
            "?overview=full&geometries=geojson";


        try {

            const response =
                await fetch(
                    url
                );


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


            CM.clearRoute();


            CM.state.routeLine =
                L.geoJSON(
                    route.geometry,
                    {
                        style: {
                            weight:
                                6,

                            opacity:
                                0.9,

                            color:
                                CM.config.routeColor,

                            lineCap:
                                "round",

                            lineJoin:
                                "round"
                        }
                    }
                )
                .addTo(
                    CM.state.map
                );


            CM.fitPickupDestination();


            const result = {

                distance:
                    route.distance,

                duration:
                    route.duration,

                geometry:
                    route.geometry
            };


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-route-updated",
                    {
                        detail:
                            result
                    }
                )
            );


            return result;

        } catch (error) {

            console.warn(
                "RiderX route error:",
                error
            );


            CM.drawStraightRoute(
                start,
                end
            );


            return null;
        }
    };


    /* ========================================================
       STRAIGHT ROUTE FALLBACK
       ======================================================== */

    CM.drawStraightRoute = function (
        start,
        end
    ) {

        if (!CM.state.map) {
            return;
        }


        CM.clearRoute();


        CM.state.routeLine =
            L.polyline(
                [
                    [
                        start.lat,
                        start.lng
                    ],

                    [
                        end.lat,
                        end.lng
                    ]
                ],
                {
                    weight:
                        5,

                    opacity:
                        0.8,

                    dashArray:
                        "8 8",

                    color:
                        CM.config.routeColor
                }
            )
            .addTo(
                CM.state.map
            );
    };


    CM.clearRoute = function () {

        if (
            CM.state.routeLine &&
            CM.state.map
        ) {

            CM.state.map.removeLayer(
                CM.state.routeLine
            );
        }


        CM.state.routeLine =
            null;
    };


    /* ========================================================
       FIT MAP
       ======================================================== */

    CM.fitPickupDestination =
        function () {

            if (
                !CM.state.map
            ) {
                return;
            }


            const points = [];


            if (
                CM.state.pickup
            ) {

                points.push(
                    [
                        CM.state.pickup.lat,
                        CM.state.pickup.lng
                    ]
                );
            }


            if (
                CM.state.destination
            ) {

                points.push(
                    [
                        CM.state.destination.lat,
                        CM.state.destination.lng
                    ]
                );
            }


            if (
                CM.state.riderLocation
            ) {

                points.push(
                    [
                        CM.state.riderLocation.lat,
                        CM.state.riderLocation.lng
                    ]
                );
            }


            if (
                points.length < 2
            ) {

                if (
                    points.length === 1
                ) {

                    CM.state.map.setView(
                        points[0],
                        CM.config.locationZoom
                    );
                }

                return;
            }


            const bounds =
                L.latLngBounds(
                    points
                );


            CM.state.map.fitBounds(
                bounds,
                {
                    padding:
                        [50, 100],

                    maxZoom:
                        CM.config.maxZoom
                }
            );
        };


    /* ========================================================
       RIDER LIVE LOCATION
       ======================================================== */

    CM.createRiderIcon = function () {

        return L.divIcon({

            className:
                "riderx-rider-marker-wrapper",

            html:
                `
                <div class="riderx-rider-marker">
                    <div class="riderx-rider-arrow">
                        ▲
                    </div>
                </div>
                `,

            iconSize:
                [42, 42],

            iconAnchor:
                [21, 21]
        });
    };


    CM.setRiderLocation = function (
        point,
        heading
    ) {

        if (
            !point ||
            !CM.state.map
        ) {
            return;
        }


        CM.state.riderLocation =
            {
                lat:
                    Number(point.lat),

                lng:
                    Number(point.lng),

                heading:
                    Number(
                        heading ||
                        0
                    )
            };


        const latLng = [
            CM.state.riderLocation.lat,
            CM.state.riderLocation.lng
        ];


        if (
            !CM.state.riderMarker
        ) {

            CM.state.riderMarker =
                L.marker(
                    latLng,
                    {
                        icon:
                            CM.createRiderIcon(),
                        zIndexOffset:
                            1100
                    }
                )
                .addTo(
                    CM.state.map
                );

        } else {

            CM.state.riderMarker
                .setLatLng(
                    latLng
                );
        }


        const element =
            CM.state.riderMarker
                .getElement();


        if (
            element &&
            heading !== undefined
        ) {

            const arrow =
                element.querySelector(
                    ".riderx-rider-arrow"
                );


            if (arrow) {

                arrow.style.transform =
                    "rotate(" +
                    Number(heading) +
                    "deg)";
            }
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-rider-location-updated",
                {
                    detail:
                        CM.state.riderLocation
                }
            )
        );
    };


    CM.removeRiderMarker =
        function () {

            if (
                CM.state.riderMarker &&
                CM.state.map
            ) {

                CM.state.map.removeLayer(
                    CM.state.riderMarker
                );
            }


            CM.state.riderMarker =
                null;

            CM.state.riderLocation =
                null;
        };


    /* ========================================================
       REVERSE GEOCODING
       ======================================================== */

    CM.reverseGeocode = async function (
        point
    ) {

        if (
            !point ||
            CM.state.geocoderBusy
        ) {
            return null;
        }


        CM.state.geocoderBusy =
            true;


        try {

            const url =
                "https://nominatim.openstreetmap.org/reverse" +
                "?format=jsonv2" +
                "&lat=" +
                encodeURIComponent(
                    point.lat
                ) +
                "&lon=" +
                encodeURIComponent(
                    point.lng
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


            if (!response.ok) {
                throw new Error(
                    "Geocoder unavailable."
                );
            }


            const data =
                await response.json();


            const address =
                data.display_name ||
                "";


            point.address =
                address;


            CM.updateAddressUI(
                point
            );


            CM.emitLocationChange();


            return address;

        } catch (error) {

            console.warn(
                "Reverse geocoding failed:",
                error
            );


            return null;

        } finally {

            CM.state.geocoderBusy =
                false;
        }
    };


    /* ========================================================
       ADDRESS UI
       ======================================================== */

    CM.updateAddressUI = function (
        point
    ) {

        if (!point) {
            return;
        }


        const isPickup =
            CM.state.pickup === point;


        const isDestination =
            CM.state.destination === point;


        if (isPickup) {

            document
                .querySelectorAll(
                    "[data-pickup-address]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            point.address ||
                            "";

                        element.textContent =
                            point.address ||
                            "";
                    }
                );
        }


        if (isDestination) {

            document
                .querySelectorAll(
                    "[data-destination-address]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            point.address ||
                            "";

                        element.textContent =
                            point.address ||
                            "";
                    }
                );
        }
    };


    /* ========================================================
       ADDRESS SEARCH
       ======================================================== */

    CM.searchAddress = async function (
        query
    ) {

        query =
            String(
                query ||
                ""
            )
            .trim();


        if (!query) {
            return null;
        }


        try {

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2" +
                "&limit=5" +
                "&countrycodes=in" +
                "&q=" +
                encodeURIComponent(
                    query
                );


            const response =
                await fetch(
                    url
                );


            if (!response.ok) {
                throw new Error(
                    "Search unavailable."
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
                            Number(
                                item.lat
                            ),

                        lng:
                            Number(
                                item.lon
                            ),

                        address:
                            item.display_name ||
                            ""
                    };
                }
            );

        } catch (error) {

            console.warn(
                "Address search failed:",
                error
            );


            return [];
        }
    };


    /* ========================================================
       SEARCH RESULT SELECT
       ======================================================== */

    CM.selectSearchResult =
        function (
            result,
            type
        ) {

            if (!result) {
                return;
            }


            if (
                type ===
                "pickup"
            ) {

                CM.setPickup(
                    result,
                    true
                );

            } else {

                CM.setDestination(
                    result,
                    true
                );
            }
        };


    /* ========================================================
       CALCULATE ROUTE
       ======================================================== */

    CM.calculateRoute =
        async function () {

            if (
                !CM.state.pickup ||
                !CM.state.destination
            ) {

                return null;
            }


            return CM.drawRoute(
                CM.state.pickup,
                CM.state.destination
            );
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    CM.distanceBetween =
        function (
            a,
            b
        ) {

            if (!a || !b) {
                return 0;
            }


            const R =
                6371;


            const lat1 =
                Number(a.lat) *
                Math.PI /
                180;


            const lat2 =
                Number(b.lat) *
                Math.PI /
                180;


            const dLat =
                (
                    Number(b.lat) -
                    Number(a.lat)
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    Number(b.lng) -
                    Number(a.lng)
                ) *
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
       LOCATION CHANGE
       ======================================================== */

    CM.emitLocationChange =
        function () {

            const detail = {

                pickup:
                    CM.state.pickup,

                destination:
                    CM.state.destination,

                customerLocation:
                    CM.state.currentLocation,

                riderLocation:
                    CM.state.riderLocation
            };


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-customer-map-change",
                    {
                        detail:
                            detail
                    }
                )
            );
        };


    /* ========================================================
       ERROR
       ======================================================== */

    CM.showLocationError =
        function (
            message
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-location-error",
                    {
                        detail: {
                            message:
                                message
                        }
                    }
                )
            );


            if (
                RX.toast &&
                typeof RX.toast ===
                "function"
            ) {

                RX.toast(
                    message,
                    "warning"
                );
            }
        };


    /* ========================================================
       GET STATE
       ======================================================== */

    CM.getState = function () {

        return {

            pickup:
                CM.state.pickup,

            destination:
                CM.state.destination,

            customerLocation:
                CM.state.currentLocation,

            riderLocation:
                CM.state.riderLocation
        };
    };


    /* ========================================================
       PUBLIC SHORTCUTS
       ======================================================== */

    RX.initCustomerMap =
        function (
            element
        ) {

            return CM.init(
                element
            );
        };


    RX.getCustomerMapState =
        function () {

            return CM.getState();
        };


    RX.setPickup =
        function (
            point
        ) {

            return CM.setPickup(
                point,
                true
            );
        };


    RX.setDestination =
        function (
            point
        ) {

            return CM.setDestination(
                point,
                true
            );
        };


    RX.clearDestination =
        function () {

            return CM.clearDestination();
        };


    RX.getCustomerLocation =
        function () {

            return CM.state.currentLocation;
        };


    /* ========================================================
       AUTO INIT
       ======================================================== */

    function autoInit() {

        const element =
            CM.getMapElement();


        if (element) {

            CM.init(
                element
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


})();
