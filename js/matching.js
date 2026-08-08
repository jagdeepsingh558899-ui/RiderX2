/**
 * ============================================================
 * RiderX - SMART RIDER MATCHING ENGINE
 * ============================================================
 *
 * CUSTOMER
 *    ↓
 * RIDE REQUESTED
 *    ↓
 * FIND ONLINE RIDERS
 *    ↓
 * FILTER AVAILABLE RIDERS
 *    ↓
 * DISTANCE / SERVICE MATCH
 *    ↓
 * SEND REQUEST
 *    ↓
 * RIDER ACCEPTS
 *    ↓
 * ATOMIC ACCEPT
 *    ↓
 * RIDE ACCEPTED
 *
 * IMPORTANT
 * ------------------------------------------------------------
 * This file DOES NOT create GPS watchers.
 * This file DOES NOT create maps.
 * This file uses the central Firebase config.
 *
 * GPS owner:
 *      js/map.js
 *
 * Booking owner:
 *      js/booking.js
 *
 * Matching owner:
 *      js/matching.js
 *
 * ============================================================
 */

import {
    auth,
    db,

    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    runTransaction,
    serverTimestamp
} from "../firebase/firebase-config.js";


/* ============================================================
   STATE
============================================================ */

const state =
    window.RiderXMatchingState ||
    {

        activeRideId:
            null,

        matching:
            false,

        listener:
            null,

        riderRequests:
            new Map(),

        timeout:
            null

    };


window.RiderXMatchingState =
    state;


/* ============================================================
   CONFIG
============================================================ */

const CONFIG = {

    /*
     * Initial rider search radius.
     */

    initialRadiusKm:
        5,

    /*
     * Expand radius if no rider accepts.
     */

    maximumRadiusKm:
        20,

    /*
     * How often matching runs.
     */

    retryIntervalMs:
        7000,

    /*
     * Rider request expiry.
     */

    requestExpiryMs:
        15000,

    /*
     * Maximum riders contacted
     * in one matching round.
     */

    maximumRidersPerRound:
        5,

    /*
     * Maximum total riders for one ride.
     */

    maximumRiders:
        20

};


/* ============================================================
   START MATCHING
============================================================ */

export async function startMatching(
    rideId
) {

    if (
        !rideId
    ) {

        console.warn(
            "RiderX matching: rideId missing."
        );

        return false;

    }


    /*
     * Stop previous matching.
     */

    stopMatching();


    state.activeRideId =
        String(
            rideId
        );


    state.matching =
        true;


    console.log(
        "RiderX matching started:",
        state.activeRideId
    );


    /*
     * Watch ride status.
     */

    startRideWatcher(
        state.activeRideId
    );


    /*
     * First matching round.
     */

    await runMatchingRound(
        state.activeRideId
    );


    return true;

}


/* ============================================================
   STOP MATCHING
============================================================ */

export function stopMatching() {

    state.matching =
        false;


    if (
        typeof state.listener ===
        "function"
    ) {

        try {

            state.listener();

        } catch (error) {}

    }


    state.listener =
        null;


    if (
        state.timeout
    ) {

        clearTimeout(
            state.timeout
        );

        state.timeout =
            null;

    }


    state.activeRideId =
        null;


    state.riderRequests.clear();

}


/* ============================================================
   RIDE WATCHER
============================================================ */

function startRideWatcher(
    rideId
) {

    const rideRef =
        doc(
            db,
            "rides",
            rideId
        );


    state.listener =
        onSnapshot(

            rideRef,

            async snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    stopMatching();

                    return;

                }


                const ride =
                    snapshot.data();


                const status =
                    normalizeStatus(
                        ride.status ||
                        ride.rideStatus
                    );


                /*
                 * Once rider accepts, matching
                 * is finished.
                 */

                if (
                    [
                        "ACCEPTED",
                        "ARRIVING",
                        "ARRIVED",
                        "STARTED",
                        "COMPLETED",
                        "CANCELLED"
                    ].includes(
                        status
                    )
                ) {

                    state.matching =
                        false;


                    if (
                        state.timeout
                    ) {

                        clearTimeout(
                            state.timeout
                        );

                        state.timeout =
                            null;

                    }


                    return;

                }


                /*
                 * Continue searching.
                 */

                if (
                    status ===
                    "REQUESTED" ||
                    status ===
                    "SEARCHING"
                ) {

                    if (
                        state.matching
                    ) {

                        scheduleNextRound(
                            rideId
                        );

                    }

                }

            },

            error => {

                console.error(
                    "RiderX matching ride listener:",
                    error
                );

            }

        );

}


/* ============================================================
   MATCHING ROUND
============================================================ */

async function runMatchingRound(
    rideId
) {

    if (
        !state.matching
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


        const rideSnapshot =
            await getDoc(
                rideRef
            );


        if (
            !rideSnapshot.exists()
        ) {

            stopMatching();

            return;

        }


        const ride =
            rideSnapshot.data();


        const status =
            normalizeStatus(
                ride.status ||
                ride.rideStatus
            );


        /*
         * Do not match completed,
         * cancelled or accepted rides.
         */

        if (
            [
                "ACCEPTED",
                "ARRIVING",
                "ARRIVED",
                "STARTED",
                "COMPLETED",
                "CANCELLED"
            ].includes(
                status
            )
        ) {

            state.matching =
                false;

            return;

        }


        /*
         * Mark ride as SEARCHING.
         */

        if (
            status ===
            "REQUESTED"
        ) {

            try {

                await updateDoc(

                    rideRef,

                    {

                        status:
                            "SEARCHING",

                        rideStatus:
                            "SEARCHING",

                        matchingStatus:
                            "SEARCHING",

                        updatedAt:
                            serverTimestamp()

                    }

                );

            } catch (error) {

                console.warn(
                    "RiderX search status update:",
                    error
                );

            }

        }


        const pickup =
            getPickup(
                ride
            );


        if (
            !pickup
        ) {

            console.warn(
                "RiderX: pickup location missing."
            );

            return;

        }


        /*
         * Get radius.
         */

        const radius =
            getSearchRadius(
                ride
            );


        /*
         * Find riders.
         */

        const riders =
            await findAvailableRiders(
                pickup,
                ride.serviceType ||
                ride.service ||
                "bike",
                radius
            );


        if (
            !riders.length
        ) {

            console.log(
                "RiderX: no rider found in radius",
                radius
            );


            expandSearchRadius(
                rideId
            );


            dispatchMatchingEvent(
                "riderx:no-rider-found",
                {

                    rideId,

                    radius

                }
            );


            return;

        }


        /*
         * Exclude already contacted riders.
         */

        const eligible =
            riders.filter(
                rider => {

                    const riderId =
                        String(
                            rider.id
                        );


                    const alreadyContacted =
                        Array.isArray(
                            ride.notifiedRiders
                        ) &&
                        ride.notifiedRiders
                            .includes(
                                riderId
                            );


                    const rejected =
                        Array.isArray(
                            ride.rejectedRiders
                        ) &&
                        ride.rejectedRiders
                            .includes(
                                riderId
                            );


                    return (
                        !alreadyContacted &&
                        !rejected
                    );

                }
            );


        if (
            !eligible.length
        ) {

            /*
             * All nearby riders already contacted.
             * Expand search.
             */

            expandSearchRadius(
                rideId
            );


            return;

        }


        /*
         * Select closest riders.
         */

        const selected =
            eligible.slice(
                0,
                CONFIG.maximumRidersPerRound
            );


        /*
         * Send requests.
         */

        for (
            const rider
            of selected
        ) {

            await sendRideRequest(
                rideId,
                rider
            );

        }


        /*
         * Notify UI.
         */

        dispatchMatchingEvent(
            "riderx:ride-matching",
            {

                rideId,

                riders:
                    selected.map(
                        rider => rider.id
                    ),

                count:
                    selected.length

            }
        );


    } catch (error) {

        console.error(
            "RiderX matching round failed:",
            error
        );


        dispatchMatchingEvent(
            "riderx:matching-error",
            {

                rideId,

                error

            }
        );

    }

}


/* ============================================================
   FIND AVAILABLE RIDERS
============================================================ */

export async function findAvailableRiders(
    pickup,
    service,
    radiusKm = CONFIG.initialRadiusKm
) {

    try {

        const ridersQuery =
            query(

                collection(
                    db,
                    "riders"
                ),

                where(
                    "online",
                    "==",
                    true
                ),

                where(
                    "availability",
                    "==",
                    "online"
                )

            );


        let snapshot;


        try {

            snapshot =
                await getDocs(
                    ridersQuery
                );

        } catch (error) {

            /*
             * Compatibility fallback for older
             * rider documents that only contain
             * status = online.
             */

            const fallbackQuery =
                query(

                    collection(
                        db,
                        "riders"
                    ),

                    where(
                        "status",
                        "==",
                        "online"
                    )

                );


            snapshot =
                await getDocs(
                    fallbackQuery
                );

        }


        if (
            snapshot.empty
        ) {

            return [];

        }


        const riders =
            [];


        snapshot.forEach(
            riderDoc => {

                const data =
                    riderDoc.data();


                const rider =
                    {

                        id:
                            riderDoc.id,

                        ...data

                    };


                /*
                 * Do not match rider with
                 * an active ride.
                 */

                if (
                    rider.activeRideId
                ) {

                    return;

                }


                if (
                    rider.currentRideId
                ) {

                    return;

                }


                /*
                 * Service compatibility.
                 */

                if (
                    !serviceMatches(
                        rider,
                        service
                    )
                ) {

                    return;

                }


                /*
                 * Get rider location.
                 */

                const location =
                    getRiderLocation(
                        rider
                    );


                if (
                    !location
                ) {

                    return;

                }


                const distance =
                    distanceKm(

                        pickup.lat,

                        pickup.lng,

                        location.lat,

                        location.lng

                    );


                if (
                    distance >
                    radiusKm
                ) {

                    return;

                }


                riders.push(

                    {

                        ...rider,

                        distanceKm:
                            Number(
                                distance.toFixed(
                                    2
                                )
                            )

                    }

                );

            }
        );


        /*
         * Closest first.
         */

        riders.sort(
            (
                a,
                b
            ) =>
                a.distanceKm -
                b.distanceKm
        );


        return riders;

    } catch (error) {

        console.error(
            "RiderX find riders failed:",
            error
        );


        return [];

    }

}


/* ============================================================
   FIND SINGLE AVAILABLE RIDER
   COMPATIBILITY FUNCTION
============================================================ */

export async function findAvailableRider(
    pickup = null,
    service = "bike"
) {

    /*
     * If pickup wasn't provided,
     * find any available rider.
     */

    if (
        !pickup
    ) {

        try {

            const ridersQuery =
                query(

                    collection(
                        db,
                        "riders"
                    ),

                    where(
                        "online",
                        "==",
                        true
                    )

                );


            const snapshot =
                await getDocs(
                    ridersQuery
                );


            if (
                snapshot.empty
            ) {

                return null;

            }


            const first =
                snapshot.docs[0];


            return {

                id:
                    first.id,

                ...first.data()

            };

        } catch (error) {

            console.error(
                error
            );


            return null;

        }

    }


    const riders =
        await findAvailableRiders(
            pickup,
            service
        );


    return (
        riders[0] ||
        null
    );

}


/* ============================================================
   SERVICE MATCHING
============================================================ */

function serviceMatches(
    rider,
    service
) {

    const requested =
        normalizeService(
            service
        );


    /*
     * If rider hasn't specified a service,
     * allow the rider.
     */

    if (
        !rider.serviceType &&
        !rider.service &&
        !Array.isArray(
            rider.services
        )
    ) {

        return true;

    }


    const services =
        [];


    if (
        rider.serviceType
    ) {

        services.push(
            normalizeService(
                rider.serviceType
            )
        );

    }


    if (
        rider.service
    ) {

        services.push(
            normalizeService(
                rider.service
            )
        );

    }


    if (
        Array.isArray(
            rider.services
        )
    ) {

        rider.services.forEach(
            item => {

                services.push(
                    normalizeService(
                        item
                    )
                );

            }
        );

    }


    /*
     * Cab / car aliases.
     */

    if (
        requested ===
        "cab"
    ) {

        return (
            services.includes(
                "cab"
            ) ||
            services.includes(
                "car"
            ) ||
            services.includes(
                "taxi"
            )
        );

    }


    return services.includes(
        requested
    );

}


/* ============================================================
   NORMALIZE SERVICE
============================================================ */

function normalizeService(
    service
) {

    const value =
        String(
            service ||
            ""
        )
        .trim()
        .toLowerCase();


    if (
        [
            "bike",
            "bike taxi",
            "motorcycle"
        ].includes(
            value
        )
    ) {

        return "bike";

    }


    if (
        [
            "cab",
            "car",
            "taxi"
        ].includes(
            value
        )
    ) {

        return "cab";

    }


    if (
        [
            "parcel",
            "delivery"
        ].includes(
            value
        )
    ) {

        return "parcel";

    }


    if (
        [
            "food",
            "food delivery"
        ].includes(
            value
        )
    ) {

        return "food";

    }


    return value;

}


/* ============================================================
   GET RIDER LOCATION
============================================================ */

function getRiderLocation(
    rider
) {

    if (
        rider.location &&
        validCoordinates(
            rider.location.lat,
            rider.location.lng
        )
    ) {

        return {

            lat:
                Number(
                    rider.location.lat
                ),

            lng:
                Number(
                    rider.location.lng
                )

        };

    }


    if (
        validCoordinates(
            rider.latitude,
            rider.longitude
        )
    ) {

        return {

            lat:
                Number(
                    rider.latitude
                ),

            lng:
                Number(
                    rider.longitude
                )

        };

    }


    if (
        validCoordinates(
            rider.lat,
            rider.lng
        )
    ) {

        return {

            lat:
                Number(
                    rider.lat
                ),

            lng:
                Number(
                    rider.lng
                )

        };

    }


    return null;

}


/* ============================================================
   SEND RIDE REQUEST
============================================================ */

export async function sendRideRequest(
    rideId,
    rider
) {

    if (
        !rideId ||
        !rider ||
        !rider.id
    ) {

        return false;

    }


    const riderId =
        String(
            rider.id
        );


    const requestRef =
        doc(

            db,

            "rideRequests",

            `${rideId}_${riderId}`

        );


    const rideRef =
        doc(
            db,
            "rides",
            rideId
        );


    try {

        /*
         * Check ride first.
         */

        const rideSnapshot =
            await getDoc(
                rideRef
            );


        if (
            !rideSnapshot.exists()
        ) {

            return false;

        }


        const ride =
            rideSnapshot.data();


        const status =
            normalizeStatus(
                ride.status ||
                ride.rideStatus
            );


        if (
            [
                "ACCEPTED",
                "ARRIVING",
                "ARRIVED",
                "STARTED",
                "COMPLETED",
                "CANCELLED"
            ].includes(
                status
            )
        ) {

            return false;

        }


        /*
         * Don't duplicate requests.
         */

        const requestSnapshot =
            await getDoc(
                requestRef
            );


        if (
            requestSnapshot.exists()
        ) {

            return false;

        }


        const expiresAt =
            Date.now() +
            CONFIG.requestExpiryMs;


        /*
         * Create rider request.
         */

        await setDoc(

            requestRef,

            {

                rideId,

                riderId,

                customerId:
                    ride.customerId ||
                    null,

                serviceType:
                    ride.serviceType ||
                    ride.service ||
                    "bike",

                pickup:
                    ride.pickup ||
                    null,

                drop:
                    ride.drop ||
                    ride.destination ||
                    null,

                fare:
                    ride.fare ||
                    ride.estimatedFare ||
                    0,

                distance:
                    ride.distance ||
                    ride.estimatedDistance ||
                    0,

                customerName:
                    ride.customerName ||
                    "RiderX Customer",

                riderName:
                    rider.name ||
                    rider.displayName ||
                    rider.fullName ||
                    "RiderX Rider",

                riderDistance:
                    rider.distanceKm ||
                    0,

                status:
                    "PENDING",

                createdAt:
                    serverTimestamp(),

                expiresAt,

                updatedAt:
                    serverTimestamp()

            }

        );


        /*
         * Update ride notified riders.
         */

        await appendRiderToRide(
            rideRef,
            riderId
        );


        /*
         * Store rider's current request.
         */

        state.riderRequests.set(
            riderId,
            {

                rideId,

                riderId,

                requestId:
                    requestRef.id,

                expiresAt

            }
        );


        /*
         * Notify rider side if it is open.
         */

        dispatchMatchingEvent(
            "riderx:new-ride-request",
            {

                rideId,

                riderId,

                requestId:
                    requestRef.id,

                rider

            }
        );


        /*
         * Auto-expire request.
         */

        setTimeout(
            () => {

                expireRideRequest(
                    rideId,
                    riderId
                );

            },
            CONFIG.requestExpiryMs
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX send ride request failed:",
            error
        );


        return false;

    }

}


/* ============================================================
   APPEND RIDER TO RIDE
============================================================ */

async function appendRiderToRide(
    rideRef,
    riderId
) {

    try {

        await runTransaction(

            db,

            async transaction => {

                const snapshot =
                    await transaction.get(
                        rideRef
                    );


                if (
                    !snapshot.exists()
                ) {

                    throw new Error(
                        "Ride not found."
                    );

                }


                const ride =
                    snapshot.data();


                const current =
                    Array.isArray(
                        ride.notifiedRiders
                    )
                        ? [
                            ...ride.notifiedRiders
                        ]
                        : [];


                if (
                    current.includes(
                        riderId
                    )
                ) {

                    return;

                }


                if (
                    current.length >=
                    CONFIG.maximumRiders
                ) {

                    return;

                }


                current.push(
                    riderId
                );


                transaction.update(

                    rideRef,

                    {

                        notifiedRiders:
                            current,

                        updatedAt:
                            serverTimestamp()

                    }

                );

            }

        );

    } catch (error) {

        console.warn(
            "RiderX notified rider update:",
            error
        );

    }

}


/* ============================================================
   ACCEPT RIDE
   ATOMIC FIRST-WIN SYSTEM
============================================================ */

export async function acceptRideRequest(
    rideId,
    riderId = null
) {

    const user =
        auth.currentUser;


    const actualRiderId =
        riderId ||
        user?.uid;


    if (
        !rideId ||
        !actualRiderId
    ) {

        return false;

    }


    const rideRef =
        doc(
            db,
            "rides",
            String(
                rideId
            )
        );


    const requestRef =
        doc(

            db,

            "rideRequests",

            `${rideId}_${actualRiderId}`

        );


    try {

        let acceptedRide =
            null;


        await runTransaction(

            db,

            async transaction => {

                /*
                 * IMPORTANT:
                 *
                 * Ride is read first.
                 * This makes the acceptance
                 * atomic.
                 */

                const rideSnapshot =
                    await transaction.get(
                        rideRef
                    );


                if (
                    !rideSnapshot.exists()
                ) {

                    throw new Error(
                        "Ride no longer exists."
                    );

                }


                const ride =
                    rideSnapshot.data();


                const status =
                    normalizeStatus(
                        ride.status ||
                        ride.rideStatus
                    );


                /*
                 * Another rider already won.
                 */

                if (
                    status !==
                    "REQUESTED" &&
                    status !==
                    "SEARCHING"
                ) {

                    throw new Error(
                        "This ride has already been accepted."
                    );

                }


                /*
                 * Read rider profile.
                 */

                const riderRef =
                    doc(
                        db,
                        "riders",
                        String(
                            actualRiderId
                        )
                    );


                const riderSnapshot =
                    await transaction.get(
                        riderRef
                    );


                if (
                    !riderSnapshot.exists()
                ) {

                    throw new Error(
                        "Rider profile not found."
                    );

                }


                const rider =
                    riderSnapshot.data();


                /*
                 * Verify rider is online.
                 */

                if (
                    rider.online ===
                    false ||
                    rider.availability ===
                    "offline"
                ) {

                    throw new Error(
                        "You are offline."
                    );

                }


                const riderName =
                    rider.name ||
                    rider.fullName ||
                    rider.displayName ||
                    "RiderX Rider";


                /*
                 * Update ride.
                 */

                transaction.update(

                    rideRef,

                    {

                        status:
                            "ACCEPTED",

                        rideStatus:
                            "ACCEPTED",

                        matchingStatus:
                            "ACCEPTED",

                        riderId:
                            String(
                                actualRiderId
                            ),

                        driverId:
                            String(
                                actualRiderId
                            ),

                        riderName,

                        riderPhone:
                            rider.phone ||
                            rider.mobile ||
                            "",

                        riderVehicle:
                            rider.vehicleType ||
                            rider.vehicle ||
                            "Bike",

                        riderVehicleNumber:
                            rider.vehicleNumber ||
                            rider.registrationNumber ||
                            "",

                        riderPhoto:
                            rider.photoURL ||
                            rider.photo ||
                            "",

                        riderRating:
                            rider.rating ||
                            5,

                        acceptedAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()

                    }

                );


                /*
                 * Make rider busy.
                 */

                transaction.update(

                    riderRef,

                    {

                        availability:
                            "busy",

                        activeRideId:
                            String(
                                rideId
                            ),

                        currentRideId:
                            String(
                                rideId
                            ),

                        lastRideAcceptedAt:
                            serverTimestamp()

                    }

                );


                /*
                 * Update request.
                 */

                const requestSnapshot =
                    await transaction.get(
                        requestRef
                    );


                if (
                    requestSnapshot.exists()
                ) {

                    transaction.update(

                        requestRef,

                        {

                            status:
                                "ACCEPTED",

                            acceptedAt:
                                serverTimestamp(),

                            updatedAt:
                                serverTimestamp()

                        }

                    );

                }


                acceptedRide =
                    {

                        id:
                            rideSnapshot.id,

                        ...ride,

                        status:
                            "ACCEPTED",

                        rideStatus:
                            "ACCEPTED",

                        riderId:
                            String(
                                actualRiderId
                            ),

                        driverId:
                            String(
                                actualRiderId
                            ),

                        riderName

                    };

            }

        );


        /*
         * Notify rider side.
         */

        dispatchMatchingEvent(
            "riderx:ride-accepted",
            {

                rideId,

                riderId:
                    actualRiderId,

                ride:
                    acceptedRide

            }
        );


        /*
         * Customer side receives this
         * through its ride listener.
         */

        return acceptedRide;

    } catch (error) {

        console.warn(
            "RiderX accept ride:",
            error.message
        );


        dispatchMatchingEvent(
            "riderx:accept-failed",
            {

                rideId,

                riderId:
                    actualRiderId,

                message:
                    error.message

            }
        );


        return false;

    }

}


/* ============================================================
   REJECT RIDE REQUEST
============================================================ */

export async function rejectRideRequest(
    rideId,
    riderId = null
) {

    const user =
        auth.currentUser;


    const actualRiderId =
        riderId ||
        user?.uid;


    if (
        !rideId ||
        !actualRiderId
    ) {

        return false;

    }


    try {

        const requestRef =
            doc(

                db,

                "rideRequests",

                `${rideId}_${actualRiderId}`

            );


        await updateDoc(

            requestRef,

            {

                status:
                    "REJECTED",

                rejectedAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()

            }

        );


        /*
         * Add rider to rejected list.
         */

        const rideRef =
            doc(
                db,
                "rides",
                String(
                    rideId
                )
            );


        await addRejectedRider(
            rideRef,
            actualRiderId
        );


        state.riderRequests.delete(
            String(
                actualRiderId
            )
        );


        dispatchMatchingEvent(
            "riderx:ride-rejected",
            {

                rideId,

                riderId:
                    actualRiderId

            }
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX reject request:",
            error
        );


        return false;

    }

}


/* ============================================================
   ADD REJECTED RIDER
============================================================ */

async function addRejectedRider(
    rideRef,
    riderId
) {

    try {

        await runTransaction(

            db,

            async transaction => {

                const snapshot =
                    await transaction.get(
                        rideRef
                    );


                if (
                    !snapshot.exists()
                ) {

                    return;

                }


                const ride =
                    snapshot.data();


                const list =
                    Array.isArray(
                        ride.rejectedRiders
                    )
                        ? [
                            ...ride.rejectedRiders
                        ]
                        : [];


                if (
                    !list.includes(
                        String(
                            riderId
                        )
                    )
                ) {

                    list.push(
                        String(
                            riderId
                        )
                    );

                }


                transaction.update(

                    rideRef,

                    {

                        rejectedRiders:
                            list,

                        updatedAt:
                            serverTimestamp()

                    }

                );

            }

        );

    } catch (error) {

        console.warn(
            "RiderX rejected rider update:",
            error
        );

    }

}


/* ============================================================
   EXPIRE REQUEST
============================================================ */

async function expireRideRequest(
    rideId,
    riderId
) {

    try {

        const requestRef =
            doc(

                db,

                "rideRequests",

                `${rideId}_${riderId}`

            );


        const snapshot =
            await getDoc(
                requestRef
            );


        if (
            !snapshot.exists()
        ) {

            return;

        }


        const request =
            snapshot.data();


        if (
            request.status !==
            "PENDING"
        ) {

            return;

        }


        await updateDoc(

            requestRef,

            {

                status:
                    "EXPIRED",

                expiredAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()

            }

        );


        state.riderRequests.delete(
            String(
                riderId
            )
        );


        dispatchMatchingEvent(
            "riderx:ride-request-expired",
            {

                rideId,

                riderId

            }
        );

    } catch (error) {

        console.warn(
            "RiderX request expiry:",
            error
        );

    }

}


/* ============================================================
   SEARCH RADIUS
============================================================ */

function getSearchRadius(
    ride
) {

    const radius =
        Number(
            ride.searchRadiusKm
        );


    if (
        Number.isFinite(
            radius
        ) &&
        radius > 0
    ) {

        return Math.min(
            radius,
            CONFIG.maximumRadiusKm
        );

    }


    return CONFIG.initialRadiusKm;

}


/* ============================================================
   EXPAND SEARCH RADIUS
============================================================ */

async function expandSearchRadius(
    rideId
) {

    try {

        const rideRef =
            doc(
                db,
                "rides",
                rideId
            );


        const snapshot =
            await getDoc(
                rideRef
            );


        if (
            !snapshot.exists()
        ) {

            return;

        }


        const ride =
            snapshot.data();


        const current =
            getSearchRadius(
                ride
            );


        const next =
            Math.min(

                current +
                5,

                CONFIG.maximumRadiusKm

            );


        if (
            next ===
            current
        ) {

            return;

        }


        await updateDoc(

            rideRef,

            {

                searchRadiusKm:
                    next,

                updatedAt:
                    serverTimestamp()

            }

        );

    } catch (error) {

        console.warn(
            "RiderX radius expansion:",
            error
        );

    }

}


/* ============================================================
   NEXT MATCHING ROUND
============================================================ */

function scheduleNextRound(
    rideId
) {

    if (
        state.timeout
    ) {

        clearTimeout(
            state.timeout
        );

    }


    state.timeout =
        setTimeout(

            async () => {

                if (
                    !state.matching
                ) {

                    return;

                }


                await runMatchingRound(
                    rideId
                );

            },

            CONFIG.retryIntervalMs

        );

}


/* ============================================================
   GET PICKUP
============================================================ */

function getPickup(
    ride
) {

    const pickup =
        ride.pickup ||
        ride.pickupLocation;


    if (
        pickup &&
        validCoordinates(
            pickup.lat,
            pickup.lng
        )
    ) {

        return {

            lat:
                Number(
                    pickup.lat
                ),

            lng:
                Number(
                    pickup.lng
                )

        };

    }


    if (
        validCoordinates(
            ride.pickupLat,
            ride.pickupLng
        )
    ) {

        return {

            lat:
                Number(
                    ride.pickupLat
                ),

            lng:
                Number(
                    ride.pickupLng
                )

        };

    }


    return null;

}


/* ============================================================
   DISTANCE
============================================================ */

function distanceKm(
    lat1,
    lon1,
    lat2,
    lon2
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


    const dLon =
        (
            lon2 -
            lon1
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
            dLon / 2
        ) ** 2;


    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 -
                a
            )
        )
    );

}


/* ============================================================
   VALID COORDINATES
============================================================ */

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
        ) &&

        Number(lat) >= -90 &&
        Number(lat) <= 90 &&

        Number(lng) >= -180 &&
        Number(lng) <= 180

    );

}


/* ============================================================
   NORMALIZE STATUS
============================================================ */

function normalizeStatus(
    status
) {

    return String(
        status ||
        "REQUESTED"
    )
        .trim()
        .toUpperCase();

}


/* ============================================================
   EVENT DISPATCHER
============================================================ */

function dispatchMatchingEvent(
    name,
    detail
) {

    window.dispatchEvent(
        new CustomEvent(
            name,
            {
                detail
            }
        )
    );

}


/* ============================================================
   GLOBAL API
============================================================ */

window.RiderXMatching = {

    startMatching,

    stopMatching,

    findAvailableRiders,

    findAvailableRider,

    sendRideRequest,

    acceptRideRequest,

    rejectRideRequest

};


/* ============================================================
   AUTO LISTEN TO CUSTOMER BOOKING
============================================================ */

window.addEventListener(
    "riderx:ride-created",
    event => {

        const rideId =
            event.detail?.rideId;


        if (
            !rideId
        ) {

            return;

        }


        startMatching(
            rideId
        );

    }
);


/* ============================================================
   AUTO STOP AFTER RIDE EVENTS
============================================================ */

window.addEventListener(
    "riderx:ride-accepted",
    () => {

        state.matching =
            false;

    }
);


window.addEventListener(
    "riderx:ride-completed",
    () => {

        stopMatching();

    }
);


window.addEventListener(
    "riderx:ride-cancelled",
    () => {

        stopMatching();

    }
);


/* ============================================================
   EXPORT DEFAULT
============================================================ */

export default {

    startMatching,

    stopMatching,

    findAvailableRiders,

    findAvailableRider,

    sendRideRequest,

    acceptRideRequest,

    rejectRideRequest

};
