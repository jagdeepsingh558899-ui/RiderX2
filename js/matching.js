/* ============================================================
   RIDERX — REALTIME RIDER MATCHING ENGINE
   Firebase v10.8.0
   ============================================================ */

import {
    auth,
    db,
    collection,
    query,
    where,
    onSnapshot,
    doc,
    runTransaction,
    serverTimestamp
} from "../firebase/firebase-config.js";

/* ============================================================
   STATE
============================================================ */

const matchingState = {

    unsubscribeRequests: null,

    currentRideId: null,

    riderLocation: null,

    active: false

};

/* ============================================================
   DISTANCE
============================================================ */

export function distanceKm(
    lat1,
    lng1,
    lat2,
    lng2
){

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLng / 2) ** 2;

    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );

}

/* ============================================================
   FIND ONLINE RIDERS
============================================================ */

export async function findAvailableRider(){

    /*
       This function intentionally does not automatically
       assign a rider.

       The rider must see the request and accept it.
       This prevents the customer ride from being assigned
       to a random rider without the rider accepting.
    */

    return null;

}

/* ============================================================
   LISTEN FOR RIDE REQUESTS
============================================================ */

export function listenForRideRequests(
    callback
){

    stopRideRequestListener();

    const requestsQuery =
        query(

            collection(
                db,
                "rides"
            ),

            where(
                "status",
                "in",
                [
                    "REQUESTED",
                    "SEARCHING"
                ]
            )

        );

    matchingState.unsubscribeRequests =
        onSnapshot(

            requestsQuery,

            snapshot => {

                const rides = [];

                snapshot.forEach(
                    rideDoc => {

                        rides.push({

                            id:
                                rideDoc.id,

                            ...rideDoc.data()

                        });

                    }
                );

                /*
                   Newest requests first.
                */

                rides.sort(
                    (a,b) => {

                        const aTime =
                            a.createdAt?.seconds ||
                            0;

                        const bTime =
                            b.createdAt?.seconds ||
                            0;

                        return bTime - aTime;

                    }
                );

                if(
                    typeof callback ===
                    "function"
                ){

                    callback(
                        rides
                    );

                }

            },

            error => {

                console.error(
                    "RiderX matching listener error:",
                    error
                );

                if(
                    typeof callback ===
                    "function"
                ){

                    callback(
                        [],
                        error
                    );

                }

            }

        );

    matchingState.active =
        true;

    return (
        matchingState
            .unsubscribeRequests
    );

}

/* ============================================================
   STOP LISTENER
============================================================ */

export function stopRideRequestListener(){

    if(
        typeof matchingState
            .unsubscribeRequests ===
        "function"
    ){

        matchingState
            .unsubscribeRequests();

    }

    matchingState
        .unsubscribeRequests =
        null;

    matchingState.active =
        false;

}

/* ============================================================
   ACCEPT RIDE
============================================================ */

export async function acceptRide(
    rideId,
    riderData = {}
){

    const user =
        auth.currentUser;

    if(!user){

        throw new Error(
            "Rider login required."
        );

    }

    if(!rideId){

        throw new Error(
            "Ride ID missing."
        );

    }

    const rideRef =
        doc(
            db,
            "rides",
            rideId
        );

    /*
       Transaction is important.

       If two riders press Accept at almost
       the same time, only one rider should
       win the ride.
    */

    const accepted =
        await runTransaction(
            db,
            async transaction => {

                const rideSnap =
                    await transaction.get(
                        rideRef
                    );

                if(
                    !rideSnap.exists()
                ){

                    throw new Error(
                        "Ride request no longer exists."
                    );

                }

                const ride =
                    rideSnap.data();

                const currentStatus =
                    String(
                        ride.status ||
                        ""
                    ).toUpperCase();

                if(
                    ![
                        "REQUESTED",
                        "SEARCHING"
                    ].includes(
                        currentStatus
                    )
                ){

                    return false;

                }

                transaction.update(

                    rideRef,

                    {

                        status:
                            "ACCEPTED",

                        riderId:
                            user.uid,

                        driverId:
                            user.uid,

                        riderName:
                            riderData.name ||
                            user.displayName ||
                            "RiderX Rider",

                        riderPhone:
                            riderData.phone ||
                            "",

                        riderPhoto:
                            riderData.photo ||
                            user.photoURL ||
                            "",

                        riderVehicle:
                            riderData.vehicle ||
                            "",

                        riderVehicleNumber:
                            riderData.vehicleNumber ||
                            "",

                        riderRating:
                            riderData.rating ||
                            5,

                        acceptedAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()

                    }

                );

                return true;

            }
        );

    if(!accepted){

        return {

            success:false,

            reason:
                "already_taken"

        };

    }

    matchingState.currentRideId =
        rideId;

    localStorage.setItem(
        "riderx_current_ride_id",
        rideId
    );

    localStorage.setItem(
        "riderx_active_ride_id",
        rideId
    );

    localStorage.setItem(
        "rideId",
        rideId
    );

    return {

        success:true,

        rideId

    };

}

/* ============================================================
   REJECT RIDE
============================================================ */

export async function rejectRide(
    rideId
){

    /*
       Do NOT change the customer's ride to
       REJECTED when one rider rejects it.

       Another rider must still be able to accept it.
       Therefore rejection is stored separately.
    */

    const user =
        auth.currentUser;

    if(!user){

        throw new Error(
            "Rider login required."
        );

    }

    if(!rideId){

        throw new Error(
            "Ride ID missing."
        );

    }

    /*
       We keep rider rejection locally so the
       same rider does not repeatedly see the
       same request during this session.
    */

    const rejected =
        JSON.parse(
            localStorage.getItem(
                "riderx_rejected_rides"
            ) || "[]"
        );

    if(
        !rejected.includes(rideId)
    ){

        rejected.push(
            rideId
        );

    }

    localStorage.setItem(
        "riderx_rejected_rides",
        JSON.stringify(
            rejected.slice(-100)
        )
    );

    return true;

}

/* ============================================================
   GET RIDER REJECTIONS
============================================================ */

export function getRejectedRides(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "riderx_rejected_rides"
            ) || "[]"
        );

    }catch{

        return [];

    }

}

/* ============================================================
   UPDATE RIDER LOCATION
============================================================ */

export function setRiderLocation(
    lat,
    lng
){

    matchingState.riderLocation = {

        lat:
            Number(lat),

        lng:
            Number(lng)

    };

}

/* ============================================================
   PUBLIC STATE
============================================================ */

export const matching = {

    state:
        matchingState,

    listen:
        listenForRideRequests,

    stop:
        stopRideRequestListener,

    accept:
        acceptRide,

    reject:
        rejectRide,

    rejected:
        getRejectedRides,

    setLocation:
        setRiderLocation,

    distance:
        distanceKm

};

window.RiderXMatching =
    matching;
