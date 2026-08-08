/**
 * ============================================================
 * RiderX Unified Tracking Service
 * ============================================================
 *
 * Purpose:
 *   - Rider location write/read
 *   - Real-time rider location
 *   - Customer live tracking
 *   - Active ride tracking
 *   - Firebase compatibility
 *
 * IMPORTANT:
 *   This file NEVER creates a map.
 *   This file NEVER creates a GPS watcher.
 *
 * Map/GPS ownership:
 *   js/map.js
 *
 * Live ride ownership:
 *   js/live-tracking.js
 * ============================================================
 */

import {
    auth,
    db,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "../firebase/firebase-config.js";


/* ============================================================
   STATE
============================================================ */

const TrackingState =
    window.RiderXTrackingState ||
    {

        rideId:
            null,

        riderId:
            null,

        unsubscribe:
            null,

        location:
            null,

        initialized:
            false

    };


window.RiderXTrackingState =
    TrackingState;


/* ============================================================
   NORMALIZE LOCATION
============================================================ */

export function normalizeLocation(
    location
) {

    if (
        !location
    ) {

        return null;

    }


    /*
     * Support all existing RiderX
     * location formats.
     */

    let lat =
        location.lat ??
        location.latitude;


    let lng =
        location.lng ??
        location.longitude;


    /*
     * Firebase nested format:
     *
     * location: {
     *   lat,
     *   lng
     * }
     */

    if (
        location.location
    ) {

        lat =
            location.location.lat ??
            location.location.latitude ??
            lat;


        lng =
            location.location.lng ??
            location.location.longitude ??
            lng;

    }


    lat =
        Number(lat);


    lng =
        Number(lng);


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return null;

    }


    return {

        lat,

        lng,

        accuracy:
            location.accuracy ??
            location.location?.accuracy ??
            null,

        heading:
            location.heading ??
            location.location?.heading ??
            null,

        speed:
            location.speed ??
            location.location?.speed ??
            null

    };

}


/* ============================================================
   UPDATE RIDER LOCATION
============================================================ */

export async function updateRiderLocation(
    riderId,
    lat,
    lng,
    extra = {}
) {

    if (
        !riderId
    ) {

        return false;

    }


    const latitude =
        Number(lat);


    const longitude =
        Number(lng);


    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        return false;

    }


    const locationData = {

        lat:
            latitude,

        lng:
            longitude,

        latitude:
            latitude,

        longitude:
            longitude,

        accuracy:
            extra.accuracy ??
            null,

        heading:
            extra.heading ??
            null,

        speed:
            extra.speed ??
            null,

        riderId:
            String(
                riderId
            ),

        online:
            extra.online ??
            true,

        updatedAt:
            serverTimestamp()

    };


    try {

        /*
         * Primary Rider location.
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

            locationData,

            {
                merge:
                    true
            }

        );


        /*
         * Also keep rider profile
         * synchronized.
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

                location: {

                    lat:
                        latitude,

                    lng:
                        longitude,

                    accuracy:
                        extra.accuracy ??
                        null,

                    heading:
                        extra.heading ??
                        null,

                    speed:
                        extra.speed ??
                        null

                },

                latitude:
                    latitude,

                longitude:
                    longitude,

                online:
                    extra.online ??
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
         * If this rider currently has an
         * active ride, update that ride too.
         */

        const activeRideId =
            extra.rideId ||
            TrackingState.rideId;


        if (
            activeRideId
        ) {

            await updateRideRiderLocation(

                activeRideId,

                {

                    lat:
                        latitude,

                    lng:
                        longitude,

                    accuracy:
                        extra.accuracy ??
                        null,

                    heading:
                        extra.heading ??
                        null,

                    speed:
                        extra.speed ??
                        null

                }

            );

        }


        TrackingState.location =
            {

                lat:
                    latitude,

                lng:
                    longitude,

                accuracy:
                    extra.accuracy ??
                    null,

                heading:
                    extra.heading ??
                    null,

                speed:
                    extra.speed ??
                    null,

                timestamp:
                    Date.now()

            };


        window.dispatchEvent(
            new CustomEvent(
                "riderx:tracking-location-updated",
                {

                    detail:
                        TrackingState.location

                }
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX updateRiderLocation:",
            error
        );


        return false;

    }

}


/* ============================================================
   GET RIDER LOCATION
============================================================ */

export async function getRiderLocation(
    riderId
) {

    if (
        !riderId
    ) {

        return null;

    }


    try {

        /*
         * First try locations collection.
         */

        const locationRef =
            doc(
                db,
                "locations",
                String(
                    riderId
                )
            );


        const locationSnapshot =
            await getDoc(
                locationRef
            );


        if (
            locationSnapshot.exists()
        ) {

            const location =
                normalizeLocation(
                    locationSnapshot.data()
                );


            if (
                location
            ) {

                return location;

            }

        }


        /*
         * Fallback to rider profile.
         */

        const riderRef =
            doc(
                db,
                "riders",
                String(
                    riderId
                )
            );


        const riderSnapshot =
            await getDoc(
                riderRef
            );


        if (
            riderSnapshot.exists()
        ) {

            return normalizeLocation(
                riderSnapshot.data()
            );

        }


        return null;

    } catch (error) {

        console.error(
            "RiderX getRiderLocation:",
            error
        );


        return null;

    }

}


/* ============================================================
   LISTEN TO RIDER LOCATION
============================================================ */

export function listenToRiderLocation(
    riderId,
    callback
) {

    if (
        !riderId ||
        typeof callback !==
        "function"
    ) {

        return () => {};

    }


    /*
     * Stop previous listener if the
     * same tracking service is reused.
     */

    if (
        TrackingState.unsubscribe
    ) {

        try {

            TrackingState
                .unsubscribe();

        } catch (error) {}

    }


    TrackingState.riderId =
        String(
            riderId
        );


    const locationRef =
        doc(
            db,
            "locations",
            String(
                riderId
            )
        );


    const unsubscribe =
        onSnapshot(

            locationRef,

            snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    return;

                }


                const location =
                    normalizeLocation(
                        snapshot.data()
                    );


                if (
                    !location
                ) {

                    return;

                }


                TrackingState.location =
                    location;


                callback(
                    location,
                    snapshot.data()
                );


                /*
                 * Update centralized RiderX map
                 * when available.
                 */

                updateMapRiderMarker(
                    location,
                    String(
                        riderId
                    )
                );


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:rider-location-changed",
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

            },

            error => {

                console.error(
                    "RiderX rider location listener:",
                    error
                );

            }

        );


    TrackingState.unsubscribe =
        unsubscribe;


    return unsubscribe;

}


/* ============================================================
   UPDATE MAP RIDER MARKER
============================================================ */

function updateMapRiderMarker(
    location,
    riderId
) {

    const engine =
        window.RiderXMap;


    if (
        !engine
    ) {

        return;

    }


    try {

        engine.setRiderLocation(

            location.lat,

            location.lng,

            riderId

        );

    } catch (error) {

        console.warn(
            "RiderX map rider marker:",
            error
        );

    }

}


/* ============================================================
   LISTEN TO ACTIVE RIDE
============================================================ */

export function listenToRide(
    rideId,
    callback
) {

    if (
        !rideId
    ) {

        return () => {};

    }


    TrackingState.rideId =
        String(
            rideId
        );


    const rideRef =
        doc(
            db,
            "rides",
            String(
                rideId
            )
        );


    const unsubscribe =
        onSnapshot(

            rideRef,

            snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    return;

                }


                const ride =
                    {

                        id:
                            String(
                                rideId
                            ),

                        ...snapshot.data()

                    };


                /*
                 * Active rider location.
                 */

                const riderLocation =
                    normalizeLocation(

                        ride.riderLocation ||

                        ride.driverLocation ||

                        ride.rider?.location ||

                        null

                    );


                if (
                    riderLocation
                ) {

                    updateMapRiderMarker(

                        riderLocation,

                        "active-rider"

                    );


                    TrackingState.location =
                        riderLocation;

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
                        "riderx:tracking-ride-updated",
                        {

                            detail:
                                ride

                        }
                    )
                );

            },

            error => {

                console.error(
                    "RiderX ride tracking:",
                    error
                );

            }

        );


    /*
     * Store only the latest ride listener
     * if this service is used globally.
     */

    TrackingState.unsubscribe =
        unsubscribe;


    return unsubscribe;

}


/* ============================================================
   UPDATE ACTIVE RIDE RIDER LOCATION
============================================================ */

export async function updateRideRiderLocation(
    rideId,
    location
) {

    if (
        !rideId ||
        !location
    ) {

        return false;

    }


    const normalized =
        normalizeLocation(
            location
        );


    if (
        !normalized
    ) {

        return false;

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
                            normalized.lat,

                        lng:
                            normalized.lng,

                        accuracy:
                            normalized.accuracy,

                        heading:
                            normalized.heading,

                        speed:
                            normalized.speed,

                        updatedAt:
                            serverTimestamp()

                    },

                lastRiderLocationUpdate:
                    serverTimestamp()

            }

        );


        return true;

    } catch (error) {

        console.warn(
            "RiderX updateRideRiderLocation:",
            error.message
        );


        return false;

    }

}


/* ============================================================
   SET ACTIVE RIDE
============================================================ */

export function setActiveRide(
    rideId
) {

    TrackingState.rideId =
        rideId
            ? String(
                rideId
            )
            : null;


    try {

        if (
            TrackingState.rideId
        ) {

            localStorage.setItem(
                "riderx_active_ride_id",
                TrackingState.rideId
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

export function getActiveRide() {

    if (
        TrackingState.rideId
    ) {

        return TrackingState.rideId;

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
   STOP TRACKING LISTENERS
============================================================ */

export function stopTracking() {

    if (
        TrackingState.unsubscribe
    ) {

        try {

            TrackingState
                .unsubscribe();

        } catch (error) {}

    }


    TrackingState.unsubscribe =
        null;

    TrackingState.rideId =
        null;

    TrackingState.riderId =
        null;

    TrackingState.location =
        null;

}


/* ============================================================
   GET CURRENT TRACKING STATE
============================================================ */

export function getTrackingState() {

    return {
        ...TrackingState
    };

}


/* ============================================================
   CENTRALIZED LOCATION EVENT
============================================================ */

window.addEventListener(
    "riderx:rider-gps-updated",
    event => {

        const location =
            event.detail;


        if (
            !location
        ) {

            return;

        }


        TrackingState.location =
            location;

    }
);


/* ============================================================
   GLOBAL API
============================================================ */

window.RiderXTracking = {

    updateRiderLocation,

    getRiderLocation,

    listenToRiderLocation,

    listenToRide,

    updateRideRiderLocation,

    setActiveRide,

    getActiveRide,

    stopTracking,

    getTrackingState,

    normalizeLocation

};
