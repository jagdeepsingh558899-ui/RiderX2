/**
 * ============================================================
 * RiderX Unified Map Engine
 * ============================================================
 * One Map System for:
 *   Customer
 *   Rider
 *   Live Tracking
 *   Booking
 *   Route Navigation
 *
 * Map:
 *   Leaflet + OpenStreetMap
 *
 * Firebase:
 *   RiderX Firebase v10 modular config
 *
 * IMPORTANT:
 *   This file MUST NOT create duplicate Leaflet maps.
 * ============================================================
 */

import {
    auth,
    db,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp
} from "../firebase/firebase-config.js";

/* ============================================================
   GLOBAL RIDERX MAP STATE
============================================================ */

const DEFAULT_CENTER = {
    lat: 30.7333,
    lng: 76.7794
};

const DEFAULT_ZOOM = 14;

const state = window.RiderXMapState = window.RiderXMapState || {
    mapInstance: null,

    containerId: null,

    currentMarker: null,
    riderMarker: null,
    customerMarker: null,
    pickupMarker: null,
    destinationMarker: null,

    routeLayer: null,
    routingControl: null,

    watchId: null,

    currentLocation: null,

    following: true,

    initialized: false,

    role: null,

    theme: "dark",

    darkTiles: null,
    lightTiles: null,

    markers: new Map(),

    locationListeners: [],

    mapListeners: []
};


/* ============================================================
   ROLE DETECTION
============================================================ */

function detectRole() {

    const bodyRole =
        document.body?.dataset?.role ||
        document.body?.getAttribute("data-role");

    if (bodyRole) {
        return bodyRole.toLowerCase();
    }

    const path = window.location.pathname.toLowerCase();

    if (path.includes("/rider/")) {
        return "rider";
    }

    if (path.includes("/customer/")) {
        return "customer";
    }

    return "customer";
}


/* ============================================================
   CHECK LEAFLET
============================================================ */

function leafletAvailable() {

    if (typeof window.L === "undefined") {

        console.error(
            "RiderX Map Error: Leaflet is not loaded."
        );

        return false;
    }

    return true;
}


/* ============================================================
   GET MAP CONTAINER
============================================================ */

function getContainer(containerId = "map") {

    const element =
        document.getElementById(containerId);

    if (!element) {
        return null;
    }

    return element;
}


/* ============================================================
   CREATE TILE LAYERS
============================================================ */

function createTileLayers(map) {

    const darkTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
            maxZoom: 20,
            attribution:
                '&copy; OpenStreetMap &copy; CARTO',
            subdomains: "abcd"
        }
    );

    const lightTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
            maxZoom: 20,
            attribution:
                '&copy; OpenStreetMap &copy; CARTO',
            subdomains: "abcd"
        }
    );

    darkTiles.addTo(map);

    state.darkTiles = darkTiles;
    state.lightTiles = lightTiles;
}


/* ============================================================
   INITIALIZE MAP
   ============================================================ */

export function initMap(
    containerId = "map",
    initialLat = DEFAULT_CENTER.lat,
    initialLng = DEFAULT_CENTER.lng,
    zoom = DEFAULT_ZOOM
) {

    if (!leafletAvailable()) {
        return null;
    }

    const container =
        getContainer(containerId);

    if (!container) {
        return null;
    }


    /*
     * IMPORTANT:
     *
     * If this exact map container already has
     * a Leaflet map, NEVER initialize it again.
     */

    if (
        state.mapInstance &&
        state.containerId === containerId
    ) {

        try {
            state.mapInstance.invalidateSize();
        } catch (error) {
            console.warn(
                "RiderX: invalidateSize failed",
                error
            );
        }

        return state.mapInstance;
    }


    /*
     * Leaflet itself stores _leaflet_id on
     * initialized DOM elements.
     *
     * This prevents:
     *
     * "Map container is already initialized"
     */

    if (container._leaflet_id) {

        try {

            container._leaflet_id = null;

        } catch (error) {

            console.warn(
                "RiderX: unable to reset Leaflet container",
                error
            );
        }
    }


    const map =
        L.map(containerId, {

            zoomControl: false,

            attributionControl: true,

            preferCanvas: true,

            minZoom: 3,

            maxZoom: 20

        }).setView(
            [
                Number(initialLat),
                Number(initialLng)
            ],
            zoom
        );


    createTileLayers(map);


    /*
     * Zoom controls
     */

    L.control.zoom({
        position: "bottomright"
    }).addTo(map);


    /*
     * Save state
     */

    state.mapInstance = map;

    state.containerId = containerId;

    state.initialized = true;

    state.role = detectRole();


    /*
     * Stop following when user manually moves map.
     */

    map.on(
        "dragstart",
        () => {
            state.following = false;
        }
    );


    map.on(
        "zoomstart",
        () => {
            state.following = false;
        }
    );


    /*
     * Notify listeners
     */

    state.mapListeners.forEach(
        callback => {

            try {
                callback(map);
            } catch (error) {
                console.error(error);
            }

        }
    );


    /*
     * Allow layout to settle before
     * invalidateSize.
     */

    setTimeout(
        () => {

            try {
                map.invalidateSize();
            } catch (error) {}

        },
        250
    );


    return map;
}


/* ============================================================
   GET MAP
============================================================ */

export function getMap() {

    return state.mapInstance;
}


/* ============================================================
   MAP EXISTS
============================================================ */

export function hasMap() {

    return Boolean(
        state.mapInstance
    );
}


/* ============================================================
   DESTROY MAP
============================================================ */

export function destroyMap() {

    stopLiveGPS();

    if (state.routingControl) {

        try {
            state.mapInstance.removeControl(
                state.routingControl
            );
        } catch (error) {}

        state.routingControl = null;
    }


    if (
        state.mapInstance
    ) {

        try {
            state.mapInstance.remove();
        } catch (error) {}
    }


    state.mapInstance = null;

    state.containerId = null;

    state.initialized = false;

    state.currentMarker = null;

    state.riderMarker = null;

    state.customerMarker = null;

    state.pickupMarker = null;

    state.destinationMarker = null;

    state.routeLayer = null;

    state.markers.clear();
}


/* ============================================================
   MAP THEME
============================================================ */

export function toggleMapTheme(
    theme = "dark"
) {

    const map =
        state.mapInstance;

    if (!map) {
        return;
    }


    if (
        theme === "light"
    ) {

        if (
            state.darkTiles &&
            map.hasLayer(
                state.darkTiles
            )
        ) {

            map.removeLayer(
                state.darkTiles
            );
        }

        if (
            state.lightTiles &&
            !map.hasLayer(
                state.lightTiles
            )
        ) {

            state.lightTiles.addTo(
                map
            );
        }

        state.theme = "light";

    } else {

        if (
            state.lightTiles &&
            map.hasLayer(
                state.lightTiles
            )
        ) {

            map.removeLayer(
                state.lightTiles
            );
        }

        if (
            state.darkTiles &&
            !map.hasLayer(
                state.darkTiles
            )
        ) {

            state.darkTiles.addTo(
                map
            );
        }

        state.theme = "dark";
    }
}


/* ============================================================
   LOCATION ICON
============================================================ */

function createLocationIcon(
    type = "customer"
) {

    let background =
        "#FFE500";

    let border =
        "#111111";

    let shadow =
        "#FFE500";


    if (type === "rider") {

        background =
            "#FFE500";

        shadow =
            "#FFE500";

    }


    if (type === "pickup") {

        background =
            "#111111";

        border =
            "#FFE500";

        shadow =
            "#FFE500";
    }


    if (
        type === "destination"
    ) {

        background =
            "#FFE500";

        border =
            "#111111";

        shadow =
            "#FFE500";
    }


    return L.divIcon({

        className:
            "riderx-map-marker",

        html: `
            <div
                style="
                    width:22px;
                    height:22px;
                    background:${background};
                    border:3px solid ${border};
                    border-radius:50%;
                    box-shadow:
                        0 0 0 5px rgba(255,229,0,.16),
                        0 0 18px ${shadow};
                "
            ></div>
        `,

        iconSize: [
            22,
            22
        ],

        iconAnchor: [
            11,
            11
        ]
    });
}


/* ============================================================
   SET CURRENT USER MARKER
============================================================ */

export function setCurrentLocationMarker(
    lat,
    lng,
    type = "customer"
) {

    const map =
        state.mapInstance;

    if (!map) {
        return null;
    }


    const position = [
        Number(lat),
        Number(lng)
    ];


    if (
        !Number.isFinite(position[0]) ||
        !Number.isFinite(position[1])
    ) {

        return null;
    }


    if (
        !state.currentMarker
    ) {

        state.currentMarker =
            L.marker(
                position,
                {
                    icon:
                        createLocationIcon(
                            type
                        ),
                    zIndexOffset: 1000
                }
            ).addTo(map);

    } else {

        state.currentMarker
            .setLatLng(position);
    }


    state.currentLocation = {
        lat: Number(lat),
        lng: Number(lng)
    };


    if (
        state.following
    ) {

        map.setView(
            position,
            Math.max(
                map.getZoom(),
                15
            ),
            {
                animate: true
            }
        );
    }


    notifyLocationListeners(
        state.currentLocation
    );


    return state.currentMarker;
}


/* ============================================================
   CUSTOMER MARKER
============================================================ */

export function setCustomerLocation(
    lat,
    lng
) {

    const map =
        state.mapInstance;

    if (!map) {
        return null;
    }


    const position = [
        Number(lat),
        Number(lng)
    ];


    if (
        !state.customerMarker
    ) {

        state.customerMarker =
            L.marker(
                position,
                {
                    icon:
                        createLocationIcon(
                            "customer"
                        ),
                    zIndexOffset: 900
                }
            ).addTo(map);

    } else {

        state.customerMarker
            .setLatLng(position);
    }


    return state.customerMarker;
}


/* ============================================================
   RIDER MARKER
============================================================ */

export function setRiderLocation(
    lat,
    lng,
    riderId = "rider"
) {

    const map =
        state.mapInstance;

    if (!map) {
        return null;
    }


    const position = [
        Number(lat),
        Number(lng)
    ];


    if (
        !Number.isFinite(position[0]) ||
        !Number.isFinite(position[1])
    ) {

        return null;
    }


    let marker =
        state.markers.get(
            riderId
        );


    if (!marker) {

        marker =
            L.marker(
                position,
                {
                    icon:
                        createLocationIcon(
                            "rider"
                        ),
                    zIndexOffset: 1100
                }
            ).addTo(map);


        state.markers.set(
            riderId,
            marker
        );

    } else {

        marker.setLatLng(
            position
        );
    }


    state.riderMarker =
        marker;


    return marker;
}


/* ============================================================
   REMOVE RIDER MARKER
============================================================ */

export function removeRider(
    riderId = "rider"
) {

    const marker =
        state.markers.get(
            riderId
        );

    if (
        marker &&
        state.mapInstance
    ) {

        state.mapInstance
            .removeLayer(marker);
    }


    state.markers.delete(
        riderId
    );


    if (
        riderId === "rider"
    ) {

        state.riderMarker =
            null;
    }
}


/* ============================================================
   PICKUP MARKER
============================================================ */

export function setPickupMarker(
    lat,
    lng
) {

    const map =
        state.mapInstance;

    if (!map) {
        return null;
    }


    const position = [
        Number(lat),
        Number(lng)
    ];


    if (
        !state.pickupMarker
    ) {

        state.pickupMarker =
            L.marker(
                position,
                {
                    icon:
                        createLocationIcon(
                            "pickup"
                        ),
                    zIndexOffset: 800
                }
            ).addTo(map);

    } else {

        state.pickupMarker
            .setLatLng(position);
    }


    return state.pickupMarker;
}


/* ============================================================
   DESTINATION MARKER
============================================================ */

export function setDestinationMarker(
    lat,
    lng
) {

    const map =
        state.mapInstance;

    if (!map) {
        return null;
    }


    const position = [
        Number(lat),
        Number(lng)
    ];


    if (
        !state.destinationMarker
    ) {

        state.destinationMarker =
            L.marker(
                position,
                {
                    icon:
                        createLocationIcon(
                            "destination"
                        ),
                    zIndexOffset: 800
                }
            ).addTo(map);

    } else {

        state.destinationMarker
            .setLatLng(position);
    }


    return state.destinationMarker;
}


/* ============================================================
   CLEAR ROUTE
============================================================ */

export function clearRoute() {

    const map =
        state.mapInstance;

    if (!map) {
        return;
    }


    if (
        state.routingControl
    ) {

        try {

            map.removeControl(
                state.routingControl
            );

        } catch (error) {}

        state.routingControl =
            null;
    }


    if (
        state.routeLayer
    ) {

        try {

            map.removeLayer(
                state.routeLayer
            );

        } catch (error) {}

        state.routeLayer =
            null;
    }
}


/* ============================================================
   DRAW ROUTE
============================================================ */

export function drawRoute(
    pickup,
    destination
) {

    const map =
        state.mapInstance;

    if (
        !map ||
        !pickup ||
        !destination
    ) {

        return null;
    }


    const pickupLat =
        Number(
            pickup.lat
        );

    const pickupLng =
        Number(
            pickup.lng
        );

    const destinationLat =
        Number(
            destination.lat
        );

    const destinationLng =
        Number(
            destination.lng
        );


    if (
        !Number.isFinite(pickupLat) ||
        !Number.isFinite(pickupLng) ||
        !Number.isFinite(destinationLat) ||
        !Number.isFinite(destinationLng)
    ) {

        return null;
    }


    clearRoute();


    setPickupMarker(
        pickupLat,
        pickupLng
    );


    setDestinationMarker(
        destinationLat,
        destinationLng
    );


    /*
     * Leaflet Routing Machine
     */

    if (
        L.Routing &&
        typeof L.Routing.control === "function"
    ) {

        state.routingControl =
            L.Routing.control({

                waypoints: [

                    L.latLng(
                        pickupLat,
                        pickupLng
                    ),

                    L.latLng(
                        destinationLat,
                        destinationLng
                    )

                ],

                routeWhileDragging:
                    false,

                addWaypoints:
                    false,

                draggableWaypoints:
                    false,

                fitSelectedRoutes:
                    true,

                showAlternatives:
                    false,

                createMarker:
                    function () {
                        return null;
                    },

                lineOptions: {

                    styles: [
                        {
                            color:
                                "#FFE500",

                            weight:
                                6,

                            opacity:
                                0.95
                        }
                    ]
                }

            }).addTo(map);


        return state.routingControl;
    }


    /*
     * Fallback route:
     * straight polyline
     */

    state.routeLayer =
        L.polyline(

            [
                [
                    pickupLat,
                    pickupLng
                ],

                [
                    destinationLat,
                    destinationLng
                ]
            ],

            {
                color:
                    "#FFE500",

                weight:
                    6,

                opacity:
                    0.9,

                dashArray:
                    "10 8"
            }

        ).addTo(map);


    map.fitBounds(
        state.routeLayer.getBounds(),
        {
            padding: [
                60,
                60
            ]
        }
    );


    return state.routeLayer;
}


/* ============================================================
   FIT MAP TO POINTS
============================================================ */

export function fitToPoints(
    points = []
) {

    const map =
        state.mapInstance;

    if (
        !map ||
        !Array.isArray(points) ||
        !points.length
    ) {

        return;
    }


    const validPoints =
        points
            .filter(
                point =>
                    point &&
                    Number.isFinite(
                        Number(point.lat)
                    ) &&
                    Number.isFinite(
                        Number(point.lng)
                    )
            )
            .map(
                point => [
                    Number(point.lat),
                    Number(point.lng)
                ]
            );


    if (!validPoints.length) {
        return;
    }


    const bounds =
        L.latLngBounds(
            validPoints
        );


    map.fitBounds(
        bounds,
        {
            padding: [
                70,
                70
            ],
            maxZoom: 16
        }
    );
}


/* ============================================================
   CENTER CURRENT LOCATION
============================================================ */

export function centerToCurrentLocation() {

    const map =
        state.mapInstance;

    if (!map) {
        return;
    }


    if (
        state.currentLocation
    ) {

        state.following =
            true;

        map.setView(
            [
                state.currentLocation.lat,
                state.currentLocation.lng
            ],
            16,
            {
                animate: true
            }
        );

        return;
    }


    if (
        !navigator.geolocation
    ) {

        return;
    }


    navigator.geolocation.getCurrentPosition(

        position => {

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;


            state.following =
                true;


            setCurrentLocationMarker(
                lat,
                lng,
                state.role
            );


            map.setView(
                [
                    lat,
                    lng
                ],
                16,
                {
                    animate: true
                }
            );
        },

        error => {

            console.warn(
                "RiderX GPS:",
                error.message
            );
        },

        {
            enableHighAccuracy:
                true,

            timeout:
                10000,

            maximumAge:
                5000
        }
    );
}


/* ============================================================
   LIVE GPS
============================================================ */

export function initLiveGPS(
    options = {}
) {

    if (
        !navigator.geolocation
    ) {

        console.warn(
            "RiderX: Geolocation unavailable."
        );

        return null;
    }


    /*
     * Never create multiple watchers.
     */

    if (
        state.watchId !== null
    ) {

        return state.watchId;
    }


    const settings = {

        enableHighAccuracy:
            true,

        timeout:
            15000,

        maximumAge:
            3000,

        ...options

    };


    state.watchId =
        navigator.geolocation.watchPosition(

            position => {

                const {
                    latitude,
                    longitude,
                    accuracy,
                    heading,
                    speed
                } =
                    position.coords;


                const location = {

                    lat:
                        latitude,

                    lng:
                        longitude,

                    accuracy:
                        accuracy || null,

                    heading:
                        heading ?? null,

                    speed:
                        speed ?? null,

                    timestamp:
                        Date.now()
                };


                setCurrentLocationMarker(
                    latitude,
                    longitude,
                    state.role
                );


                /*
                 * Rider location is written
                 * only for rider users.
                 */

                if (
                    state.role === "rider"
                ) {

                    updateRiderLocation(
                        location
                    );
                }

            },

            error => {

                console.warn(
                    "RiderX GPS error:",
                    error.message
                );
            },

            settings
        );


    return state.watchId;
}


/* ============================================================
   STOP LIVE GPS
============================================================ */

export function stopLiveGPS() {

    if (
        state.watchId === null
    ) {

        return;
    }


    try {

        navigator.geolocation
            .clearWatch(
                state.watchId
            );

    } catch (error) {

        console.warn(
            "RiderX: clearWatch failed",
            error
        );
    }


    state.watchId =
        null;
}


/* ============================================================
   UPDATE RIDER LOCATION
============================================================ */

async function updateRiderLocation(
    location
) {

    const user =
        auth.currentUser;

    if (!user) {
        return;
    }


    /*
     * Update both rider profile and
     * realtime location record.
     *
     * Firestore errors are ignored here
     * so GPS UI keeps working.
     */

    try {

        const riderRef =
            doc(
                db,
                "riders",
                user.uid
            );


        await setDoc(

            riderRef,

            {

                location: {

                    lat:
                        location.lat,

                    lng:
                        location.lng
                },

                heading:
                    location.heading,

                speed:
                    location.speed,

                accuracy:
                    location.accuracy,

                lastUpdated:
                    serverTimestamp(),

                online:
                    true

            },

            {
                merge:
                    true
            }

        );

    } catch (error) {

        console.warn(
            "RiderX rider location sync:",
            error.message
        );
    }
}


/* ============================================================
   LOCATION LISTENERS
============================================================ */

export function onLocationChange(
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {

        return () => {};
    }


    state.locationListeners
        .push(callback);


    return () => {

        state.locationListeners =
            state.locationListeners.filter(
                item =>
                    item !== callback
            );
    };
}


/* ============================================================
   NOTIFY LOCATION LISTENERS
============================================================ */

function notifyLocationListeners(
    location
) {

    state.locationListeners
        .forEach(
            callback => {

                try {

                    callback(
                        location
                    );

                } catch (error) {

                    console.error(
                        "RiderX location listener:",
                        error
                    );
                }
            }
        );
}


/* ============================================================
   MAP READY LISTENER
============================================================ */

export function onMapReady(
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {

        return () => {};
    }


    if (
        state.mapInstance
    ) {

        try {
            callback(
                state.mapInstance
            );
        } catch (error) {
            console.error(error);
        }
    }


    state.mapListeners
        .push(callback);


    return () => {

        state.mapListeners =
            state.mapListeners.filter(
                item =>
                    item !== callback
            );
    };
}


/* ============================================================
   CLEAR ALL MARKERS
============================================================ */

export function clearMarkers() {

    const map =
        state.mapInstance;

    if (!map) {
        return;
    }


    [
        state.currentMarker,
        state.customerMarker,
        state.riderMarker,
        state.pickupMarker,
        state.destinationMarker
    ]
        .forEach(
            marker => {

                if (marker) {

                    try {
                        map.removeLayer(
                            marker
                        );
                    } catch (error) {}
                }
            }
        );


    state.markers
        .forEach(
            marker => {

                try {
                    map.removeLayer(
                        marker
                    );
                } catch (error) {}
            }
        );


    state.currentMarker =
        null;

    state.customerMarker =
        null;

    state.riderMarker =
        null;

    state.pickupMarker =
        null;

    state.destinationMarker =
        null;

    state.markers.clear();
}


/* ============================================================
   INVALIDATE SIZE
============================================================ */

export function invalidateMapSize() {

    if (
        state.mapInstance
    ) {

        try {

            state.mapInstance
                .invalidateSize();

        } catch (error) {}
    }
}


/* ============================================================
   GLOBAL API
============================================================ */

window.RiderXMap = {

    initMap,

    getMap,

    hasMap,

    destroyMap,

    toggleMapTheme,

    initLiveGPS,

    stopLiveGPS,

    centerToCurrentLocation,

    setCurrentLocationMarker,

    setCustomerLocation,

    setRiderLocation,

    removeRider,

    setPickupMarker,

    setDestinationMarker,

    drawRoute,

    clearRoute,

    fitToPoints,

    clearMarkers,

    invalidateMapSize,

    onLocationChange,

    onMapReady

};


/* ============================================================
   SAFE AUTO INITIALIZATION
============================================================ */

function autoInitialize() {

    const mapElement =
        document.getElementById(
            "map"
        );


    if (!mapElement) {
        return;
    }


    /*
     * Only this centralized map engine
     * initializes #map.
     */

    if (
        !state.mapInstance
    ) {

        const map =
            initMap(
                "map",
                DEFAULT_CENTER.lat,
                DEFAULT_CENTER.lng,
                DEFAULT_ZOOM
            );


        if (map) {

            /*
             * Start GPS once.
             */

            initLiveGPS();
        }
    }
}


/* ============================================================
   DOM READY
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        autoInitialize,
        {
            once:
                true
        }
    );

} else {

    autoInitialize();
}
