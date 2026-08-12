/* ============================================================
   RIDERX 2.0
   CUSTOMER BOOKING ENGINE
   File: js/booking.js

   FINAL RESPONSIBILITIES
   ------------------------------------------------------------
   - Use the shared RiderX Firebase instance
   - Require a real Firebase authenticated customer
   - Create exactly ONE stable rideId
   - Create rides/{rideId} before matching starts
   - Keep customer/rider on the same ride document
   - Start the existing RiderX matching engine
   - Persist active ride locally
   - Restore/watch active rides
   - Listen for Firestore ride status changes
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
    collection,
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

        defaultService:
            "bike",

        defaultPayment:
            "cash",

        redirectAfterCreate:
            true,

        rideStatusPage:
            "ride-status.html"
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

        unsubscribe:
            null,

        authUser:
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


    /*
     * Customer profile is optional.
     * Booking must still work when the customer document
     * has not been created yet.
     */

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
         * A missing/blocked customer profile must not prevent
         * a valid authenticated customer from booking.
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
   RIDE ID
   ============================================================ */

Booking.createRideId = function () {

    const random =
        Math.random()
            .toString(36)
            .slice(
                2,
                10
            );


    return (
        "ride_" +
        Date.now() +
        "_" +
        random
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

            return fare;

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

            return fare;

        }

    }


    return 0;

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
        Booking.getPaymentMethod();


    const fare =
        Booking.getFare();


    const rideId =
        Booking.createRideId();


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
     * EXACTLY ONE ride document.
     *
     * rides/{rideId}
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


    return {

        ref:
            rideRef,

        rideId:
            ride.rideId

    };

};


/* ============================================================
   MATCHING ENGINE
   ============================================================ */

Booking.startMatching = async function (
    ride
) {

    const matching =
        RX.matching;


    if (
        matching &&
        typeof matching.start === "function"
    ) {

        try {

            return await matching.start(
                {

                    rideId:
                        ride.rideId,

                    customerId:
                        ride.customerId,

                    service:
                        ride.service,

                    serviceType:
                        ride.serviceType,

                    pickup:
                        ride.pickup,

                    pickupAddress:
                        ride.pickup,

                    pickupLocation:
                        ride.pickupLocation,

                    destination:
                        ride.destination,

                    destinationAddress:
                        ride.destination,

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

        } catch (error) {

            console.error(
                "RiderX matching engine failed:",
                error
            );


            /*
             * Do NOT delete the ride.
             * Firestore remains the source of truth.
             */

            return {

                success:
                    false,

                rideId:
                    ride.rideId,

                error

            };

        }

    }


    /*
     * Matching engine may load after booking.js.
     * The Firestore ride is still valid.
     */

    console.warn(
        "RiderX matching engine is not available yet."
    );


    return {

        success:
            false,

        matching:
            false,

        rideId:
            ride.rideId,

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


    try {

        const activeRide = {

            rideId:
                ride.rideId,

            customerId:
                ride.customerId,

            status:
                ride.status,

            riderId:
                ride.riderId ||
                null,

            service:
                ride.service,

            pickup:
                ride.pickup,

            destination:
                ride.destination,

            createdAt:
                Date.now()

        };


        localStorage.setItem(
            "riderx_active_ride",
            JSON.stringify(
                activeRide
            )
        );


        localStorage.setItem(
            "riderx_active_ride_id",
            String(
                ride.rideId
            )
        );


        localStorage.setItem(
            "riderx_current_ride_id",
            String(
                ride.rideId
            )
        );


        return true;

    } catch (error) {

        console.warn(
            "RiderX active ride storage failed:",
            error
        );


        return false;

    }

};


/* ============================================================
   CLEAR ACTIVE RIDE
   ============================================================ */

Booking.clearActiveRide = function () {

    try {

        localStorage.removeItem(
            "riderx_active_ride"
        );

        localStorage.removeItem(
            "riderx_active_ride_id"
        );

        localStorage.removeItem(
            "riderx_current_ride_id"
        );

    } catch (error) {

        console.warn(
            "RiderX active ride cleanup failed:",
            error
        );

    }


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
        "expired"
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

    try {

        const current =
            JSON.parse(
                localStorage.getItem(
                    "riderx_active_ride"
                ) ||
                "{}"
            );


        const merged = {

            ...current,

            rideId,

            status:
                ride.status ||
                current.status ||
                "searching",

            riderId:
                ride.riderId ||
                current.riderId ||
                null,

            updatedAt:
                Date.now()

        };


        if (
            Booking.isTerminalStatus(
                merged.status
            )
        ) {

            Booking.clearActiveRide();

            return;

        }


        localStorage.setItem(
            "riderx_active_ride",
            JSON.stringify(
                merged
            )
        );

    } catch (error) {

        console.warn(
            "RiderX local ride update failed:",
            error
        );

    }

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


    /*
     * Remove previous listener.
     */

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
            String(
                rideId
            )
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
                        rideId
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-ride-not-found",
                            {
                                detail: {
                                    rideId
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


                Booking.state.rideId =
                    String(
                        rideId
                    );


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


                Booking.updateLocalRide(
                    String(rideId),
                    ride
                );


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-updated",
                        {
                            detail: {

                                rideId:
                                    String(
                                        rideId
                                    ),

                                ride

                            }
                        }
                    )
                );


                /*
                 * Rider accepted.
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
                                        String(
                                            rideId
                                        ),

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
                                        String(
                                            rideId
                                        ),

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
                                    String(
                                        rideId
                                    ),

                                error

                            }
                        }
                    )
                );

            }
        );


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
   UPDATE RIDE
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
        typeof update !== "object"
    ) {

        throw new Error(
            "Ride update data is invalid."
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


    await updateDoc(
        rideRef,
        {

            ...update,

            updatedAt:
                serverTimestamp(),

            updatedAtClient:
                Date.now()

        }
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
        Booking.state.rideId;


    if (!rideId) {

        try {

            rideId =
                localStorage.getItem(
                    "riderx_active_ride_id"
                );

        } catch (error) {

            rideId =
                null;

        }

    }


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


    try {

        /*
         * Read first so a customer cannot accidentally
         * cancel a ride belonging to another account.
         */

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

            Booking.clearActiveRide();

            return false;

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

            throw new Error(
                "You are not allowed to cancel this ride."
            );

        }


        if (
            Booking.isTerminalStatus(
                ride.status
            )
        ) {

            Booking.clearActiveRide();

            return true;

        }


        await Booking.updateRide(
            rideId,
            {

                status:
                    "cancelled",

                cancelledBy:
                    "customer",

                cancelledAt:
                    serverTimestamp(),

                cancelledAtClient:
                    Date.now()

            }
        );


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

        return false;

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
         * Real authenticated customer required.
         */

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


        /*
         * Build ride.
         */

        const ride =
            await Booking.buildRide();


        /*
         * IMPORTANT:
         * Firestore document is created FIRST.
         */

        await Booking.createRideInFirestore(
            ride
        );


        /*
         * Save active ride immediately.
         */

        Booking.state.rideId =
            ride.rideId;

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
         * Start Firestore listener BEFORE matching.
         */

        Booking.watchRide(
            ride.rideId
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx-ride-created",
                {
                    detail: {

                        rideId:
                            ride.rideId,

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
         * Start existing matching engine
         * with the SAME rideId.
         */

        const matchingResult =
            await Booking.startMatching(
                ride
            );


        console.log(
            "RiderX matching result:",
            matchingResult
        );


        /*
         * Keep listener active.
         */

        if (
            Booking.state.rideId ===
            ride.rideId
        ) {

            Booking.watchRide(
                ride.rideId
            );

        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-booking-success",
                {
                    detail: {

                        ride,

                        rideId:
                            ride.rideId,

                        matching:
                            matchingResult

                    }
                }
            )
        );


        /*
         * Open customer ride-status screen.
         *
         * This happens only after rides/{rideId}
         * has been successfully created and verified.
         */

        Booking.openRideStatus(
            ride.rideId
        );


        return {

            success:
                true,

            ride,

            rideId:
                ride.rideId,

            matching:
                matchingResult

        };

    } catch (error) {

        console.error(
            "RiderX booking failed:",
            error
        );


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


    let rideId =
        null;


    try {

        rideId =
            localStorage.getItem(
                "riderx_active_ride_id"
            );


        if (!rideId) {

            const raw =
                localStorage.getItem(
                    "riderx_active_ride"
                );


            if (raw) {

                const saved =
                    JSON.parse(
                        raw
                    );


                rideId =
                    saved?.rideId ||
                    null;

            }

        }

    } catch (error) {

        console.warn(
            "RiderX active ride storage restore failed:",
            error
        );

    }


    if (!rideId) {

        return null;

    }


    try {

        const database =
            Booking.getFirestore();


        if (!database) {

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


        /*
         * IMPORTANT:
         * Do not attach to another customer's ride even if
         * an old/stale rideId exists in localStorage.
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
                ride.fare ||
                ride.estimatedFare ||
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


    /*
     * Avoid registering this listener multiple times.
     */

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


            if (!user) {

                Booking.stopWatchingRide();

                Booking.state.rideId =
                    null;

                Booking.state.active =
                    false;

                return;

            }


            /*
             * Restore only this authenticated user's active ride.
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


    Booking.bindBookButtons();

    Booking.bindMatchingEvents();

    Booking.bindRideEvents();

    Booking.bindAuthState();


    /*
     * Current user may already be available immediately.
     * Auth listener will also handle later resolution.
     */

    const user =
        Booking.getCurrentUser();


    if (user) {

        Booking.state.authUser =
            user;


        await Booking
            .restoreActiveRide();

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

    stopWatchingRide:
        function () {

            return Booking
                .stopWatchingRide();

        }

};


/* ============================================================
   END OF FILE
   ============================================================ */
