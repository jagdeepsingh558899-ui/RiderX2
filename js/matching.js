/* ============================================================
   RIDERX 2.0
   CUSTOMER BOOKING ENGINE
   File: js/booking.js

   FINAL RESPONSIBILITIES
   ------------------------------------------------------------
   - Use the shared RiderX Firebase instance
   - Firebase Auth is the only authentication authority
   - Require a real authenticated customer
   - Prevent duplicate active customer bookings
   - Create exactly one ride document per booking attempt
   - Keep one stable rideId throughout the booking flow
   - Create rides/{rideId} before matching starts
   - Keep customer/rider on the same ride document
   - Start the existing RiderX matching engine
   - Support a late-loading matching engine
   - Persist active ride locally as cache only
   - Restore active rides only after Firebase ownership validation
   - Watch Firestore ride status changes in real time
   - Protect customer-side ride updates
   - Support existing RiderX booking/map UI
   ============================================================ */

"use strict";


/* ============================================================
   FIREBASE
   ------------------------------------------------------------
   IMPORTANT:
   Do NOT initialize another Firebase app here.
   firebase/firebase-config.js is the single Firebase source.
   ============================================================ */

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


/* ============================================================
   RIDERX GLOBAL
   ============================================================ */

window.RiderX =
    window.RiderX || {};

const RX =
    window.RiderX;


/* ============================================================
   BOOKING OBJECT
   ============================================================ */

const Booking =
    RX.booking =
    RX.booking || {};


/* ============================================================
   CONFIG
   ============================================================ */

Booking.config = Object.assign(
    {
        ridesCollection:
            "rides",

        customersCollection:
            "customers",

        matchingTimeout:
            90000,

        matchingEngineWait:
            10000,

        defaultService:
            "bike",

        defaultPayment:
            "cash",

        redirectAfterCreate:
            true,

        rideStatusPage:
            "ride-status.html",

        activeRideStorageKey:
            "riderx_active_ride",

        activeRideIdStorageKey:
            "riderx_active_ride_id",

        currentRideIdStorageKey:
            "riderx_current_ride_id",

        pendingRideIdStorageKey:
            "riderx_pending_ride_id"
    },
    Booking.config || {}
);


/* ============================================================
   STATE
   ============================================================ */

Booking.state = Object.assign(
    {
        initialized:
            false,

        submitting:
            false,

        active:
            false,

        rideId:
            null,

        pendingRideId:
            null,

        unsubscribe:
            null,

        authUser:
            null,

        authReady:
            false,

        authListenerBound:
            false,

        authReadyPromise:
            null,

        authReadyResolve:
            null,

        pickup:
            null,

        destination:
            null,

        fare:
            0,

        service:
            "bike",

        paymentMethod:
            "cash"
    },
    Booking.state || {}
);


/* ============================================================
   FIREBASE HELPERS
   ============================================================ */

Booking.getFirestore = function () {

    return db || null;

};


Booking.getAuth = function () {

    return auth || null;

};


Booking.isFirebaseReady = function () {

    return Boolean(
        Booking.getFirestore() &&
        Booking.getAuth()
    );

};


/* ============================================================
   AUTH READINESS
   ------------------------------------------------------------
   Firebase Auth can resolve currentUser asynchronously.
   Never treat an unresolved auth state as a logged-out user.
   ============================================================ */

Booking.waitForAuth = function () {

    const firebaseAuth =
        Booking.getAuth();


    if (!firebaseAuth) {

        return Promise.reject(
            new Error(
                "Firebase Authentication is unavailable."
            )
        );

    }


    if (
        Booking.state.authReady
    ) {

        return Promise.resolve(
            Booking.state.authUser || null
        );

    }


    if (
        !Booking.state.authReadyPromise
    ) {

        Booking.state.authReadyPromise =
            new Promise(
                function (resolve) {

                    Booking.state.authReadyResolve =
                        resolve;

                }
            );

    }


    return Booking.state.authReadyPromise;

};


/* ============================================================
   CURRENT AUTH USER
   ------------------------------------------------------------
   Firebase Auth is the ONLY authentication authority.
   localStorage is never accepted as proof of login.
   ============================================================ */

Booking.getCurrentUser = function () {

    const firebaseAuth =
        Booking.getAuth();

    if (
        firebaseAuth &&
        firebaseAuth.currentUser
    ) {

        return firebaseAuth.currentUser;

    }

    return null;

};


/* ============================================================
   CUSTOMER ID
   ============================================================ */

Booking.getCustomerId = function () {

    const user =
        Booking.getCurrentUser();

    if (
        !user ||
        !user.uid
    ) {

        return null;

    }

    return String(
        user.uid
    );

};


/* ============================================================
   CUSTOMER PROFILE
   ============================================================ */

Booking.getCustomerProfile = async function () {

    const user =
        Booking.getCurrentUser();

    if (
        !user ||
        !user.uid
    ) {

        throw new Error(
            "Customer login required."
        );

    }


    const profile = {

        name:
            user.displayName ||
            "",

        phone:
            user.phoneNumber ||
            "",

        email:
            user.email ||
            ""

    };


    try {

        const database =
            Booking.getFirestore();

        if (!database) {

            return profile;

        }


        const customerRef =
            doc(
                database,
                Booking.config.customersCollection,
                user.uid
            );


        const snapshot =
            await getDoc(
                customerRef
            );


        if (
            snapshot.exists()
        ) {

            const data =
                snapshot.data() ||
                {};


            profile.name =
                data.name ||
                data.fullName ||
                data.displayName ||
                profile.name ||
                "";


            profile.phone =
                data.phone ||
                data.phoneNumber ||
                profile.phone ||
                "";


            profile.email =
                data.email ||
                profile.email ||
                "";

        }

    } catch (error) {

        /*
         * Customer profile is supplementary data.
         * Authentication remains the authority.
         */

        console.warn(
            "RiderX customer profile lookup failed:",
            error
        );

    }


    return profile;

};


/* ============================================================
   DOM HELPERS
   ============================================================ */

Booking.findElement = function (
    ids
) {

    if (
        typeof ids === "string"
    ) {

        ids = [
            ids
        ];

    }


    if (
        !Array.isArray(ids)
    ) {

        return null;

    }


    for (
        const id of ids
    ) {

        if (!id) {

            continue;

        }


        const element =
            document.getElementById(
                id
            );


        if (element) {

            return element;

        }

    }


    return null;

};


/* ============================================================
   VALUE HELPER
   ============================================================ */

Booking.getValue = function (
    ids
) {

    const element =
        Booking.findElement(
            ids
        );


    if (!element) {

        return "";

    }


    return String(
        element.value ??
        element.textContent ??
        ""
    ).trim();

};


/* ============================================================
   MESSAGE
   ============================================================ */

Booking.showMessage = function (
    message,
    type = "info"
) {

    const element =
        Booking.findElement(
            [
                "message",
                "booking-message",
                "bookingMessage",
                "status-message",
                "statusMessage",
                "error-message",
                "errorMessage"
            ]
        );


    if (element) {

        element.textContent =
            message || "";

        element.style.display =
            message
                ? "block"
                : "";

        element.dataset.type =
            type;

    }


    console.log(
        `[RiderX Booking:${type}]`,
        message
    );

};


/* ============================================================
   LOADING STATE
   ============================================================ */

Booking.setLoading = function (
    loading
) {

    const buttons =
        document.querySelectorAll(
            [
                "#bookRide",
                "#book-ride",
                "#confirmRide",
                "#confirm-ride",
                "#bookButton",
                "#confirmButton",
                "[data-book-ride]",
                "[data-confirm-ride]"
            ].join(",")
        );


    buttons.forEach(
        function (button) {

            button.disabled =
                Boolean(
                    loading
                );


            if (loading) {

                if (
                    !button.dataset
                        .originalText
                ) {

                    button.dataset
                        .originalText =
                        button.textContent;

                }


                button.textContent =
                    "Finding Rider...";

            } else {

                if (
                    button.dataset
                        .originalText
                ) {

                    button.textContent =
                        button.dataset
                            .originalText;

                }

            }

        }
    );

};


/* ============================================================
   STORAGE HELPERS
   ------------------------------------------------------------
   Storage is ONLY a cache.
   It is never used as authentication authority.
   ============================================================ */

Booking.storageGet = function (
    key
) {

    try {

        return localStorage.getItem(
            key
        );

    } catch (error) {

        console.warn(
            "RiderX storage read failed:",
            error
        );

        return null;

    }

};


Booking.storageSet = function (
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            String(value)
        );

        return true;

    } catch (error) {

        console.warn(
            "RiderX storage write failed:",
            error
        );

        return false;

    }

};


Booking.storageRemove = function (
    key
) {

    try {

        localStorage.removeItem(
            key
        );

    } catch (error) {

        console.warn(
            "RiderX storage removal failed:",
            error
        );

    }

};


/* ============================================================
   RIDE ID
   ============================================================ */

Booking.createRideId = function () {

    /*
     * Prefer cryptographically strong UUID when available.
     */

    try {

        if (
            window.crypto &&
            typeof window.crypto.randomUUID ===
            "function"
        ) {

            return (
                "ride_" +
                window.crypto.randomUUID()
                    .replace(
                        /-/g,
                        ""
                    )
            );

        }

    } catch (error) {

        console.warn(
            "RiderX crypto UUID unavailable:",
            error
        );

    }


    const random =
        Math.random()
            .toString(36)
            .slice(
                2,
                12
            );


    return (
        "ride_" +
        Date.now().toString(36) +
        "_" +
        random
    );

};


/* ============================================================
   PENDING RIDE ID
   ------------------------------------------------------------
   Keeps one booking attempt tied to one stable ID.
   ============================================================ */

Booking.getPendingRideId = function () {

    if (
        Booking.state.pendingRideId
    ) {

        return String(
            Booking.state.pendingRideId
        );

    }


    const stored =
        Booking.storageGet(
            Booking.config
                .pendingRideIdStorageKey
        );


    if (stored) {

        Booking.state.pendingRideId =
            String(
                stored
            );

        return Booking.state.pendingRideId;

    }


    return null;

};


Booking.createPendingRideId = function () {

    const existing =
        Booking.getPendingRideId();


    if (existing) {

        return existing;

    }


    const rideId =
        Booking.createRideId();


    Booking.state.pendingRideId =
        rideId;


    Booking.storageSet(
        Booking.config
            .pendingRideIdStorageKey,
        rideId
    );


    return rideId;

};


Booking.clearPendingRideId = function () {

    Booking.state.pendingRideId =
        null;


    Booking.storageRemove(
        Booking.config
            .pendingRideIdStorageKey
    );

};


/* ============================================================
   LOCATION NORMALIZER
   ============================================================ */

Booking.normalizeLocation = function (
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
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return null;

    }


    if (
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
    ) {

        return null;

    }


    return {

        lat,
        lng

    };

};


/* ============================================================
   GET PICKUP LOCATION
   ============================================================ */

Booking.getPickupLocation = function () {

    const stateLocation =
        Booking.normalizeLocation(
            Booking.state.pickup
        );


    if (stateLocation) {

        return stateLocation;

    }


    const candidates = [

        window.riderxPickupLocation,
        window.pickupLocation,
        window.customerPickupLocation,
        window.selectedPickup,
        window.RiderX?.pickupLocation

    ];


    for (
        const candidate of candidates
    ) {

        const location =
            Booking.normalizeLocation(
                candidate
            );


        if (location) {

            return location;

        }

    }


    const lat =
        Number(
            Booking.getValue(
                [
                    "pickupLat",
                    "pickup-lat",
                    "pickupLatitude"
                ]
            )
        );


    const lng =
        Number(
            Booking.getValue(
                [
                    "pickupLng",
                    "pickup-lng",
                    "pickupLongitude"
                ]
            )
        );


    return Booking.normalizeLocation(
        {
            lat,
            lng
        }
    );

};


/* ============================================================
   GET DESTINATION LOCATION
   ============================================================ */

Booking.getDestinationLocation = function () {

    const stateLocation =
        Booking.normalizeLocation(
            Booking.state.destination
        );


    if (stateLocation) {

        return stateLocation;

    }


    const candidates = [

        window.riderxDestinationLocation,
        window.destinationLocation,
        window.customerDestinationLocation,
        window.selectedDestination,
        window.RiderX?.destinationLocation

    ];


    for (
        const candidate of candidates
    ) {

        const location =
            Booking.normalizeLocation(
                candidate
            );


        if (location) {

            return location;

        }

    }


    const lat =
        Number(
            Booking.getValue(
                [
                    "dropLat",
                    "drop-lat",
                    "dropLatitude",
                    "destinationLat",
                    "destination-lat"
                ]
            )
        );


    const lng =
        Number(
            Booking.getValue(
                [
                    "dropLng",
                    "drop-lng",
                    "dropLongitude",
                    "destinationLng",
                    "destination-lng"
                ]
            )
        );


    return Booking.normalizeLocation(
        {
            lat,
            lng
        }
    );

};


/* ============================================================
   PICKUP ADDRESS
   ============================================================ */

Booking.getPickupAddress = function () {

    return Booking.getValue(
        [
            "pickup",
            "pickupAddress",
            "pickup-address",
            "pickupLocationText",
            "pickup-location",
            "from",
            "fromAddress"
        ]
    );

};


/* ============================================================
   DESTINATION ADDRESS
   ============================================================ */

Booking.getDestinationAddress = function () {

    return Booking.getValue(
        [
            "drop",
            "dropAddress",
            "drop-address",
            "destination",
            "destinationAddress",
            "destination-address",
            "to",
            "toAddress"
        ]
    );

};


/* ============================================================
   SERVICE
   ============================================================ */

Booking.getService = function () {

    const selected =
        document.querySelector(
            [
                "input[name='service']:checked",
                "input[name='serviceType']:checked",
                "input[name='rideType']:checked",
                "[data-service].active",
                "[data-service].selected"
            ].join(",")
        );


    if (selected) {

        const selectedValue =
            selected.value ||
            selected.dataset?.service ||
            selected.dataset?.serviceType ||
            "";


        if (selectedValue) {

            return String(
                selectedValue
            )
            .toLowerCase()
            .trim();

        }

    }


    const value =
        Booking.getValue(
            [
                "service",
                "serviceType",
                "service-type",
                "rideType",
                "ride-type",
                "selectedService"
            ]
        );


    return (
        value ||
        Booking.config.defaultService
    )
    .toLowerCase()
    .trim();

};


/* ============================================================
   NORMALIZE SERVICE
   ============================================================ */

Booking.normalizeService = function (
    service
) {

    const value =
        String(
            service || "bike"
        )
        .toLowerCase()
        .trim();


    if (
        value.includes("cab") ||
        value.includes("car") ||
        value.includes("taxi")
    ) {

        return "cab";

    }


    if (
        value.includes("parcel") ||
        value.includes("delivery")
    ) {

        return "parcel";

    }


    if (
        value.includes("food")
    ) {

        return "food";

    }


    return "bike";

};


/* ============================================================
   PAYMENT METHOD
   ============================================================ */

Booking.getPaymentMethod = function () {

    const checked =
        document.querySelector(
            [
                "input[name='paymentMethod']:checked",
                "input[name='payment']:checked",
                "input[name='payment-method']:checked"
            ].join(",")
        );


    if (checked) {

        const value =
            String(
                checked.value || ""
            )
            .toLowerCase()
            .trim();


        if (value) {

            return value;

        }

    }


    const value =
        Booking.getValue(
            [
                "paymentMethod",
                "payment-method",
                "payment",
                "selectedPayment"
            ]
        );


    return (
        value ||
        Booking.config.defaultPayment
    )
    .toLowerCase()
    .trim();

};


/* ============================================================
   FARE
   ============================================================ */

Booking.getFare = function () {

    const possibleValues = [

        window.riderxFare,
        window.estimatedFare,
        window.currentFare,
        window.RiderX?.fare,
        window.RiderX?.estimatedFare

    ];


    for (
        const value of possibleValues
    ) {

        const fare =
            Number(
                value
            );


        if (
            Number.isFinite(fare) &&
            fare >= 0
        ) {

            return Math.round(
                fare * 100
            ) / 100;

        }

    }


    const element =
        Booking.findElement(
            [
                "fare",
                "estimatedFare",
                "estimated-fare",
                "fareAmount",
                "totalFare",
                "total-fare"
            ]
        );


    if (element) {

        const fare =
            Number(
                String(
                    element.value ??
                    element.textContent ??
                    ""
                )
                .replace(
                    /[^0-9.]/g,
                    ""
                )
            );


        if (
            Number.isFinite(fare) &&
            fare >= 0
        ) {

            return Math.round(
                fare * 100
            ) / 100;

        }

    }


    return 0;

};


/* ============================================================
   VALIDATE PAYMENT
   ============================================================ */

Booking.normalizePaymentMethod = function (
    payment
) {

    const value =
        String(
            payment ||
            Booking.config.defaultPayment
        )
        .toLowerCase()
        .trim();


    const aliases = {

        cash:
            "cash",

        cod:
            "cash",

        wallet:
            "wallet",

        online:
            "online",

        upi:
            "upi",

        card:
            "card"

    };


    return (
        aliases[value] ||
        value ||
        Booking.config.defaultPayment
    );

};


/* ============================================================
   VALIDATE BOOKING
   ============================================================ */

Booking.validate = function () {

    const pickupAddress =
        Booking.getPickupAddress();


    const destinationAddress =
        Booking.getDestinationAddress();


    const pickupLocation =
        Booking.getPickupLocation();


    const destinationLocation =
        Booking.getDestinationLocation();


    if (!pickupAddress) {

        return {

            valid:
                false,

            message:
                "Please select pickup location."

        };

    }


    if (!destinationAddress) {

        return {

            valid:
                false,

            message:
                "Please select destination."

        };

    }


    if (!pickupLocation) {

        return {

            valid:
                false,

            message:
                "Pickup GPS location is missing."

        };

    }


    if (!destinationLocation) {

        return {

            valid:
                false,

            message:
                "Destination GPS location is missing."

        };

    }


    if (
        pickupLocation.lat ===
        destinationLocation.lat &&
        pickupLocation.lng ===
        destinationLocation.lng
    ) {

        return {

            valid:
                false,

            message:
                "Pickup and destination cannot be the same."

        };

    }


    return {

        valid:
            true,

        pickupAddress,

        destinationAddress,

        pickupLocation,

        destinationLocation

    };

};


/* ============================================================
   FIND EXISTING ACTIVE RIDE
   ------------------------------------------------------------
   Firestore is authoritative.
   ============================================================ */

Booking.findExistingActiveRide = async function (
    user
) {

    if (
        !user ||
        !user.uid
    ) {

        return null;

    }


    const database =
        Booking.getFirestore();


    if (!database) {

        throw new Error(
            "Firestore unavailable."
        );

    }


    let rideId =
        Booking.storageGet(
            Booking.config
                .activeRideIdStorageKey
        );


    if (!rideId) {

        const raw =
            Booking.storageGet(
                Booking.config
                    .activeRideStorageKey
            );


        if (raw) {

            try {

                const saved =
                    JSON.parse(
                        raw
                    );


                rideId =
                    saved?.rideId ||
                    null;

            } catch (error) {

                rideId =
                    null;

            }

        }

    }


    if (!rideId) {

        return null;

    }


    const rideRef =
        doc(
            database,
            Booking.config.ridesCollection,
            String(
                rideId
            )
        );


    const snapshot =
        await getDoc(
            rideRef
        );


    if (
        !snapshot.exists()
    ) {

        Booking.clearActiveRide();

        return null;

    }


    const ride =
        snapshot.data() ||
        {};


    if (
        String(
            ride.customerId ||
            ""
        ) !==
        String(
            user.uid
        )
    ) {

        Booking.clearActiveRide();

        return null;

    }


    if (
        Booking.isTerminalStatus(
            ride.status
        )
    ) {

        Booking.clearActiveRide();

        return null;

    }


    return {

        rideId:
            String(
                rideId
            ),

        ride

    };

};


/* ============================================================
   BUILD RIDE
   ============================================================ */

Booking.buildRide = async function () {

    const validation =
        Booking.validate();


    if (!validation.valid) {

        throw new Error(
            validation.message
        );

    }


    const user =
        Booking.getCurrentUser();


    if (
        !user ||
        !user.uid
    ) {

        throw new Error(
            "Customer login required. Please login again."
        );

    }


    const profile =
        await Booking.getCustomerProfile();


    const service =
        Booking.normalizeService(
            Booking.getService()
        );


    const paymentMethod =
        Booking.normalizePaymentMethod(
            Booking.getPaymentMethod()
        );


    const fare =
        Booking.getFare();


    const rideId =
        Booking.createPendingRideId();


    return {

        rideId,

        customerId:
            String(
                user.uid
            ),

        riderId:
            null,

        customerName:
            profile.name ||
            "",

        customerPhone:
            profile.phone ||
            "",

        customerEmail:
            profile.email ||
            "",

        service,

        serviceType:
            service,

        status:
            "searching",

        pickup:
            validation.pickupAddress,

        destination:
            validation.destinationAddress,

        pickupAddress:
            validation.pickupAddress,

        destinationAddress:
            validation.destinationAddress,

        pickupLocation:
            validation.pickupLocation,

        destinationLocation:
            validation.destinationLocation,

        fare,

        estimatedFare:
            fare,

        paymentMethod,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp(),

        matchingStartedAt:
            serverTimestamp(),

        createdAtClient:
            Date.now(),

        updatedAtClient:
            Date.now()

    };

};


/* ============================================================
   CREATE FIRESTORE RIDE
   ============================================================ */

Booking.createRideInFirestore = async function (
    ride
) {

    const database =
        Booking.getFirestore();


    if (!database) {

        throw new Error(
            "Firestore is unavailable."
        );

    }


    if (
        !ride ||
        !ride.rideId
    ) {

        throw new Error(
            "Invalid ride data."
        );

    }


    const rideRef =
        doc(
            database,
            Booking.config.ridesCollection,
            String(
                ride.rideId
            )
        );


    /*
     * IMPORTANT:
     * create semantics are preserved.
     * merge:false means this operation represents one
     * complete ride document.
     */

    await setDoc(
        rideRef,
        ride,
        {
            merge:
                false
        }
    );


    const verification =
        await getDoc(
            rideRef
        );


    if (
        !verification.exists()
    ) {

        throw new Error(
            "Ride document could not be verified."
        );

    }


    const savedRide =
        verification.data() ||
        {};


    if (
        String(
            savedRide.customerId ||
            ""
        ) !==
        String(
            ride.customerId
        )
    ) {

        throw new Error(
            "Ride ownership verification failed."
        );

    }


    if (
        String(
            savedRide.rideId ||
            ride.rideId
        ) !==
        String(
            ride.rideId
        )
    ) {

        throw new Error(
            "Ride ID verification failed."
        );

    }


    return {

        ref:
            rideRef,

        rideId:
            String(
                ride.rideId
            ),

        ride:
            savedRide

    };

};


/* ============================================================
   MATCHING ENGINE WAIT
   ------------------------------------------------------------ */

Booking.waitForMatchingEngine = async function () {

    if (
        RX.matching &&
        typeof RX.matching.start ===
        "function"
    ) {

        return RX.matching;

    }


    const timeout =
        Math.max(
            0,
            Number(
                Booking.config
                    .matchingEngineWait
            ) || 0
        );


    if (!timeout) {

        return null;

    }


    const started =
        Date.now();


    while (
        Date.now() - started <
        timeout
    ) {

        await new Promise(
            function (resolve) {

                setTimeout(
                    resolve,
                    250
                );

            }
        );


        if (
            RX.matching &&
            typeof RX.matching.start ===
            "function"
        ) {

            return RX.matching;

        }

    }


    return null;

};


/* ============================================================
   MATCHING ENGINE
   ============================================================ */

Booking.startMatching = async function (
    ride
) {

    if (
        !ride ||
        !ride.rideId
    ) {

        return {

            success:
                false,

            matching:
                false,

            reason:
                "invalid-ride"

        };

    }


    const matching =
        await Booking.waitForMatchingEngine();


    if (
        matching &&
        typeof matching.start ===
        "function"
    ) {

        try {

            const result =
                await matching.start(
                    {

                        rideId:
                            String(
                                ride.rideId
                            ),

                        customerId:
                            String(
                                ride.customerId
                            ),

                        service:
                            ride.service,

                        serviceType:
                            ride.serviceType,

                        pickup:
                            ride.pickup,

                        pickupAddress:
                            ride.pickupAddress,

                        pickupLocation:
                            ride.pickupLocation,

                        destination:
                            ride.destination,

                        destinationAddress:
                            ride.destinationAddress,

                        destinationLocation:
                            ride.destinationLocation,

                        fare:
                            ride.fare,

                        estimatedFare:
                            ride.estimatedFare,

                        paymentMethod:
                            ride.paymentMethod,

                        customerName:
                            ride.customerName,

                        customerPhone:
                            ride.customerPhone

                    }
                );


            return {

                success:
                    result !== false,

                matching:
                    true,

                rideId:
                    String(
                        ride.rideId
                    ),

                result

            };

        } catch (error) {

            console.error(
                "RiderX matching engine failed:",
                error
            );


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-matching-engine-error",
                    {
                        detail: {

                            rideId:
                                String(
                                    ride.rideId
                                ),

                            error

                        }
                    }
                )
            );


            return {

                success:
                    false,

                matching:
                    true,

                rideId:
                    String(
                        ride.rideId
                    ),

                error

            };

        }

    }


    /*
     * IMPORTANT:
     * The ride itself remains in Firestore.
     * Do not delete a valid ride because the matching module
     * loaded late or is temporarily unavailable.
     */

    console.warn(
        "RiderX matching engine is not available."
    );


    window.dispatchEvent(
        new CustomEvent(
            "riderx-matching-engine-unavailable",
            {
                detail: {

                    rideId:
                        String(
                            ride.rideId
                        )

                }
            }
        )
    );


    return {

        success:
            false,

        matching:
            false,

        rideId:
            String(
                ride.rideId
            ),

        reason:
            "matching-engine-not-loaded"

    };

};


/* ============================================================
   SAVE ACTIVE RIDE
   ============================================================ */

Booking.saveActiveRide = function (
    ride
) {

    if (
        !ride ||
        !ride.rideId
    ) {

        return false;

    }


    const activeRide = {

        rideId:
            String(
                ride.rideId
            ),

        customerId:
            ride.customerId
                ? String(
                    ride.customerId
                )
                : null,

        status:
            ride.status ||
            "searching",

        riderId:
            ride.riderId ||
            null,

        service:
            ride.service ||
            "bike",

        pickup:
            ride.pickup ||
            ride.pickupAddress ||
            "",

        destination:
            ride.destination ||
            ride.destinationAddress ||
            "",

        updatedAt:
            Date.now()

    };


    const saved =
        Booking.storageSet(
            Booking.config
                .activeRideStorageKey,
            JSON.stringify(
                activeRide
            )
        );


    Booking.storageSet(
        Booking.config
            .activeRideIdStorageKey,
        activeRide.rideId
    );


    Booking.storageSet(
        Booking.config
            .currentRideIdStorageKey,
        activeRide.rideId
    );


    return saved;

};


/* ============================================================
   CLEAR ACTIVE RIDE
   ============================================================ */

Booking.clearActiveRide = function () {

    Booking.storageRemove(
        Booking.config
            .activeRideStorageKey
    );

    Booking.storageRemove(
        Booking.config
            .activeRideIdStorageKey
    );

    Booking.storageRemove(
        Booking.config
            .currentRideIdStorageKey
    );


    Booking.clearPendingRideId();


    Booking.state.rideId =
        null;

    Booking.state.active =
        false;

};


/* ============================================================
   RIDE STATUS HELPERS
   ============================================================ */

Booking.normalizeStatus = function (
    status
) {

    return String(
        status || ""
    )
    .toLowerCase()
    .trim()
    .replace(
        /[\s-]+/g,
        "_"
    );

};


Booking.isTerminalStatus = function (
    status
) {

    return [
        "completed",
        "cancelled",
        "canceled",
        "no_driver",
        "no_rider",
        "expired",
        "rejected",
        "failed"
    ].includes(
        Booking.normalizeStatus(
            status
        )
    );

};


/* ============================================================
   UPDATE ACTIVE RIDE LOCAL CACHE
   ============================================================ */

Booking.updateLocalRide = function (
    rideId,
    ride
) {

    if (!rideId) {

        return;

    }


    if (
        Booking.isTerminalStatus(
            ride?.status
        )
    ) {

        Booking.clearActiveRide();

        return;

    }


    let current =
        {};


    try {

        current =
            JSON.parse(
                Booking.storageGet(
                    Booking.config
                        .activeRideStorageKey
                ) ||
                "{}"
            ) ||
            {};

    } catch (error) {

        current =
            {};

    }


    const merged = {

        ...current,

        rideId:
            String(
                rideId
            ),

        status:
            ride?.status ||
            current.status ||
            "searching",

        riderId:
            ride?.riderId ||
            current.riderId ||
            null,

        updatedAt:
            Date.now()

    };


    Booking.storageSet(
        Booking.config
            .activeRideStorageKey,
        JSON.stringify(
            merged
        )
    );


    Booking.storageSet(
        Booking.config
            .activeRideIdStorageKey,
        String(
            rideId
        )
    );


    Booking.storageSet(
        Booking.config
            .currentRideIdStorageKey,
        String(
            rideId
        )
    );

};


/* ============================================================
   WATCH RIDE
   ============================================================ */

Booking.watchRide = function (
    rideId
) {

    if (!rideId) {

        return null;

    }


    const normalizedRideId =
        String(
            rideId
        );


    /*
     * Do not recreate the same listener unnecessarily.
     */

    if (
        Booking.state.rideId ===
        normalizedRideId &&
        typeof Booking.state.unsubscribe ===
        "function"
    ) {

        return Booking.state.unsubscribe;

    }


    Booking.stopWatchingRide();


    const database =
        Booking.getFirestore();


    if (!database) {

        console.error(
            "RiderX cannot watch ride: Firestore unavailable."
        );

        return null;

    }


    const rideRef =
        doc(
            database,
            Booking.config.ridesCollection,
            normalizedRideId
        );


    const unsubscribe =
        onSnapshot(
            rideRef,

            function (
                snapshot
            ) {

                if (
                    !snapshot.exists()
                ) {

                    console.warn(
                        "RiderX ride document does not exist:",
                        normalizedRideId
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-ride-not-found",
                            {
                                detail: {
                                    rideId:
                                        normalizedRideId
                                }
                            }
                        )
                    );

                    return;

                }


                const ride =
                    snapshot.data() ||
                    {};


                const status =
                    Booking.normalizeStatus(
                        ride.status
                    );


                /*
                 * Security-side ownership check.
                 * The Firestore rules remain the real security boundary.
                 */

                const currentUser =
                    Booking.getCurrentUser();


                if (
                    currentUser &&
                    ride.customerId &&
                    String(
                        ride.customerId
                    ) !==
                    String(
                        currentUser.uid
                    )
                ) {

                    console.error(
                        "RiderX ownership mismatch while watching ride."
                    );


                    Booking.stopWatchingRide();

                    Booking.clearActiveRide();

                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-ride-ownership-error",
                            {
                                detail: {

                                    rideId:
                                        normalizedRideId

                                }
                            }
                        )
                    );

                    return;

                }


                Booking.state.rideId =
                    normalizedRideId;


                Booking.state.active =
                    !Booking.isTerminalStatus(
                        status
                    );


                Booking.state.pickup =
                    Booking.normalizeLocation(
                        ride.pickupLocation
                    );


                Booking.state.destination =
                    Booking.normalizeLocation(
                        ride.destinationLocation
                    );


                Booking.state.service =
                    ride.service ||
                    Booking.state.service ||
                    "bike";


                Booking.state.paymentMethod =
                    ride.paymentMethod ||
                    Booking.state.paymentMethod ||
                    "cash";


                Booking.state.fare =
                    Number(
                        ride.fare ??
                        ride.estimatedFare ??
                        Booking.state.fare ??
                        0
                    );


                if (
                    Booking.isTerminalStatus(
                        status
                    )
                ) {

                    Booking.clearActiveRide();

                } else {

                    Booking.updateLocalRide(
                        normalizedRideId,
                        ride
                    );

                }


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-updated",
                        {
                            detail: {

                                rideId:
                                    normalizedRideId,

                                ride

                            }
                        }
                    )
                );


                /*
                 * Rider accepted / active ride states.
                 */

                if (
                    ride.riderId &&
                    [
                        "accepted",
                        "arriving",
                        "arrived",
                        "started",
                        "in_progress",
                        "inprogress"
                    ].includes(
                        status
                    )
                ) {

                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-ride-accepted",
                            {
                                detail: {

                                    rideId:
                                        normalizedRideId,

                                    riderId:
                                        ride.riderId,

                                    ride

                                }
                            }
                        )
                    );

                }


                /*
                 * Terminal ride.
                 */

                if (
                    Booking.isTerminalStatus(
                        status
                    )
                ) {

                    Booking.state.active =
                        false;


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-ride-finished",
                            {
                                detail: {

                                    rideId:
                                        normalizedRideId,

                                    status,

                                    ride

                                }
                            }
                        )
                    );

                }

            },

            function (
                error
            ) {

                console.error(
                    "RiderX ride listener error:",
                    error
                );


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-listener-error",
                        {
                            detail: {

                                rideId:
                                    normalizedRideId,

                                error

                            }
                        }
                    )
                );

            }
        );


    Booking.state.rideId =
        normalizedRideId;

    Booking.state.unsubscribe =
        unsubscribe;


    return unsubscribe;

};


/* ============================================================
   STOP WATCHING RIDE
   ============================================================ */

Booking.stopWatchingRide = function () {

    if (
        typeof Booking.state.unsubscribe ===
        "function"
    ) {

        try {

            Booking.state.unsubscribe();

        } catch (error) {

            console.warn(
                "RiderX ride listener cleanup failed:",
                error
            );

        }

    }


    Booking.state.unsubscribe =
        null;

};


/* ============================================================
   CUSTOMER-SAFE RIDE UPDATE
   ------------------------------------------------------------
   This function is intentionally restricted.
   Server/Admin/Rider lifecycle changes should be performed
   by their respective authorized flows / backend rules.
   ============================================================ */

Booking.updateRide = async function (
    rideId,
    update
) {

    if (!rideId) {

        throw new Error(
            "Ride ID is required."
        );

    }


    if (
        !update ||
        typeof update !== "object" ||
        Array.isArray(update)
    ) {

        throw new Error(
            "Ride update data is invalid."
        );

    }


    const user =
        Booking.getCurrentUser();


    if (
        !user ||
        !user.uid
    ) {

        throw new Error(
            "Customer login required."
        );

    }


    const database =
        Booking.getFirestore();


    if (!database) {

        throw new Error(
            "Firestore unavailable."
        );

    }


    const rideRef =
        doc(
            database,
            Booking.config.ridesCollection,
            String(
                rideId
            )
        );


    const snapshot =
        await getDoc(
            rideRef
        );


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Ride does not exist."
        );

    }


    const currentRide =
        snapshot.data() ||
        {};


    if (
        String(
            currentRide.customerId ||
            ""
        ) !==
        String(
            user.uid
        )
    ) {

        throw new Error(
            "You are not allowed to update this ride."
        );

    }


    /*
     * Only customer-safe fields are accepted here.
     * Do not allow arbitrary lifecycle/ownership changes.
     */

    const allowedFields = [

        "customerNote",
        "customerNotes",
        "customerPickupNote",
        "customerDropNote"

    ];


    const safeUpdate =
        {};


    allowedFields.forEach(
        function (field) {

            if (
                Object.prototype.hasOwnProperty.call(
                    update,
                    field
                )
            ) {

                safeUpdate[field] =
                    update[field];

            }

        }
    );


    if (
        Object.keys(
            safeUpdate
        ).length === 0
    ) {

        throw new Error(
            "No customer-safe ride fields were supplied."
        );

    }


    safeUpdate.updatedAt =
        serverTimestamp();

    safeUpdate.updatedAtClient =
        Date.now();


    await updateDoc(
        rideRef,
        safeUpdate
    );


    return true;

};


/* ============================================================
   CANCEL RIDE
   ============================================================ */

Booking.cancelRide = async function (
    rideId
) {

    rideId =
        rideId ||
        Booking.state.rideId ||
        Booking.storageGet(
            Booking.config
                .activeRideIdStorageKey
        );


    if (!rideId) {

        return false;

    }


    const user =
        Booking.getCurrentUser();


    if (
        !user ||
        !user.uid
    ) {

        Booking.showMessage(
            "Please login again before cancelling the ride.",
            "error"
        );

        return false;

    }


    const database =
        Booking.getFirestore();


    if (!database) {

        Booking.showMessage(
            "Firestore unavailable.",
            "error"
        );

        return false;

    }


    try {

        const rideRef =
            doc(
                database,
                Booking.config.ridesCollection,
                String(
                    rideId
                )
            );


        const snapshot =
            await getDoc(
                rideRef
            );


        if (
            !snapshot.exists()
        ) {

            Booking.clearActiveRide();

            return false;

        }


        const ride =
            snapshot.data() ||
            {};


        /*
         * Ownership check.
         */

        if (
            String(
                ride.customerId ||
                ""
            ) !==
            String(
                user.uid
            )
        ) {

            throw new Error(
                "You are not allowed to cancel this ride."
            );

        }


        const currentStatus =
            Booking.normalizeStatus(
                ride.status
            );


        if (
            Booking.isTerminalStatus(
                currentStatus
            )
        ) {

            Booking.clearActiveRide();

            return true;

        }


        /*
         * Do not allow customer cancellation after the ride
         * has actually started.
         */

        if (
            [
                "started",
                "in_progress",
                "inprogress"
            ].includes(
                currentStatus
            )
        ) {

            throw new Error(
                "Ride cannot be cancelled after it has started."
            );

        }


        await updateDoc(
            rideRef,
            {

                status:
                    "cancelled",

                cancelledBy:
                    "customer",

                cancelledAt:
                    serverTimestamp(),

                cancelledAtClient:
                    Date.now(),

                updatedAt:
                    serverTimestamp(),

                updatedAtClient:
                    Date.now()

            }
        );


        /*
         * Stop customer-side matching if the matching engine
         * supports cancellation.
         */

        if (
            RX.matching &&
            typeof RX.matching.cancel ===
            "function"
        ) {

            try {

                await RX.matching.cancel(
                    String(
                        rideId
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX matching cancellation failed:",
                    error
                );

            }

        }


        Booking.stopWatchingRide();

        Booking.clearActiveRide();


        window.dispatchEvent(
            new CustomEvent(
                "riderx-ride-cancelled",
                {
                    detail: {

                        rideId:
                            String(
                                rideId
                            )

                    }
                }
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX ride cancellation failed:",
            error
        );


        Booking.showMessage(
            error?.message ||
            "Ride cancel nahi hui. Please try again.",
            "error"
        );


        return false;

    }

};


/* ============================================================
   OPEN RIDE STATUS
   ============================================================ */

Booking.openRideStatus = function (
    rideId
) {

    if (!rideId) {

        return null;

    }


    const currentPath =
        String(
            window.location.pathname ||
            ""
        );


    let target;


    if (
        currentPath.includes(
            "/customer/"
        )
    ) {

        target =
            "./ride-status.html";

    } else {

        target =
            "customer/ride-status.html";

    }


    const separator =
        target.includes("?")
            ? "&"
            : "?";


    const url =
        target +
        separator +
        "rideId=" +
        encodeURIComponent(
            String(
                rideId
            )
        );


    if (
        Booking.config
            .redirectAfterCreate
    ) {

        window.location.replace(
            url
        );

    }


    return url;

};


/* ============================================================
   MAIN BOOK RIDE
   ============================================================ */

Booking.bookRide = async function (
    event
) {

    if (
        event &&
        typeof event.preventDefault ===
        "function"
    ) {

        event.preventDefault();

    }


    if (
        Booking.state.submitting
    ) {

        return {

            success:
                false,

            reason:
                "already-submitting"

        };

    }


    Booking.state.submitting =
        true;


    Booking.setLoading(
        true
    );


    Booking.showMessage(
        "Booking ride...",
        "loading"
    );


    try {

        /*
         * Firebase must be ready.
         */

        if (
            !Booking.isFirebaseReady()
        ) {

            throw new Error(
                "Firebase service unavailable. Please reload RiderX."
            );

        }


        /*
         * Wait for Firebase Auth resolution.
         */

        await Booking.waitForAuth();


        const user =
            Booking.getCurrentUser();


        if (
            !user ||
            !user.uid
        ) {

            throw new Error(
                "Customer login required. Please login again."
            );

        }


        Booking.state.authUser =
            user;


        /*
         * Prevent duplicate active rides.
         */

        const existing =
            await Booking.findExistingActiveRide(
                user
            );


        if (existing) {

            Booking.state.rideId =
                existing.rideId;

            Booking.state.active =
                true;


            Booking.watchRide(
                existing.rideId
            );


            Booking.showMessage(
                "Aapki ek ride already active hai.",
                "info"
            );


            Booking.openRideStatus(
                existing.rideId
            );


            return {

                success:
                    true,

                existing:
                    true,

                rideId:
                    existing.rideId,

                ride:
                    existing.ride

            };

        }


        /*
         * Build exactly one ride object with one stable ID.
         */

        const ride =
            await Booking.buildRide();


        /*
         * Create Firestore ride FIRST.
         */

        const created =
            await Booking.createRideInFirestore(
                ride
            );


        /*
         * Booking attempt has now successfully become
         * a real Firestore ride.
         */

        Booking.state.rideId =
            created.rideId;

        Booking.state.active =
            true;

        Booking.state.service =
            ride.service;

        Booking.state.paymentMethod =
            ride.paymentMethod;

        Booking.state.fare =
            ride.fare;

        Booking.state.pickup =
            ride.pickupLocation;

        Booking.state.destination =
            ride.destinationLocation;


        Booking.saveActiveRide(
            ride
        );


        /*
         * The pending ID has become the active ride ID.
         */

        Booking.clearPendingRideId();


        /*
         * Start Firestore listener BEFORE matching.
         */

        Booking.watchRide(
            created.rideId
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx-ride-created",
                {
                    detail: {

                        rideId:
                            created.rideId,

                        ride

                    }
                }
            )
        );


        Booking.showMessage(
            "Ride created. Nearby rider search ho rahi hai...",
            "success"
        );


        /*
         * Start matching using EXACTLY THE SAME rideId.
         */

        const matchingResult =
            await Booking.startMatching(
                ride
            );


        console.log(
            "RiderX matching result:",
            matchingResult
        );


        if (
            !matchingResult?.success
        ) {

            /*
             * Never delete the real ride merely because the
             * matching module is unavailable.
             *
             * The Firestore ride remains searchable and the
             * status page remains the source for the customer.
             */

            Booking.showMessage(
                "Ride create ho gayi hai. Rider matching service connect ho rahi hai...",
                "info"
            );

        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-booking-success",
                {
                    detail: {

                        ride,

                        rideId:
                            created.rideId,

                        matching:
                            matchingResult

                    }
                }
            )
        );


        /*
         * Open status screen only after Firestore creation
         * has been verified.
         */

        Booking.openRideStatus(
            created.rideId
        );


        return {

            success:
                true,

            ride,

            rideId:
                created.rideId,

            matching:
                matchingResult

        };

    } catch (error) {

        console.error(
            "RiderX booking failed:",
            error
        );


        /*
         * If the ride was never created, the pending ID can
         * safely be removed. If a real ride already exists,
         * keep its active state.
         */

        if (
            !Booking.state.active
        ) {

            Booking.clearPendingRideId();

        }


        Booking.showMessage(
            error?.message ||
            "Ride booking failed. Please try again.",
            "error"
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx-booking-error",
                {
                    detail: {

                        error

                    }
                }
            )
        );


        return {

            success:
                false,

            error

        };

    } finally {

        Booking.state.submitting =
            false;

        Booking.setLoading(
            false
        );

    }

};


/* ============================================================
   BUTTON HANDLER
   ============================================================ */

Booking.bindBookButtons = function () {

    const selectors = [

        "#bookRide",
        "#book-ride",
        "#confirmRide",
        "#confirm-ride",
        "#bookButton",
        "#confirmButton",
        "[data-book-ride]",
        "[data-confirm-ride]"

    ];


    const buttons =
        document.querySelectorAll(
            selectors.join(",")
        );


    buttons.forEach(
        function (button) {

            if (
                button.dataset
                    .riderxBookingBound ===
                "true"
            ) {

                return;

            }


            button.dataset
                .riderxBookingBound =
                "true";


            button.addEventListener(
                "click",
                Booking.bookRide
            );

        }
    );


    const forms =
        document.querySelectorAll(
            [
                "#bookingForm",
                "#booking-form",
                "form[data-booking-form]"
            ].join(",")
        );


    forms.forEach(
        function (form) {

            if (
                form.dataset
                    .riderxBookingBound ===
                "true"
            ) {

                return;

            }


            form.dataset
                .riderxBookingBound =
                "true";


            form.addEventListener(
                "submit",
                Booking.bookRide
            );

        }
    );


    console.log(
        "RiderX booking controls:",
        buttons.length,
        "buttons,",
        forms.length,
        "forms"
    );

};


/* ============================================================
   MATCHING EVENTS
   ============================================================ */

Booking.bindMatchingEvents = function () {

    window.addEventListener(
        "riderx-matching-riders-found",
        function (event) {

            const data =
                event.detail ||
                {};


            const riders =
                Array.isArray(
                    data.riders
                )
                    ? data.riders
                    : [];


            Booking.showMessage(
                riders.length
                    ? "Nearby riders mil gaye. Request send ho rahi hai..."
                    : "Nearby rider search ho rahi hai...",
                "info"
            );

        }
    );


    window.addEventListener(
        "riderx-matching-request-sent",
        function () {

            Booking.showMessage(
                "Rider ko ride request bhej di gayi hai.",
                "success"
            );

        }
    );


    window.addEventListener(
        "riderx-matching-rider-accepted",
        function (event) {

            console.log(
                "RiderX matching rider accepted:",
                event.detail
            );


            Booking.showMessage(
                "Rider ne ride accept kar li hai.",
                "success"
            );

        }
    );


    window.addEventListener(
        "riderx-matching-matching-timeout",
        function () {

            Booking.showMessage(
                "Abhi nearby rider available nahi hai.",
                "error"
            );

        }
    );


    window.addEventListener(
        "riderx-matching-matching-error",
        function (event) {

            console.error(
                "RiderX matching error:",
                event.detail
            );

        }
    );


    window.addEventListener(
        "riderx-matching-engine-unavailable",
        function () {

            Booking.showMessage(
                "Ride create ho gayi hai. Rider matching service connect ho rahi hai...",
                "info"
            );

        }
    );

};


/* ============================================================
   RIDE EVENTS
   ============================================================ */

Booking.bindRideEvents = function () {

    window.addEventListener(
        "riderx-ride-updated",
        function (event) {

            console.log(
                "RiderX ride updated:",
                event.detail
            );

        }
    );


    window.addEventListener(
        "riderx-ride-accepted",
        function (event) {

            console.log(
                "RiderX ride accepted:",
                event.detail
            );

        }
    );


    window.addEventListener(
        "riderx-ride-cancelled",
        function (event) {

            console.log(
                "RiderX ride cancelled:",
                event.detail
            );

        }
    );


    window.addEventListener(
        "riderx-ride-finished",
        function (event) {

            console.log(
                "RiderX ride finished:",
                event.detail
            );

        }
    );


    window.addEventListener(
        "riderx-ride-ownership-error",
        function () {

            Booking.showMessage(
                "Ride access verification failed. Please login again.",
                "error"
            );

        }
    );

};


/* ============================================================
   RESTORE ACTIVE RIDE
   ============================================================ */

Booking.restoreActiveRide = async function () {

    const user =
        Booking.getCurrentUser();


    /*
     * Never restore a ride for an unauthenticated user.
     */

    if (
        !user ||
        !user.uid
    ) {

        return null;

    }


    const database =
        Booking.getFirestore();


    if (!database) {

        return null;

    }


    let rideId =
        Booking.storageGet(
            Booking.config
                .activeRideIdStorageKey
        );


    if (!rideId) {

        const raw =
            Booking.storageGet(
                Booking.config
                    .activeRideStorageKey
            );


        if (raw) {

            try {

                const saved =
                    JSON.parse(
                        raw
                    );


                rideId =
                    saved?.rideId ||
                    null;

            } catch (error) {

                rideId =
                    null;

            }

        }

    }


    if (!rideId) {

        return null;

    }


    try {

        const rideRef =
            doc(
                database,
                Booking.config.ridesCollection,
                String(
                    rideId
                )
            );


        const snapshot =
            await getDoc(
                rideRef
            );


        if (
            !snapshot.exists()
        ) {

            Booking.clearActiveRide();

            return null;

        }


        const ride =
            snapshot.data() ||
            {};


        /*
         * IMPORTANT:
         * LocalStorage never grants access.
         * Firestore ownership is checked against Firebase Auth.
         */

        if (
            String(
                ride.customerId ||
                ""
            ) !==
            String(
                user.uid
            )
        ) {

            Booking.clearActiveRide();

            return null;

        }


        if (
            Booking.isTerminalStatus(
                ride.status
            )
        ) {

            Booking.clearActiveRide();

            return null;

        }


        Booking.state.rideId =
            String(
                rideId
            );

        Booking.state.active =
            true;

        Booking.state.authUser =
            user;

        Booking.state.pickup =
            Booking.normalizeLocation(
                ride.pickupLocation
            );

        Booking.state.destination =
            Booking.normalizeLocation(
                ride.destinationLocation
            );

        Booking.state.service =
            ride.service ||
            "bike";

        Booking.state.paymentMethod =
            ride.paymentMethod ||
            "cash";

        Booking.state.fare =
            Number(
                ride.fare ??
                ride.estimatedFare ??
                0
            );


        Booking.saveActiveRide(
            {

                rideId:
                    rideId,

                customerId:
                    ride.customerId,

                status:
                    ride.status,

                riderId:
                    ride.riderId,

                service:
                    ride.service,

                pickup:
                    ride.pickup,

                destination:
                    ride.destination

            }
        );


        Booking.watchRide(
            rideId
        );


        return ride;

    } catch (error) {

        console.warn(
            "RiderX active ride restore failed:",
            error
        );


        return null;

    }

};


/* ============================================================
   AUTH STATE LISTENER
   ============================================================ */

Booking.bindAuthState = function () {

    const firebaseAuth =
        Booking.getAuth();


    if (!firebaseAuth) {

        return;

    }


    if (
        Booking.state.authListenerBound
    ) {

        return;

    }


    Booking.state.authListenerBound =
        true;


    onAuthStateChanged(
        firebaseAuth,
        async function (user) {

            Booking.state.authUser =
                user ||
                null;


            Booking.state.authReady =
                true;


            if (
                typeof Booking.state
                    .authReadyResolve ===
                "function"
            ) {

                Booking.state
                    .authReadyResolve(
                        user ||
                        null
                    );

                Booking.state
                    .authReadyResolve =
                    null;

            }


            if (!user) {

                Booking.stopWatchingRide();

                Booking.state.rideId =
                    null;

                Booking.state.active =
                    false;

                return;

            }


            /*
             * Restore only this authenticated user's ride.
             */

            try {

                await Booking
                    .restoreActiveRide();

            } catch (error) {

                console.warn(
                    "RiderX authenticated ride restore failed:",
                    error
                );

            }

        }
    );

};


/* ============================================================
   GLOBAL API
   ============================================================ */

RX.booking =
    Booking;


RX.bookRide =
    Booking.bookRide;


RX.cancelRide =
    Booking.cancelRide;


RX.watchRide =
    Booking.watchRide;


RX.getActiveRide =
    Booking.restoreActiveRide;


RX.stopWatchingRide =
    Booking.stopWatchingRide;


/* ============================================================
   INITIALIZE
   ============================================================ */

Booking.init = async function () {

    if (
        Booking.state.initialized
    ) {

        return;

    }


    Booking.state.initialized =
        true;


    console.log(
        "=============================================="
    );

    console.log(
        "RiderX booking.js initialized."
    );

    console.log(
        "Firestore collection:",
        Booking.config.ridesCollection
    );

    console.log(
        "Firebase Auth:",
        Boolean(
            Booking.getAuth()
        )
    );

    console.log(
        "Firestore:",
        Boolean(
            Booking.getFirestore()
        )
    );

    console.log(
        "=============================================="
    );


    if (
        !Booking.isFirebaseReady()
    ) {

        console.error(
            "RiderX booking.js: shared Firebase is unavailable."
        );

        Booking.showMessage(
            "Firebase service unavailable.",
            "error"
        );

        return;

    }


    /*
     * Bind auth first so auth readiness is tracked before
     * booking/restoration is attempted.
     */

    Booking.bindAuthState();

    Booking.bindBookButtons();

    Booking.bindMatchingEvents();

    Booking.bindRideEvents();


    /*
     * Wait for Firebase Auth's first state resolution.
     */

    try {

        const user =
            await Booking.waitForAuth();


        if (user) {

            Booking.state.authUser =
                user;


            await Booking
                .restoreActiveRide();

        }

    } catch (error) {

        console.warn(
            "RiderX booking auth initialization failed:",
            error
        );

    }

};


/* ============================================================
   DOM READY
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            Booking.init();

        },
        {
            once:
                true
        }
    );

} else {

    Booking.init();

}


/* ============================================================
   DEBUG API
   ============================================================ */

window.RiderXBookingDebug = {

    getCustomerId:
        function () {

            return Booking
                .getCustomerId();

        },

    getCurrentUser:
        function () {

            return Booking
                .getCurrentUser();

        },

    getPickup:
        function () {

            return Booking
                .getPickupLocation();

        },

    getDestination:
        function () {

            return Booking
                .getDestinationLocation();

        },

    getFare:
        function () {

            return Booking
                .getFare();

        },

    getService:
        function () {

            return Booking
                .getService();

        },

    getPayment:
        function () {

            return Booking
                .getPaymentMethod();

        },

    getActiveRide:
        function () {

            return Booking
                .restoreActiveRide();

        },

    bookRide:
        function () {

            return Booking
                .bookRide();

        },

    cancelRide:
        function (
            rideId
        ) {

            return Booking
                .cancelRide(
                    rideId
                );

        },

    watchRide:
        function (
            rideId
        ) {

            return Booking
                .watchRide(
                    rideId
                );

        },

    stopWatchingRide:
        function () {

            return Booking
                .stopWatchingRide();

        },

    clearActiveRide:
        function () {

            return Booking
                .clearActiveRide();

        }

};


/* ============================================================
   END OF FILE
   ============================================================ */
