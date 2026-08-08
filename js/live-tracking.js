/**
 * ============================================================
 * RiderX Live Tracking Controller
 * ============================================================
 *
 * This file DOES NOT create a Leaflet map.
 *
 * Map ownership:
 *     js/map.js
 *
 * Customer map controller:
 *     js/customer-map.js
 *
 * Responsibilities:
 *     - Active ride tracking
 *     - Rider live GPS
 *     - Customer live rider position
 *     - Firebase ride location sync
 *     - Ride start / complete status
 *     - Automatic UI updates
 *
 * ============================================================
 */

import {
    auth,
    db,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    onSnapshot,
    serverTimestamp
} from "../firebase/firebase-config.js";


/* ============================================================
   STATE
============================================================ */

const LiveTrackingState =
    window.RiderXLiveTrackingState ||
    {

        initialized:
            false,

        gpsStarted:
            false,

        gpsWatchId:
            null,

        rideId:
            null,

        rideUnsubscribe:
            null,

        locationUnsubscribe:
            null,

        currentLocation:
            null,

        lastFirebaseUpdate:
            0,

        updateInterval:
            3000,

        role:
            null,

        rideStatus:
            null,

        mapFollow:
            true

    };


window.RiderXLiveTrackingState =
    LiveTrackingState;


/* ============================================================
   ROLE DETECTION
============================================================ */

function detectRole() {

    const bodyRole =
        document.body?.dataset?.role;

    if (bodyRole) {

        return bodyRole.toLowerCase();

    }


    const path =
        window.location.pathname
            .toLowerCase();


    if (
        path.includes(
            "/rider/"
        )
    ) {

        return "rider";

    }


    return "customer";
}


LiveTrackingState.role =
    detectRole();


/* ============================================================
   MAP ENGINE
============================================================ */

function getMapEngine() {

    return window.RiderXMap ||
        null;

}


function getMap() {

    const engine =
        getMapEngine();

    if (!engine) {

        return null;

    }

    return engine.getMap();

}


/* ============================================================
   INITIALIZE
============================================================ */

export function initLiveTracking(
    options = {}
) {

    if (
        LiveTrackingState.initialized
    ) {

        return true;

    }


    LiveTrackingState.initialized =
        true;


    if (
        options.role
    ) {

        LiveTrackingState.role =
            options.role;

    }


    if (
        options.rideId
    ) {

        setRideId(
            options.rideId
        );

    }


    /*
     * The central map engine is the
     * ONLY component allowed to create
     * the Leaflet map.
     */

    ensureCentralMap();


    /*
     * Rider sends GPS.
     *
     * Customer only observes rider.
     */

    if (
        LiveTrackingState.role ===
        "rider"
    ) {

        startRiderGPS();

    }


    /*
     * Existing ride ID may be stored
     * in localStorage.
     */

    if (
        !LiveTrackingState.rideId
    ) {

        const savedRideId =
            getSavedRideId();


        if (
            savedRideId
        ) {

            setRideId(
                savedRideId
            );

        }

    }


    return true;

}


/* ============================================================
   ENSURE CENTRAL MAP
============================================================ */

function ensureCentralMap() {

    const engine =
        getMapEngine();

    if (!engine) {

        console.warn(
            "RiderX Live Tracking: map.js not loaded."
        );

        return null;

    }


    let map =
        engine.getMap();


    if (!map) {

        const mapElement =
            document.getElementById(
                "map"
            );


        if (
            mapElement
        ) {

            map =
                engine.initMap(
                    "map"
                );

        }

    }


    return map;

}


/* ============================================================
   SET RIDE ID
============================================================ */

export function setRideId(
    rideId
) {

    if (
        !rideId
    ) {

        return;

    }


    LiveTrackingState.rideId =
        String(
            rideId
        );


    try {

        localStorage.setItem(
            "riderx_active_ride_id",
            LiveTrackingState.rideId
        );

    } catch (error) {}


    /*
     * Start Firestore ride listener.
     */

    subscribeToRide(
        LiveTrackingState.rideId
    );

}


/* ============================================================
   GET RIDE ID
============================================================ */

export function getRideId() {

    return (
        LiveTrackingState.rideId ||
        getSavedRideId()
    );

}


/* ============================================================
   SAVED RIDE ID
============================================================ */

function getSavedRideId() {

    try {

        return localStorage.getItem(
            "riderx_active_ride_id"
        );

    } catch (error) {

        return null;

    }

}


/* ============================================================
   START RIDER GPS
============================================================ */

export function startRiderGPS() {

    if (
        LiveTrackingState.gpsStarted
    ) {

        return LiveTrackingState.gpsWatchId;

    }


    if (
        LiveTrackingState.role !==
        "rider"
    ) {

        return null;

    }


    if (
        !navigator.geolocation
    ) {

        showLocationError(
            "GPS is not available on this device."
        );

        return null;

    }


    LiveTrackingState.gpsStarted =
        true;


    /*
     * IMPORTANT:
     *
     * We use the centralized map.js
     * GPS watcher.
     *
     * This prevents a second
     * navigator.geolocation.watchPosition()
     * from being created.
     */

    const engine =
        getMapEngine();


    if (
        engine
    ) {

        engine.initLiveGPS();

    }


    /*
     * Listen to the central location
     * stream.
     */

    if (
        engine
    ) {

        LiveTrackingState.locationUnsubscribe =
            engine.onLocationChange(
                location => {

                    if (
                        LiveTrackingState.role !==
                        "rider"
                    ) {

                        return;

                    }


                    handleRiderLocation(
                        location
                    );

                }
            );

    }


    return true;

}


/* ============================================================
   HANDLE RIDER LOCATION
============================================================ */

async function handleRiderLocation(
    location
) {

    if (
        !location
    ) {

        return;

    }


    const lat =
        Number(
            location.lat
        );


    const lng =
        Number(
            location.lng
        );


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return;

    }


    LiveTrackingState.currentLocation =
        {

            lat,

            lng,

            accuracy:
                location.accuracy ??
                null,

            heading:
                location.heading ??
                null,

            speed:
                location.speed ??
                null,

            timestamp:
                Date.now()

        };


    /*
     * Keep rider marker on central map.
     */

    const engine =
        getMapEngine();


    if (
        engine
    ) {

        engine.setCurrentLocationMarker(
            lat,
            lng,
            "rider"
        );

    }


    /*
     * Firebase update throttling.
     */

    const now =
        Date.now();


    if (
        now -
        LiveTrackingState.lastFirebaseUpdate
        <
        LiveTrackingState.updateInterval
    ) {

        return;

    }


    LiveTrackingState.lastFirebaseUpdate =
        now;


    await saveRiderLocation(
        LiveTrackingState.currentLocation
    );


    /*
     * If rider has an active ride,
     * also write the location into
     * that ride document.
     */

    if (
        LiveTrackingState.rideId
    ) {

        await saveRideRiderLocation(
            LiveTrackingState.rideId,
            LiveTrackingState.currentLocation
        );

    }


    window.dispatchEvent(
        new CustomEvent(
            "riderx:rider-gps-updated",
            {

                detail:
                    LiveTrackingState.currentLocation

            }
        )
    );

}


/* ============================================================
   SAVE RIDER PROFILE LOCATION
============================================================ */

async function saveRiderLocation(
    location
) {

    const user =
        auth.currentUser;


    if (
        !user ||
        LiveTrackingState.role !==
        "rider"
    ) {

        return;

    }


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

                location:
                    {

                        lat:
                            location.lat,

                        lng:
                            location.lng

                    },

                latitude:
                    location.lat,

                longitude:
                    location.lng,

                heading:
                    location.heading,

                speed:
                    location.speed,

                accuracy:
                    location.accuracy,

                online:
                    true,

                lastLocationUpdate:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        /*
         * Keep legacy location document
         * compatible with existing pages.
         */

        const locationRef =
            doc(
                db,
                "locations",
                user.uid
            );


        await setDoc(

            locationRef,

            {

                lat:
                    location.lat,

                lng:
                    location.lng,

                latitude:
                    location.lat,

                longitude:
                    location.lng,

                type:
                    "rider",

                riderId:
                    user.uid,

                online:
                    true,

                heading:
                    location.heading,

                speed:
                    location.speed,

                accuracy:
                    location.accuracy,

                time:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );

    } catch (error) {

        console.error(
            "RiderX: rider location sync failed.",
            error
        );

    }

}


/* ============================================================
   SAVE LOCATION INSIDE ACTIVE RIDE
============================================================ */

async function saveRideRiderLocation(
    rideId,
    location
) {

    if (
        !rideId
    ) {

        return;

    }


    try {

        const rideRef =
            doc(
                db,
                "rides",
                rideId
            );


        await updateDoc(

            rideRef,

            {

                riderLocation:
                    {

                        lat:
                            location.lat,

                        lng:
                            location.lng,

                        heading:
                            location.heading,

                        speed:
                            location.speed,

                        accuracy:
                            location.accuracy,

                        updatedAt:
                            serverTimestamp()

                    },

                lastRiderLocationUpdate:
                    serverTimestamp()

            }

        );

    } catch (error) {

        /*
         * If the ride document doesn't
         * exist yet, don't crash GPS.
         */

        console.warn(
            "RiderX: active ride location update failed.",
            error.message
        );

    }

}


/* ============================================================
   SUBSCRIBE TO ACTIVE RIDE
============================================================ */

export function subscribeToRide(
    rideId
) {

    if (
        !rideId
    ) {

        return null;

    }


    /*
     * Remove previous listener.
     */

    stopRideListener();


    const rideRef =
        doc(
            db,
            "rides",
            String(
                rideId
            )
        );


    LiveTrackingState.rideUnsubscribe =
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


                LiveTrackingState.rideStatus =
                    ride.status ||
                    ride.rideStatus ||
                    null;


                /*
                 * Rider location for CUSTOMER
                 */

                if (
                    LiveTrackingState.role ===
                    "customer"
                ) {

                    const riderLocation =
                        normalizeLocation(
                            ride.riderLocation ||
                            ride.driverLocation ||
                            ride.rider?.location
                        );


                    if (
                        riderLocation
                    ) {

                        updateCustomerRiderMarker(
                            riderLocation
                        );

                    }

                }


                /*
                 * Pickup and destination
                 */

                updateRideRoute(
                    ride
                );


                /*
                 * Update status UI.
                 */

                updateRideStatusUI(
                    ride
                );


                /*
                 * Dispatch unified event.
                 */

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:active-ride-updated",
                        {

                            detail:
                                {
                                    id:
                                        rideId,

                                    ...ride

                                }

                        }
                    )
                );

            },

            error => {

                console.error(
                    "RiderX: active ride listener failed.",
                    error
                );

            }

        );


    return LiveTrackingState
        .rideUnsubscribe;

}


/* ============================================================
   CUSTOMER RIDER MARKER
============================================================ */

function updateCustomerRiderMarker(
    location
) {

    const normalized =
        normalizeLocation(
            location
        );


    if (
        !normalized
    ) {

        return;

    }


    const engine =
        getMapEngine();


    if (
        !engine
    ) {

        return;

    }


    engine.setRiderLocation(
        normalized.lat,
        normalized.lng,
        "active-rider"
    );


    /*
     * Do not constantly force map movement
     * if customer is interacting with it.
     */

    const state =
        window.RiderXMapState;


    if (
        state &&
        state.following
    ) {

        const customer =
            state.currentLocation;


        if (
            customer
        ) {

            engine.fitToPoints(
                [
                    customer,

                    normalized

                ]
            );

        }

    }


    window.dispatchEvent(
        new CustomEvent(
            "riderx:live-rider-location",
            {

                detail:
                    normalized

            }
        )
    );

}


/* ============================================================
   UPDATE RIDE ROUTE
============================================================ */

function updateRideRoute(
    ride
) {

    if (
        !ride
    ) {

        return;

    }


    const pickup =
        normalizeLocation(
            ride.pickup ||
            ride.pickupLocation
        );


    const destination =
        normalizeLocation(
            ride.destination ||
            ride.dropoff ||
            ride.dropoffLocation
        );


    if (
        !pickup ||
        !destination
    ) {

        return;

    }


    const engine =
        getMapEngine();


    if (
        !engine
    ) {

        return;

    }


    /*
     * Do not redraw route every Firestore
     * location update if route is already
     * present.
     *
     * The central engine safely replaces
     * the old route if needed.
     */

    const state =
        window.RiderXMapState;


    const hasRoute =
        state &&
        (
            state.routeLayer ||
            state.routingControl
        );


    if (
        !hasRoute
    ) {

        engine.drawRoute(
            pickup,
            destination
        );

    }


    window.dispatchEvent(
        new CustomEvent(
            "riderx:ride-route-updated",
            {

                detail:
                    {
                        pickup,

                        destination

                    }

            }
        )
    );

}


/* ============================================================
   NORMALIZE LOCATION
============================================================ */

function normalizeLocation(
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

        lat,

        lng

    };

}


/* ============================================================
   START RIDE
============================================================ */

export async function startRide(
    rideId = getRideId()
) {

    if (
        !rideId
    ) {

        return false;

    }


    const user =
        auth.currentUser;


    if (
        !user
    ) {

        return false;

    }


    try {

        const rideRef =
            doc(
                db,
                "rides",
                rideId
            );


        await updateDoc(

            rideRef,

            {

                status:
                    "started",

                rideStatus:
                    "started",

                startedAt:
                    serverTimestamp(),

                startedBy:
                    user.uid

            }

        );


        LiveTrackingState.rideStatus =
            "started";


        updateRideStatusUI(
            {
                status:
                    "started"
            }
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx:ride-started",
                {

                    detail:
                        {
                            rideId

                        }

                }
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX: start ride failed.",
            error
        );


        return false;

    }

}


/* ============================================================
   COMPLETE RIDE
============================================================ */

export async function completeRide(
    rideId = getRideId()
) {

    if (
        !rideId
    ) {

        return false;

    }


    const user =
        auth.currentUser;


    if (
        !user
    ) {

        return false;

    }


    try {

        const rideRef =
            doc(
                db,
                "rides",
                rideId
            );


        await updateDoc(

            rideRef,

            {

                status:
                    "completed",

                rideStatus:
                    "completed",

                completedAt:
                    serverTimestamp(),

                completedBy:
                    user.uid

            }

        );


        LiveTrackingState.rideStatus =
            "completed";


        updateRideStatusUI(
            {
                status:
                    "completed"
            }
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx:ride-completed",
                {

                    detail:
                        {
                            rideId

                        }

                }
            )
        );


        /*
         * Stop active ride listener after
         * completion.
         *
         * GPS itself remains available for
         * rider online mode.
         */

        stopRideListener();


        return true;

    } catch (error) {

        console.error(
            "RiderX: complete ride failed.",
            error
        );


        return false;

    }

}


/* ============================================================
   RIDE STATUS UI
============================================================ */

function updateRideStatusUI(
    ride
) {

    const status =
        ride?.status ||
        ride?.rideStatus ||
        "";


    const elements =
        document.querySelectorAll(
            "[data-ride-status], #rideStatus"
        );


    elements.forEach(
        element => {

            element.textContent =
                formatStatus(
                    status
                );


            element.dataset.status =
                status;

        }
    );


    /*
     * Buttons
     */

    const startButtons =
        document.querySelectorAll(
            "#startRide, [data-start-ride]"
        );


    const completeButtons =
        document.querySelectorAll(
            "#completeRide, [data-complete-ride]"
        );


    startButtons.forEach(
        button => {

            button.disabled =
                status === "started" ||
                status === "completed";

        }
    );


    completeButtons.forEach(
        button => {

            button.disabled =
                status !== "started";

        }
    );

}


/* ============================================================
   FORMAT STATUS
============================================================ */

function formatStatus(
    status
) {

    const map =
        {

            requested:
                "Searching for rider",

            searching:
                "Finding your rider",

            accepted:
                "Rider accepted",

            arriving:
                "Rider is arriving",

            arrived:
                "Rider has arrived",

            started:
                "Trip started",

            completed:
                "Trip completed",

            cancelled:
                "Ride cancelled",

            cancelled_by_rider:
                "Ride cancelled by rider",

            cancelled_by_customer:
                "Ride cancelled by customer"

        };


    return (
        map[status] ||
        status ||
        "Ride"
    );

}


/* ============================================================
   BUTTON EVENTS
============================================================ */

function bindRideButtons() {

    const startButtons =
        document.querySelectorAll(
            "#startRide, [data-start-ride]"
        );


    startButtons.forEach(
        button => {

            if (
                button.dataset.riderxBound ===
                "true"
            ) {

                return;

            }


            button.dataset.riderxBound =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    const success =
                        await startRide();


                    if (
                        !success
                    ) {

                        showActionError(
                            "Unable to start the ride."
                        );

                    }

                }
            );

        }
    );


    const completeButtons =
        document.querySelectorAll(
            "#completeRide, [data-complete-ride]"
        );


    completeButtons.forEach(
        button => {

            if (
                button.dataset.riderxBound ===
                "true"
            ) {

                return;

            }


            button.dataset.riderxBound =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    const success =
                        await completeRide();


                    if (
                        !success
                    ) {

                        showActionError(
                            "Unable to complete the ride."
                        );

                    }

                }
            );

        }
    );

}


/* ============================================================
   STOP RIDE LISTENER
============================================================ */

export function stopRideListener() {

    if (
        LiveTrackingState.rideUnsubscribe
    ) {

        try {

            LiveTrackingState
                .rideUnsubscribe();

        } catch (error) {}

    }


    LiveTrackingState.rideUnsubscribe =
        null;

}


/* ============================================================
   STOP RIDER LOCATION LISTENER
============================================================ */

export function stopLocationListener() {

    if (
        LiveTrackingState.locationUnsubscribe
    ) {

        try {

            LiveTrackingState
                .locationUnsubscribe();

        } catch (error) {}

    }


    LiveTrackingState.locationUnsubscribe =
        null;

}


/* ============================================================
   STOP EVERYTHING
============================================================ */

export function stopLiveTracking() {

    stopRideListener();

    stopLocationListener();


    /*
     * GPS is owned by map.js.
     * We stop it there so there is still
     * only one GPS watcher.
     */

    const engine =
        getMapEngine();


    if (
        engine
    ) {

        engine.stopLiveGPS();

    }


    LiveTrackingState.gpsStarted =
        false;


    LiveTrackingState.gpsWatchId =
        null;


    LiveTrackingState.initialized =
        false;

}


/* ============================================================
   UI HELPERS
============================================================ */

function showLocationError(
    message
) {

    window.dispatchEvent(
        new CustomEvent(
            "riderx:location-error",
            {

                detail:
                    {
                        message

                    }

            }
        )
    );


    console.warn(
        "RiderX:",
        message
    );

}


function showActionError(
    message
) {

    window.dispatchEvent(
        new CustomEvent(
            "riderx:action-error",
            {

                detail:
                    {
                        message

                    }

            }
        )
    );


    console.warn(
        "RiderX:",
        message
    );

}


/* ============================================================
   GLOBAL API
============================================================ */

window.RiderXLiveTracking = {

    init:
        initLiveTracking,

    setRideId,

    getRideId,

    startGPS:
        startRiderGPS,

    startRide,

    completeRide,

    subscribeToRide,

    stopRideListener,

    stopLocationListener,

    stop:
        stopLiveTracking,

    getState:
        () =>
            LiveTrackingState

};


/* ============================================================
   AUTO INITIALIZATION
============================================================ */

function autoInitialize() {

    const mapElement =
        document.getElementById(
            "map"
        );


    /*
     * Don't activate tracking on unrelated
     * pages simply because this script was
     * accidentally included.
     */

    if (
        !mapElement
    ) {

        return;

    }


    /*
     * Only initialize on actual tracking/
     * trip pages or when an active ride exists.
     */

    const path =
        window.location.pathname
            .toLowerCase();


    const trackingPage =
        path.includes(
            "live"
        ) ||
        path.includes(
            "tracking"
        ) ||
        path.includes(
            "trip"
        ) ||
        path.includes(
            "ride-status"
        );


    const savedRideId =
        getSavedRideId();


    if (
        !trackingPage &&
        !savedRideId
    ) {

        return;

    }


    initLiveTracking({

        rideId:
            savedRideId ||
            null

    });


    bindRideButtons();

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
