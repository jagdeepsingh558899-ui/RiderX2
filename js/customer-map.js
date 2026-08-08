/**
 * ============================================================
 * RiderX Customer Map Controller
 * ============================================================
 * IMPORTANT:
 * This file does NOT create another Leaflet map.
 * The only map engine is:
 *
 *     js/map.js
 *
 * This controller only manages:
 * - Customer GPS
 * - Pickup location
 * - Destination location
 * - Nearby riders
 * - Rider live location
 * - Ride route
 * - Map UI buttons
 * ============================================================
 */

const CustomerMap = (() => {

    let initialized = false;
    let gpsStarted = false;

    let nearbyRiderUnsubscribe = null;
    let rideUnsubscribe = null;

    let pickup = null;
    let destination = null;

    let currentRideId = null;

    /* ========================================================
       HELPERS
    ======================================================== */

    function getMapEngine() {

        if (
            window.RiderXMap
        ) {
            return window.RiderXMap;
        }

        console.warn(
            "RiderX Customer Map: map.js has not loaded yet."
        );

        return null;
    }


    function getMap() {

        const engine =
            getMapEngine();

        if (!engine) {
            return null;
        }

        return engine.getMap();
    }


    function validCoordinates(
        lat,
        lng
    ) {

        return (
            Number.isFinite(
                Number(lat)
            ) &&
            Number.isFinite(
                Number(lng)
            )
        );
    }


    function normalizeLocation(
        location
    ) {

        if (!location) {
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
            !validCoordinates(
                lat,
                lng
            )
        ) {
            return null;
        }

        return {
            lat,
            lng
        };
    }


    /* ========================================================
       INITIALIZE
    ======================================================== */

    function init() {

        if (initialized) {
            return true;
        }

        const engine =
            getMapEngine();

        if (!engine) {
            return false;
        }


        /*
         * IMPORTANT:
         *
         * We do NOT call L.map().
         *
         * map.js owns the Leaflet instance.
         */

        let map =
            engine.getMap();


        if (!map) {

            map =
                engine.initMap(
                    "map"
                );
        }


        if (!map) {
            return false;
        }


        initialized = true;


        setupMapButtons();

        startCustomerGPS();

        listenForMapResize();


        /*
         * Restore saved pickup/drop
         * if available.
         */

        restoreBookingLocations();


        return true;
    }


    /* ========================================================
       CUSTOMER GPS
    ======================================================== */

    function startCustomerGPS() {

        if (gpsStarted) {
            return;
        }

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }

        gpsStarted = true;


        /*
         * map.js has one centralized
         * geolocation watcher.
         */

        engine.initLiveGPS();


        /*
         * Listen for location updates.
         */

        engine.onLocationChange(
            location => {

                if (!location) {
                    return;
                }

                updateCustomerLocation(
                    location
                );

            }
        );
    }


    function updateCustomerLocation(
        location
    ) {

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }

        const normalized =
            normalizeLocation(
                location
            );

        if (!normalized) {
            return;
        }


        engine.setCustomerLocation(
            normalized.lat,
            normalized.lng
        );


        /*
         * Keep current marker synchronized
         * as well.
         */

        engine.setCurrentLocationMarker(
            normalized.lat,
            normalized.lng,
            "customer"
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx:customer-location",
                {
                    detail:
                        normalized
                }
            )
        );
    }


    /* ========================================================
       CENTER CUSTOMER
    ======================================================== */

    function centerOnCustomer() {

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }

        engine.centerToCurrentLocation();
    }


    /* ========================================================
       PICKUP
    ======================================================== */

    function setPickup(
        location,
        address = ""
    ) {

        const normalized =
            normalizeLocation(
                location
            );

        if (!normalized) {
            return false;
        }


        pickup = {

            ...normalized,

            address:
                address ||
                location.address ||
                ""

        };


        const engine =
            getMapEngine();

        if (engine) {

            engine.setPickupMarker(
                pickup.lat,
                pickup.lng
            );
        }


        saveBookingLocations();


        window.dispatchEvent(
            new CustomEvent(
                "riderx:pickup-selected",
                {
                    detail:
                        pickup
                }
            )
        );


        return true;
    }


    /* ========================================================
       DESTINATION
    ======================================================== */

    function setDestination(
        location,
        address = ""
    ) {

        const normalized =
            normalizeLocation(
                location
            );

        if (!normalized) {
            return false;
        }


        destination = {

            ...normalized,

            address:
                address ||
                location.address ||
                ""

        };


        const engine =
            getMapEngine();

        if (engine) {

            engine.setDestinationMarker(
                destination.lat,
                destination.lng
            );
        }


        saveBookingLocations();


        /*
         * Draw route automatically
         * when both points exist.
         */

        if (
            pickup &&
            destination
        ) {

            drawBookingRoute();
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx:destination-selected",
                {
                    detail:
                        destination
                }
            )
        );


        return true;
    }


    /* ========================================================
       DRAW BOOKING ROUTE
    ======================================================== */

    function drawBookingRoute() {

        if (
            !pickup ||
            !destination
        ) {
            return null;
        }


        const engine =
            getMapEngine();

        if (!engine) {
            return null;
        }


        return engine.drawRoute(
            pickup,
            destination
        );
    }


    /* ========================================================
       CLEAR ROUTE
    ======================================================== */

    function clearRoute() {

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }

        engine.clearRoute();
    }


    /* ========================================================
       CLEAR LOCATIONS
    ======================================================== */

    function clearLocations() {

        pickup =
            null;

        destination =
            null;


        clearRoute();


        const engine =
            getMapEngine();

        if (engine) {

            engine.setPickupMarker =
                engine.setPickupMarker;

            /*
             * Clear all markers and allow
             * customer GPS to recreate
             * the customer marker.
             */

            engine.clearMarkers();

        }


        saveBookingLocations();
    }


    /* ========================================================
       NEARBY RIDERS
    ======================================================== */

    function showNearbyRider(
        rider
    ) {

        if (!rider) {
            return;
        }


        const id =
            rider.id ||
            rider.uid ||
            rider.riderId;


        const location =
            normalizeLocation(
                rider.location ||
                rider
            );


        if (
            !id ||
            !location
        ) {
            return;
        }


        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }


        const marker =
            engine.setRiderLocation(
                location.lat,
                location.lng,
                String(id)
            );


        if (
            marker &&
            rider.name
        ) {

            marker.bindPopup(
                `
                    <div
                        style="
                            min-width:160px;
                            font-family:Arial,sans-serif;
                        "
                    >
                        <strong>
                            ${escapeHTML(
                                rider.name
                            )}
                        </strong>

                        ${
                            rider.vehicleNumber
                                ? `
                                    <br>
                                    <small>
                                        ${escapeHTML(
                                            rider.vehicleNumber
                                        )}
                                    </small>
                                  `
                                : ""
                        }
                    </div>
                `
            );
        }
    }


    function removeNearbyRider(
        riderId
    ) {

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }

        engine.removeRider(
            String(riderId)
        );
    }


    function clearNearbyRiders() {

        /*
         * RiderXMap manages its own marker
         * registry. Remove only markers
         * registered as nearby riders.
         */

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }


        const state =
            window.RiderXMapState;


        if (
            !state ||
            !state.markers
        ) {
            return;
        }


        Array.from(
            state.markers.keys()
        ).forEach(
            id => {

                engine.removeRider(
                    id
                );

            }
        );
    }


    /* ========================================================
       LIVE RIDE RIDER LOCATION
    ======================================================== */

    function updateRideRiderLocation(
        location
    ) {

        const normalized =
            normalizeLocation(
                location
            );

        if (!normalized) {
            return;
        }


        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }


        engine.setRiderLocation(
            normalized.lat,
            normalized.lng,
            "active-rider"
        );


        /*
         * During active ride, fit map
         * between rider and customer.
         */

        const customerLocation =
            getCustomerLocation();


        if (customerLocation) {

            engine.fitToPoints(
                [
                    customerLocation,
                    normalized
                ]
            );
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx:rider-location",
                {
                    detail:
                        normalized
                }
            )
        );
    }


    /* ========================================================
       CUSTOMER LOCATION
    ======================================================== */

    function getCustomerLocation() {

        const state =
            window.RiderXMapState;

        if (
            state &&
            state.currentLocation
        ) {

            return {
                lat:
                    Number(
                        state.currentLocation.lat
                    ),

                lng:
                    Number(
                        state.currentLocation.lng
                    )
            };
        }


        return null;
    }


    /* ========================================================
       FIT BOOKING ROUTE
    ======================================================== */

    function fitBookingRoute() {

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }


        const points = [];


        if (pickup) {
            points.push(
                pickup
            );
        }


        if (destination) {
            points.push(
                destination
            );
        }


        if (points.length) {

            engine.fitToPoints(
                points
            );
        }
    }


    /* ========================================================
       MAP BUTTONS
    ======================================================== */

    function setupMapButtons() {

        const locateButtons =
            document.querySelectorAll(
                "[data-map-locate], #locateBtn, #myLocationBtn, #currentLocationBtn"
            );


        locateButtons.forEach(
            button => {

                if (
                    button.dataset.riderxMapBound ===
                    "true"
                ) {
                    return;
                }


                button.dataset.riderxMapBound =
                    "true";


                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        centerOnCustomer();
                    }
                );
            }
        );


        const fitButtons =
            document.querySelectorAll(
                "[data-map-fit]"
            );


        fitButtons.forEach(
            button => {

                if (
                    button.dataset.riderxMapBound ===
                    "true"
                ) {
                    return;
                }


                button.dataset.riderxMapBound =
                    "true";


                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        fitBookingRoute();
                    }
                );
            }
        );
    }


    /* ========================================================
       MAP RESIZE
    ======================================================== */

    function listenForMapResize() {

        const engine =
            getMapEngine();

        if (!engine) {
            return;
        }


        const invalidate =
            () => {

                setTimeout(
                    () => {

                        engine.invalidateMapSize();

                    },
                    100
                );
            };


        window.addEventListener(
            "resize",
            invalidate
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    !document.hidden
                ) {
                    invalidate();
                }

            }
        );
    }


    /* ========================================================
       LOCAL STORAGE
    ======================================================== */

    function saveBookingLocations() {

        try {

            localStorage.setItem(
                "riderx_customer_pickup",
                JSON.stringify(
                    pickup
                )
            );


            localStorage.setItem(
                "riderx_customer_destination",
                JSON.stringify(
                    destination
                )
            );

        } catch (error) {

            console.warn(
                "RiderX: unable to save locations.",
                error
            );
        }
    }


    function restoreBookingLocations() {

        try {

            const savedPickup =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_customer_pickup"
                    )
                );


            const savedDestination =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_customer_destination"
                    )
                );


            if (
                savedPickup
            ) {

                setPickup(
                    savedPickup,
                    savedPickup.address
                );
            }


            if (
                savedDestination
            ) {

                setDestination(
                    savedDestination,
                    savedDestination.address
                );
            }

        } catch (error) {

            console.warn(
                "RiderX: location restore failed.",
                error
            );
        }
    }


    /* ========================================================
       ACTIVE RIDE
    ======================================================== */

    function setActiveRide(
        rideId
    ) {

        currentRideId =
            rideId ||
            null;


        try {

            if (
                currentRideId
            ) {

                localStorage.setItem(
                    "riderx_active_ride_id",
                    currentRideId
                );

            } else {

                localStorage.removeItem(
                    "riderx_active_ride_id"
                );
            }

        } catch (error) {}
    }


    function getActiveRide() {

        if (
            currentRideId
        ) {
            return currentRideId;
        }


        try {

            return localStorage.getItem(
                "riderx_active_ride_id"
            );

        } catch (error) {

            return null;
        }
    }


    /* ========================================================
       FIREBASE RIDE LISTENER
    ======================================================== */

    async function listenToRide(
        rideId,
        callback
    ) {

        /*
         * This function intentionally uses
         * the existing global Firebase module
         * if available.
         *
         * It does not create another map.
         */

        if (!rideId) {
            return () => {};
        }


        setActiveRide(
            rideId
        );


        try {

            const firebase =
                await import(
                    "../firebase/firebase-config.js"
                );


            const {
                db,
                doc,
                onSnapshot
            } =
                firebase;


            if (
                !db ||
                !doc ||
                !onSnapshot
            ) {

                return () => {};
            }


            if (
                rideUnsubscribe
            ) {

                rideUnsubscribe();

                rideUnsubscribe =
                    null;
            }


            const rideRef =
                doc(
                    db,
                    "rides",
                    rideId
                );


            rideUnsubscribe =
                onSnapshot(
                    rideRef,
                    snapshot => {

                        if (
                            !snapshot.exists()
                        ) {
                            return;
                        }


                        const ride =
                            snapshot.data();


                        /*
                         * Rider live location
                         */

                        const riderLocation =
                            normalizeLocation(
                                ride.riderLocation ||
                                ride.driverLocation ||
                                ride.rider?.location
                            );


                        if (
                            riderLocation
                        ) {

                            updateRideRiderLocation(
                                riderLocation
                            );
                        }


                        /*
                         * Update route
                         * if ride coordinates
                         * are available.
                         */

                        const ridePickup =
                            normalizeLocation(
                                ride.pickup
                            );


                        const rideDestination =
                            normalizeLocation(
                                ride.destination
                            );


                        if (
                            ridePickup &&
                            rideDestination
                        ) {

                            pickup =
                                {
                                    ...ridePickup,
                                    address:
                                        ride.pickup?.address ||
                                        ""
                                };


                            destination =
                                {
                                    ...rideDestination,
                                    address:
                                        ride.destination?.address ||
                                        ""
                                };
                        }


                        if (
                            typeof callback ===
                            "function"
                        ) {

                            callback(
                                ride
                            );
                        }


                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-updated",
                                {
                                    detail:
                                        ride
                                }
                            )
                        );

                    },
                    error => {

                        console.error(
                            "RiderX ride listener:",
                            error
                        );

                    }
                );


            return rideUnsubscribe;

        } catch (error) {

            console.error(
                "RiderX: ride listener failed.",
                error
            );


            return () => {};
        }
    }


    /* ========================================================
       STOP RIDE LISTENER
    ======================================================== */

    function stopRideListener() {

        if (
            rideUnsubscribe
        ) {

            rideUnsubscribe();

            rideUnsubscribe =
                null;
        }
    }


    /* ========================================================
       ESCAPE HTML
    ======================================================== */

    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
    }


    /* ========================================================
       PUBLIC API
    ======================================================== */

    return {

        init,

        startCustomerGPS,

        centerOnCustomer,

        setPickup,

        setDestination,

        drawBookingRoute,

        clearRoute,

        clearLocations,

        showNearbyRider,

        removeNearbyRider,

        clearNearbyRiders,

        updateRideRiderLocation,

        getCustomerLocation,

        fitBookingRoute,

        listenToRide,

        stopRideListener,

        setActiveRide,

        getActiveRide,

        getPickup: () =>
            pickup,

        getDestination: () =>
            destination

    };

})();


/* ============================================================
   GLOBAL ACCESS
============================================================ */

window.RiderXCustomerMap =
    CustomerMap;


/* ============================================================
   SAFE INITIALIZATION
============================================================ */

function initializeCustomerMap() {

    const map =
        document.getElementById(
            "map"
        );


    if (!map) {
        return;
    }


    CustomerMap.init();
}


/*
 * Wait for centralized map engine.
 */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            /*
             * Give map.js a moment to
             * initialize the central map.
             */

            setTimeout(
                initializeCustomerMap,
                100
            );

        },
        {
            once:
                true
        }
    );

} else {

    setTimeout(
        initializeCustomerMap,
        100
    );
              }
