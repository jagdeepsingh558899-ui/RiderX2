/* ============================================================
   RIDERX — CUSTOMER BOOKING ENGINE
   Uber-style ride request / fare / realtime ride state
   Firebase v10 Modular SDK
   ============================================================ */

import {
    auth,
    db,
    doc,
    getDoc,
    collection,
    addDoc,
    updateDoc,
    onSnapshot,
    Timestamp
} from "../firebase/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/* ============================================================
   STATE
   ============================================================ */

const state = window.RiderXBookingState = {

    activeService:
        localStorage.getItem("riderx_service") || "bike",

    paymentMethod:
        localStorage.getItem("riderx_payment_method") || "cash",

    pickupLocation: null,

    dropLocation: null,

    estimatedFare: 0,

    estimatedDistance: 0,

    estimatedDuration: 0,

    currentRideId:
        localStorage.getItem("riderx_current_ride_id") || null,

    rideListener: null,

    fareSettings: null,

    initialized: false,

    creatingRide: false

};

/* ============================================================
   DEFAULT FARES
   ============================================================ */

const DEFAULT_FARES = {

    bike: {
        baseFare: 30,
        dayRate: 8,
        extraRate: 9,
        nightRate: 11
    },

    cab: {
        baseFare: 50,
        dayRate: 12,
        extraRate: 14,
        nightRate: 16
    },

    parcel: {
        baseFare: 40,
        dayRate: 10,
        extraRate: 12,
        nightRate: 14
    },

    food: {
        baseFare: 30,
        dayRate: 8,
        extraRate: 10,
        nightRate: 12
    }

};

/* ============================================================
   HELPERS
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}

function clean(value) {
    return String(value || "").trim();
}

function number(value, fallback = 0) {

    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;

}

function showMessage(message, type = "info") {

    console.log(`[RiderX ${type}]`, message);

    const toast = $("toast");

    if (!toast) {

        if (type === "error") {
            alert(message);
        }

        return;

    }

    toast.textContent = message;

    toast.className = "toast show " + type;

    clearTimeout(window.__riderxToastTimer);

    window.__riderxToastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}

/* ============================================================
   DISTANCE
   ============================================================ */

function distanceKm(lat1, lng1, lat2, lng2) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;

}

/* ============================================================
   FARE SETTINGS
   ============================================================ */

async function loadFareSettings() {

    try {

        const ref = doc(
            db,
            "settings",
            "fare"
        );

        const snap = await getDoc(ref);

        if (snap.exists()) {

            state.fareSettings =
                snap.data();

        }

    } catch (error) {

        console.warn(
            "RiderX fare settings unavailable:",
            error
        );

        state.fareSettings = null;

    }

}

/* ============================================================
   GET SERVICE FARE
   ============================================================ */

function getServiceFare(service) {

    const admin =
        state.fareSettings;

    if (
        admin &&
        admin[service]
    ) {

        return {

            baseFare:
                number(
                    admin[service].baseFare,
                    DEFAULT_FARES[service]?.baseFare || 30
                ),

            dayRate:
                number(
                    admin[service].dayRate,
                    DEFAULT_FARES[service]?.dayRate || 8
                ),

            extraRate:
                number(
                    admin[service].extraRate,
                    DEFAULT_FARES[service]?.extraRate || 9
                ),

            nightRate:
                number(
                    admin[service].nightRate,
                    DEFAULT_FARES[service]?.nightRate || 11
                )

        };

    }

    return (
        DEFAULT_FARES[service] ||
        DEFAULT_FARES.bike
    );

}

/* ============================================================
   SET SERVICE
   ============================================================ */

export function setService(service) {

    service =
        clean(service).toLowerCase();

    if (!DEFAULT_FARES[service]) {
        service = "bike";
    }

    state.activeService = service;

    localStorage.setItem(
        "riderx_service",
        service
    );

    document
        .querySelectorAll(
            ".service, .service-select-btn"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                String(
                    button.dataset.service || ""
                ).toLowerCase() === service
            );

        });

    calculateFareEstimate();

}

/* ============================================================
   SET PAYMENT
   ============================================================ */

export function setPaymentMethod(method) {

    method =
        clean(method).toLowerCase();

    if (
        ![
            "cash",
            "upi",
            "wallet"
        ].includes(method)
    ) {

        method = "cash";

    }

    state.paymentMethod = method;

    localStorage.setItem(
        "riderx_payment_method",
        method
    );

    document
        .querySelectorAll(
            ".payment-option, .payment-method"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                String(
                    button.dataset.payment || ""
                ).toLowerCase() === method
            );

        });

}

/* ============================================================
   SET PICKUP
   ============================================================ */

export function setPickupLocation(
    lat,
    lng,
    address = ""
) {

    state.pickupLocation = {

        lat: number(lat),
        lng: number(lng),

        address:
            clean(address)

    };

    const input =
        $("pickupInput");

    if (
        input &&
        address
    ) {

        input.value =
            address;

    }

    calculateFareEstimate();

}

/* ============================================================
   SET DROP
   ============================================================ */

export function setDropLocation(
    lat,
    lng,
    address = ""
) {

    state.dropLocation = {

        lat: number(lat),
        lng: number(lng),

        address:
            clean(address)

    };

    const input =
        $("dropInput");

    if (
        input &&
        address
    ) {

        input.value =
            address;

    }

    calculateFareEstimate();

}

/* ============================================================
   FARE
   ============================================================ */

export function calculateFareEstimate() {

    if (
        !state.pickupLocation ||
        !state.dropLocation
    ) {

        state.estimatedDistance = 0;

        state.estimatedDuration = 0;

        state.estimatedFare = 0;

        updateFareUI();

        return 0;

    }

    const distance =
        distanceKm(

            state.pickupLocation.lat,
            state.pickupLocation.lng,

            state.dropLocation.lat,
            state.dropLocation.lng

        );

    state.estimatedDistance =
        Number(
            distance.toFixed(2)
        );

    /*
       Approximate city travel time.
       Later this can be replaced by
       a routing API without changing
       booking structure.
    */

    state.estimatedDuration =
        Math.max(
            1,
            Math.round(
                distance * 3.2
            )
        );

    const fare =
        getServiceFare(
            state.activeService
        );

    const hour =
        new Date().getHours();

    const night =
        hour >= 22 ||
        hour < 6;

    const perKm =
        night
            ? fare.nightRate
            : fare.dayRate;

    let total =
        fare.baseFare;

    if (
        state.estimatedDistance <= 10
    ) {

        total +=
            state.estimatedDistance *
            perKm;

    } else {

        total +=
            10 * perKm;

        total +=
            (
                state.estimatedDistance -
                10
            ) *
            fare.extraRate;

    }

    state.estimatedFare =
        Math.max(
            fare.baseFare,
            Math.round(total)
        );

    updateFareUI();

    return state.estimatedFare;

}

/* ============================================================
   UPDATE UI
   ============================================================ */

function updateFareUI() {

    const distance =
        $("distanceDisplay");

    const duration =
        $("durationDisplay");

    const fare =
        $("fareDisplay");

    const genericFare =
        $("fare");

    const genericDistance =
        $("estimated-distance-display");

    const genericTime =
        $("estimated-time-display");

    if (distance) {

        distance.textContent =
            state.estimatedDistance > 0
                ? `${state.estimatedDistance} km`
                : "0 km";

    }

    if (duration) {

        duration.textContent =
            state.estimatedDuration > 0
                ? `${state.estimatedDuration} min`
                : "0 min";

    }

    if (fare) {

        fare.textContent =
            `₹${state.estimatedFare}`;

    }

    if (genericFare) {

        genericFare.textContent =
            `₹${state.estimatedFare}`;

    }

    if (genericDistance) {

        genericDistance.textContent =
            `${state.estimatedDistance} KM`;

    }

    if (genericTime) {

        genericTime.textContent =
            `${state.estimatedDuration} mins`;

    }

    const book =
        $("bookRideBtn");

    if (book) {

        book.disabled = !(
            auth.currentUser &&
            state.pickupLocation &&
            state.dropLocation &&
            state.estimatedDistance > 0 &&
            !state.creatingRide
        );

    }

}

/* ============================================================
   CREATE RIDE
   ============================================================ */

export async function createRideRequest(
    paymentMethod =
        state.paymentMethod
) {

    if (state.creatingRide) {
        return null;
    }

    const user =
        auth.currentUser;

    if (!user) {

        showMessage(
            "Please login first.",
            "error"
        );

        window.location.href =
            "../auth/login.html?role=customer";

        return null;

    }

    if (
        !state.pickupLocation ||
        !state.dropLocation
    ) {

        showMessage(
            "Pickup and destination select karein.",
            "error"
        );

        return null;

    }

    calculateFareEstimate();

    if (
        state.estimatedDistance <= 0
    ) {

        showMessage(
            "Route calculate nahi ho paya.",
            "error"
        );

        return null;

    }

    state.creatingRide = true;

    updateFareUI();

    const overlay =
        $("searchingOverlay");

    const searchingText =
        $("searchingText");

    if (overlay) {
        overlay.style.display =
            "flex";
    }

    if (searchingText) {

        searchingText.textContent =
            "Creating your ride request...";

    }

    const now =
        Timestamp.now();

    const pickup =
        state.pickupLocation;

    const drop =
        state.dropLocation;

    const payment =
        clean(
            paymentMethod ||
            state.paymentMethod ||
            "cash"
        ).toLowerCase();

    try {

        const ride = {

            customerId:
                user.uid,

            customerName:
                user.displayName ||
                user.email ||
                "RiderX Customer",

            customerEmail:
                user.email || "",

            serviceType:
                state.activeService,

            service:
                state.activeService,

            pickup: {

                lat:
                    number(pickup.lat),

                lng:
                    number(pickup.lng),

                address:
                    pickup.address ||
                    "Pickup location",

                name:
                    pickup.address ||
                    "Pickup location"

            },

            drop: {

                lat:
                    number(drop.lat),

                lng:
                    number(drop.lng),

                address:
                    drop.address ||
                    "Destination",

                name:
                    drop.address ||
                    "Destination"

            },

            distance:
                number(
                    state.estimatedDistance
                ),

            duration:
                number(
                    state.estimatedDuration
                ),

            fare:
                number(
                    state.estimatedFare
                ),

            estimatedFare:
                number(
                    state.estimatedFare
                ),

            paymentMethod:
                payment,

            paymentStatus:
                payment === "cash"
                    ? "pending"
                    : "pending",

            status:
                "REQUESTED",

            riderId:
                null,

            driverId:
                null,

            riderName:
                null,

            riderPhone:
                null,

            riderPhoto:
                null,

            otp:
                String(
                    Math.floor(
                        1000 +
                        Math.random() *
                        9000
                    )
                ),

            createdAt:
                now,

            requestedAt:
                now,

            updatedAt:
                now

        };

        if (searchingText) {

            searchingText.textContent =
                "Sending request to nearby riders...";

        }

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

        localStorage.setItem(
            "riderx_current_ride_id",
            rideRef.id
        );

        localStorage.setItem(
            "riderx_active_ride_id",
            rideRef.id
        );

        showMessage(
            "Ride request sent.",
            "success"
        );

        startRideStatusListener(
            rideRef.id
        );

        window.dispatchEvent(
            new CustomEvent(
                "riderx:ride-created",
                {
                    detail: {
                        rideId:
                            rideRef.id,

                        ride
                    }
                }
            )
        );

        return rideRef.id;

    } catch (error) {

        console.error(
            "RiderX booking error:",
            error
        );

        if (overlay) {
            overlay.style.display =
                "none";
        }

        if (
            error.code ===
            "permission-denied"
        ) {

            showMessage(
                "Firestore permission denied. Firestore rules check karein.",
                "error"
            );

        } else {

            showMessage(
                error.message ||
                "Ride booking failed.",
                "error"
            );

        }

        return null;

    } finally {

        state.creatingRide = false;

        updateFareUI();

    }

}

/* ============================================================
   REALTIME RIDE STATUS
   ============================================================ */

export function startRideStatusListener(
    rideId
) {

    if (!rideId) {
        return;
    }

    if (
        typeof state.rideListener ===
        "function"
    ) {

        state.rideListener();

        state.rideListener =
            null;

    }

    state.rideListener =
        onSnapshot(

            doc(
                db,
                "rides",
                rideId
            ),

            snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    console.warn(
                        "Ride no longer exists:",
                        rideId
                    );

                    return;

                }

                const ride =
                    snapshot.data();

                const status =
                    String(
                        ride.status ||
                        "REQUESTED"
                    ).toUpperCase();

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:ride-status",
                        {
                            detail: {
                                rideId,
                                ride,
                                status
                            }
                        }
                    )
                );

                handleRideStatus(
                    rideId,
                    ride,
                    status
                );

            },

            error => {

                console.error(
                    "Ride listener error:",
                    error
                );

            }

        );

}

/* ============================================================
   STATUS HANDLER
   ============================================================ */

function handleRideStatus(
    rideId,
    ride,
    status
) {

    const overlay =
        $("searchingOverlay");

    const text =
        $("searchingText");

    switch (status) {

        case "REQUESTED":

        case "SEARCHING":

            if (overlay) {

                overlay.style.display =
                    "flex";

            }

            if (text) {

                text.textContent =
                    "Looking for a nearby rider...";

            }

            break;

        case "ACCEPTED":

            if (overlay) {

                overlay.style.display =
                    "none";

            }

            localStorage.setItem(
                "riderx_active_ride_id",
                rideId
            );

            window.dispatchEvent(
                new CustomEvent(
                    "riderx:ride-accepted",
                    {
                        detail: {
                            rideId,
                            ride
                        }
                    }
                )
            );

            /*
               If a dedicated ride-status page
               exists, go there instead of history.
            */

            if (
                window.location.pathname
                    .includes("/customer/booking")
            ) {

                setTimeout(() => {

                    window.location.href =
                        "ride-status.html";

                }, 500);

            }

            break;

        case "ARRIVING":

        case "ARRIVED":

        case "STARTED":

        case "IN_PROGRESS":

        case "COMPLETED":

        case "CANCELLED":

            if (overlay) {

                overlay.style.display =
                    "none";

            }

            window.dispatchEvent(
                new CustomEvent(
                    "riderx:ride-status-changed",
                    {
                        detail: {
                            rideId,
                            ride,
                            status
                        }
                    }
                )
            );

            break;

        default:

            break;

    }

}

/* ============================================================
   CANCEL RIDE
   ============================================================ */

export async function cancelRide(
    rideId =
        state.currentRideId
) {

    if (!rideId) {
        return false;
    }

    const user =
        auth.currentUser;

    if (!user) {
        throw new Error(
            "Login required."
        );
    }

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
                Timestamp.now(),

            updatedAt:
                Timestamp.now()

        }

    );

    localStorage.removeItem(
        "riderx_current_ride_id"
    );

    localStorage.removeItem(
        "riderx_active_ride_id"
    );

    return true;

}

/* ============================================================
   GET CURRENT RIDE
   ============================================================ */

export async function getCurrentRide() {

    const rideId =
        state.currentRideId ||
        localStorage.getItem(
            "riderx_current_ride_id"
        );

    if (!rideId) {
        return null;
    }

    try {

        const snap =
            await getDoc(
                doc(
                    db,
                    "rides",
                    rideId
                )
            );

        if (!snap.exists()) {
            return null;
        }

        return {

            id:
                snap.id,

            ...snap.data()

        };

    } catch (error) {

        console.error(
            "Get current ride error:",
            error
        );

        return null;

    }

}

/* ============================================================
   RESET
   ============================================================ */

export function resetBookingState() {

    if (
        typeof state.rideListener ===
        "function"
    ) {

        state.rideListener();

    }

    state.pickupLocation = null;

    state.dropLocation = null;

    state.estimatedFare = 0;

    state.estimatedDistance = 0;

    state.estimatedDuration = 0;

    state.currentRideId = null;

    state.rideListener = null;

    state.creatingRide = false;

    localStorage.removeItem(
        "riderx_current_ride_id"
    );

    localStorage.removeItem(
        "riderx_active_ride_id"
    );

    updateFareUI();

}

/* ============================================================
   EVENT WIRING
   ============================================================ */

function setupUI() {

    document
        .querySelectorAll(
            ".service, .service-select-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    setService(
                        button.dataset.service
                    );

                }
            );

        });

    document
        .querySelectorAll(
            ".payment-option, .payment-method"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    setPaymentMethod(
                        button.dataset.payment
                    );

                }
            );

        });

    const book =
        $("bookRideBtn");

    if (book) {

        book.addEventListener(
            "click",
            async () => {

                await createRideRequest(
                    state.paymentMethod
                );

            }
        );

    }

    const back =
        $("backBtn");

    if (back) {

        back.addEventListener(
            "click",
            () => {

                if (
                    window.history.length > 1
                ) {

                    window.history.back();

                } else {

                    window.location.href =
                        "home.html";

                }

            }
        );

    }

}

/* ============================================================
   AUTH
   ============================================================ */

function setupAuth() {

    onAuthStateChanged(
        auth,
        user => {

            updateFareUI();

            if (
                user &&
                state.currentRideId
            ) {

                startRideStatusListener(
                    state.currentRideId
                );

            }

        }
    );

}

/* ============================================================
   PUBLIC API
   ============================================================ */

window.RiderXBooking = {

    setPickupLocation,

    setDropLocation,

    setService,

    setPaymentMethod,

    calculateFare:
        calculateFareEstimate,

    createRide:
        createRideRequest,

    cancelRide,

    getCurrentRide,

    startRideStatusListener,

    reset:
        resetBookingState,

    state

};

/* ============================================================
   INIT
   ============================================================ */

export async function initBookingModule() {

    if (state.initialized) {
        return;
    }

    state.initialized = true;

    setupUI();

    setupAuth();

    setService(
        state.activeService
    );

    setPaymentMethod(
        state.paymentMethod
    );

    await loadFareSettings();

    updateFareUI();

    if (
        state.currentRideId
    ) {

        startRideStatusListener(
            state.currentRideId
        );

    }

    console.log(
        "RiderX Booking Engine ready."
    );

}

/* ============================================================
   AUTO INIT
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initBookingModule
    );

} else {

    initBookingModule();

    }
