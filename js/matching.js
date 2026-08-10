/* ============================================================
   RIDERX 2.0
   CUSTOMER BOOKING ENGINE
   File: js/booking.js

   PURPOSE:
   ------------------------------------------------------------
   - Create customer ride in Firestore
   - Use one stable rideId
   - Start RiderX matching engine
   - Dispatch ride to nearby riders
   - Save active ride locally
   - Listen for ride status changes
   - Support Firebase modular + existing RiderX setup

   FIRESTORE:
   ------------------------------------------------------------
   rides/{rideId}

   REQUIRED RIDE FIELDS:
   ------------------------------------------------------------
   rideId
   customerId
   riderId
   service
   serviceType
   status
   pickup
   destination
   pickupLocation
   destinationLocation
   fare
   estimatedFare
   paymentMethod
   customerName
   customerPhone
   createdAt
   updatedAt

   IMPORTANT:
   ------------------------------------------------------------
   Customer and rider MUST use the same Firestore rideId.
   ============================================================ */

"use strict";


/* ============================================================
   FIREBASE MODULAR IMPORTS
   ============================================================ */

import {
    getApps,
    getApp,
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


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

Booking.config = {

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

};


/* ============================================================
   STATE
   ============================================================ */

Booking.state = {

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

};


/* ============================================================
   FIREBASE APP
   ============================================================ */

Booking.getFirebaseApp = function () {

    try {

        const apps =
            getApps();

        if (
            apps &&
            apps.length
        ) {

            return getApp();

        }

        /*
         * Normally firebase-config.js should
         * initialize the Firebase app before this file.
         */

        console.error(
            "RiderX: Firebase app is not initialized. " +
            "Load firebase/firebase-config.js before booking.js."
        );

        return null;

    } catch (error) {

        console.error(
            "RiderX Firebase app error:",
            error
        );

        return null;
    }

};


/* ============================================================
   FIRESTORE
   ============================================================ */

Booking.getFirestore = function () {

    try {

        const app =
            Booking.getFirebaseApp();

        if (!app) {

            return null;
        }

        return getFirestore(
            app
        );

    } catch (error) {

        console.error(
            "RiderX Firestore initialization failed:",
            error
        );

        return null;
    }

};


/* ============================================================
   AUTH
   ============================================================ */

Booking.getAuth = function () {

    try {

        const app =
            Booking.getFirebaseApp();

        if (!app) {

            return null;
        }

        return getAuth(
            app
        );

    } catch (error) {

        console.error(
            "RiderX Auth initialization failed:",
            error
        );

        return null;
    }

};


/* ============================================================
   AUTH USER
   ============================================================ */

Booking.getCurrentUser = function () {

    try {

        const auth =
            Booking.getAuth();

        if (
            auth &&
            auth.currentUser
        ) {

            return auth.currentUser;
        }

    } catch (error) {

        console.warn(
            "RiderX auth user lookup failed:",
            error
        );
    }


    /*
     * RiderX saved user fallback.
     */

    const storageKeys = [

        "riderx_user",
        "riderx_customer",
        "riderxUser",
        "riderxCustomer"

    ];


    for (
        const key of storageKeys
    ) {

        try {

            const raw =
                localStorage.getItem(
                    key
                );

            if (!raw) {

                continue;
            }


            const user =
                JSON.parse(
                    raw
                );

            if (user) {

                return user;
            }

        } catch (error) {

            console.warn(
                "RiderX saved user parse failed:",
                key,
                error
            );

        }

    }


    return null;

};


/* ============================================================
   CUSTOMER ID
   ============================================================ */

Booking.getCustomerId = function () {

    const user =
        Booking.getCurrentUser();


    if (user) {

        return (
            user.uid ||
            user.id ||
            user.userId ||
            user.customerId ||
            null
        );

    }


    return (
        localStorage.getItem(
            "riderx_uid"
        ) ||
        localStorage.getItem(
            "riderx_customer_id"
        ) ||
        null
    );

};


/* ============================================================
   CUSTOMER PROFILE
   ============================================================ */

Booking.getCustomerProfile = async function () {

    const user =
        Booking.getCurrentUser();

    const customerId =
        Booking.getCustomerId();


    let profile = {

        name:
            "",

        phone:
            "",

        email:
            ""

    };


    if (user) {

        profile.name =
            user.displayName ||
            user.name ||
            user.fullName ||
            user.username ||
            "";

        profile.phone =
            user.phoneNumber ||
            user.phone ||
            "";

        profile.email =
            user.email ||
            "";

    }


    /*
     * Try Firestore customer document.
     */

    if (
        customerId
    ) {

        try {

            const db =
                Booking.getFirestore();

            if (db) {

                const customerRef =
                    doc(
                        db,
                        Booking.config
                            .customersCollection,
                        String(
                            customerId
                        )
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

            }

        } catch (error) {

            console.warn(
                "RiderX customer profile lookup failed:",
                error
            );

        }

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
        typeof ids ===
        "string"
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
   GET VALUE
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
   SET MESSAGE
   ============================================================ */

Booking.showMessage = function (
    message,
    type
) {

    const element =
        Booking.findElement([
            "message",
            "booking-message",
            "bookingMessage",
            "status-message",
            "statusMessage",
            "error-message",
            "errorMessage"
        ]);


    if (element) {

        element.textContent =
            message || "";

        element.style.display =
            message
                ? "block"
                : "";

        element.dataset.type =
            type ||
            "info";

    }


    console.log(
        "RiderX Booking:",
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
   GENERATE RIDE ID
   ============================================================ */

Booking.createRideId = function () {

    return (

        "ride_" +

        Date.now() +

        "_" +

        Math.random()
            .toString(36)
            .slice(
                2,
                10
            )

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


    /*
     * Leaflet LatLng.
     */

    if (
        Number.isFinite(
            Number(
                location.lat
            )
        ) &&
        Number.isFinite(
            Number(
                location.lng
            )
        )
    ) {

        return {

            lat:
                Number(
                    location.lat
                ),

            lng:
                Number(
                    location.lng
                )

        };

    }


    if (
        Number.isFinite(
            Number(
                location.latitude
            )
        ) &&
        Number.isFinite(
            Number(
                location.longitude
            )
        )
    ) {

        return {

            lat:
                Number(
                    location.latitude
                ),

            lng:
                Number(
                    location.longitude
                )

        };

    }


    return null;

};


/* ============================================================
   GET PICKUP LOCATION
   ============================================================ */

Booking.getPickupLocation = function () {

    /*
     * Existing RiderX booking state.
     */

    if (
        RX.booking &&
        RX.booking.state &&
        RX.booking.state.pickup
    ) {

        const location =
            Booking.normalizeLocation(
                RX.booking.state.pickup
            );


        if (location) {

            return location;
        }

    }


    /*
     * Common global variables.
     */

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


    /*
     * Dataset / hidden fields.
     */

    const lat =
        Number(
            Booking.getValue([
                "pickupLat",
                "pickup-lat",
                "pickupLatitude"
            ])
        );


    const lng =
        Number(
            Booking.getValue([
                "pickupLng",
                "pickup-lng",
                "pickupLongitude"
            ])
        );


    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
    ) {

        return {

            lat:
                lat,

            lng:
                lng

        };

    }


    return null;

};


/* ============================================================
   GET DESTINATION LOCATION
   ============================================================ */

Booking.getDestinationLocation = function () {

    if (
        RX.booking &&
        RX.booking.state &&
        RX.booking.state.destination
    ) {

        const location =
            Booking.normalizeLocation(
                RX.booking.state.destination
            );


        if (location) {

            return location;
        }

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
            Booking.getValue([
                "dropLat",
                "drop-lat",
                "dropLatitude",
                "destinationLat",
                "destination-lat"
            ])
        );


    const lng =
        Number(
            Booking.getValue([
                "dropLng",
                "drop-lng",
                "dropLongitude",
                "destinationLng",
                "destination-lng"
            ])
        );


    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
    ) {

        return {

            lat:
                lat,

            lng:
                lng

        };

    }


    return null;

};


/* ============================================================
   GET PICKUP ADDRESS
   ============================================================ */

Booking.getPickupAddress = function () {

    return Booking.getValue([

        "pickup",
        "pickupAddress",
        "pickup-address",
        "pickupLocationText",
        "pickup-location",
        "from",
        "fromAddress"

    ]);

};


/* ============================================================
   GET DESTINATION ADDRESS
   ============================================================ */

Booking.getDestinationAddress = function () {

    return Booking.getValue([

        "drop",
        "dropAddress",
        "drop-address",
        "destination",
        "destinationAddress",
        "destination-address",
        "to",
        "toAddress"

    ]);

};


/* ============================================================
   GET SERVICE
   ============================================================ */

Booking.getService = function () {

    const value =
        Booking.getValue([

            "service",
            "serviceType",
            "service-type",
            "rideType",
            "ride-type",
            "selectedService"

        ]);


    if (value) {

        return value
            .toLowerCase()
            .trim();

    }


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

        return (

            selected.value ||

            selected.dataset
                ?.service ||

            selected.dataset
                ?.serviceType ||

            Booking.config
                .defaultService

        )
        .toString()
        .toLowerCase()
        .trim();

    }


    return Booking.config
        .defaultService;

};


/* ============================================================
   NORMALIZE SERVICE
   ============================================================ */

Booking.normalizeService = function (
    service
) {

    service =
        String(
            service ||
            "bike"
        )
        .toLowerCase()
        .trim();


    if (
        service.includes(
            "cab"
        ) ||
        service.includes(
            "car"
        ) ||
        service.includes(
            "taxi"
        )
    ) {

        return "cab";
    }


    if (
        service.includes(
            "parcel"
        ) ||
        service.includes(
            "delivery"
        )
    ) {

        return "parcel";
    }


    if (
        service.includes(
            "food"
        )
    ) {

        return "food";
    }


    return "bike";

};


/* ============================================================
   GET PAYMENT METHOD
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

        return String(
            checked.value ||
            ""
        )
        .toLowerCase()
        .trim();

    }


    const value =
        Booking.getValue([

            "paymentMethod",
            "payment-method",
            "payment",
            "selectedPayment"

        ]);


    return (
        value ||
        Booking.config
            .defaultPayment
    )
    .toLowerCase()
    .trim();

};


/* ============================================================
   GET FARE
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
        Booking.findElement([

            "fare",
            "estimatedFare",
            "estimated-fare",
            "fareAmount",
            "totalFare",
            "total-fare"

        ]);


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
            Number.isFinite(fare)
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


    if (
        !pickupAddress
    ) {

        return {

            valid:
                false,

            message:
                "Please select pickup location."

        };

    }


    if (
        !destinationAddress
    ) {

        return {

            valid:
                false,

            message:
                "Please select destination."

        };

    }


    if (
        !pickupLocation
    ) {

        return {

            valid:
                false,

            message:
                "Pickup GPS location is missing."

        };

    }


    if (
        !destinationLocation
    ) {

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

        pickupAddress:
            pickupAddress,

        destinationAddress:
            destinationAddress,

        pickupLocation:
            pickupLocation,

        destinationLocation:
            destinationLocation

    };

};


/* ============================================================
   BUILD RIDE
   ============================================================ */

Booking.buildRide = async function () {

    const validation =
        Booking.validate();


    if (
        !validation.valid
    ) {

        throw new Error(
            validation.message
        );

    }


    const customerId =
        Booking.getCustomerId();


    if (!customerId) {

        throw new Error(
            "Customer login required."
        );

    }


    const profile =
        await Booking
            .getCustomerProfile();


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


    const now =
        Date.now();


    return {

        rideId:
            rideId,

        customerId:
            String(
                customerId
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

        service:
            service,

        serviceType:
            service,

        status:
            "searching",

        pickup:
            validation
                .pickupAddress,

        destination:
            validation
                .destinationAddress,

        pickupAddress:
            validation
                .pickupAddress,

        destinationAddress:
            validation
                .destinationAddress,

        pickupLocation:
            validation
                .pickupLocation,

        destinationLocation:
            validation
                .destinationLocation,

        fare:
            fare,

        estimatedFare:
            fare,

        paymentMethod:
            paymentMethod,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp(),

        matchingStartedAt:
            serverTimestamp(),

        createdAtClient:
            now,

        updatedAtClient:
            now

    };

};


/* ============================================================
   CREATE RIDE DIRECTLY IN FIRESTORE
   ============================================================ */

Booking.createRideInFirestore = async function (
    ride
) {

    const db =
        Booking.getFirestore();


    if (!db) {

        throw new Error(
            "Firestore is not available. Check firebase-config.js."
        );

    }


    const rideRef =
        doc(
            db,
            Booking.config
                .ridesCollection,
            ride.rideId
        );


    /*
     * IMPORTANT:
     * setDoc guarantees the exact rideId is used.
     */

    await setDoc(
        rideRef,
        ride,
        {
            merge:
                false
        }
    );


    /*
     * Verify write.
     */

    const verification =
        await getDoc(
            rideRef
        );


    if (
        !verification.exists()
    ) {

        throw new Error(
            "Ride write returned but Firestore document was not found."
        );

    }


    console.log(
        "RiderX FIRESTORE RIDE CREATED:",
        ride.rideId
    );


    return {

        ref:
            rideRef,

        rideId:
            ride.rideId

    };

};


/* ============================================================
   START MATCHING ENGINE
   ============================================================ */

Booking.startMatching = async function (
    ride
) {

    /*
     * Matching engine is the preferred dispatcher.
     */

    const matching =
        RX.matching;


    if (
        matching &&
        typeof matching.start ===
        "function"
    ) {

        try {

            const result =
                await matching.start({

                    rideId:
                        ride.rideId,

                    customerId:
                        ride.customerId,

                    service:
                        ride.service,

                    serviceType:
                        ride.serviceType,

                    pickupAddress:
                        ride.pickup,

                    pickup:
                        ride.pickup,

                    pickupLocation:
                        ride.pickupLocation,

                    destinationAddress:
                        ride.destination,

                    destination:
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

                });


            console.log(
                "RiderX matching started:",
                result
            );


            return result;

        } catch (error) {

            console.error(
                "RiderX matching engine failed:",
                error
            );


            /*
             * Important:
             * Do not silently erase the Firestore ride.
             * The ride is already safely created.
             */

            return {

                success:
                    false,

                error:
                    error,

                ride:
                    ride,

                rideId:
                    ride.rideId

            };

        }

    }


    console.warn(
        "RiderX matching engine is not loaded. " +
        "Ride remains available in Firestore."
    );


    return {

        success:
            true,

        matching:
            false,

        ride:
            ride,

        rideId:
            ride.rideId

    };

};


/* ============================================================
   SAVE ACTIVE RIDE
   ============================================================ */

Booking.saveActiveRide = function (
    ride
) {

    try {

        localStorage.setItem(
            "riderx_active_ride",
            JSON.stringify({

                rideId:
                    ride.rideId,

                customerId:
                    ride.customerId,

                status:
                    ride.status,

                service:
                    ride.service,

                pickup:
                    ride.pickup,

                destination:
                    ride.destination,

                createdAt:
                    Date.now()

            })
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

    } catch (error) {

        console.warn(
            "RiderX active ride localStorage failed:",
            error
        );

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
            "RiderX active ride clear failed:",
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

    if (
        typeof Booking.state
            .unsubscribe ===
        "function"
    ) {

        try {

            Booking.state
                .unsubscribe();

        } catch (error) {

            console.warn(
                "RiderX old ride listener cleanup failed:",
                error
            );

        }

    }


    const db =
        Booking.getFirestore();


    if (!db) {

        console.warn(
            "RiderX cannot watch ride: Firestore unavailable."
        );

        return null;

    }


    const rideRef =
        doc(
            db,
            Booking.config
                .ridesCollection,
            String(
                rideId
            )
        );


    Booking.state.unsubscribe =
        onSnapshot(
            rideRef,
            function (snapshot) {

                if (
                    !snapshot.exists()
                ) {

                    console.warn(
                        "RiderX ride document disappeared:",
                        rideId
                    );

                    return;
                }


                const ride =
                    snapshot.data() ||
                    {};


                Booking.state.active =
                    ![
                        "completed",
                        "cancelled",
                        "no_driver"
                    ].includes(
                        String(
                            ride.status ||
                            ""
                        ).toLowerCase()
                    );


                /*
                 * Keep local active ride updated.
                 */

                try {

                    const saved =
                        JSON.parse(
                            localStorage.getItem(
                                "riderx_active_ride"
                            ) ||
                            "{}"
                        );


                    localStorage.setItem(
                        "riderx_active_ride",
                        JSON.stringify({

                            ...saved,

                            rideId:
                                rideId,

                            status:
                                ride.status ||
                                "searching",

                            riderId:
                                ride.riderId ||
                                null,

                            updatedAt:
                                Date.now()

                        })
                    );

                } catch (error) {

                    console.warn(
                        "RiderX ride local state update failed:",
                        error
                    );

                }


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-updated",
                        {
                            detail: {

                                rideId:
                                    rideId,

                                ride:
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
                        "in_progress"
                    ].includes(
                        String(
                            ride.status ||
                            ""
                        ).toLowerCase()
                    )
                ) {

                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx-ride-accepted",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    riderId:
                                        ride.riderId,

                                    ride:
                                        ride

                                }
                            }
                        )
                    );

                }


                /*
                 * Ride completed/cancelled.
                 */

                if (
                    [
                        "completed",
                        "cancelled",
                        "no_driver"
                    ].includes(
                        String(
                            ride.status ||
                            ""
                        ).toLowerCase()
                    )
                ) {

                    Booking.state.active =
                        false;

                }

            },
            function (error) {

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
                                    rideId,

                                error:
                                    error

                            }
                        }
                    )
                );

            }
        );


    return Booking.state.unsubscribe;

};


/* ============================================================
   UPDATE RIDE
   ============================================================ */

Booking.updateRide = async function (
    rideId,
    update
) {

    const db =
        Booking.getFirestore();


    if (!db) {

        throw new Error(
            "Firestore unavailable."
        );

    }


    const rideRef =
        doc(
            db,
            Booking.config
                .ridesCollection,
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
        Booking.state.rideId ||
        localStorage.getItem(
            "riderx_active_ride_id"
        );


    if (!rideId) {

        return false;
    }


    try {

        await Booking.updateRide(
            rideId,
            {

                status:
                    "cancelled",

                cancelledAt:
                    serverTimestamp(),

                cancelledAtClient:
                    Date.now()

            }
        );


        Booking.clearActiveRide();


        if (
            RX.matching &&
            typeof RX.matching.cancel ===
            "function"
        ) {

            try {

                await RX.matching.cancel();

            } catch (error) {

                console.warn(
                    "RiderX matching cancellation failed:",
                    error
                );

            }

        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-ride-cancelled",
                {
                    detail: {

                        rideId:
                            rideId

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

        return;
    }


    /*
     * Current page:
     * customer/booking.html
     *
     * Target:
     * customer/ride-status.html
     */

    const currentPath =
        String(
            window.location.pathname ||
            ""
        );


    let target =
        Booking.config
            .rideStatusPage;


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
            rideId
        );


    /*
     * Only redirect when explicitly enabled.
     */

    if (
        Booking.config
            .redirectAfterCreate
    ) {

        window.location.href =
            url;

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


    /*
     * Prevent double booking.
     */

    if (
        Booking.state.submitting
    ) {

        console.warn(
            "RiderX booking already in progress."
        );

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
         * Validate Firebase first.
         */

        const db =
            Booking.getFirestore();


        if (!db) {

            throw new Error(
                "Firebase/Firestore load nahi hua. " +
                "firebase/firebase-config.js check karo."
            );

        }


        /*
         * Validate customer.
         */

        const customerId =
            Booking.getCustomerId();


        if (!customerId) {

            throw new Error(
                "Customer login required. Please login again."
            );

        }


        /*
         * Build complete ride object.
         */

        const ride =
            await Booking.buildRide();


        console.log(
            "RiderX ride prepared:",
            ride
        );


        /*
         * --------------------------------------------------------
         * STEP 1
         * CREATE RIDE DIRECTLY IN FIRESTORE.
         *
         * This guarantees:
         *
         * rides/{rideId}
         *
         * exists BEFORE matching starts.
         * --------------------------------------------------------
         */

        await Booking
            .createRideInFirestore(
                ride
            );


        /*
         * Save local active ride immediately.
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
         * Start listener BEFORE matching.
         */

        Booking.watchRide(
            ride.rideId
        );


        /*
         * Tell UI that Firestore ride exists.
         */

        window.dispatchEvent(
            new CustomEvent(
                "riderx-ride-created",
                {
                    detail: {

                        rideId:
                            ride.rideId,

                        ride:
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
         * --------------------------------------------------------
         * STEP 2
         * START MATCHING ENGINE.
         *
         * matching.js may already create a ride itself.
         * We pass the SAME rideId so both customer and
         * rider side use the same Firestore document.
         * --------------------------------------------------------
         */

        const matchingResult =
            await Booking
                .startMatching(
                    ride
                );


        /*
         * If matching.js returns the same ride,
         * continue normally.
         */

        console.log(
            "RiderX matching result:",
            matchingResult
        );


        /*
         * Important:
         * Matching engine may update the ride.
         * Keep customer listening.
         */

        Booking.watchRide(
            ride.rideId
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx-booking-success",
                {
                    detail: {

                        ride:
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
         * Redirect only after Firestore document
         * has definitely been created.
         */

        Booking.openRideStatus(
            ride.rideId
        );


        return {

            success:
                true,

            ride:
                ride,

            rideId:
                ride.rideId,

            matching:
                matchingResult

        };

    } catch (error) {

        console.error(
            "================================================",
            "\nRIDERX BOOKING FAILED",
            "\n================================================",
            error
        );


        console.error(
            "Error code:",
            error?.code
        );


        console.error(
            "Error message:",
            error?.message
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

                        error:
                            error

                    }
                }
            )
        );


        return {

            success:
                false,

            error:
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


    /*
     * Forms.
     */

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


            console.log(
                "RiderX nearby riders:",
                data.riders || []
            );


            Booking.showMessage(
                (
                    data.riders &&
                    data.riders.length
                )
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

            const data =
                event.detail ||
                {};


            console.log(
                "RiderX rider accepted:",
                data
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

            const data =
                event.detail ||
                {};


            console.log(
                "RiderX ride updated:",
                data
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

};


/* ============================================================
   AUTO RESTORE ACTIVE RIDE
   ============================================================ */

Booking.restoreActiveRide = async function () {

    let rideId =
        null;


    try {

        rideId =
            localStorage.getItem(
                "riderx_active_ride_id"
            );


        if (!rideId) {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_active_ride"
                    ) ||
                    "null"
                );


            rideId =
                saved?.rideId ||
                null;

        }

    } catch (error) {

        console.warn(
            "RiderX active ride restore failed:",
            error
        );

    }


    if (!rideId) {

        return null;
    }


    try {

        const db =
            Booking.getFirestore();


        if (!db) {

            return null;
        }


        const rideRef =
            doc(
                db,
                Booking.config
                    .ridesCollection,
                rideId
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


        const status =
            String(
                ride.status ||
                ""
            )
            .toLowerCase();


        if (
            [
                "completed",
                "cancelled",
                "no_driver"
            ].includes(
                status
            )
        ) {

            Booking.clearActiveRide();

            return null;

        }


        Booking.state.rideId =
            rideId;

        Booking.state.active =
            true;


        Booking.watchRide(
            rideId
        );


        return ride;

    } catch (error) {

        console.warn(
            "RiderX active ride restore Firestore lookup failed:",
            error
        );


        return null;
    }

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
        "RiderX booking.js loaded."
    );

    console.log(
        "Firestore rides collection:",
        Booking.config
            .ridesCollection
    );

    console.log(
        "=============================================="
    );


    Booking.bindBookButtons();

    Booking.bindMatchingEvents();

    Booking.bindRideEvents();


    /*
     * Restore current authenticated user.
     */

    try {

        const auth =
            Booking.getAuth();


        if (auth) {

            onAuthStateChanged(
                auth,
                function (user) {

                    Booking.state.authUser =
                        user ||
                        null;


                    if (user) {

                        console.log(
                            "RiderX customer auth:",
                            user.uid
                        );

                    }

                }
            );

        }

    } catch (error) {

        console.warn(
            "RiderX auth listener failed:",
            error
        );

    }


    /*
     * Restore existing ride.
     */

    await Booking
        .restoreActiveRide();

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

        }
    );

} else {

    Booking.init();

}


/* ============================================================
   DEBUG HELPER
   ============================================================ */

window.RiderXBookingDebug = {

    getCustomerId:
        function () {

            return Booking
                .getCustomerId();

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

        }

};


/* ============================================================
   END OF FILE
   ============================================================ */
