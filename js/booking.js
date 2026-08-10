/* ============================================================
   RIDERX 2.0
   BOOKING ENGINE
   File: js/booking.js

   FINAL CUSTOMER BOOKING ENGINE

   Handles:
   - Firebase Authentication
   - Firebase Realtime Database
   - Firestore mirror
   - Pickup / Destination
   - Service selection
   - Fare calculation
   - Payment method
   - Ride creation
   - Customer ride index
   - Live ride status
   - Cancellation
   - Coupon
   - Active ride restore
   - Customer booking API

   IMPORTANT:
   Firebase is initialized ONLY inside:
       firebase/firebase-config.js

   This file only imports the already initialized
   Firebase services.

   DO NOT initialize Firebase again here.
   ============================================================ */

"use strict";


/* ============================================================
   FIREBASE
   ============================================================ */

import {
    auth,
    db,
    realtimeDb,

    ref,
    set,
    get,
    update,
    remove,
    onValue,
    off,

    doc,
    setDoc,

    onAuthStateChanged
} from "../firebase/firebase-config.js";


/* ============================================================
   RIDERX NAMESPACE
   ============================================================ */

const RX =
    window.RiderX =
    window.RiderX || {};


const BOOKING =
    RX.booking =
    RX.booking || {};


/* ============================================================
   CONFIG
   ============================================================ */

BOOKING.config = {

    city:
        "Chandigarh",

    currency:
        "₹",

    defaultService:
        "bike",

    defaultPayment:
        "cash",

    services: {

        bike: {

            id:
                "bike",

            name:
                "Bike Taxi",

            icon:
                "🏍️",

            baseFare:
                20,

            perKm:
                8,

            minimumFare:
                25

        },


        cab: {

            id:
                "cab",

            name:
                "Cab",

            icon:
                "🚕",

            baseFare:
                40,

            perKm:
                12,

            minimumFare:
                40

        },


        parcel: {

            id:
                "parcel",

            name:
                "Parcel",

            icon:
                "📦",

            baseFare:
                25,

            perKm:
                10,

            minimumFare:
                25

        },


        food: {

            id:
                "food",

            name:
                "Food Delivery",

            icon:
                "🍔",

            baseFare:
                20,

            perKm:
                10,

            minimumFare:
                20

        }

    }

};


/* ============================================================
   STATE
   ============================================================ */

BOOKING.state = {

    initialized:
        false,

    loading:
        false,

    firebaseReady:
        Boolean(
            auth &&
            (
                realtimeDb ||
                db
            )
        ),

    booking:
        null,

    pickup:
        null,

    destination:
        null,

    distanceKm:
        0,

    durationMinutes:
        0,

    service:
        "bike",

    paymentMethod:
        "cash",

    coupon:
        null,

    discount:
        0,

    fare:
        0,

    estimatedFare:
        0,

    rideStatus:
        "idle",

    matching:
        false,

    bookingListener:
        null,

    bookingListenerRef:
        null,

    authListener:
        null

};


/* ============================================================
   SAFE HELPERS
   ============================================================ */

BOOKING.number =
function(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;

};


BOOKING.round =
function(value) {

    return Math.round(
        BOOKING.number(value)
    );

};


BOOKING.now =
function() {

    return Date.now();

};


BOOKING.id =
function() {

    return (
        "RX-" +
        Date.now()
            .toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    ).toUpperCase();

};


/* ============================================================
   FIREBASE ACCESS
   ============================================================ */

BOOKING.database =
function() {

    return realtimeDb || null;

};


BOOKING.firestore =
function() {

    return db || null;

};


BOOKING.getAuth =
function() {

    return auth || null;

};


/* ============================================================
   USER
   ============================================================ */

BOOKING.getUser =
function() {

    try {

        const firebaseUser =
            auth?.currentUser;


        let savedUser =
            null;


        try {

            savedUser =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_user"
                    ) || "null"
                );

        } catch(error) {

            savedUser =
                null;

        }


        if(firebaseUser) {

            return {

                ...(savedUser || {}),

                uid:
                    firebaseUser.uid,

                id:
                    firebaseUser.uid,

                userId:
                    firebaseUser.uid,

                email:
                    firebaseUser.email ||
                    savedUser?.email ||
                    "",

                phone:
                    firebaseUser.phoneNumber ||
                    savedUser?.phone ||
                    "",

                phoneNumber:
                    firebaseUser.phoneNumber ||
                    savedUser?.phoneNumber ||
                    "",

                name:
                    firebaseUser.displayName ||
                    savedUser?.name ||
                    "Customer",

                displayName:
                    firebaseUser.displayName ||
                    savedUser?.displayName ||
                    savedUser?.name ||
                    "Customer"

            };

        }


        return savedUser;

    } catch(error) {

        console.error(
            "RiderX user error:",
            error
        );

        return null;

    }

};


BOOKING.getUid =
function() {

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

BOOKING.getService =
function(service) {

    let value =
        String(
            service ||
            BOOKING.state.service ||
            "bike"
        )
        .toLowerCase()
        .trim();


    const aliases = {

        "bike taxi":
            "bike",

        "bike_taxi":
            "bike",

        motorcycle:
            "bike",

        motorbike:
            "bike",

        car:
            "cab"

    };


    value =
        aliases[value] ||
        value;


    return (
        BOOKING.config
            .services[value] ||

        BOOKING.config
            .services.bike
    );

};


BOOKING.setService =
function(service) {

    const selected =
        BOOKING.getService(
            service
        );


    BOOKING.state.service =
        selected.id;


    if(document.body) {

        document.body.dataset.service =
            selected.id;

    }


    document
        .querySelectorAll(
            "[data-service]"
        )
        .forEach(
            function(element) {

                const value =
                    String(
                        element.dataset.service ||
                        ""
                    )
                    .toLowerCase();


                element.classList.toggle(
                    "active",
                    value ===
                    selected.id
                );

            }
        );


    BOOKING.updateFare();


    BOOKING.emit(
        "service-changed",
        {
            service:
                selected
        }
    );


    return selected;

};


/* ============================================================
   PAYMENT
   ============================================================ */

BOOKING.setPaymentMethod =
function(method) {

    method =
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


    if(
        !allowed.includes(
            method
        )
    ) {

        method =
            "cash";

    }


    BOOKING.state.paymentMethod =
        method;


    document
        .querySelectorAll(
            "[data-payment-method]"
        )
        .forEach(
            function(element) {

                element.classList.toggle(
                    "active",
                    String(
                        element.dataset
                            .paymentMethod ||
                        ""
                    )
                    .toLowerCase() ===
                    method
                );

            }
        );


    BOOKING.emit(
        "payment-method-changed",
        {
            method:
                method
        }
    );


    return method;

};


/* ============================================================
   PICKUP
   ============================================================ */

BOOKING.setPickup =
function(location) {

    if(!location) {

        return null;

    }


    const lat =
        Number(
            location.lat
        );

    const lng =
        Number(
            location.lng
        );


    if(
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return null;

    }


    BOOKING.state.pickup = {

        lat:
            lat,

        lng:
            lng,

        address:
            location.address ||
            location.name ||
            "Pickup location",

        name:
            location.name ||
            location.address ||
            "Pickup location"

    };


    BOOKING.updateLocationUI();

    BOOKING.updateFare();


    BOOKING.emit(
        "pickup-changed",
        {
            pickup:
                BOOKING.state.pickup
        }
    );


    return BOOKING.state.pickup;

};


/* ============================================================
   DESTINATION
   ============================================================ */

BOOKING.setDestination =
function(location) {

    if(!location) {

        return null;

    }


    const lat =
        Number(
            location.lat
        );

    const lng =
        Number(
            location.lng
        );


    if(
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return null;

    }


    BOOKING.state.destination = {

        lat:
            lat,

        lng:
            lng,

        address:
            location.address ||
            location.name ||
            "Destination",

        name:
            location.name ||
            location.address ||
            "Destination"

    };


    BOOKING.updateLocationUI();

    BOOKING.updateFare();


    BOOKING.emit(
        "destination-changed",
        {
            destination:
                BOOKING.state.destination
        }
    );


    return BOOKING.state.destination;

};


/* ============================================================
   PUBLIC LOCATION API
   ============================================================ */

export function setPickupLocation(
    lat,
    lng,
    address = ""
) {

    return BOOKING.setPickup({

        lat:
            Number(lat),

        lng:
            Number(lng),

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

        lat:
            Number(lat),

        lng:
            Number(lng),

        address:
            address ||
            "Destination"

    });

}


/* ============================================================
   LOCATION UI
   ============================================================ */

BOOKING.updateLocationUI =
function() {

    const pickup =
        BOOKING.state.pickup;

    const destination =
        BOOKING.state.destination;


    document
        .querySelectorAll(
            "[data-pickup-address]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    pickup?.address ||
                    "Choose pickup location";

            }
        );


    document
        .querySelectorAll(
            "[data-destination-address]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    destination?.address ||
                    "Choose destination";

            }
        );


    const pickupInput =
        document.querySelector(
            "#pickup"
        ) ||
        document.querySelector(
            "#pickupInput"
        );


    if(
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


    if(
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

BOOKING.calculateDistance =
function(
    pickup,
    destination
) {

    if(
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


    if(
        ![
            lat1,
            lon1,
            lat2,
            lon2
        ].every(
            Number.isFinite
        )
    ) {

        return 0;

    }


    const earthRadius =
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


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return (
        earthRadius *
        c
    );

};


/* ============================================================
   FARE
   ============================================================ */

BOOKING.calculateFare =
function(
    distanceKm,
    service
) {

    distanceKm =
        Math.max(
            0,
            Number(distanceKm) || 0
        );


    const selected =
        BOOKING.getService(
            service
        );


    const hour =
        new Date()
            .getHours();


    let base =
        selected.baseFare;

    let rate =
        selected.perKm;


    /*
     * RiderX Bike Pricing
     *
     * 06:00 - 22:00
     * Up to 10 km: ₹8/km
     * Above 10 km: ₹9/km
     *
     * 22:00 - 06:00
     * ₹11/km
     */

    if(
        selected.id === "bike"
    ) {

        base =
            20;


        if(
            hour >= 22 ||
            hour < 6
        ) {

            rate =
                11;

        }

    }


    let distanceFare =
        0;


    if(
        selected.id === "bike" &&
        hour >= 6 &&
        hour < 22 &&
        distanceKm > 10
    ) {

        distanceFare =
            (
                10 *
                8
            ) +

            (
                (
                    distanceKm -
                    10
                ) *
                9
            );

    } else {

        distanceFare =
            distanceKm *
            rate;

    }


    const bookingFee =
        selected.id === "bike"
            ? 5
            : 10;


    const total =
        Math.max(
            selected.minimumFare,
            base +
            distanceFare +
            bookingFee
        );


    return {

        baseFare:
            BOOKING.round(
                base
            ),

        distanceFare:
            BOOKING.round(
                distanceFare
            ),

        bookingFee:
            BOOKING.round(
                bookingFee
            ),

        totalFare:
            BOOKING.round(
                total
            ),

        distanceKm:
            distanceKm,

        service:
            selected.id

    };

};


/* ============================================================
   UPDATE FARE
   ============================================================ */

BOOKING.updateFare =
function() {

    const distance =
        BOOKING.number(
            BOOKING.state.distanceKm
        );


    const result =
        BOOKING.calculateFare(
            distance,
            BOOKING.state.service
        );


    const discount =
        Math.min(
            result.totalFare,
            BOOKING.number(
                BOOKING.state.discount
            )
        );


    const finalFare =
        Math.max(
            0,
            result.totalFare -
            discount
        );


    BOOKING.state.estimatedFare =
        result.totalFare;


    BOOKING.state.fare =
        BOOKING.round(
            finalFare
        );


    document
        .querySelectorAll(
            "[data-fare]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    "₹" +
                    BOOKING.state.fare;

            }
        );


    document
        .querySelectorAll(
            "[data-estimated-fare]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    "₹" +
                    BOOKING.state
                        .estimatedFare;

            }
        );


    document
        .querySelectorAll(
            "[data-discount]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    "₹" +
                    discount;

            }
        );


    document
        .querySelectorAll(
            "[data-distance]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    distance.toFixed(1) +
                    " km";

            }
        );


    document
        .querySelectorAll(
            "[data-duration]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    Math.round(
                        BOOKING.state
                            .durationMinutes
                    ) +
                    " min";

            }
        );


    BOOKING.emit(
        "fare-updated",
        {
            fare:
                BOOKING.state.fare,

            estimatedFare:
                BOOKING.state
                    .estimatedFare,

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

BOOKING.estimate =
async function() {

    if(
        !BOOKING.state.pickup ||
        !BOOKING.state.destination
    ) {

        BOOKING.state.distanceKm =
            0;

        BOOKING.state
            .durationMinutes =
            0;

        BOOKING.updateFare();


        return {

            distanceKm:
                0,

            durationMinutes:
                0,

            fare:
                0

        };

    }


    BOOKING.state.distanceKm =
        BOOKING.calculateDistance(
            BOOKING.state.pickup,
            BOOKING.state.destination
        );


    BOOKING.state
        .durationMinutes =
        Math.max(
            5,
            Math.round(
                BOOKING.state.distanceKm *
                3
            )
        );


    const fare =
        BOOKING.updateFare();


    return {

        distanceKm:
            BOOKING.state.distanceKm,

        durationMinutes:
            BOOKING.state
                .durationMinutes,

        fare:
            fare,

        service:
            BOOKING.state.service

    };

};


export async function calculateFareEstimate() {

    return await BOOKING.estimate();

}


/* ============================================================
   COUPON
   ============================================================ */

BOOKING.applyCoupon =
async function(code) {

    code =
        String(
            code || ""
        )
        .trim()
        .toUpperCase();


    if(!code) {

        throw new Error(
            "Enter a coupon code."
        );

    }


    if(!realtimeDb) {

        throw new Error(
            "Coupon database is unavailable."
        );

    }


    const couponRef =
        ref(
            realtimeDb,
            "coupons/" +
            code
        );


    const snapshot =
        await get(
            couponRef
        );


    if(!snapshot.exists()) {

        throw new Error(
            "Invalid coupon code."
        );

    }


    const coupon =
        snapshot.val() ||
        {};


    if(
        coupon.active ===
        false
    ) {

        throw new Error(
            "This coupon is inactive."
        );

    }


    if(
        coupon.expiry &&
        Date.now() >
        Number(
            coupon.expiry
        )
    ) {

        throw new Error(
            "This coupon has expired."
        );

    }


    let discount =
        0;


    if(
        coupon.type ===
        "percent"
    ) {

        discount =
            BOOKING.state
                .estimatedFare *
            (
                Number(
                    coupon.value
                ) /
                100
            );

    } else {

        discount =
            Number(
                coupon.value
            ) || 0;

    }


    discount =
        Math.min(
            discount,
            BOOKING.state
                .estimatedFare
        );


    BOOKING.state.coupon = {

        code:
            code,

        type:
            coupon.type ||
            "flat",

        value:
            coupon.value,

        valid:
            true

    };


    BOOKING.state.discount =
        BOOKING.round(
            discount
        );


    BOOKING.updateFare();


    return BOOKING.state.coupon;

};


BOOKING.removeCoupon =
function() {

    BOOKING.state.coupon =
        null;

    BOOKING.state.discount =
        0;

    BOOKING.updateFare();

};


/* ============================================================
   VALIDATION
   ============================================================ */

BOOKING.validate =
function() {

    const user =
        BOOKING.getUser();


    if(!user) {

        return {

            valid:
                false,

            message:
                "Please login before booking a ride."

        };

    }


    if(!BOOKING.state.pickup) {

        return {

            valid:
                false,

            message:
                "Please select your pickup location."

        };

    }


    if(!BOOKING.state.destination) {

        return {

            valid:
                false,

            message:
                "Please select your destination."

        };

    }


    if(
        BOOKING.state.pickup.lat ===
        BOOKING.state.destination.lat &&

        BOOKING.state.pickup.lng ===
        BOOKING.state.destination.lng
    ) {

        return {

            valid:
                false,

            message:
                "Pickup and destination cannot be the same."

        };

    }


    if(
        BOOKING.state.distanceKm <=
        0
    ) {

        return {

            valid:
                false,

            message:
                "Unable to calculate route distance."

        };

    }


    if(
        BOOKING.state.fare <=
        0
    ) {

        return {

            valid:
                false,

            message:
                "Unable to calculate fare."

        };

    }


    return {

        valid:
            true,

        message:
            "Ready"

    };

};


/* ============================================================
   CREATE BOOKING OBJECT
   ============================================================ */

BOOKING.createObject =
function(extra = {}) {

    const user =
        BOOKING.getUser();


    const service =
        BOOKING.getService();


    const id =
        BOOKING.id();


    const timestamp =
        Date.now();


    return {

        id:
            id,

        rideId:
            id,

        bookingId:
            id,


        customerId:
            user?.uid ||
            user?.id ||
            "",

        customerUid:
            user?.uid ||
            user?.id ||
            "",


        customerName:
            user?.displayName ||
            user?.name ||
            "Customer",

        customerPhone:
            user?.phoneNumber ||
            user?.phone ||
            "",

        customerEmail:
            user?.email ||
            "",


        service:
            service.id,

        serviceName:
            service.name,


        pickup:
            BOOKING.state.pickup,

        destination:
            BOOKING.state.destination,


        pickupAddress:
            BOOKING.state.pickup
                ?.address ||
            "",

        destinationAddress:
            BOOKING.state.destination
                ?.address ||
            "",


        pickupLat:
            BOOKING.state.pickup
                ?.lat ??
            null,

        pickupLng:
            BOOKING.state.pickup
                ?.lng ??
            null,

        destinationLat:
            BOOKING.state.destination
                ?.lat ??
            null,

        destinationLng:
            BOOKING.state.destination
                ?.lng ??
            null,


        distanceKm:
            BOOKING.state.distanceKm,

        durationMinutes:
            BOOKING.state
                .durationMinutes,


        estimatedFare:
            BOOKING.state
                .estimatedFare,

        discount:
            BOOKING.state
                .discount,

        fare:
            BOOKING.state.fare,

        totalFare:
            BOOKING.state.fare,


        currency:
            "INR",


        paymentMethod:
            BOOKING.state
                .paymentMethod,

        paymentStatus:
            "pending",


        coupon:
            BOOKING.state.coupon
                ?.code ||
            null,


        status:
            "searching",

        rideStatus:
            "searching",


        riderId:
            null,

        riderUid:
            null,

        riderName:
            null,

        riderPhone:
            null,

        riderRating:
            null,


        otp:
            null,


        city:
            BOOKING.config.city,


        source:
            "riderx-customer-web",


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

BOOKING.saveRealtime =
async function(booking) {

    if(!realtimeDb) {

        throw new Error(
            "RiderX Realtime Database is unavailable."
        );

    }


    const rideRef =
        ref(
            realtimeDb,
            "rides/" +
            booking.id
        );


    await set(
        rideRef,
        booking
    );


    if(
        booking.customerId
    ) {

        const customerRideRef =
            ref(
                realtimeDb,
                "customerRides/" +
                booking.customerId +
                "/" +
                booking.id
            );


        await set(
            customerRideRef,
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

                fare:
                    booking.fare,

                pickupAddress:
                    booking.pickupAddress,

                destinationAddress:
                    booking.destinationAddress,

                createdAt:
                    booking.createdAt,

                updatedAt:
                    booking.updatedAt

            }
        );

    }


    return booking;

};


/* ============================================================
   FIRESTORE MIRROR
   ============================================================ */

BOOKING.saveFirestore =
async function(booking) {

    if(!db) {

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
                merge:
                    true
            }
        );

    } catch(error) {

        /*
         * RTDB is primary live ride transport.
         * Firestore mirror failure is logged but
         * does not destroy the ride request.
         */

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

BOOKING.saveBooking =
async function(booking) {

    if(
        !realtimeDb &&
        !db
    ) {

        throw new Error(
            "RiderX Firebase database is unavailable."
        );

    }


    /*
     * RTDB is primary.
     */

    if(realtimeDb) {

        await BOOKING.saveRealtime(
            booking
        );

    }


    /*
     * Firestore mirror.
     */

    if(db) {

        await BOOKING.saveFirestore(
            booking
        );

    }


    return booking;

};


/* ============================================================
   RIDE LISTENER
   ============================================================ */

BOOKING.removeBookingListener =
function() {

    if(
        realtimeDb &&
        BOOKING.bookingListener &&
        BOOKING.bookingListenerRef
    ) {

        try {

            off(
                BOOKING.bookingListenerRef,
                "value",
                BOOKING.bookingListener
            );

        } catch(error) {

            console.warn(
                "RiderX listener removal failed:",
                error
            );

        }

    }


    BOOKING.bookingListener =
        null;

    BOOKING.bookingListenerRef =
        null;

};


BOOKING.attachBookingListener =
function(bookingId) {

    if(
        !realtimeDb ||
        !bookingId
    ) {

        return null;

    }


    BOOKING.removeBookingListener();


    const rideRef =
        ref(
            realtimeDb,
            "rides/" +
            bookingId
        );


    const listener =
    function(snapshot) {

        const ride =
            snapshot.val();


        if(!ride) {

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
                    BOOKING.state
                        .rideStatus

            }
        );


        if(
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


    BOOKING.bookingListenerRef =
        rideRef;

    BOOKING.bookingListener =
        listener;


    onValue(
        rideRef,
        listener
    );


    return listener;

};


/* ============================================================
   BOOKING UI
   ============================================================ */

BOOKING.updateBookingUI =
function() {

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
        .forEach(
            function(element) {

                element.textContent =
                    status;

            }
        );


    document
        .querySelectorAll(
            "[data-rider-name]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    booking?.riderName ||
                    "Finding rider...";

            }
        );


    document
        .querySelectorAll(
            "[data-rider-phone]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    booking?.riderPhone ||
                    "";

            }
        );


    document
        .querySelectorAll(
            "[data-rider-rating]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    booking?.riderRating ||
                    "5.0";

            }
        );


    document
        .querySelectorAll(
            "[data-ride-otp]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    booking?.otp ||
                    "----";

            }
        );


    document
        .querySelectorAll(
            "[data-booking-fare]"
        )
        .forEach(
            function(element) {

                element.textContent =
                    "₹" +
                    (
                        booking?.fare ||
                        BOOKING.state.fare ||
                        0
                    );

            }
        );

};


/* ============================================================
   REQUEST RIDE
   ============================================================ */

BOOKING.requestRide =
async function(options = {}) {

    if(
        BOOKING.state.loading
    ) {

        throw new Error(
            "A booking request is already being processed."
        );

    }


    /*
     * Make sure Firebase authentication is
     * actually available.
     */

    if(!auth) {

        throw new Error(
            "RiderX Authentication is unavailable."
        );

    }


    const user =
        auth.currentUser ||
        BOOKING.getUser();


    if(!user) {

        throw new Error(
            "Please login as customer first."
        );

    }


    /*
     * Recalculate everything immediately
     * before writing to Firebase.
     */

    await BOOKING.estimate();


    const validation =
        BOOKING.validate();


    if(
        !validation.valid
    ) {

        throw new Error(
            validation.message
        );

    }


    BOOKING.state.loading =
        true;


    try {

        const booking =
            BOOKING.createObject({

                paymentMethod:
                    options.paymentMethod ||
                    BOOKING.state
                        .paymentMethod,

                scheduled:
                    Boolean(
                        options.scheduled
                    ),

                scheduledAt:
                    options.scheduledAt ||
                    null,

                notes:
                    options.notes ||
                    ""

            });


        BOOKING.state.booking =
            booking;


        BOOKING.state.rideStatus =
            "searching";


        BOOKING.state.matching =
            true;


        /*
         * REAL FIREBASE WRITE.
         */

        await BOOKING.saveBooking(
            booking
        );


        /*
         * LIVE STATUS LISTENER.
         */

        BOOKING.attachBookingListener(
            booking.id
        );


        BOOKING.updateBookingUI();


        BOOKING.emit(
            "ride-requested",
            {
                booking:
                    booking
            }
        );


        /*
         * Optional matching integration.
         */

        if(
            RX.matching &&
            typeof RX.matching.start ===
            "function"
        ) {

            try {

                await RX.matching.start(
                    booking
                );

            } catch(error) {

                console.warn(
                    "RiderX matching module:",
                    error
                );

            }

        }


        return booking;

    } finally {

        BOOKING.state.loading =
            false;

    }

};


/* ============================================================
   PUBLIC CREATE RIDE
   ============================================================ */

export async function createRideRequest(
    paymentMethod = null
) {

    if(paymentMethod) {

        BOOKING.setPaymentMethod(
            paymentMethod
        );

    }


    return await BOOKING.requestRide({

        paymentMethod:
            BOOKING.state
                .paymentMethod

    });

}


/* ============================================================
   CANCEL RIDE
   ============================================================ */

BOOKING.cancelRide =
async function(
    reason =
        "Customer cancelled"
) {

    const booking =
        BOOKING.state.booking;


    if(!booking?.id) {

        throw new Error(
            "No active ride found."
        );

    }


    const uid =
        BOOKING.getUid();


    const timestamp =
        Date.now();


    const updates = {

        status:
            "cancelled",

        rideStatus:
            "cancelled",

        cancellationReason:
            reason,

        cancelledBy:
            "customer",

        cancelledAt:
            timestamp,

        updatedAt:
            timestamp

    };


    if(realtimeDb) {

        await update(
            ref(
                realtimeDb,
                "rides/" +
                booking.id
            ),
            updates
        );


        if(uid) {

            await update(
                ref(
                    realtimeDb,
                    "customerRides/" +
                    uid +
                    "/" +
                    booking.id
                ),
                {

                    status:
                        "cancelled",

                    rideStatus:
                        "cancelled",

                    updatedAt:
                        timestamp

                }
            );

        }

    }


    if(db) {

        try {

            await setDoc(
                doc(
                    db,
                    "rides",
                    booking.id
                ),
                updates,
                {
                    merge:
                        true
                }
            );

        } catch(error) {

            console.warn(
                "RiderX cancellation mirror failed:",
                error
            );

        }

    }


    BOOKING.state.rideStatus =
        "cancelled";

    BOOKING.state.matching =
        false;


    BOOKING.updateBookingUI();


    BOOKING.emit(
        "ride-cancelled",
        {
            booking:
                booking,

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
async function() {

    const uid =
        BOOKING.getUid();


    if(
        !uid ||
        !realtimeDb
    ) {

        return null;

    }


    try {

        const customerRef =
            ref(
                realtimeDb,
                "customerRides/" +
                uid
            );


        const snapshot =
            await get(
                customerRef
            );


        if(
            !snapshot.exists()
        ) {

            return null;

        }


        const rides =
            snapshot.val() ||
            {};


        const ids =
            Object.keys(
                rides
            );


        if(
            !ids.length
        ) {

            return null;

        }


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


        /*
         * Newest records first.
         */

        ids.sort(
            function(a,b) {

                return (
                    Number(
                        rides[b]?.createdAt ||
                        0
                    ) -

                    Number(
                        rides[a]?.createdAt ||
                        0
                    )
                );

            }
        );


        for(
            const id of ids
        ) {

            const rideSnapshot =
                await get(
                    ref(
                        realtimeDb,
                        "rides/" +
                        id
                    )
                );


            if(
                !rideSnapshot.exists()
            ) {

                continue;

            }


            const ride =
                rideSnapshot.val();


            const status =
                ride.status ||
                ride.rideStatus;


            if(
                activeStatuses.includes(
                    status
                )
            ) {

                BOOKING.state.booking =
                    ride;


                BOOKING.state.rideStatus =
                    status;


                BOOKING.state.matching =
                    [
                        "searching",
                        "requested",
                        "pending"
                    ].includes(
                        status
                    );


                BOOKING.attachBookingListener(
                    ride.id ||
                    id
                );


                BOOKING.updateBookingUI();


                return ride;

            }

        }

    } catch(error) {

        /*
         * Active ride restore must NEVER
         * prevent the booking engine from
         * becoming ready.
         */

        console.warn(
            "RiderX active ride restore skipped:",
            error
        );

    }


    return null;

};


/* ============================================================
   EVENTS
   ============================================================ */

BOOKING.emit =
function(
    eventName,
    detail = {}
) {

    try {

        window.dispatchEvent(
            new CustomEvent(
                "riderx-booking-" +
                eventName,
                {
                    detail:
                        detail
                }
            )
        );

    } catch(error) {

        console.warn(
            "RiderX booking event:",
            error
        );

    }

};


BOOKING.on =
function(
    eventName,
    callback
) {

    if(
        typeof callback !==
        "function"
    ) {

        return;

    }


    window.addEventListener(
        "riderx-booking-" +
        eventName,
        function(event) {

            callback(
                event.detail ||
                {}
            );

        }
    );

};


/* ============================================================
   AUTH LISTENER
   ============================================================ */

BOOKING.setupAuth =
function() {

    if(
        !auth ||
        typeof onAuthStateChanged !==
        "function"
    ) {

        return;

    }


    if(
        BOOKING.state.authListener
    ) {

        return;

    }


    BOOKING.state.authListener =
        onAuthStateChanged(
            auth,
            function(user) {

                BOOKING.emit(
                    "auth-changed",
                    {
                        user:
                            user
                    }
                );


                if(!user) {

                    BOOKING.removeBookingListener();

                    BOOKING.state.booking =
                        null;

                    BOOKING.state.rideStatus =
                        "idle";

                    BOOKING.state.matching =
                        false;

                }

            }
        );

};


/* ============================================================
   INITIALIZE
   ============================================================ */

export async function initBookingModule() {

    /*
     * IMPORTANT:
     * Never leave the API unavailable because
     * an active ride restore failed.
     */

    if(
        BOOKING.state.initialized
    ) {

        window.RiderXBookingReady =
            true;

        return BOOKING;

    }


    /*
     * Firebase core check.
     */

    if(!auth) {

        throw new Error(
            "RiderX Firebase Authentication is not initialized."
        );

    }


    if(
        !realtimeDb &&
        !db
    ) {

        throw new Error(
            "RiderX Firebase Database is not initialized."
        );

    }


    /*
     * Defaults.
     */

    BOOKING.setService(
        "bike"
    );


    BOOKING.setPaymentMethod(
        "cash"
    );


    BOOKING.updateLocationUI();

    BOOKING.updateFare();

    BOOKING.updateBookingUI();


    /*
     * Auth listener.
     */

    BOOKING.setupAuth();


    /*
     * IMPORTANT:
     * Mark engine initialized BEFORE attempting
     * active ride restore.
     *
     * This prevents:
     *
     * "RiderX booking engine is not ready"
     *
     * when restoreActiveRide has a Firebase
     * permission/network issue.
     */

    BOOKING.state.initialized =
        true;


    window.RiderXBookingReady =
        true;


    /*
     * Complete public API.
     */

    window.RiderXBookingAPI = {

        ready:
            true,

        auth:
            auth,

        db:
            db,

        realtimeDb:
            realtimeDb,


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


        calculateFareEstimate:
            calculateFareEstimate,


        createRideRequest:
            createRideRequest,


        cancelRide:
            BOOKING.cancelRide,


        applyCoupon:
            BOOKING.applyCoupon,


        removeCoupon:
            BOOKING.removeCoupon,


        getActiveBooking:
            function() {

                return BOOKING.state
                    .booking;

            },


        getState:
            function() {

                return BOOKING.state;

            }

    };


    /*
     * Fire ready event.
     */

    BOOKING.emit(
        "ready",
        {
            api:
                window.RiderXBookingAPI
        }
    );


    console.info(
        "RiderX booking engine ready."
    );


    /*
     * Restore active ride AFTER
     * engine is already marked ready.
     *
     * Failure here does not break booking.
     */

    try {

        await BOOKING.restoreActiveRide();

    } catch(error) {

        console.warn(
            "RiderX active ride restore skipped:",
            error
        );

    }


    return BOOKING;

}


/* ============================================================
   RIDERX GLOBAL API
   ============================================================ */

RX.booking =
    BOOKING;


RX.bookingEngine =
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


RX.cancelRide =
    BOOKING.cancelRide;


/* ============================================================
   GLOBAL API SAFETY NET
   ------------------------------------------------------------
   This is intentionally created immediately.
   The customer booking page can therefore see the API even
   before async initialization finishes.
   ============================================================ */

window.RiderXBookingReady =
    false;


window.RiderXBookingAPI = {

    ready:
        false,

    auth:
        auth,

    db:
        db,

    realtimeDb:
        realtimeDb,


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


    calculateFareEstimate:
        calculateFareEstimate,


    createRideRequest:
        createRideRequest,


    cancelRide:
        BOOKING.cancelRide,


    applyCoupon:
        BOOKING.applyCoupon,


    removeCoupon:
        BOOKING.removeCoupon,


    getActiveBooking:
        function() {

            return BOOKING.state
                .booking;

        },


    getState:
        function() {

            return BOOKING.state;

        }

};


/* ============================================================
   AUTO INITIALIZATION
   ============================================================ */

function startBookingEngine() {

    initBookingModule()
        .catch(
            function(error) {

                /*
                 * API remains available even if initialization
                 * has a Firebase/network problem.
                 */

                console.error(
                    "RiderX booking engine initialization error:",
                    error
                );


                /*
                 * Keep API object alive.
                 */

                if(
                    window.RiderXBookingAPI
                ) {

                    window.RiderXBookingAPI
                        .ready =
                        false;

                }


                window.RiderXBookingReady =
                    false;


                BOOKING.emit(
                    "error",
                    {
                        error:
                            error
                    }
                );

            }
        );

}


if(
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startBookingEngine,
        {
            once:
                true
        }
    );

} else {

    startBookingEngine();

}


/* ============================================================
   MODULE EXPORT
   ============================================================ */

export {
    BOOKING
};
