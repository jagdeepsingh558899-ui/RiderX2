/**
 * ============================================================
 * RiderX - BOOKING ENGINE
 * ============================================================
 *
 * ONE AUTHORITATIVE RIDE SYSTEM
 *
 * Customer
 *    ↓
 * Create ride
 *    ↓
 * REQUESTED
 *    ↓
 * Matching / Rider requests
 *    ↓
 * ACCEPTED
 *    ↓
 * ARRIVING
 *    ↓
 * ARRIVED
 *    ↓
 * STARTED
 *    ↓
 * COMPLETED
 *
 * Cancellation can happen before completion.
 *
 * IMPORTANT:
 * - No map is created here.
 * - No GPS watcher is created here.
 * - No second Firebase SDK is imported here.
 * - Firebase comes only from firebase-config.js.
 *
 * ============================================================
 */

import {
    auth,
    db,

    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    runTransaction,
    serverTimestamp
} from "../firebase/firebase-config.js";


/* ============================================================
   GLOBAL STATE
============================================================ */

const defaultState = {

    activeService:
        "bike",

    pickupLocation:
        null,

    dropLocation:
        null,

    estimatedFare:
        0,

    estimatedDistance:
        0,

    estimatedDuration:
        0,

    currentRideId:
        null,

    rideListener:
        null,

    matchingListener:
        null,

    fareSettings:
        null,

    paymentMethod:
        "cash",

    booking:
        false,

    lastRide:
        null

};


if (
    !window.RiderXBookingState
) {

    window.RiderXBookingState =
        {
            ...defaultState
        };

} else {

    window.RiderXBookingState =
        {
            ...defaultState,
            ...window.RiderXBookingState
        };

}


/* ============================================================
   CONSTANTS
============================================================ */

const RIDE_COLLECTION =
    "rides";

const FARE_SETTINGS_DOCUMENT =
    "fare";

const DEFAULT_FARES = {

    bike: {

        baseFare:
            30,

        dayRate:
            8,

        extraRate:
            9,

        nightRate:
            11

    },

    cab: {

        baseFare:
            60,

        dayRate:
            12,

        extraRate:
            14,

        nightRate:
            16

    },

    parcel: {

        baseFare:
            40,

        dayRate:
            10,

        extraRate:
            12,

        nightRate:
            14

    },

    food: {

        baseFare:
            40,

        dayRate:
            10,

        extraRate:
            12,

        nightRate:
            14

    }

};


/* ============================================================
   INIT
============================================================ */

export async function initBookingModule() {

    console.log(
        "RiderX Booking Engine initialized"
    );


    await loadFareSettings();

    setupServiceSelectors();

    setupPaymentSelectors();

    setupBookingButtons();

    restoreBookingState();

    updateFareUI();

    /*
     * If a customer refreshes the page while
     * a ride is active, restore the listener.
     */

    const savedRideId =
        getSavedRideId();


    if (
        savedRideId
    ) {

        window.RiderXBookingState.currentRideId =
            savedRideId;


        startRideStatusListener(
            savedRideId
        );

    }


    return true;

}


/* ============================================================
   LOAD FARE SETTINGS
============================================================ */

async function loadFareSettings() {

    try {

        const fareRef =
            doc(
                db,
                "settings",
                FARE_SETTINGS_DOCUMENT
            );


        const snapshot =
            await getDoc(
                fareRef
            );


        if (
            snapshot.exists()
        ) {

            window.RiderXBookingState.fareSettings =
                snapshot.data();


            console.log(
                "RiderX fare settings loaded"
            );

        } else {

            window.RiderXBookingState.fareSettings =
                DEFAULT_FARES;

        }

    } catch (error) {

        console.warn(
            "RiderX fare settings unavailable. Using defaults.",
            error
        );


        window.RiderXBookingState.fareSettings =
            DEFAULT_FARES;

    }

}


/* ============================================================
   SERVICE SELECTORS
============================================================ */

function setupServiceSelectors() {

    const buttons =
        document.querySelectorAll(
            "[data-service], .service-select-btn, .service"
        );


    buttons.forEach(
        button => {

            if (
                button.dataset.riderxBookingBound ===
                "true"
            ) {

                return;

            }


            button.dataset.riderxBookingBound =
                "true";


            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();


                    const service =
                        button.dataset.service;


                    if (
                        !service
                    ) {

                        return;

                    }


                    setService(
                        service
                    );

                }
            );

        }
    );

}


/* ============================================================
   SET SERVICE
============================================================ */

export function setService(
    service
) {

    const normalized =
        String(
            service ||
            "bike"
        )
        .trim()
        .toLowerCase();


    const allowed =
        [
            "bike",
            "cab",
            "parcel",
            "food"
        ];


    window.RiderXBookingState.activeService =
        allowed.includes(
            normalized
        )
            ? normalized
            : "bike";


    document
        .querySelectorAll(
            "[data-service], .service-select-btn, .service"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    String(
                        button.dataset.service ||
                        ""
                    )
                    .toLowerCase() ===
                    window.RiderXBookingState.activeService
                );

            }
        );


    calculateFareEstimate();


    window.dispatchEvent(
        new CustomEvent(
            "riderx:service-changed",
            {

                detail:
                    {
                        service:
                            window.RiderXBookingState
                                .activeService
                    }

            }
        )
    );

}


/* ============================================================
   PAYMENT SELECTORS
============================================================ */

function setupPaymentSelectors() {

    const buttons =
        document.querySelectorAll(
            "[data-payment], .payment-method"
        );


    buttons.forEach(
        button => {

            if (
                button.dataset.riderxPaymentBound ===
                "true"
            ) {

                return;

            }


            button.dataset.riderxPaymentBound =
                "true";


            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();


                    const method =
                        button.dataset.payment;


                    if (
                        method
                    ) {

                        setPaymentMethod(
                            method
                        );

                    }

                }
            );

        }
    );

}


/* ============================================================
   SET PAYMENT METHOD
============================================================ */

export function setPaymentMethod(
    method
) {

    const normalized =
        String(
            method ||
            "cash"
        )
        .trim()
        .toLowerCase();


    const allowed =
        [
            "cash",
            "online",
            "wallet",
            "upi"
        ];


    window.RiderXBookingState.paymentMethod =
        allowed.includes(
            normalized
        )
            ? normalized
            : "cash";


    document
        .querySelectorAll(
            "[data-payment], .payment-method"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    String(
                        button.dataset.payment ||
                        ""
                    )
                    .toLowerCase() ===
                    window.RiderXBookingState.paymentMethod
                );

            }
        );


    window.dispatchEvent(
        new CustomEvent(
            "riderx:payment-method-changed",
            {

                detail:
                    {
                        paymentMethod:
                            window.RiderXBookingState
                                .paymentMethod
                    }

            }
        )
    );

}


/* ============================================================
   SET PICKUP
============================================================ */

export function setPickupLocation(
    lat,
    lng,
    address = ""
) {

    const latitude =
        Number(lat);

    const longitude =
        Number(lng);


    if (
        !validCoordinates(
            latitude,
            longitude
        )
    ) {

        return false;

    }


    window.RiderXBookingState.pickupLocation =
        {

            lat:
                latitude,

            lng:
                longitude,

            address:
                String(
                    address ||
                    ""
                )

        };


    saveBookingState();

    calculateFareEstimate();


    window.dispatchEvent(
        new CustomEvent(
            "riderx:pickup-selected",
            {

                detail:
                    window.RiderXBookingState
                        .pickupLocation

            }
        )
    );


    return true;

}


/* ============================================================
   SET DROP
============================================================ */

export function setDropLocation(
    lat,
    lng,
    address = ""
) {

    const latitude =
        Number(lat);

    const longitude =
        Number(lng);


    if (
        !validCoordinates(
            latitude,
            longitude
        )
    ) {

        return false;

    }


    window.RiderXBookingState.dropLocation =
        {

            lat:
                latitude,

            lng:
                longitude,

            address:
                String(
                    address ||
                    ""
                )

        };


    saveBookingState();

    calculateFareEstimate();


    window.dispatchEvent(
        new CustomEvent(
            "riderx:destination-selected",
            {

                detail:
                    window.RiderXBookingState
                        .dropLocation

            }
        )
    );


    return true;

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
   HAVERSINE DISTANCE
============================================================ */

function calculateDistance(
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
        ) *
        Math.sin(
            dLat / 2
        ) +

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
        ) *
        Math.sin(
            dLon / 2
        );


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 - a
            )
        );


    return R * c;

}


/* ============================================================
   GET FARE CONFIG
============================================================ */

function getServiceFare(
    service
) {

    const settings =
        window.RiderXBookingState
            .fareSettings;


    if (
        settings &&
        settings[service]
    ) {

        return {
            ...DEFAULT_FARES.bike,
            ...settings[service]
        };

    }


    return (
        DEFAULT_FARES[service] ||
        DEFAULT_FARES.bike
    );

}


/* ============================================================
   FARE CALCULATION
============================================================ */

export function calculateFareEstimate() {

    const state =
        window.RiderXBookingState;


    if (
        !state.pickupLocation ||
        !state.dropLocation
    ) {

        state.estimatedFare =
            0;

        state.estimatedDistance =
            0;

        state.estimatedDuration =
            0;


        updateFareUI();


        return 0;

    }


    const distance =
        calculateDistance(

            state.pickupLocation.lat,

            state.pickupLocation.lng,

            state.dropLocation.lat,

            state.dropLocation.lng

        );


    state.estimatedDistance =
        Number(
            distance.toFixed(
                2
            )
        );


    /*
     * Approximate urban travel duration.
     * Actual route duration can later be
     * supplied by routing service.
     */

    state.estimatedDuration =
        Math.max(

            3,

            Math.round(
                distance *
                3
            )

        );


    const fareConfig =
        getServiceFare(
            state.activeService
        );


    const hour =
        new Date()
            .getHours();


    const isNight =
        hour >= 22 ||
        hour < 6;


    const perKm =
        Number(

            isNight
                ? fareConfig.nightRate
                : fareConfig.dayRate

        );


    const extraRate =
        Number(
            fareConfig.extraRate ??
            perKm
        );


    const baseFare =
        Number(
            fareConfig.baseFare ??
            30
        );


    let fare =
        baseFare;


    /*
     * RiderX requested pricing:
     *
     * First 10 KM:
     *   day = ₹8/km
     *   night = ₹11/km
     *
     * Above 10 KM:
     *   extra rate
     */

    if (
        distance <= 10
    ) {

        fare +=
            distance *
            perKm;

    } else {

        fare +=
            10 *
            perKm;


        fare +=
            (
                distance -
                10
            ) *
            extraRate;

    }


    state.estimatedFare =
        Math.max(
            baseFare,
            Math.round(
                fare
            )
        );


    updateFareUI();


    window.dispatchEvent(
        new CustomEvent(
            "riderx:fare-updated",
            {

                detail:
                    {

                        fare:
                            state.estimatedFare,

                        distance:
                            state.estimatedDistance,

                        duration:
                            state.estimatedDuration

                    }

            }
        )
    );


    return state.estimatedFare;

}


/* ============================================================
   FARE UI
============================================================ */

function updateFareUI() {

    const state =
        window.RiderXBookingState;


    const fareElements =
        document.querySelectorAll(
            "#estimated-fare-display, #fare, [data-fare]"
        );


    fareElements.forEach(
        element => {

            element.textContent =
                state.estimatedFare
                    ? `₹${state.estimatedFare}`
                    : "₹0";

        }
    );


    const distanceElements =
        document.querySelectorAll(
            "#estimated-distance-display, #distance, [data-distance]"
        );


    distanceElements.forEach(
        element => {

            element.textContent =
                state.estimatedDistance
                    ? `${state.estimatedDistance} KM`
                    : "0 KM";

        }
    );


    const durationElements =
        document.querySelectorAll(
            "#estimated-time-display, #duration, [data-duration]"
        );


    durationElements.forEach(
        element => {

            element.textContent =
                state.estimatedDuration
                    ? `${state.estimatedDuration} mins`
                    : "0 mins";

        }
    );

}


/* ============================================================
   CREATE RIDE
============================================================ */

export async function createRideRequest(
    paymentMethod = null
) {

    const state =
        window.RiderXBookingState;


    const user =
        auth.currentUser;


    /*
     * Prevent double booking button clicks.
     */

    if (
        state.booking
    ) {

        return null;

    }


    if (
        !user
    ) {

        window.dispatchEvent(
            new CustomEvent(
                "riderx:booking-error",
                {

                    detail:
                        {
                            message:
                                "Please login first."

                        }

                }
            )
        );


        window.location.href =
            "../auth/login.html?role=customer";


        return null;

    }


    if (
        !state.pickupLocation ||
        !state.dropLocation
    ) {

        showBookingError(
            "Please select pickup and destination."
        );


        return null;

    }


    if (
        sameLocation(
            state.pickupLocation,
            state.dropLocation
        )
    ) {

        showBookingError(
            "Pickup and destination cannot be the same."
        );


        return null;

    }


    /*
     * Do not allow another active ride.
     */

    const existingRide =
        await findCustomerActiveRide(
            user.uid
        );


    if (
        existingRide
    ) {

        state.currentRideId =
            existingRide.id;


        saveCurrentRideId(
            existingRide.id
        );


        startRideStatusListener(
            existingRide.id
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx:active-ride-exists",
                {

                    detail:
                        existingRide

                }
            )
        );


        return existingRide.id;

    }


    calculateFareEstimate();


    const method =
        String(

            paymentMethod ||

            state.paymentMethod ||

            "cash"

        )
        .trim()
        .toLowerCase();


    state.paymentMethod =
        method;


    state.booking =
        true;


    setBookingButtonsDisabled(
        true
    );


    try {

        const rideData = {

            /*
             * Customer
             */

            customerId:
                user.uid,

            customerName:
                user.displayName ||
                user.email ||
                "RiderX Customer",

            customerEmail:
                user.email ||
                "",


            /*
             * Service
             */

            serviceType:
                state.activeService,

            service:
                state.activeService,


            /*
             * Pickup
             */

            pickup:
                {

                    lat:
                        state.pickupLocation.lat,

                    lng:
                        state.pickupLocation.lng,

                    address:
                        state.pickupLocation.address ||
                        ""

                },


            /*
             * Destination
             */

            drop:
                {

                    lat:
                        state.dropLocation.lat,

                    lng:
                        state.dropLocation.lng,

                    address:
                        state.dropLocation.address ||
                        ""

                },


            destination:
                {

                    lat:
                        state.dropLocation.lat,

                    lng:
                        state.dropLocation.lng,

                    address:
                        state.dropLocation.address ||
                        ""

                },


            /*
             * Fare
             */

            fare:
                Number(
                    state.estimatedFare
                ),

            estimatedFare:
                Number(
                    state.estimatedFare
                ),

            distance:
                Number(
                    state.estimatedDistance
                ),

            estimatedDistance:
                Number(
                    state.estimatedDistance
                ),

            duration:
                Number(
                    state.estimatedDuration
                ),

            estimatedDuration:
                Number(
                    state.estimatedDuration
                ),


            /*
             * Payment
             */

            paymentMethod:
                method,

            paymentStatus:
                method ===
                "cash"
                    ? "pending"
                    : "pending",


            /*
             * CENTRAL RIDE STATUS
             *
             * All RiderX pages must use
             * this status field.
             */

            status:
                "REQUESTED",

            rideStatus:
                "REQUESTED",


            /*
             * Rider fields
             */

            riderId:
                null,

            driverId:
                null,

            riderName:
                null,

            riderPhone:
                null,

            riderVehicle:
                null,

            riderVehicleNumber:
                null,


            /*
             * Ride security
             */

            otp:
                generateRideOTP(),


            /*
             * Request state
             */

            requestedAt:
                serverTimestamp(),

            createdAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp(),

            cancelledAt:
                null,

            completedAt:
                null,

            startedAt:
                null,

            acceptedAt:
                null,


            /*
             * Matching
             */

            matchingStatus:
                "SEARCHING",

            notifiedRiders:
                [],

            rejectedRiders:
                [],

            expiredRiders:
                [],


            /*
             * Metadata
             */

            city:
                "Chandigarh",

            platform:
                "RiderX",

            version:
                1

        };


        /*
         * Create ONE ride document.
         */

        const rideRef =
            await addDoc(

                collection(
                    db,
                    RIDE_COLLECTION
                ),

                rideData

            );


        const rideId =
            rideRef.id;


        state.currentRideId =
            rideId;


        state.lastRide =
            {

                id:
                    rideId,

                ...rideData

            };


        saveCurrentRideId(
            rideId
        );


        /*
         * Start real-time listener
         * immediately.
         */

        startRideStatusListener(
            rideId
        );


        /*
         * Matching event.
         *
         * matching.js will listen for this
         * and find suitable riders.
         */

        window.dispatchEvent(
            new CustomEvent(
                "riderx:ride-created",
                {

                    detail:
                        {

                            rideId,

                            ride:
                                {

                                    id:
                                        rideId,

                                    ...rideData

                                }

                        }

                }
            )
        );


        /*
         * Start matching if the matching
         * module is already loaded.
         */

        if (
            window.RiderXMatching &&
            typeof
                window.RiderXMatching
                    .startMatching ===
                "function"
        ) {

            try {

                window.RiderXMatching
                    .startMatching(
                        rideId
                    );

            } catch (error) {

                console.warn(
                    "RiderX matching start:",
                    error
                );

            }

        }


        return rideId;

    } catch (error) {

        console.error(
            "RiderX booking failed:",
            error
        );


        showBookingError(
            getFirebaseErrorMessage(
                error
            )
        );


        throw error;

    } finally {

        state.booking =
            false;


        setBookingButtonsDisabled(
            false
        );

    }

}


/* ============================================================
   GENERATE OTP
============================================================ */

function generateRideOTP() {

    return String(
        Math.floor(
            1000 +
            Math.random() *
            9000
        )
    );

}


/* ============================================================
   SAME LOCATION
============================================================ */

function sameLocation(
    first,
    second
) {

    if (
        !first ||
        !second
    ) {

        return false;

    }


    return (

        Number(
            first.lat
        ).toFixed(5) ===

        Number(
            second.lat
        ).toFixed(5) &&

        Number(
            first.lng
        ).toFixed(5) ===

        Number(
            second.lng
        ).toFixed(5)

    );

}


/* ============================================================
   ACTIVE CUSTOMER RIDE
============================================================ */

async function findCustomerActiveRide(
    customerId
) {

    try {

        const statuses =
            [
                "REQUESTED",
                "SEARCHING",
                "ACCEPTED",
                "ARRIVING",
                "ARRIVED",
                "STARTED"
            ];


        /*
         * Firestore query is done one status
         * at a time to avoid requiring a
         * composite index.
         */

        for (
            const status
            of statuses
        ) {

            const ridesQuery =
                query(

                    collection(
                        db,
                        RIDE_COLLECTION
                    ),

                    where(
                        "customerId",
                        "==",
                        customerId
                    ),

                    where(
                        "status",
                        "==",
                        status
                    )

                );


            /*
             * One-time snapshot.
             */

            const result =
                await new Promise(
                    resolve => {

                        let done =
                            false;


                        const unsubscribe =
                            onSnapshot(

                                ridesQuery,

                                snapshot => {

                                    if (
                                        done
                                    ) {

                                        return;

                                    }


                                    done =
                                        true;


                                    unsubscribe();


                                    if (
                                        snapshot.empty
                                    ) {

                                        resolve(
                                            null
                                        );

                                        return;

                                    }


                                    const item =
                                        snapshot.docs[0];


                                    resolve(

                                        {

                                            id:
                                                item.id,

                                            ...item.data()

                                        }

                                    );

                                },

                                () => {

                                    if (
                                        done
                                    ) {

                                        return;

                                    }


                                    done =
                                        true;


                                    resolve(
                                        null
                                    );

                                }

                            );

                    }
                );


            if (
                result
            ) {

                return result;

            }

        }


        return null;

    } catch (error) {

        console.warn(
            "RiderX active ride search:",
            error
        );


        return null;

    }

}


/* ============================================================
   RIDE STATUS LISTENER
============================================================ */

export function startRideStatusListener(
    rideId
) {

    if (
        !rideId
    ) {

        return null;

    }


    const state =
        window.RiderXBookingState;


    /*
     * Remove old listener.
     */

    if (
        typeof state.rideListener ===
        "function"
    ) {

        try {

            state.rideListener();

        } catch (error) {}

    }


    const rideRef =
        doc(
            db,
            RIDE_COLLECTION,
            String(
                rideId
            )
        );


    state.rideListener =
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
                            snapshot.id,

                        ...snapshot.data()

                    };


                state.currentRideId =
                    ride.id;


                state.lastRide =
                    ride;


                saveCurrentRideId(
                    ride.id
                );


                const status =
                    normalizeStatus(
                        ride.status ||
                        ride.rideStatus
                    );


                /*
                 * Unified status.
                 */

                state.lastRide.status =
                    status;


                /*
                 * Update rider fields.
                 */

                if (
                    ride.riderId ||
                    ride.driverId
                ) {

                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx:rider-assigned",
                            {

                                detail:
                                    ride

                            }
                        )
                    );

                }


                /*
                 * Every ride status is
                 * broadcast to the UI.
                 */

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:ride-status",
                        {

                            detail:
                                {

                                    rideId:
                                        ride.id,

                                    ride,

                                    status

                                }

                        }
                    )
                );


                /*
                 * Specific events.
                 */

                switch (
                    status
                ) {

                    case "ACCEPTED":

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-accepted",
                                {

                                    detail:
                                        {
                                            rideId:
                                                ride.id,

                                            ride

                                        }

                                }
                            )
                        );

                        break;


                    case "ARRIVING":

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-arriving",
                                {

                                    detail:
                                        ride

                                }
                            )
                        );

                        break;


                    case "ARRIVED":

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-arrived",
                                {

                                    detail:
                                        ride

                                }
                            )
                        );

                        break;


                    case "STARTED":

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-started",
                                {

                                    detail:
                                        {

                                            rideId:
                                                ride.id,

                                            ride

                                        }

                                }
                            )
                        );

                        break;


                    case "COMPLETED":

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-completed",
                                {

                                    detail:
                                        {

                                            rideId:
                                                ride.id,

                                            ride

                                        }

                                }
                            )
                        );

                        break;


                    case "CANCELLED":

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:ride-cancelled",
                                {

                                    detail:
                                        {

                                            rideId:
                                                ride.id,

                                            ride

                                        }

                                }
                            )
                        );

                        break;

                }


                /*
                 * Update visible status text.
                 */

                updateRideStatusUI(
                    ride
                );

            },

            error => {

                console.error(
                    "RiderX ride listener:",
                    error
                );


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:booking-error",
                        {

                            detail:
                                {
                                    message:
                                        "Ride connection lost. Please check your internet connection."

                                }

                        }
                    )
                );

            }

        );


    return state.rideListener;

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
   STATUS UI
============================================================ */

function updateRideStatusUI(
    ride
) {

    const status =
        normalizeStatus(
            ride.status ||
            ride.rideStatus
        );


    const statusText =
        {

            REQUESTED:
                "Request sent",

            SEARCHING:
                "Finding your rider",

            ACCEPTED:
                "Rider accepted",

            ARRIVING:
                "Rider is coming",

            ARRIVED:
                "Rider has arrived",

            STARTED:
                "Trip started",

            COMPLETED:
                "Trip completed",

            CANCELLED:
                "Ride cancelled"

        }[status] ||
        status;


    document
        .querySelectorAll(
            "[data-ride-status], #rideStatus, #statusText"
        )
        .forEach(
            element => {

                element.textContent =
                    statusText;


                element.dataset.status =
                    status;

            }
        );


    document
        .querySelectorAll(
            "[data-ride-id], #rideId"
        )
        .forEach(
            element => {

                element.textContent =
                    ride.id ||
                    "";

            }
        );


    /*
     * Rider details.
     */

    document
        .querySelectorAll(
            "[data-rider-name], #riderName"
        )
        .forEach(
            element => {

                element.textContent =
                    ride.riderName ||
                    "RiderX Rider";

            }
        );


    document
        .querySelectorAll(
            "[data-rider-phone], #riderPhone"
        )
        .forEach(
            element => {

                element.textContent =
                    ride.riderPhone ||
                    "";

            }
        );


    document
        .querySelectorAll(
            "[data-rider-vehicle], #riderVehicle"
        )
        .forEach(
            element => {

                element.textContent =
                    ride.riderVehicleNumber ||
                    ride.riderVehicle ||
                    "";

            }
        );


    /*
     * Fare.
     */

    document
        .querySelectorAll(
            "[data-ride-fare], #rideFare"
        )
        .forEach(
            element => {

                element.textContent =
                    ride.fare
                        ? `₹${ride.fare}`
                        : "₹0";

            }
        );

}


/* ============================================================
   CANCEL RIDE
============================================================ */

export async function cancelRide(
    rideId = null
) {

    const id =
        rideId ||
        getCurrentRideId();


    if (
        !id
    ) {

        return false;

    }


    const user =
        auth.currentUser;


    if (
        !user
    ) {

        throw new Error(
            "Login required."
        );

    }


    try {

        const rideRef =
            doc(
                db,
                RIDE_COLLECTION,
                id
            );


        /*
         * Transaction prevents two different
         * clients from incorrectly changing
         * a completed ride.
         */

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


                const status =
                    normalizeStatus(
                        ride.status ||
                        ride.rideStatus
                    );


                if (
                    status ===
                    "COMPLETED"
                ) {

                    throw new Error(
                        "Completed rides cannot be cancelled."
                    );

                }


                if (
                    status ===
                    "CANCELLED"
                ) {

                    return;

                }


                transaction.update(

                    rideRef,

                    {

                        status:
                            "CANCELLED",

                        rideStatus:
                            "CANCELLED",

                        cancelledBy:
                            "customer",

                        cancelledById:
                            user.uid,

                        cancelledAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp(),

                        matchingStatus:
                            "CANCELLED"

                    }

                );

            }

        );


        return true;

    } catch (error) {

        console.error(
            "RiderX cancel ride:",
            error
        );


        showBookingError(
            error.message ||
            "Unable to cancel ride."
        );


        return false;

    }

}


/* ============================================================
   ACCEPTED RIDE DATA
============================================================ */

export async function getCurrentRide() {

    const rideId =
        getCurrentRideId();


    if (
        !rideId
    ) {

        return null;

    }


    try {

        const snapshot =
            await getDoc(

                doc(
                    db,
                    RIDE_COLLECTION,
                    rideId
                )

            );


        if (
            !snapshot.exists()
        ) {

            return null;

        }


        return {

            id:
                snapshot.id,

            ...snapshot.data()

        };

    } catch (error) {

        console.error(
            "RiderX get current ride:",
            error
        );


        return null;

    }

}


/* ============================================================
   GET CURRENT RIDE ID
============================================================ */

export function getCurrentRideId() {

    const state =
        window.RiderXBookingState;


    if (
        state.currentRideId
    ) {

        return state.currentRideId;

    }


    return getSavedRideId();

}


/* ============================================================
   SAVE RIDE ID
============================================================ */

function saveCurrentRideId(
    rideId
) {

    if (
        !rideId
    ) {

        return;

    }


    try {

        localStorage.setItem(
            "riderx_active_ride_id",
            String(
                rideId
            )
        );

    } catch (error) {}

}


/* ============================================================
   GET SAVED RIDE ID
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
   CLEAR ACTIVE RIDE
============================================================ */

export function clearCurrentRide() {

    const state =
        window.RiderXBookingState;


    if (
        typeof state.rideListener ===
        "function"
    ) {

        try {

            state.rideListener();

        } catch (error) {}

    }


    state.rideListener =
        null;

    state.currentRideId =
        null;

    state.lastRide =
        null;


    try {

        localStorage.removeItem(
            "riderx_active_ride_id"
        );

    } catch (error) {}


}


/* ============================================================
   RESET BOOKING
============================================================ */

export function resetBookingState(
    keepFareSettings = true
) {

    const currentFareSettings =
        window.RiderXBookingState
            .fareSettings;


    clearCurrentRide();


    window.RiderXBookingState =
        {

            ...defaultState,

            fareSettings:
                keepFareSettings
                    ? currentFareSettings
                    : null

        };


    updateFareUI();


    window.dispatchEvent(
        new CustomEvent(
            "riderx:booking-reset"
        )
    );

}


/* ============================================================
   SAVE BOOKING FORM STATE
============================================================ */

function saveBookingState() {

    const state =
        window.RiderXBookingState;


    try {

        localStorage.setItem(

            "riderx_booking_state",

            JSON.stringify(

                {

                    activeService:
                        state.activeService,

                    pickupLocation:
                        state.pickupLocation,

                    dropLocation:
                        state.dropLocation,

                    paymentMethod:
                        state.paymentMethod

                }

            )

        );

    } catch (error) {}

}


/* ============================================================
   RESTORE BOOKING FORM STATE
============================================================ */

function restoreBookingState() {

    try {

        const raw =
            localStorage.getItem(
                "riderx_booking_state"
            );


        if (
            !raw
        ) {

            return;

        }


        const saved =
            JSON.parse(
                raw
            );


        if (
            saved.activeService
        ) {

            setService(
                saved.activeService
            );

        }


        if (
            saved.paymentMethod
        ) {

            setPaymentMethod(
                saved.paymentMethod
            );

        }


        if (
            saved.pickupLocation
        ) {

            setPickupLocation(

                saved.pickupLocation.lat,

                saved.pickupLocation.lng,

                saved.pickupLocation.address

            );

        }


        if (
            saved.dropLocation
        ) {

            setDropLocation(

                saved.dropLocation.lat,

                saved.dropLocation.lng,

                saved.dropLocation.address

            );

        }

    } catch (error) {

        console.warn(
            "RiderX booking state restore failed.",
            error
        );

    }

}


/* ============================================================
   BOOKING BUTTONS
============================================================ */

function setupBookingButtons() {

    const buttons =
        document.querySelectorAll(
            "#bookRide, #confirmRide, [data-book-ride]"
        );


    buttons.forEach(
        button => {

            if (
                button.dataset.riderxBookingBound ===
                "true"
            ) {

                return;

            }


            button.dataset.riderxBookingBound =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    const payment =
                        button.dataset.payment ||
                        window.RiderXBookingState
                            .paymentMethod ||
                        "cash";


                    try {

                        const rideId =
                            await createRideRequest(
                                payment
                            );


                        if (
                            rideId
                        ) {

                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx:booking-success",
                                    {

                                        detail:
                                            {
                                                rideId

                                            }

                                    }
                                )
                            );

                        }

                    } catch (error) {

                        console.error(
                            error
                        );

                    }

                }
            );

        }
    );


    /*
     * Cancel button.
     */

    const cancelButtons =
        document.querySelectorAll(
            "#cancelRide, [data-cancel-ride]"
        );


    cancelButtons.forEach(
        button => {

            if (
                button.dataset.riderxCancelBound ===
                "true"
            ) {

                return;

            }


            button.dataset.riderxCancelBound =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    await cancelRide();

                }
            );

        }
    );

}


/* ============================================================
   BUTTON LOADING STATE
============================================================ */

function setBookingButtonsDisabled(
    disabled
) {

    document
        .querySelectorAll(
            "#bookRide, #confirmRide, [data-book-ride]"
        )
        .forEach(
            button => {

                button.disabled =
                    disabled;


                button.classList.toggle(
                    "loading",
                    disabled
                );

            }
        );

}


/* ============================================================
   ERROR MESSAGE
============================================================ */

function showBookingError(
    message
) {

    window.dispatchEvent(
        new CustomEvent(
            "riderx:booking-error",
            {

                detail:
                    {
                        message:
                            String(
                                message
                            )

                    }

            }
        )
    );


    /*
     * Use existing toast if the project
     * already provides one.
     */

    if (
        typeof window.showToast ===
        "function"
    ) {

        window.showToast(
            message,
            "error"
        );


        return;

    }


    console.warn(
        "RiderX booking:",
        message
    );

}


/* ============================================================
   FIREBASE ERROR MESSAGE
============================================================ */

function getFirebaseErrorMessage(
    error
) {

    if (
        !error
    ) {

        return "Ride booking failed.";

    }


    switch (
        error.code
    ) {

        case "permission-denied":

            return (
                "Ride booking permission denied. Please check Firestore rules."
            );


        case "unavailable":

            return (
                "Network unavailable. Please try again."
            );


        case "failed-precondition":

            return (
                "Firebase configuration or Firestore setup needs attention."
            );


        default:

            return (
                error.message ||
                "Ride booking failed."
            );

    }

}


/* ============================================================
   GLOBAL COMPATIBILITY API
============================================================ */

window.RiderXBooking = {

    init:
        initBookingModule,

    setService,

    setPickupLocation,

    setDropLocation,

    setPaymentMethod,

    calculateFare:
        calculateFareEstimate,

    createRide:
        createRideRequest,

    cancelRide,

    getCurrentRide,

    getCurrentRideId,

    startRideStatusListener,

    clearCurrentRide,

    reset:
        resetBookingState

};


/* ============================================================
   EVENT COMPATIBILITY
============================================================ */

/*
 * Some older RiderX pages may use these events.
 */

window.addEventListener(
    "riderx:ride-created",
    event => {

        const rideId =
            event.detail?.rideId;


        if (
            rideId
        ) {

            saveCurrentRideId(
                rideId
            );

        }

    }
);


/* ============================================================
   AUTO INIT
============================================================ */

function autoInitialize() {

    /*
     * Only initialize booking engine
     * on pages that actually contain
     * booking-related UI.
     */

    const bookingPage =
        document.querySelector(
            "#bookRide, #confirmRide, [data-book-ride], [data-service]"
        );


    if (
        !bookingPage
    ) {

        return;

    }


    initBookingModule();

}


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
