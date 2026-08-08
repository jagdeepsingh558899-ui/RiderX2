// ============================================================
// RiderX Super App
// Booking & Ride Dispatch Controller
// Firebase v10 Modular SDK
// FINAL VERSION
// ============================================================

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GLOBAL STATE
// ============================================================

window.RiderXBookingState = {

    activeService: "bike",

    pickupLocation: null,

    dropLocation: null,

    estimatedFare: 0,

    estimatedDistance: 0,

    estimatedDuration: 0,

    currentRideId: null,

    rideListener: null,

    fareSettings: null

};


// ============================================================
// INIT
// ============================================================

export async function initBookingModule() {

    console.log("RiderX Booking Started");

    await loadFareSettings();

    setupServiceSelectors();

    updateFareUI();

}


// ============================================================
// LOAD ADMIN FARE SETTINGS
// ============================================================

async function loadFareSettings() {

    try {

        const fareRef =
            doc(
                db,
                "settings",
                "fare"
            );

        const snap =
            await getDoc(fareRef);


        if (snap.exists()) {

            window.RiderXBookingState.fareSettings =
                snap.data();

            console.log(
                "RiderX Fare Settings Loaded:",
                snap.data()
            );

        } else {

            console.log(
                "No admin fare settings found. Using default fare."
            );

            window.RiderXBookingState.fareSettings = null;
        }


    } catch (error) {

        console.error(
            "RiderX Fare Load Error:",
            error
        );

    }

}


// ============================================================
// SERVICE SELECTORS
// ============================================================

function setupServiceSelectors() {

    const buttons =
        document.querySelectorAll(
            ".service-select-btn, .service"
        );


    buttons.forEach((btn) => {

        btn.addEventListener(
            "click",
            () => {

                buttons.forEach((button) => {

                    button.classList.remove(
                        "active"
                    );

                });


                btn.classList.add(
                    "active"
                );


                const service =
                    btn.dataset.service;


                if (service) {

                    window.RiderXBookingState.activeService =
                        String(service)
                            .trim()
                            .toLowerCase();

                }


                calculateFareEstimate();

            }
        );

    });

}


// ============================================================
// SET PICKUP
// ============================================================

export function setPickupLocation(
    lat,
    lng,
    address = ""
) {

    window.RiderXBookingState.pickupLocation = {

        lat: Number(lat),

        lng: Number(lng),

        address: String(address || "")

    };


    calculateFareEstimate();

}


// ============================================================
// SET DROP
// ============================================================

export function setDropLocation(
    lat,
    lng,
    address = ""
) {

    window.RiderXBookingState.dropLocation = {

        lat: Number(lat),

        lng: Number(lng),

        address: String(address || "")

    };


    calculateFareEstimate();

}


// ============================================================
// DISTANCE CALCULATION
// ============================================================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;


    const dLat =
        (lat2 - lat1) *
        Math.PI /
        180;


    const dLon =
        (lon2 - lon1) *
        Math.PI /
        180;


    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

        Math.cos(
            lat1 * Math.PI / 180
        )

        *

        Math.cos(
            lat2 * Math.PI / 180
        )

        *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


// ============================================================
// GET SERVICE FARE
// ============================================================

function getServiceFare(
    service
) {

    const settings =
        window.RiderXBookingState.fareSettings;


    if (
        settings &&
        settings[service]
    ) {

        return settings[service];

    }


    // Default RiderX fare

    return {

        baseFare: 30,

        dayRate: 8,

        extraRate: 9,

        nightRate: 11

    };

}


// ============================================================
// FARE CALCULATION
// ============================================================

export function calculateFareEstimate() {

    const state =
        window.RiderXBookingState;


    if (
        !state.pickupLocation ||
        !state.dropLocation
    ) {

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
            distance.toFixed(2)
        );


    state.estimatedDuration =
        Math.max(
            1,
            Math.round(
                distance * 3
            )
        );


    const serviceFare =
        getServiceFare(
            state.activeService
        );


    const hour =
        new Date().getHours();


    let perKm;


    // ========================================================
    // NIGHT RATE
    // 10 PM - 6 AM
    // ========================================================

    if (
        hour >= 22 ||
        hour < 6
    ) {

        perKm =
            Number(
                serviceFare.nightRate ?? 11
            );

    }

    // ========================================================
    // DAY RATE
    // ========================================================

    else {

        perKm =
            Number(
                serviceFare.dayRate ?? 8
            );

    }


    const baseFare =
        Number(
            serviceFare.baseFare ?? 30
        );


    const extraRate =
        Number(
            serviceFare.extraRate ??
            perKm
        );


    let fare =
        baseFare;


    // ========================================================
    // FIRST 10 KM
    // ========================================================

    if (
        state.estimatedDistance <= 10
    ) {

        fare +=
            state.estimatedDistance *
            perKm;

    }

    // ========================================================
    // ABOVE 10 KM
    // ========================================================

    else {

        fare +=
            10 *
            perKm;


        fare +=
            (
                state.estimatedDistance - 10
            ) *
            extraRate;

    }


    state.estimatedFare =
        Math.max(
            30,
            Math.round(fare)
        );


    updateFareUI();


    return state.estimatedFare;

}


// ============================================================
// UPDATE FARE UI
// ============================================================

function updateFareUI() {

    const state =
        window.RiderXBookingState;


    const fareElement =
        document.getElementById(
            "estimated-fare-display"
        );


    if (fareElement) {

        fareElement.innerText =
            "₹" +
            state.estimatedFare;

    }


    // Compatibility with customer home

    const fareElement2 =
        document.getElementById(
            "fare"
        );


    if (fareElement2) {

        fareElement2.innerText =
            "₹" +
            state.estimatedFare;

    }


    const distanceElement =
        document.getElementById(
            "estimated-distance-display"
        );


    if (distanceElement) {

        distanceElement.innerText =
            state.estimatedDistance +
            " KM";

    }


    const timeElement =
        document.getElementById(
            "estimated-time-display"
        );


    if (timeElement) {

        timeElement.innerText =
            state.estimatedDuration +
            " mins";

    }

}


// ============================================================
// CREATE RIDE REQUEST
// ============================================================

export async function createRideRequest(
    paymentMethod = "cash"
) {

    const state =
        window.RiderXBookingState;


    const user =
        auth.currentUser;


    // ========================================================
    // AUTH CHECK
    // ========================================================

    if (!user) {

        alert(
            "Please login first."
        );


        window.location.href =
            "../auth/login.html?role=customer";


        return null;

    }


    // ========================================================
    // LOCATION CHECK
    // ========================================================

    if (
        !state.pickupLocation ||
        !state.dropLocation
    ) {

        alert(
            "Please select pickup and drop location."
        );


        return null;

    }


    // ========================================================
    // RECALCULATE FARE
    // ========================================================

    calculateFareEstimate();


    try {

        // ====================================================
        // RIDE DATA
        //
        // IMPORTANT:
        // status = REQUESTED
        //
        // Rider engine listens for REQUESTED.
        // ====================================================

        const ride = {

            customerId:
                user.uid,


            customerName:
                user.displayName ||
                user.email ||
                "RiderX Customer",


            serviceType:
                state.activeService,


            // Compatibility

            service:
                state.activeService,


            pickup: {

                lat:
                    state.pickupLocation.lat,

                lng:
                    state.pickupLocation.lng,

                address:
                    state.pickupLocation.address,

                name:
                    state.pickupLocation.address

            },


            drop: {

                lat:
                    state.dropLocation.lat,

                lng:
                    state.dropLocation.lng,

                address:
                    state.dropLocation.address,

                name:
                    state.dropLocation.address

            },


            fare:
                Number(
                    state.estimatedFare
                ),


            distance:
                Number(
                    state.estimatedDistance
                ),


            duration:
                Number(
                    state.estimatedDuration
                ),


            paymentMethod:
                String(
                    paymentMethod ||
                    "cash"
                )
                    .trim()
                    .toLowerCase(),


            // =================================================
            // IMPORTANT STATUS
            // =================================================

            status:
                "REQUESTED",


            riderId:
                null,


            driverId:
                null,


            createdAt:
                Timestamp.now(),


            requestedAt:
                Timestamp.now()

        };


        // ====================================================
        // CREATE FIRESTORE RIDE
        // ====================================================

        const rideRef =
            await addDoc(
                collection(
                    db,
                    "rides"
                ),
                ride
            );


        state.currentRideId =
            rideRef.id;


        console.log(
            "RiderX Ride Created:",
            rideRef.id,
            ride
        );


        // ====================================================
        // START LISTENER
        // ====================================================

        startRideStatusListener(
            rideRef.id
        );


        // ====================================================
        // EVENT
        // ====================================================

        window.dispatchEvent(

            new CustomEvent(
                "riderx:ride-created",
                {
                    detail: {

                        rideId:
                            rideRef.id,

                        ride:
                            ride

                    }
                }
            )

        );


        return rideRef.id;


    } catch (error) {

        console.error(
            "RiderX Ride Booking Error:",
            error
        );


        let message =
            "Ride booking failed.";


        if (
            error.code ===
            "permission-denied"
        ) {

            message =
                "Missing or insufficient permissions. Please check Firestore rules.";

        }


        alert(message);


        throw error;

    }

}


// ============================================================
// RIDE STATUS LISTENER
// ============================================================

function startRideStatusListener(
    rideId
) {

    const state =
        window.RiderXBookingState;


    // Remove previous listener

    if (
        typeof state.rideListener ===
        "function"
    ) {

        state.rideListener();

        state.rideListener =
            null;

    }


    const rideRef =
        doc(
            db,
            "rides",
            rideId
        );


    state.rideListener =
        onSnapshot(

            rideRef,

            (snapshot) => {

                if (
                    !snapshot.exists()
                ) {

                    console.warn(
                        "Ride document no longer exists:",
                        rideId
                    );

                    return;

                }


                const data =
                    snapshot.data();


                console.log(
                    "RiderX Ride Status:",
                    data.status
                );


                window.dispatchEvent(

                    new CustomEvent(
                        "riderx:ride-status",
                        {
                            detail: {

                                rideId:
                                    rideId,

                                ride:
                                    data,

                                status:
                                    data.status

                            }
                        }
                    )

                );


                // =================================================
                // RIDER ACCEPTED
                // =================================================

                if (
                    data.status ===
                    "ACCEPTED"
                ) {

                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-accepted",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    ride:
                                        data

                                }
                            }
                        )

                    );

                }


                // =================================================
                // COMPLETED
                // =================================================

                if (
                    data.status ===
                    "COMPLETED"
                ) {

                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-completed",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    ride:
                                        data

                                }
                            }
                        )

                    );

                }


                // =================================================
                // CANCELLED
                // =================================================

                if (
                    data.status ===
                    "CANCELLED"
                ) {

                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-cancelled",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    ride:
                                        data

                                }
                            }
                        )

                    );

                }

            },

            (error) => {

                console.error(
                    "RiderX Ride Listener Error:",
                    error
                );

            }

        );

}


// ============================================================
// CANCEL RIDE
// ============================================================

export async function cancelRide(
    rideId
) {

    if (!rideId) {

        return;

    }


    const user =
        auth.currentUser;


    if (!user) {

        throw new Error(
            "Login required."
        );

    }


    try {

        await updateDoc(

            doc(
                db,
                "rides",
                rideId
            ),

            {

                status:
                    "CANCELLED",

                cancelledBy:
                    "customer",

                cancelledAt:
                    Timestamp.now()

            }

        );


        console.log(
            "Ride cancelled:",
            rideId
        );


    } catch (error) {

        console.error(
            "Cancel Ride Error:",
            error
        );


        throw error;

    }

}


// ============================================================
// GET CURRENT RIDE
// ============================================================

export async function getCurrentRide() {

    const state =
        window.RiderXBookingState;


    if (
        !state.currentRideId
    ) {

        return null;

    }


    try {

        const snap =
            await getDoc(

                doc(
                    db,
                    "rides",
                    state.currentRideId
                )

            );


        if (
            !snap.exists()
        ) {

            return null;

        }


        return {

            id:
                snap.id,

            ...snap.data()

        };


    } catch (error) {

        console.error(
            "Get Current Ride Error:",
            error
        );


        return null;

    }

}


// ============================================================
// RESET BOOKING
// ============================================================

export function resetBookingState() {

    const state =
        window.RiderXBookingState;


    if (
        typeof state.rideListener ===
        "function"
    ) {

        state.rideListener();

    }


    window.RiderXBookingState = {

        activeService: "bike",

        pickupLocation: null,

        dropLocation: null,

        estimatedFare: 0,

        estimatedDistance: 0,

        estimatedDuration: 0,

        currentRideId: null,

        rideListener: null,

        fareSettings:
            state.fareSettings || null

    };


    updateFareUI();

}


// ============================================================
// GLOBAL COMPATIBILITY
// ============================================================

window.RiderXBooking = {

    init:
        initBookingModule,

    setPickupLocation:
        setPickupLocation,

    setDropLocation:
        setDropLocation,

    calculateFare:
        calculateFareEstimate,

    createRide:
        createRideRequest,

    cancelRide:
        cancelRide,

    getCurrentRide:
        getCurrentRide,

    reset:
        resetBookingState

};


// ============================================================
// AUTO INIT
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initBookingModule();

        }
    );

} else {

    initBookingModule();

}
