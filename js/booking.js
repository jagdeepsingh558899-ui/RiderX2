/* ============================================================
   RIDERX 2.0
   BOOKING ENGINE
   File: js/booking.js

   FINAL CUSTOMER BOOKING ENGINE

   Handles:
   - Customer booking
   - Pickup / destination
   - Service selection
   - Fare calculation
   - Payment method
   - Coupon
   - Firebase RTDB ride creation
   - Firestore ride mirror
   - Customer ride index
   - Realtime ride status
   - Active ride restore
   - Ride cancellation
   - Global RiderXBookingAPI

   IMPORTANT:
   Firebase is initialized ONLY inside:
       ../firebase/firebase-config.js

   This file DOES NOT initialize Firebase again.
   ============================================================ */

import {
    auth,
    db,
    realtimeDb,
    ref,
    set,
    get,
    update,
    onValue,
    off,
    doc,
    setDoc
} from "../firebase/firebase-config.js";


/* ============================================================
   GLOBAL RIDERX NAMESPACE
   ============================================================ */

const RX = window.RiderX = window.RiderX || {};

const BOOKING = RX.booking = RX.booking || {};


/* ============================================================
   CONFIG
   ============================================================ */

BOOKING.config = {

    city: "Chandigarh",

    currency: "₹",

    defaultService: "bike",

    defaultPayment: "cash",

    requestTimeout: 120000,

    services: {

        bike: {
            id: "bike",
            name: "Bike Taxi",
            icon: "🏍️",
            baseFare: 30,
            perKm: 8,
            minimumFare: 30
        },

        cab: {
            id: "cab",
            name: "Cab",
            icon: "🚕",
            baseFare: 60,
            perKm: 12,
            minimumFare: 60
        },

        parcel: {
            id: "parcel",
            name: "Parcel",
            icon: "📦",
            baseFare: 40,
            perKm: 10,
            minimumFare: 40
        },

        food: {
            id: "food",
            name: "Food Delivery",
            icon: "🍔",
            baseFare: 35,
            perKm: 9,
            minimumFare: 35
        }

    }

};


/* ============================================================
   STATE
   ============================================================ */

BOOKING.state = BOOKING.state || {

    initialized: false,

    loading: false,

    booking: null,

    pickup: null,

    destination: null,

    distanceKm: 0,

    durationMinutes: 0,

    service: "bike",

    paymentMethod: "cash",

    coupon: null,

    discount: 0,

    fare: 0,

    estimatedFare: 0,

    rideStatus: "idle",

    matching: false,

    bookingListener: null,

    bookingListenerRef: null,

    uiBound: false

};


/* ============================================================
   FIREBASE HELPERS
   ============================================================ */

BOOKING.database = function () {

    return realtimeDb || null;

};


BOOKING.firestore = function () {

    return db || null;

};


BOOKING.getAuth = function () {

    return auth || null;

};


/* ============================================================
   BASIC HELPERS
   ============================================================ */

BOOKING.number = function (value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;

};


BOOKING.round = function (value) {

    return Math.round(
        BOOKING.number(value)
    );

};


BOOKING.now = function () {

    return Date.now();

};


BOOKING.id = function () {

    return (
        "RX-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    ).toUpperCase();

};


/* ============================================================
   USER
   ============================================================ */

BOOKING.getUser = function () {

    let savedUser = null;

    try {

        savedUser = JSON.parse(
            localStorage.getItem(
                "riderx_user"
            ) || "null"
        );

    } catch (error) {

        savedUser = null;

    }


    const firebaseUser =
        auth?.currentUser || null;


    if (firebaseUser) {

        return {

            ...(savedUser || {}),

            uid: firebaseUser.uid,

            id: firebaseUser.uid,

            userId: firebaseUser.uid,

            email:
                firebaseUser.email ||
                savedUser?.email ||
                "",

            phone:
                firebaseUser.phoneNumber ||
                savedUser?.phone ||
                savedUser?.phoneNumber ||
                "",

            phoneNumber:
                firebaseUser.phoneNumber ||
                savedUser?.phoneNumber ||
                savedUser?.phone ||
                "",

            name:
                firebaseUser.displayName ||
                savedUser?.name ||
                savedUser?.displayName ||
                "Customer",

            displayName:
                firebaseUser.displayName ||
                savedUser?.displayName ||
                savedUser?.name ||
                "Customer"

        };

    }


    return savedUser;

};


BOOKING.getUid = function () {

    const user =
        BOOKING.getUser();

    return (
        user?.uid ||
        user?.id ||
        user?.userId ||
        null
    );

};


/* ============================================================
   SERVICE
   ============================================================ */

BOOKING.getService = function (service) {

    let value = String(
        service ||
        BOOKING.state.service ||
        "bike"
    )
        .toLowerCase()
        .trim();


    const aliases = {

        "bike taxi": "bike",
        "bike_taxi": "bike",
        "motorcycle": "bike",
        "motorbike": "bike",

        "car": "cab",
        "taxi": "cab",

        "delivery": "parcel"

    };


    value =
        aliases[value] ||
        value;


    return (
        BOOKING.config.services[value] ||
        BOOKING.config.services.bike
    );

};


BOOKING.setService = function (service) {

    const selected =
        BOOKING.getService(service);


    BOOKING.state.service =
        selected.id;


    if (document.body) {

        document.body.dataset.service =
            selected.id;

    }


    document
        .querySelectorAll(
            "[data-service]"
        )
        .forEach(function (element) {

            const value =
                String(
                    element.dataset.service ||
                    ""
                )
                .toLowerCase()
                .trim();


            const normalized =
                BOOKING.getService(
                    value
                ).id;


            element.classList.toggle(
                "active",
                normalized === selected.id
            );


            element.setAttribute(
                "aria-selected",
                normalized === selected.id
            );

        });


    BOOKING.updateFare();


    BOOKING.emit(
        "service-changed",
        {
            service: selected
        }
    );


    return selected;

};


/* ============================================================
   PAYMENT
   ============================================================ */

BOOKING.setPaymentMethod = function (method) {

    let value =
        String(
            method ||
            "cash"
        )
        .toLowerCase()
        .trim();


    const allowed = [
        "cash",
        "online",
        "wallet",
        "upi"
    ];


    if (!allowed.includes(value)) {

        value = "cash";

    }


    BOOKING.state.paymentMethod =
        value;


    document
        .querySelectorAll(
            "[data-payment-method]"
        )
        .forEach(function (element) {

            const item =
                String(
                    element.dataset.paymentMethod ||
                    ""
                )
                .toLowerCase()
                .trim();


            element.classList.toggle(
                "active",
                item === value
            );

        });


    BOOKING.emit(
        "payment-method-changed",
        {
            method: value
        }
    );


    return value;

};


/* ============================================================
   LOCATION NORMALIZER
   ============================================================ */

BOOKING.normalizeLocation = function (
    location,
    fallbackName
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
            location.lon ??
            location.longitude
        );


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return null;

    }


    const address =
        location.address ||
        location.name ||
        fallbackName;


    return {

        lat: lat,

        lng: lng,

        address: address,

        name:
            location.name ||
            address

    };

};


/* ============================================================
   PICKUP
   ============================================================ */

BOOKING.setPickup = function (location) {

    const normalized =
        BOOKING.normalizeLocation(
            location,
            "Pickup location"
        );


    if (!normalized) {

        return null;

    }


    BOOKING.state.pickup =
        normalized;


    BOOKING.updateLocationUI();

    BOOKING.updateFare();


    BOOKING.emit(
        "pickup-changed",
        {
            pickup: normalized
        }
    );


    return normalized;

};


/* ============================================================
   DESTINATION
   ============================================================ */

BOOKING.setDestination = function (location) {

    const normalized =
        BOOKING.normalizeLocation(
            location,
            "Destination"
        );


    if (!normalized) {

        return null;

    }


    BOOKING.state.destination =
        normalized;


    BOOKING.updateLocationUI();

    BOOKING.updateFare();


    BOOKING.emit(
        "destination-changed",
        {
            destination: normalized
        }
    );


    return normalized;

};


/* ============================================================
   PUBLIC LOCATION FUNCTIONS
   ============================================================ */

export function setPickupLocation(
    lat,
    lng,
    address = ""
) {

    return BOOKING.setPickup({

        lat: lat,

        lng: lng,

        address:
            address ||
            "Pickup location"

    });

}


export function setDropLocation(
    lat,
    lng,
    address = ""
) {

    return BOOKING.setDestination({

        lat: lat,

        lng: lng,

        address:
            address ||
            "Destination"

    });

}


/* ============================================================
   CLEAR LOCATIONS
   ============================================================ */

BOOKING.clearLocations = function () {

    BOOKING.state.pickup = null;

    BOOKING.state.destination = null;

    BOOKING.state.distanceKm = 0;

    BOOKING.state.durationMinutes = 0;


    BOOKING.updateLocationUI();

    BOOKING.updateFare();

};


/* ============================================================
   LOCATION UI
   ============================================================ */

BOOKING.updateLocationUI = function () {

    const pickup =
        BOOKING.state.pickup;

    const destination =
        BOOKING.state.destination;


    document
        .querySelectorAll(
            "[data-pickup-address]"
        )
        .forEach(function (element) {

            element.textContent =
                pickup?.address ||
                "Choose pickup location";

        });


    document
        .querySelectorAll(
            "[data-destination-address]"
        )
        .forEach(function (element) {

            element.textContent =
                destination?.address ||
                "Choose destination";

        });


    const pickupInput =
        document.querySelector(
            "#pickup"
        ) ||
        document.querySelector(
            "#pickupInput"
        );


    if (
        pickupInput &&
        pickup
    ) {

        pickupInput.value =
            pickup.address;

    }


    const dropInput =
        document.querySelector(
            "#destination"
        ) ||
        document.querySelector(
            "#dropInput"
        );


    if (
        dropInput &&
        destination
    ) {

        dropInput.value =
            destination.address;

    }

};


/* ============================================================
   DISTANCE
   ============================================================ */

BOOKING.calculateDistance = function (
    pickup,
    destination
) {

    if (
        !pickup ||
        !destination
    ) {

        return 0;

    }


    const lat1 =
        Number(pickup.lat);

    const lon1 =
        Number(pickup.lng);

    const lat2 =
        Number(destination.lat);

    const lon2 =
        Number(destination.lng);


    if (
        !Number.isFinite(lat1) ||
        !Number.isFinite(lon1) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lon2)
    ) {

        return 0;

    }


    const R = 6371;


    const dLat =
        (
            lat2 - lat1
        ) *
        Math.PI /
        180;


    const dLon =
        (
            lon2 - lon1
        ) *
        Math.PI /
        180;


    const a =
        Math.sin(dLat / 2) ** 2 +

        Math.cos(
            lat1 * Math.PI / 180
        ) *

        Math.cos(
            lat2 * Math.PI / 180
        ) *

        Math.sin(dLon / 2) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

};


/* ============================================================
   FARE
   ============================================================ */

BOOKING.calculateFare = function (
    distanceKm,
    service
) {

    const distance =
        Math.max(
            0,
            BOOKING.number(
                distanceKm
            )
        );


    const selected =
        BOOKING.getService(
            service
        );


    if (distance <= 0) {

        return selected.minimumFare;

    }


    const hour =
        new Date().getHours();


    let fare = 0;


    /*
       BIKE TAXI

       06:00 - 22:00

       Up to 10 km:
           ₹8/km

       Above 10 km:
           first 10 km ₹8/km
           remaining ₹9/km

       22:00 - 06:00:
           ₹11/km
    */

    if (
        selected.id === "bike"
    ) {

        if (
            hour >= 22 ||
            hour < 6
        ) {

            fare =
                selected.baseFare +
                (
                    distance * 11
                );

        } else if (
            distance > 10
        ) {

            fare =
                selected.baseFare +

                (
                    10 * 8
                ) +

                (
                    (distance - 10) * 9
                );

        } else {

            fare =
                selected.baseFare +
                (
                    distance * 8
                );

        }

    } else {

        fare =
            selected.baseFare +
            (
                distance *
                selected.perKm
            );

    }


    return Math.max(
        selected.minimumFare,
        BOOKING.round(fare)
    );

};


/* ============================================================
   UPDATE FARE
   ============================================================ */

BOOKING.updateFare = function () {

    const distance =
        BOOKING.number(
            BOOKING.state.distanceKm
        );


    const baseFare =
        BOOKING.calculateFare(
            distance,
            BOOKING.state.service
        );


    const discount =
        Math.min(
            baseFare,
            BOOKING.number(
                BOOKING.state.discount
            )
        );


    const total =
        Math.max(
            0,
            baseFare - discount
        );


    BOOKING.state.estimatedFare =
        BOOKING.round(baseFare);


    BOOKING.state.fare =
        BOOKING.round(total);


    document
        .querySelectorAll(
            "[data-fare]"
        )
        .forEach(function (element) {

            element.textContent =
                "₹" +
                BOOKING.state.fare;

        });


    document
        .querySelectorAll(
            "[data-estimated-fare]"
        )
        .forEach(function (element) {

            element.textContent =
                "₹" +
                BOOKING.state.estimatedFare;

        });


    document
        .querySelectorAll(
            "[data-discount]"
        )
        .forEach(function (element) {

            element.textContent =
                "₹" +
                discount;

        });


    document
        .querySelectorAll(
            "[data-distance]"
        )
        .forEach(function (element) {

            element.textContent =
                distance.toFixed(1) +
                " km";

        });


    document
        .querySelectorAll(
            "[data-duration]"
        )
        .forEach(function (element) {

            element.textContent =
                Math.round(
                    BOOKING.state.durationMinutes
                ) +
                " min";

        });


    BOOKING.emit(
        "fare-updated",
        {

            fare:
                BOOKING.state.fare,

            estimatedFare:
                BOOKING.state.estimatedFare,

            discount:
                discount,

            distanceKm:
                distance

        }
    );


    return BOOKING.state.fare;

};


/* ============================================================
   ESTIMATE
   ============================================================ */

BOOKING.estimate = async function () {

    if (
        !BOOKING.state.pickup ||
        !BOOKING.state.destination
    ) {

        BOOKING.state.distanceKm = 0;

        BOOKING.state.durationMinutes = 0;

        BOOKING.updateFare();


        return {

            distanceKm: 0,

            durationMinutes: 0,

            fare: 0

        };

    }


    BOOKING.state.distanceKm =
        BOOKING.calculateDistance(
            BOOKING.state.pickup,
            BOOKING.state.destination
        );


    /*
       Approximate travel time.

       Real navigation can update this later.
    */

    BOOKING.state.durationMinutes =
        Math.max(
            5,
            Math.round(
                BOOKING.state.distanceKm * 3
            )
        );


    const fare =
        BOOKING.updateFare();


    return {

        distanceKm:
            BOOKING.state.distanceKm,

        durationMinutes:
            BOOKING.state.durationMinutes,

        fare:
            fare,

        service:
            BOOKING.state.service

    };

};


/* ============================================================
   PUBLIC FARE API
   ============================================================ */

export async function calculateFareEstimate() {

    return BOOKING.estimate();

}


/* ============================================================
   COUPON
   ============================================================ */

BOOKING.applyCoupon = async function (code) {

    code =
        String(
            code || ""
        )
        .trim()
        .toUpperCase();


    if (!code) {

        throw new Error(
            "Enter a coupon code."
        );

    }


    if (!realtimeDb) {

        throw new Error(
            "Coupon service is not available."
        );

    }


    const couponSnapshot =
        await get(
            ref(
                realtimeDb,
                "coupons/" + code
            )
        );


    if (!couponSnapshot.exists()) {

        throw new Error(
            "Invalid coupon code."
        );

    }


    const coupon =
        couponSnapshot.val() || {};


    if (
        coupon.active === false
    ) {

        throw new Error(
            "This coupon is inactive."
        );

    }


    if (
        coupon.expiry &&
        Date.now() >
        Number(coupon.expiry)
    ) {

        throw new Error(
            "This coupon has expired."
        );

    }


    let discount = 0;


    if (
        coupon.type === "percent"
    ) {

        discount =
            BOOKING.state.estimatedFare *
            (
                BOOKING.number(
                    coupon.value
                ) / 100
            );

    } else {

        discount =
            BOOKING.number(
                coupon.value
            );

    }


    discount =
        Math.min(
            discount,
            BOOKING.state.estimatedFare
        );


    BOOKING.state.coupon = {

        code: code,

        type:
            coupon.type || "flat",

        value:
            coupon.value,

        valid: true

    };


    BOOKING.state.discount =
        BOOKING.round(discount);


    BOOKING.updateFare();


    return BOOKING.state.coupon;

};


BOOKING.removeCoupon = function () {

    BOOKING.state.coupon = null;

    BOOKING.state.discount = 0;

    BOOKING.updateFare();

};


/* ============================================================
   VALIDATE
   ============================================================ */

BOOKING.validate = function () {

    const user =
        BOOKING.getUser();


    if (!user) {

        return {

            valid: false,

            message:
                "Please login before booking a ride."

        };

    }


    if (!BOOKING.state.pickup) {

        return {

            valid: false,

            message:
                "Please select your pickup location."

        };

    }


    if (!BOOKING.state.destination) {

        return {

            valid: false,

            message:
                "Please select your destination."

        };

    }


    if (
        BOOKING.state.pickup.lat ===
            BOOKING.state.destination.lat &&

        BOOKING.state.pickup.lng ===
            BOOKING.state.destination.lng
    ) {

        return {

            valid: false,

            message:
                "Pickup and destination cannot be the same."

        };

    }


    if (
        BOOKING.state.distanceKm <= 0
    ) {

        return {

            valid: false,

            message:
                "Unable to calculate the route distance."

        };

    }


    if (
        BOOKING.state.fare <= 0
    ) {

        return {

            valid: false,

            message:
                "Unable to calculate the fare."

        };

    }


    return {

        valid: true,

        message: "Ready"

    };

};


/* ============================================================
   CREATE BOOKING OBJECT
   ============================================================ */

BOOKING.createObject = function (
    extra = {}
) {

    const user =
        BOOKING.getUser();


    const service =
        BOOKING.getService(
            BOOKING.state.service
        );


    const id =
        BOOKING.id();


    const timestamp =
        Date.now();


    const pickup =
        BOOKING.state.pickup;

    const destination =
        BOOKING.state.destination;


    return {

        id: id,

        rideId: id,

        bookingId: id,


        customerId:
            user?.uid ||
            user?.id ||
            "",

        customerUid:
            user?.uid ||
            user?.id ||
            "",


        customerName:
            user?.name ||
            user?.displayName ||
            "Customer",

        customerPhone:
            user?.phone ||
            user?.phoneNumber ||
            "",

        customerEmail:
            user?.email ||
            "",


        service:
            service.id,

        serviceName:
            service.name,


        pickup: pickup,

        destination: destination,


        pickupAddress:
            pickup?.address || "",

        destinationAddress:
            destination?.address || "",


        pickupLat:
            pickup?.lat ?? null,

        pickupLng:
            pickup?.lng ?? null,

        destinationLat:
            destination?.lat ?? null,

        destinationLng:
            destination?.lng ?? null,


        distanceKm:
            BOOKING.state.distanceKm,

        durationMinutes:
            BOOKING.state.durationMinutes,


        estimatedFare:
            BOOKING.state.estimatedFare,

        discount:
            BOOKING.state.discount,

        fare:
            BOOKING.state.fare,

        totalFare:
            BOOKING.state.fare,


        currency: "INR",


        paymentMethod:
            BOOKING.state.paymentMethod,

        paymentStatus:
            "pending",


        coupon:
            BOOKING.state.coupon?.code ||
            null,


        status:
            "searching",

        rideStatus:
            "searching",


        riderId: null,

        riderUid: null,

        riderName: null,

        riderPhone: null,

        riderRating: null,


        otp: null,


        city:
            BOOKING.config.city,


        source:
            "riderx-web",


        scheduled:
            false,

        scheduledAt:
            null,


        createdAt:
            timestamp,

        requestedAt:
            timestamp,

        updatedAt:
            timestamp,


        ...(extra || {})

    };

};


/* ============================================================
   SAVE RTDB
   ============================================================ */

BOOKING.saveRealtime = async function (
    booking
) {

    if (!realtimeDb) {

        throw new Error(
            "RiderX Realtime Database is not available."
        );

    }


    /*
       Main live ride.
    */

    await set(
        ref(
            realtimeDb,
            "rides/" +
            booking.id
        ),
        booking
    );


    /*
       Customer ride index.
    */

    if (booking.customerId) {

        await set(
            ref(
                realtimeDb,
                "customerRides/" +
                booking.customerId +
                "/" +
                booking.id
            ),
            {

                bookingId:
                    booking.id,

                rideId:
                    booking.id,

                status:
                    booking.status,

                rideStatus:
                    booking.rideStatus,

                service:
                    booking.service,

                serviceName:
                    booking.serviceName,

                pickupAddress:
                    booking.pickupAddress,

                destinationAddress:
                    booking.destinationAddress,

                pickupLat:
                    booking.pickupLat,

                pickupLng:
                    booking.pickupLng,

                destinationLat:
                    booking.destinationLat,

                destinationLng:
                    booking.destinationLng,

                fare:
                    booking.fare,

                paymentMethod:
                    booking.paymentMethod,

                createdAt:
                    booking.createdAt,

                updatedAt:
                    booking.updatedAt

            }
        );

    }


    /*
       Rider request queue.

       This gives the rider side a predictable
       place to discover new requests.
    */

    await set(
        ref(
            realtimeDb,
            "rideRequests/" +
            booking.id
        ),
        {

            rideId:
                booking.id,

            bookingId:
                booking.id,

            customerId:
                booking.customerId,

            customerName:
                booking.customerName,

            customerPhone:
                booking.customerPhone,

            service:
                booking.service,

            serviceName:
                booking.serviceName,

            pickup:
                booking.pickup,

            destination:
                booking.destination,

            pickupAddress:
                booking.pickupAddress,

            destinationAddress:
                booking.destinationAddress,

            pickupLat:
                booking.pickupLat,

            pickupLng:
                booking.pickupLng,

            destinationLat:
                booking.destinationLat,

            destinationLng:
                booking.destinationLng,

            distanceKm:
                booking.distanceKm,

            durationMinutes:
                booking.durationMinutes,

            fare:
                booking.fare,

            paymentMethod:
                booking.paymentMethod,

            status:
                "searching",

            createdAt:
                booking.createdAt,

            updatedAt:
                booking.updatedAt

        }
    );


    return booking;

};


/* ============================================================
   FIRESTORE MIRROR
   ============================================================ */

BOOKING.saveFirestore = async function (
    booking
) {

    if (!db) {

        return booking;

    }


    try {

        await setDoc(
            doc(
                db,
                "rides",
                booking.id
            ),
            booking,
            {
                merge: true
            }
        );

    } catch (error) {

        console.warn(
            "RiderX Firestore mirror failed:",
            error
        );

    }


    return booking;

};


/* ============================================================
   SAVE BOOKING
   ============================================================ */

BOOKING.saveBooking = async function (
    booking
) {

    if (!realtimeDb && !db) {

        throw new Error(
            "Firebase database is not available."
        );

    }


    /*
       RTDB is required for the live
       customer/rider ride flow.
    */

    if (!realtimeDb) {

        throw new Error(
            "RiderX Realtime Database is not available."
        );

    }


    await BOOKING.saveRealtime(
        booking
    );


    if (db) {

        await BOOKING.saveFirestore(
            booking
        );

    }


    return booking;

};


/* ============================================================
   LISTENER REMOVE
   ============================================================ */

BOOKING.removeBookingListener =
    function () {

        if (
            realtimeDb &&
            BOOKING.state.bookingListener &&
            BOOKING.state.bookingListenerRef
        ) {

            try {

                off(
                    BOOKING.state.bookingListenerRef,
                    "value",
                    BOOKING.state.bookingListener
                );

            } catch (error) {

                console.warn(
                    "RiderX ride listener removal failed:",
                    error
                );

            }

        }


        BOOKING.state.bookingListener =
            null;

        BOOKING.state.bookingListenerRef =
            null;

    };


/* ============================================================
   RIDE LISTENER
   ============================================================ */

BOOKING.attachBookingListener =
    function (bookingId) {

        if (
            !realtimeDb ||
            !bookingId
        ) {

            return null;

        }


        BOOKING.removeBookingListener();


        const rideReference =
            ref(
                realtimeDb,
                "rides/" +
                bookingId
            );


        const listener =
            function (snapshot) {

                const ride =
                    snapshot.val();


                if (!ride) {

                    return;

                }


                BOOKING.state.booking =
                    ride;


                BOOKING.state.rideStatus =
                    ride.status ||
                    ride.rideStatus ||
                    "searching";


                BOOKING.state.matching =
                    [
                        "searching",
                        "requested",
                        "pending"
                    ].includes(
                        BOOKING.state.rideStatus
                    );


                BOOKING.updateBookingUI();


                BOOKING.emit(
                    "ride-updated",
                    {

                        booking:
                            ride,

                        status:
                            BOOKING.state.rideStatus

                    }
                );


                if (
                    [
                        "accepted",
                        "arriving",
                        "driver_arriving",
                        "started",
                        "ongoing",
                        "in_progress"
                    ].includes(
                        BOOKING.state.rideStatus
                    )
                ) {

                    BOOKING.state.matching =
                        false;

                }


                if (
                    [
                        "completed",
                        "cancelled",
                        "canceled",
                        "rejected"
                    ].includes(
                        BOOKING.state.rideStatus
                    )
                ) {

                    BOOKING.state.matching =
                        false;

                }

            };


        BOOKING.state.bookingListenerRef =
            rideReference;

        BOOKING.state.bookingListener =
            listener;


        onValue(
            rideReference,
            listener
        );


        return listener;

    };


/* ============================================================
   BOOKING UI
   ============================================================ */

BOOKING.updateBookingUI =
    function () {

        const booking =
            BOOKING.state.booking;


        const status =
            booking?.status ||
            booking?.rideStatus ||
            BOOKING.state.rideStatus;


        document
            .querySelectorAll(
                "[data-ride-status]"
            )
            .forEach(function (element) {

                element.textContent =
                    status || "idle";

            });


        document
            .querySelectorAll(
                "[data-rider-name]"
            )
            .forEach(function (element) {

                element.textContent =
                    booking?.riderName ||
                    (
                        status === "searching"
                            ? "Finding rider..."
                            : "Rider"
                    );

            });


        document
            .querySelectorAll(
                "[data-rider-phone]"
            )
            .forEach(function (element) {

                element.textContent =
                    booking?.riderPhone ||
                    "";

            });


        document
            .querySelectorAll(
                "[data-rider-rating]"
            )
            .forEach(function (element) {

                element.textContent =
                    booking?.riderRating ||
                    "5.0";

            });


        document
            .querySelectorAll(
                "[data-ride-otp]"
            )
            .forEach(function (element) {

                element.textContent =
                    booking?.otp ||
                    "----";

            });


        document
            .querySelectorAll(
                "[data-booking-fare]"
            )
            .forEach(function (element) {

                element.textContent =
                    "₹" +
                    (
                        booking?.fare ||
                        BOOKING.state.fare ||
                        0
                    );

            });


        document
            .querySelectorAll(
                "[data-cancel-ride]"
            )
            .forEach(function (element) {

                const canCancel =
                    [
                        "searching",
                        "requested",
                        "pending",
                        "accepted",
                        "arriving",
                        "driver_arriving"
                    ].includes(status);


                element.disabled =
                    !canCancel;

            });

    };


/* ============================================================
   REQUEST RIDE
   ============================================================ */

BOOKING.requestRide = async function (
    options = {}
) {

    if (BOOKING.state.loading) {

        throw new Error(
            "A booking request is already being processed."
        );

    }


    /*
       Always recalculate first.

       This is important because the customer
       may have changed pickup/drop/service.
    */

    await BOOKING.estimate();


    const validation =
        BOOKING.validate();


    if (!validation.valid) {

        throw new Error(
            validation.message
        );

    }


    if (!auth) {

        throw new Error(
            "RiderX authentication is not available."
        );

    }


    if (!realtimeDb) {

        throw new Error(
            "RiderX booking database is not available."
        );

    }


    BOOKING.state.loading = true;


    try {

        const booking =
            BOOKING.createObject({

                scheduled:
                    options.scheduled ||
                    false,

                scheduledAt:
                    options.scheduledAt ||
                    null,

                notes:
                    options.notes ||
                    "",

                paymentMethod:
                    options.paymentMethod ||
                    BOOKING.state.paymentMethod

            });


        BOOKING.state.booking =
            booking;


        BOOKING.state.rideStatus =
            "searching";


        BOOKING.state.matching =
            true;


        /*
           ACTUAL FIREBASE BOOKING.
        */

        await BOOKING.saveBooking(
            booking
        );


        /*
           Start realtime listener.
        */

        BOOKING.attachBookingListener(
            booking.id
        );


        /*
           Optional matching module.
        */

        if (
            RX.matching &&
            typeof RX.matching.start ===
            "function"
        ) {

            try {

                await RX.matching.start(
                    booking
                );

            } catch (error) {

                console.warn(
                    "RiderX matching module failed:",
                    error
                );

            }

        }


        /*
           Optional request module.
        */

        if (
            RX.requests &&
            typeof RX.requests.create ===
            "function"
        ) {

            try {

                await RX.requests.create(
                    booking
                );

            } catch (error) {

                console.warn(
                    "RiderX request module failed:",
                    error
                );

            }

        }


        BOOKING.updateBookingUI();


        BOOKING.emit(
            "ride-requested",
            {
                booking: booking
            }
        );


        return booking;

    } finally {

        BOOKING.state.loading =
            false;

    }

};


/* ============================================================
   PUBLIC CREATE RIDE API
   ============================================================ */

export async function createRideRequest(
    paymentMethod = null
) {

    if (paymentMethod) {

        BOOKING.setPaymentMethod(
            paymentMethod
        );

    }


    return BOOKING.requestRide({

        paymentMethod:
            BOOKING.state.paymentMethod

    });

}


/* ============================================================
   CANCEL RIDE
   ============================================================ */

BOOKING.cancelRide = async function (
    reason = "Customer cancelled"
) {

    const booking =
        BOOKING.state.booking;


    if (!booking?.id) {

        throw new Error(
            "No active ride found."
        );

    }


    const timestamp =
        Date.now();


    const uid =
        BOOKING.getUid();


    const updates = {

        status: "cancelled",

        rideStatus: "cancelled",

        cancellationReason:
            reason,

        cancelledBy:
            "customer",

        cancelledAt:
            timestamp,

        updatedAt:
            timestamp

    };


    if (realtimeDb) {

        await update(
            ref(
                realtimeDb,
                "rides/" +
                booking.id
            ),
            updates
        );


        if (uid) {

            await update(
                ref(
                    realtimeDb,
                    "customerRides/" +
                    uid +
                    "/" +
                    booking.id
                ),
                updates
            );

        }


        /*
           Remove request from rider queue.
        */

        try {

            await update(
                ref(
                    realtimeDb,
                    "rideRequests/" +
                    booking.id
                ),
                {

                    status:
                        "cancelled",

                    updatedAt:
                        timestamp

                }
            );

        } catch (error) {

            console.warn(
                "RiderX request cancellation update failed:",
                error
            );

        }

    }


    if (db) {

        try {

            await setDoc(
                doc(
                    db,
                    "rides",
                    booking.id
                ),
                updates,
                {
                    merge: true
                }
            );

        } catch (error) {

            console.warn(
                "Firestore cancellation mirror failed:",
                error
            );

        }

    }


    BOOKING.state.booking = {

        ...booking,

        ...updates

    };


    BOOKING.state.rideStatus =
        "cancelled";


    BOOKING.state.matching =
        false;


    BOOKING.updateBookingUI();


    BOOKING.emit(
        "ride-cancelled",
        {

            booking:
                BOOKING.state.booking,

            reason:
                reason

        }
    );


    return true;

};


/* ============================================================
   RESTORE ACTIVE RIDE
   ============================================================ */

BOOKING.restoreActiveRide =
    async function () {

        const uid =
            BOOKING.getUid();


        if (
            !uid ||
            !realtimeDb
        ) {

            return null;

        }


        try {

            const snapshot =
                await get(
                    ref(
                        realtimeDb,
                        "customerRides/" +
                        uid
                    )
                );


            if (!snapshot.exists()) {

                return null;

            }


            const rides =
                snapshot.val() || {};


            const ids =
                Object.keys(rides)
                    .sort(function (a, b) {

                        const ta =
                            Number(
                                rides[a]?.createdAt ||
                                0
                            );

                        const tb =
                            Number(
                                rides[b]?.createdAt ||
                                0
                            );

                        return tb - ta;

                    });


            const activeStatuses = [

                "searching",
                "requested",
                "pending",
                "accepted",
                "arriving",
                "driver_arriving",
                "started",
                "ongoing",
                "in_progress"

            ];


            for (const id of ids) {

                const rideSnapshot =
                    await get(
                        ref(
                            realtimeDb,
                            "rides/" +
                            id
                        )
                    );


                if (!rideSnapshot.exists()) {

                    continue;

                }


                const ride =
                    rideSnapshot.val();


                const status =
                    ride.status ||
                    ride.rideStatus;


                if (
                    activeStatuses.includes(
                        status
                    )
                ) {

                    BOOKING.state.booking =
                        ride;


                    BOOKING.state.rideStatus =
                        status;


                    BOOKING.state.pickup =
                        ride.pickup ||
                        (
                            ride.pickupLat != null &&
                            ride.pickupLng != null
                                ? {
                                    lat:
                                        ride.pickupLat,

                                    lng:
                                        ride.pickupLng,

                                    address:
                                        ride.pickupAddress ||
                                        "Pickup location"
                                }
                                : null
                        );


                    BOOKING.state.destination =
                        ride.destination ||
                        (
                            ride.destinationLat != null &&
                            ride.destinationLng != null
                                ? {
                                    lat:
                                        ride.destinationLat,

                                    lng:
                                        ride.destinationLng,

                                    address:
                                        ride.destinationAddress ||
                                        "Destination"
                                }
                                : null
                        );


                    BOOKING.state.distanceKm =
                        BOOKING.number(
                            ride.distanceKm
                        );


                    BOOKING.state.durationMinutes =
                        BOOKING.number(
                            ride.durationMinutes
                        );


                    BOOKING.state.fare =
                        BOOKING.number(
                            ride.fare
                        );


                    BOOKING.state.estimatedFare =
                        BOOKING.number(
                            ride.estimatedFare ||
                            ride.fare
                        );


                    BOOKING.state.service =
                        ride.service ||
                        "bike";


                    BOOKING.state.paymentMethod =
                        ride.paymentMethod ||
                        "cash";


                    BOOKING.attachBookingListener(
                        ride.id ||
                        id
                    );


                    BOOKING.updateLocationUI();

                    BOOKING.updateFare();

                    BOOKING.updateBookingUI();


                    return ride;

                }

            }

        } catch (error) {

            console.warn(
                "RiderX active ride restore failed:",
                error
            );

        }


        return null;

    };


/* ============================================================
   EVENTS
   ============================================================ */

BOOKING.emit = function (
    eventName,
    detail = {}
) {

    try {

        window.dispatchEvent(
            new CustomEvent(
                "riderx-booking-" +
                eventName,
                {
                    detail: detail
                }
            )
        );

    } catch (error) {

        console.warn(
            "RiderX booking event failed:",
            error
        );

    }

};


BOOKING.on = function (
    eventName,
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {

        return;

    }


    window.addEventListener(
        "riderx-booking-" +
        eventName,
        function (event) {

            callback(
                event.detail || {}
            );

        }
    );

};


/* ============================================================
   UI BINDINGS
   ============================================================ */

BOOKING.bindUI = function () {

    if (BOOKING.state.uiBound) {

        return;

    }


    BOOKING.state.uiBound =
        true;


    /*
       Service selection.
    */

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-service]"
                );


            if (!button) {

                return;

            }


            BOOKING.setService(
                button.dataset.service
            );

        }
    );


    /*
       Payment selection.
    */

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-payment-method]"
                );


            if (!button) {

                return;

            }


            BOOKING.setPaymentMethod(
                button.dataset.paymentMethod
            );

        }
    );


    /*
       Cancel.
    */

    document.addEventListener(
        "click",
        async function (event) {

            const button =
                event.target.closest(
                    "[data-cancel-ride]"
                );


            if (!button) {

                return;

            }


            event.preventDefault();


            try {

                await BOOKING.cancelRide();

            } catch (error) {

                console.error(
                    "RiderX cancellation failed:",
                    error
                );

            }

        }
    );

};


/* ============================================================
   AUTH LISTENER
   ============================================================ */

BOOKING.setupAuth = function () {

    /*
       Do not import Firebase Auth again.

       firebase-config.js already exports the
       initialized auth instance.

       onAuthStateChanged is intentionally accessed
       from the existing Firebase compat/module API
       only when available.
    */

    if (!auth) {

        return;

    }


    try {

        if (
            typeof auth.onAuthStateChanged ===
            "function"
        ) {

            auth.onAuthStateChanged(
                function (user) {

                    if (!user) {

                        BOOKING.removeBookingListener();

                        BOOKING.state.booking =
                            null;

                        BOOKING.state.rideStatus =
                            "idle";

                        BOOKING.state.matching =
                            false;

                        BOOKING.updateBookingUI();

                    }

                }
            );

        }

    } catch (error) {

        console.warn(
            "RiderX auth listener skipped:",
            error
        );

    }

};


/* ============================================================
   GLOBAL API
   ============================================================ */

/*
   IMPORTANT:

   This function is called BEFORE async initialization.

   Therefore booking.html can safely find:

       window.RiderXBookingAPI

   immediately after booking.js loads.
*/

BOOKING.exposeAPI = function () {

    const api = {

        auth: auth,

        db: db,

        realtimeDb: realtimeDb,


        initBookingModule:
            initBookingModule,


        setService:
            BOOKING.setService,


        setPaymentMethod:
            BOOKING.setPaymentMethod,


        setPickupLocation:
            setPickupLocation,


        setDropLocation:
            setDropLocation,


        clearLocations:
            BOOKING.clearLocations,


        calculateDistance:
            BOOKING.calculateDistance,


        calculateFare:
            BOOKING.calculateFare,


        calculateFareEstimate:
            calculateFareEstimate,


        estimate:
            BOOKING.estimate,


        createRideRequest:
            createRideRequest,


        requestRide:
            BOOKING.requestRide,


        cancelRide:
            BOOKING.cancelRide,


        applyCoupon:
            BOOKING.applyCoupon,


        removeCoupon:
            BOOKING.removeCoupon,


        getUser:
            BOOKING.getUser,


        getUid:
            BOOKING.getUid,


        getActiveBooking:
            function () {

                return BOOKING.state.booking;

            },


        getState:
            function () {

                return BOOKING.state;

            },


        state:
            BOOKING.state,


        ready:
            function () {

                return (
                    BOOKING.state.initialized ===
                    true
                );

            }

    };


    /*
       Set API immediately.
    */

    window.RiderXBookingAPI =
        api;


    /*
       Compatibility flags.
    */

    window.RiderXBookingReady =
        true;


    window.RiderXBookingLoading =
        true;


    return api;

};


/* ============================================================
   INITIALIZATION
   ============================================================ */

export async function initBookingModule() {

    /*
       Already initialized.
    */

    if (
        BOOKING.state.initialized
    ) {

        window.RiderXBookingReady =
            true;

        window.RiderXBookingLoading =
            false;

        return BOOKING;

    }


    /*
       Firebase auth must exist.
    */

    if (!auth) {

        window.RiderXBookingLoading =
            false;

        window.RiderXBookingReady =
            false;

        throw new Error(
            "RiderX Firebase Authentication is not initialized."
        );

    }


    /*
       RTDB is required for the actual
       live ride booking flow.
    */

    if (!realtimeDb) {

        window.RiderXBookingLoading =
            false;

        window.RiderXBookingReady =
            false;

        throw new Error(
            "RiderX Firebase Realtime Database is not initialized."
        );

    }


    /*
       Default settings.
    */

    BOOKING.setService(
        BOOKING.config.defaultService
    );


    BOOKING.setPaymentMethod(
        BOOKING.config.defaultPayment
    );


    /*
       UI.
    */

    BOOKING.bindUI();

    BOOKING.setupAuth();


    BOOKING.updateLocationUI();

    BOOKING.updateFare();

    BOOKING.updateBookingUI();


    /*
       Restore current active ride.
    */

    try {

        await BOOKING.restoreActiveRide();

    } catch (error) {

        console.warn(
            "RiderX active ride restore skipped:",
            error
        );

    }


    /*
       Mark initialized.
    */

    BOOKING.state.initialized =
        true;


    window.RiderXBookingReady =
        true;


    window.RiderXBookingLoading =
        false;


    BOOKING.emit(
        "ready",
        {
            booking: BOOKING
        }
    );


    console.log(
        "RiderX booking engine ready."
    );


    return BOOKING;

}


/* ============================================================
   EXPOSE API IMMEDIATELY
   ============================================================ */

BOOKING.exposeAPI();


/* ============================================================
   GLOBAL RIDERX SHORTCUTS
   ============================================================ */

RX.booking =
    BOOKING;


RX.setPickup =
    setPickupLocation;


RX.setDestination =
    setDropLocation;


RX.setService =
    BOOKING.setService;


RX.setPaymentMethod =
    BOOKING.setPaymentMethod;


RX.calculateFare =
    BOOKING.calculateFare;


RX.requestRide =
    BOOKING.requestRide;


RX.createRideRequest =
    createRideRequest;


RX.cancelRide =
    BOOKING.cancelRide;


RX.getActiveBooking =
    function () {

        return BOOKING.state.booking;

    };


/* ============================================================
   AUTO INIT
   ============================================================ */

function startBookingEngine() {

    /*
       API is already available here.

       Initialization happens separately.
    */

    initBookingModule()
        .catch(function (error) {

            console.error(
                "RiderX booking engine initialization failed:",
                error
            );


            /*
               Keep API available so the page
               never gets the misleading
               "engine is not ready" error.

               The actual Firebase error is
               exposed here.
            */

            window.RiderXBookingReady =
                false;

            window.RiderXBookingLoading =
                false;

            window.RiderXBookingError =
                error?.message ||
                "Booking engine initialization failed.";

        });

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startBookingEngine,
        {
            once: true
        }
    );

} else {

    startBookingEngine();

}


/* ============================================================
   EXPORT
   ============================================================ */

export {

    BOOKING

};
