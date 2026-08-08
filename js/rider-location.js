/**
 * ============================================================
 * RiderX Rider Location Service
 * ============================================================
 *
 * IMPORTANT:
 *
 * This file DOES NOT create its own GPS watcher.
 *
 * GPS owner:
 *      js/map.js
 *
 * Tracking service:
 *      js/tracking.js
 *
 * Active ride:
 *      js/live-tracking.js
 *
 * This prevents:
 *      - duplicate GPS watchers
 *      - duplicate Firebase writes
 *      - battery drain
 *      - conflicting rider locations
 * ============================================================
 */

import {
    auth,
    db,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "../firebase/firebase-config.js";


/* ============================================================
   STATE
============================================================ */

const RiderLocationState =
    window.RiderXRiderLocationState ||
    {

        initialized:
            false,

        riderId:
            null,

        online:
            false,

        activeRideId:
            null,

        locationListener:
            null,

        lastLocation:
            null,

        lastUpdate:
            0,

        updateInterval:
            3000

    };


window.RiderXRiderLocationState =
    RiderLocationState;


/* ============================================================
   GET RIDER ID
============================================================ */

function getRiderId() {

    if (
        RiderLocationState.riderId
    ) {

        return RiderLocationState.riderId;

    }


    const user =
        auth.currentUser;


    if (
        user
    ) {

        return user.uid;

    }


    try {

        return (
            localStorage.getItem(
                "riderx_rider_id"
            ) ||
            localStorage.getItem(
                "riderId"
            )
        );

    } catch (error) {

        return null;

    }

}


/* ============================================================
   SET RIDER ID
============================================================ */

export function setRiderId(
    riderId
) {

    if (
        !riderId
    ) {

        return;

    }


    RiderLocationState.riderId =
        String(
            riderId
        );


    try {

        localStorage.setItem(
            "riderx_rider_id",
            RiderLocationState.riderId
        );

    } catch (error) {}

}


/* ============================================================
   SET ACTIVE RIDE
============================================================ */

export function setActiveRide(
    rideId
) {

    RiderLocationState.activeRideId =
        rideId
            ? String(
                rideId
            )
            : null;


    try {

        if (
            RiderLocationState.activeRideId
        ) {

            localStorage.setItem(
                "riderx_active_ride_id",
                RiderLocationState.activeRideId
            );

        } else {

            localStorage.removeItem(
                "riderx_active_ride_id"
            );

        }

    } catch (error) {}

}


/* ============================================================
   GET ACTIVE RIDE
============================================================ */

function getActiveRide() {

    if (
        RiderLocationState.activeRideId
    ) {

        return RiderLocationState.activeRideId;

    }


    try {

        return localStorage.getItem(
            "riderx_active_ride_id"
        );

    } catch (error) {

        return null;

    }

}


/* ============================================================
   START RIDER LOCATION
============================================================ */

export function startLocationTracking(
    riderId = null
) {

    /*
     * Get rider ID.
     */

    const id =
        riderId ||
        getRiderId();


    if (
        id
    ) {

        setRiderId(
            id
        );

    }


    if (
        !RiderLocationState.riderId
    ) {

        console.warn(
            "RiderX: rider ID not available."
        );

        return false;

    }


    /*
     * Prevent duplicate listeners.
     */

    if (
        RiderLocationState.initialized
    ) {

        return true;

    }


    RiderLocationState.initialized =
        true;


    RiderLocationState.online =
        true;


    /*
     * IMPORTANT:
     *
     * map.js owns the only GPS watcher.
     */

    const mapEngine =
        window.RiderXMap;


    if (
        !mapEngine
    ) {

        console.warn(
            "RiderX: map.js is not loaded yet."
        );


        RiderLocationState.initialized =
            false;


        return false;

    }


    /*
     * Start central GPS engine.
     */

    mapEngine.initLiveGPS();


    /*
     * Listen to central GPS stream.
     */

    RiderLocationState.locationListener =
        mapEngine.onLocationChange(
            location => {

                handleLocation(
                    location
                );

            }
        );


    /*
     * Mark rider online immediately.
     */

    updateOnlineStatus(
        true
    );


    return true;

}


/* ============================================================
   HANDLE LOCATION
============================================================ */

async function handleLocation(
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


    RiderLocationState.lastLocation =
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
     * Prevent excessive Firebase writes.
     */

    const now =
        Date.now();


    if (
        now -
        RiderLocationState.lastUpdate
        <
        RiderLocationState.updateInterval
    ) {

        return;

    }


    RiderLocationState.lastUpdate =
        now;


    await writeRiderLocation(
        RiderLocationState.lastLocation
    );

}


/* ============================================================
   WRITE RIDER LOCATION
============================================================ */

async function writeRiderLocation(
    location
) {

    const riderId =
        RiderLocationState.riderId ||
        getRiderId();


    if (
        !riderId
    ) {

        return false;

    }


    try {

        /*
         * Primary location document.
         */

        const locationRef =
            doc(
                db,
                "locations",
                String(
                    riderId
                )
            );


        await setDoc(

            locationRef,

            {

                riderId:
                    String(
                        riderId
                    ),

                lat:
                    location.lat,

                lng:
                    location.lng,

                latitude:
                    location.lat,

                longitude:
                    location.lng,

                accuracy:
                    location.accuracy,

                heading:
                    location.heading,

                speed:
                    location.speed,

                online:
                    RiderLocationState.online,

                updatedAt:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        /*
         * Rider profile location.
         */

        const riderRef =
            doc(
                db,
                "riders",
                String(
                    riderId
                )
            );


        await setDoc(

            riderRef,

            {

                location:
                    {

                        lat:
                            location.lat,

                        lng:
                            location.lng,

                        accuracy:
                            location.accuracy,

                        heading:
                            location.heading,

                        speed:
                            location.speed

                    },

                latitude:
                    location.lat,

                longitude:
                    location.lng,

                online:
                    RiderLocationState.online,

                lastLocationUpdate:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        /*
         * Active ride location.
         */

        const rideId =
            getActiveRide();


        if (
            rideId
        ) {

            await updateActiveRideLocation(
                rideId,
                location
            );

        }


        /*
         * Notify the rest of RiderX.
         */

        window.dispatchEvent(
            new CustomEvent(
                "riderx:rider-location-updated",
                {

                    detail:
                        {

                            riderId:
                                String(
                                    riderId
                                ),

                            location

                        }

                }
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX rider location write failed:",
            error
        );


        return false;

    }

}


/* ============================================================
   UPDATE ACTIVE RIDE LOCATION
============================================================ */

async function updateActiveRideLocation(
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
                String(
                    rideId
                )
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

                        accuracy:
                            location.accuracy,

                        heading:
                            location.heading,

                        speed:
                            location.speed,

                        updatedAt:
                            serverTimestamp()

                    },

                lastRiderLocationUpdate:
                    serverTimestamp()

            }

        );

    } catch (error) {

        /*
         * Ride document may not exist yet.
         * Do not stop rider GPS because of it.
         */

        console.warn(
            "RiderX active ride location update:",
            error.message
        );

    }

}


/* ============================================================
   SET ONLINE
============================================================ */

export async function setOnline() {

    RiderLocationState.online =
        true;


    const riderId =
        RiderLocationState.riderId ||
        getRiderId();


    if (
        !riderId
    ) {

        return false;

    }


    try {

        const riderRef =
            doc(
                db,
                "riders",
                String(
                    riderId
                )
            );


        await setDoc(

            riderRef,

            {

                online:
                    true,

                availability:
                    "online",

                lastOnlineAt:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        const locationRef =
            doc(
                db,
                "locations",
                String(
                    riderId
                )
            );


        await setDoc(

            locationRef,

            {

                online:
                    true,

                availability:
                    "online",

                updatedAt:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        return true;

    } catch (error) {

        console.error(
            "RiderX set online failed:",
            error
        );


        return false;

    }

}


/* ============================================================
   SET OFFLINE
============================================================ */

export async function setOffline() {

    RiderLocationState.online =
        false;


    const riderId =
        RiderLocationState.riderId ||
        getRiderId();


    if (
        !riderId
    ) {

        return false;

    }


    try {

        const riderRef =
            doc(
                db,
                "riders",
                String(
                    riderId
                )
            );


        await setDoc(

            riderRef,

            {

                online:
                    false,

                availability:
                    "offline",

                lastOfflineAt:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        const locationRef =
            doc(
                db,
                "locations",
                String(
                    riderId
                )
            );


        await setDoc(

            locationRef,

            {

                online:
                    false,

                availability:
                    "offline",

                updatedAt:
                    serverTimestamp()

            },

            {
                merge:
                    true
            }

        );


        return true;

    } catch (error) {

        console.error(
            "RiderX set offline failed:",
            error
        );


        return false;

    }

}


/* ============================================================
   STOP LOCATION TRACKING
============================================================ */

export function stopLocationTracking() {

    /*
     * Remove our event listener only.
     *
     * We do NOT stop map.js GPS here because
     * another RiderX module may still need it.
     */

    if (
        RiderLocationState.locationListener
    ) {

        try {

            RiderLocationState
                .locationListener();

        } catch (error) {}

    }


    RiderLocationState.locationListener =
        null;


    RiderLocationState.initialized =
        false;


    /*
     * Mark rider offline.
     */

    setOffline();

}


/* ============================================================
   GET LAST LOCATION
============================================================ */

export function getLastLocation() {

    return (
        RiderLocationState.lastLocation ||
        null
    );

}


/* ============================================================
   GET STATE
============================================================ */

export function getLocationState() {

    return {
        ...RiderLocationState
    };

}


/* ============================================================
   AUTO RIDER ID
============================================================ */

function autoSetRiderId() {

    const user =
        auth.currentUser;


    if (
        user
    ) {

        setRiderId(
            user.uid
        );

    }

}


/* ============================================================
   GLOBAL API
============================================================ */

window.RiderXRiderLocation = {

    start:
        startLocationTracking,

    stop:
        stopLocationTracking,

    setOnline,

    setOffline,

    setRiderId,

    setActiveRide,

    getLastLocation,

    getState:
        getLocationState

};


/* ============================================================
   AUTH READY
============================================================ */

if (
    auth
) {

    /*
     * Firebase Auth observer is intentionally
     * used only when available.
     */

    try {

        auth.onAuthStateChanged(
            user => {

                if (
                    user
                ) {

                    setRiderId(
                        user.uid
                    );

                }

            }
        );

    } catch (error) {

        /*
         * Some Firebase versions expose
         * onAuthStateChanged differently.
         * Other modules can still explicitly
         * call startLocationTracking().
         */

    }

}


/* ============================================================
   EVENT BRIDGE
============================================================ */

window.addEventListener(
    "riderx:ride-started",
    event => {

        const rideId =
            event.detail?.rideId;


        if (
            rideId
        ) {

            setActiveRide(
                rideId
            );

        }

    }
);


window.addEventListener(
    "riderx:ride-completed",
    () => {

        setActiveRide(
            null
        );

    }
);


/* ============================================================
   EXPORT COMPATIBILITY
============================================================ */

export default {

    startLocationTracking,

    stopLocationTracking,

    updateRiderLocation,

    setOnline,

    setOffline,

    setRiderId,

    setActiveRide,

    getLastLocation,

    getLocationState

};
