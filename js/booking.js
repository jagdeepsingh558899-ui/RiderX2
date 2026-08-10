/* ============================================================
   RIDERX 2.0
   BOOKING ENGINE
   File: js/booking.js

   ES MODULE VERSION

   Handles:
   - Pickup / destination
   - Service selection
   - Fare estimate
   - Ride creation
   - Firebase RTDB + Firestore
   - Driver/rider matching trigger
   - Booking cancellation
   - Ride status
   - Payment method
   - Promo/coupon
   - Booking events

   IMPORTANT:
   This file uses the SINGLE Firebase instance exported by
   firebase/firebase-config.js.

   DO NOT initialize Firebase again here.
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
    setDoc
} from "../firebase/firebase-config.js";


/* ============================================================
   RIDERX NAMESPACE
   ============================================================ */

const RX =
    window.RiderX =
    window.RiderX || {};

RX.booking =
    RX.booking || {};

const BOOKING =
    RX.booking;


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

    requestTimeout:
        120000,

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

BOOKING.state = {

    initialized:
        false,

    loading:
        false,

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
        BOOKING.config.defaultService,

    paymentMethod:
        BOOKING.config.defaultPayment,

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
        null

};


/* ============================================================
   FIREBASE
   ============================================================ */

BOOKING.database =
    function () {

        return realtimeDb || null;

    };


BOOKING.firestore =
    function () {

        return db || null;

    };


BOOKING.getAuth =
    function () {

        return auth || null;

    };


/* ============================================================
   USER
   ============================================================ */

BOOKING.getUser =
    function () {

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

            } catch (error) {

                savedUser =
                    null;

            }


            if (
                firebaseUser
            ) {

                return {

                    ...savedUser,

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

        } catch (error) {

            console.warn(
                "RiderX user lookup failed:",
                error
            );

            return null;

        }

    };


BOOKING.getUid =
    function () {

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
   HELPERS
   ============================================================ */

BOOKING.number =
    function (value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;

    };


BOOKING.round =
    function (value) {

        return Math.round(
            BOOKING.number(value)
        );

    };


BOOKING.now =
    function () {

        return Date.now();

    };


BOOKING.id =
    function () {

        return (
            "RX-" +
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 8)
        ).toUpperCase();

    };


/* ============================================================
   SERVICE
   ============================================================ */

BOOKING.getService =
    function (service) {

        service =
            String(
                service ||
                BOOKING.state.service ||
                ""
            )
            .toLowerCase()
            .trim();


        if (
            service === "bike taxi" ||
            service === "bike_taxi" ||
            service === "motorcycle"
        ) {

            service =
                "bike";

        }


        if (
            service === "car"
        ) {

            service =
                "cab";

        }


        return (
            BOOKING.config
                .services[service] ||
            BOOKING.config
                .services.bike
        );

    };


BOOKING.setService =
    function (service) {

        const selected =
            BOOKING.getService(
                service
            );


        BOOKING.state.service =
            selected.id;


        if (
            document.body
        ) {

            document.body.dataset.service =
                selected.id;

        }


        document
            .querySelectorAll(
                "[data-service]"
            )
            .forEach(
                function (element) {

                    const value =
                        String(
                            element.dataset.service ||
                            ""
                        )
                        .toLowerCase();

                    element.classList.toggle(
                        "active",
                        value === selected.id
                    );

                    element.setAttribute(
                        "aria-selected",
                        value === selected.id
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
    function (method) {

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


        if (
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
                function (element) {

                    const value =
                        String(
                            element.dataset.paymentMethod ||
                            ""
                        )
                        .toLowerCase();

                    element.classList.toggle(
                        "active",
                        value === method
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
   LOCATION
   ============================================================ */

BOOKING.setPickup =
    function (location) {

        if (
            !location
        ) {

            return null;

        }


        const lat =
            BOOKING.number(
                location.lat
            );

        const lng =
            BOOKING.number(
                location.lng
            );


        if (
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


BOOKING.setDestination =
    function (location) {

        if (
            !location
        ) {

            return null;

        }


        const lat =
            BOOKING.number(
                location.lat
            );

        const lng =
            BOOKING.number(
                location.lng
            );


        if (
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


BOOKING.clearLocations =
    function () {

        BOOKING.state.pickup =
            null;

        BOOKING.state.destination =
            null;

        BOOKING.state.distanceKm =
            0;

        BOOKING.state.durationMinutes =
            0;


        BOOKING.updateLocationUI();

        BOOKING.updateFare();

    };


BOOKING.updateLocationUI =
    function () {

        const pickup =
            BOOKING.state.pickup;

        const destination =
            BOOKING.state.destination;


        document
            .querySelectorAll(
                "[data-pickup-address]"
            )
            .forEach(
                function (element) {

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
                function (element) {

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


        if (
            pickupInput &&
            pickup
        ) {

            pickupInput.value =
                pickup.address;

        }


        const destinationInput =
            document.querySelector(
                "#destination"
            ) ||
            document.querySelector(
                "#dropInput"
            );


        if (
            destinationInput &&
            destination
        ) {

            destinationInput.value =
                destination.address;

        }

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
            lat,

        lng:
            lng,

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
            lat,

        lng:
            lng,

        address:
            address ||
            "Destination"

    });

}


/* ============================================================
   DISTANCE
   ============================================================ */

BOOKING.calculateDistance =
    function (
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
            BOOKING.number(
                pickup.lat
            );

        const lon1 =
            BOOKING.number(
                pickup.lng
            );

        const lat2 =
            BOOKING.number(
                destination.lat
            );

        const lon2 =
            BOOKING.number(
                destination.lng
            );


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


        return (
            R * c
        );

    };


/* ============================================================
   FARE
   ============================================================ */

BOOKING.calculateFare =
    function (
        distanceKm,
        service
    ) {

        distanceKm =
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


        const hour =
            new Date()
                .getHours();


        let fare;


        /*
         * Bike pricing:
         *
         * 06:00 - 22:00
         * first 10 km = ₹8/km
         * above 10 km = ₹9/km
         *
         * 22:00 - 06:00
         * ₹11/km
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
                        distanceKm *
                        11
                    );

            } else if (
                distanceKm > 10
            ) {

                fare =
                    selected.baseFare +

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

                fare =
                    selected.baseFare +
                    (
                        distanceKm *
                        8
                    );

            }

        } else {

            fare =
                selected.baseFare +
                (
                    distanceKm *
                    selected.perKm
                );

        }


        fare =
            Math.max(
                fare,
                selected.minimumFare
            );


        return BOOKING.round(
            fare
        );

    };


/* ============================================================
   FARE UPDATE
   ============================================================ */

BOOKING.updateFare =
    function () {

        const distance =
            BOOKING.number(
                BOOKING.state.distanceKm
            );


        const base =
            BOOKING.calculateFare(
                distance,
                BOOKING.state.service
            );


        const discount =
            Math.min(
                base,
                BOOKING.number(
                    BOOKING.state.discount
                )
            );


        const total =
            Math.max(
                0,
                base -
                discount
            );


        BOOKING.state.estimatedFare =
            base;


        BOOKING.state.fare =
            BOOKING.round(
                total
            );


        document
            .querySelectorAll(
                "[data-fare]"
            )
            .forEach(
                function (element) {

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
                function (element) {

                    element.textContent =
                        "₹" +
                        BOOKING.state.estimatedFare;

                }
            );


        document
            .querySelectorAll(
                "[data-discount]"
            )
            .forEach(
                function (element) {

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
                function (element) {

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
                function (element) {

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
    async function () {

        if (
            !BOOKING.state.pickup ||
            !BOOKING.state.destination
        ) {

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


        BOOKING.state.durationMinutes =
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


/* ============================================================
   PUBLIC FARE API
   ============================================================ */

export async function calculateFareEstimate() {

    return await BOOKING.estimate();

}


/* ============================================================
   COUPON
   ============================================================ */

BOOKING.applyCoupon =
    async function (code) {

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


        /*
         * Realtime Database coupons.
         */

        if (
            realtimeDb
        ) {

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


            if (
                snapshot.exists()
            ) {

                const coupon =
                    snapshot.val() ||
                    {};


                if (
                    coupon.active ===
                    false
                ) {

                    throw new Error(
                        "This coupon is inactive."
                    );

                }


                if (
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


                if (
                    coupon.type ===
                    "percent"
                ) {

                    discount =
                        BOOKING.state
                            .estimatedFare *

                        (
                            BOOKING.number(
                                coupon.value
                            ) /
                            100
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
                        BOOKING.state
                            .estimatedFare
                    );


                BOOKING.state.coupon = {

                    code:
                        code,

                    type:
                        coupon.type,

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

            }

        }


        throw new Error(
            "Invalid coupon code."
        );

    };


BOOKING.removeCoupon =
    function () {

        BOOKING.state.coupon =
            null;

        BOOKING.state.discount =
            0;

        BOOKING.updateFare();

    };


/* ============================================================
   VALIDATE
   ============================================================ */

BOOKING.validate =
    function () {

        const user =
            BOOKING.getUser();


        if (
            !user
        ) {

            return {

                valid:
                    false,

                message:
                    "Please login before booking a ride."

            };

        }


        if (
            !BOOKING.state.pickup
        ) {

            return {

                valid:
                    false,

                message:
                    "Please select your pickup location."

            };

        }


        if (
            !BOOKING.state.destination
        ) {

            return {

                valid:
                    false,

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

                valid:
                    false,

                message:
                    "Pickup and destination cannot be the same."

            };

        }


        if (
            BOOKING.state.distanceKm <=
            0
        ) {

            return {

                valid:
                    false,

                message:
                    "Unable to calculate the route distance."

            };

        }


        if (
            BOOKING.state.fare <=
            0
        ) {

            return {

                valid:
                    false,

                message:
                    "Unable to calculate the fare."

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
    function (extra = {}) {

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
                    ?.lat ||
                null,

            pickupLng:
                BOOKING.state.pickup
                    ?.lng ||
                null,

            destinationLat:
                BOOKING.state.destination
                    ?.lat ||
                null,

            destinationLng:
                BOOKING.state.destination
                    ?.lng ||
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
   SAVE TO REALTIME DATABASE
   ============================================================ */

BOOKING.saveRealtime =
    async function (booking) {

        if (
            !realtimeDb
        ) {

            throw new Error(
                "RiderX Realtime Database is not available."
            );

        }


        const rideReference =
            ref(
                realtimeDb,
                "rides/" +
                booking.id
            );


        await set(
            rideReference,
            booking
        );


        if (
            booking.customerId
        ) {

            const customerRideReference =
                ref(
                    realtimeDb,
                    "customerRides/" +
                    booking.customerId +
                    "/" +
                    booking.id
                );


            await set(
                customerRideReference,
                {

                    bookingId:
                        booking.id,

                    rideId:
                        booking.id,

                    status:
                        booking.status,

                    service:
                        booking.service,

                    fare:
                        booking.fare,

                    createdAt:
                        booking.createdAt

                }
            );

        }


        return booking;

    };


/* ============================================================
   SAVE FIRESTORE MIRROR
   ============================================================ */

BOOKING.saveFirestore =
    async function (booking) {

        if (
            !db
        ) {

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

        } catch (error) {

            console.warn(
                "RiderX Firestore mirror failed:",
                error
            );

            /*
             * RTDB is the primary ride transport.
             * Firestore mirror failure should not
             * make a valid ride disappear.
             */

        }


        return booking;

    };


/* ============================================================
   SAVE BOOKING
   ============================================================ */

BOOKING.saveBooking =
    async function (booking) {

        if (
            !realtimeDb &&
            !db
        ) {

            throw new Error(
                "Firebase database is not available."
            );

        }


        /*
         * RTDB is authoritative for live ride flow.
         */

        if (
            realtimeDb
        ) {

            await BOOKING.saveRealtime(
                booking
            );

        }


        /*
         * Firestore mirror.
         */

        if (
            db
        ) {

            await BOOKING.saveFirestore(
                booking
            );

        }


        return booking;

    };


/* ============================================================
   ATTACH RIDE LISTENER
   ============================================================ */

BOOKING.removeBookingListener =
    function () {

        if (
            BOOKING.bookingListener &&
            BOOKING.bookingListenerRef &&
            realtimeDb
        ) {

            try {

                off(
                    BOOKING.bookingListenerRef,
                    "value",
                    BOOKING.bookingListener
                );

            } catch (error) {

                console.warn(
                    "RiderX ride listener removal failed:",
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


                if (
                    !ride
                ) {

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
                        BOOKING.state
                            .rideStatus
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


                if (
                    [
                        "completed",
                        "cancelled",
                        "canceled",
                        "rejected"
                    ].includes(
                        BOOKING.state
                            .rideStatus
                    )
                ) {

                    BOOKING.state.matching =
                        false;

                }

            };


        BOOKING.bookingListenerRef =
            rideReference;

        BOOKING.bookingListener =
            listener;


        onValue(
            rideReference,
            listener
        );


        return listener;

    };


/* ============================================================
   UPDATE BOOKING UI
   ============================================================ */

BOOKING.updateBookingUI =
    function () {

        const booking =
            BOOKING.state.booking;

        const status =
            booking?.status ||
            booking?.rideStatus ||
            BOOKING.state
                .rideStatus;


        document
            .querySelectorAll(
                "[data-ride-status]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        status ||
                        "idle";

                }
            );


        document
            .querySelectorAll(
                "[data-rider-name]"
            )
            .forEach(
                function (element) {

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
                function (element) {

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
                function (element) {

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
                function (element) {

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
                function (element) {

                    element.textContent =
                        "₹" +
                        (
                            booking?.fare ||
                            BOOKING.state.fare ||
                            0
                        );

                }
            );


        document
            .querySelectorAll(
                "[data-cancel-ride]"
            )
            .forEach(
                function (element) {

                    const canCancel =
                        [
                            "searching",
                            "requested",
                            "pending",
                            "accepted",
                            "arriving",
                            "driver_arriving"
                        ].includes(
                            status
                        );


                    element.disabled =
                        !canCancel;

                }
            );

    };


/* ============================================================
   REQUEST RIDE
   ============================================================ */

BOOKING.requestRide =
    async function (options = {}) {

        if (
            BOOKING.state.loading
        ) {

            throw new Error(
                "A booking request is already being processed."
            );

        }


        const validation =
            BOOKING.validate();


        if (
            !validation.valid
        ) {

            throw new Error(
                validation.message
            );

        }


        BOOKING.state.loading =
            true;


        try {

            /*
             * Recalculate immediately before
             * writing the ride.
             */

            await BOOKING.estimate();


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
             * Real Firebase write.
             */

            await BOOKING.saveBooking(
                booking
            );


            /*
             * Attach real-time ride listener.
             */

            BOOKING.attachBookingListener(
                booking.id
            );


            /*
             * Optional matching module.
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
             * Optional request module.
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
                    booking:
                        booking
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

    if (
        paymentMethod
    ) {

        BOOKING.setPaymentMethod(
            paymentMethod
        );

    }


    return await BOOKING.requestRide({

        paymentMethod:
            BOOKING.state.paymentMethod

    });

}


/* ============================================================
   CANCEL RIDE
   ============================================================ */

BOOKING.cancelRide =
    async function (
        reason = "Customer cancelled"
    ) {

        const booking =
            BOOKING.state.booking;


        if (
            !booking?.id
        ) {

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


        if (
            realtimeDb
        ) {

            await update(
                ref(
                    realtimeDb,
                    "rides/" +
                    booking.id
                ),
                updates
            );


            if (
                uid
            ) {

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

                        updatedAt:
                            timestamp

                    }
                );

            }

        }


        if (
            db
        ) {

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

            } catch (error) {

                console.warn(
                    "Firestore cancellation mirror failed:",
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

            const customerReference =
                ref(
                    realtimeDb,
                    "customerRides/" +
                    uid
                );


            const snapshot =
                await get(
                    customerReference
                );


            const rides =
                snapshot.val() ||
                {};


            const ids =
                Object.keys(
                    rides
                );


            if (
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
             * Check newest rides first.
             */

            for (
                let i =
                    ids.length - 1;
                i >= 0;
                i--
            ) {

                const id =
                    ids[i];


                const rideSnapshot =
                    await get(
                        ref(
                            realtimeDb,
                            "rides/" +
                            id
                        )
                    );


                const ride =
                    rideSnapshot.val();


                if (
                    !ride
                ) {

                    continue;

                }


                if (
                    activeStatuses.includes(
                        ride.status ||
                        ride.rideStatus
                    )
                ) {

                    BOOKING.state.booking =
                        ride;


                    BOOKING.state.rideStatus =
                        ride.status ||
                        ride.rideStatus;


                    BOOKING.attachBookingListener(
                        ride.id ||
                        id
                    );


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
   UI BINDINGS
   ============================================================ */

BOOKING.bindUI =
    function () {

        /*
         * Service buttons.
         */

        document.addEventListener(
            "click",
            function (event) {

                const serviceButton =
                    event.target.closest(
                        "[data-service]"
                    );


                if (
                    serviceButton
                ) {

                    /*
                     * Do not interfere with
                     * customer/booking.html's
                     * own onclick handler.
                     */

                    BOOKING.setService(
                        serviceButton.dataset.service
                    );

                    return;

                }


                const paymentButton =
                    event.target.closest(
                        "[data-payment-method]"
                    );


                if (
                    paymentButton
                ) {

                    BOOKING.setPaymentMethod(
                        paymentButton.dataset.paymentMethod
                    );

                }

            }
        );


        /*
         * Cancel buttons.
         */

        document.addEventListener(
            "click",
            async function (event) {

                const cancelButton =
                    event.target.closest(
                        "[data-cancel-ride]"
                    );


                if (
                    !cancelButton
                ) {

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
   AUTH
   ============================================================ */

BOOKING.setupAuth =
    function () {

        if (
            !auth
        ) {

            return;

        }


        /*
         * Firebase modular Auth listener.
         */

        import(
            "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
        )
            .then(
                function (module) {

                    if (
                        typeof module.onAuthStateChanged !==
                        "function"
                    ) {

                        return;

                    }


                    module.onAuthStateChanged(
                        auth,
                        function (user) {

                            if (
                                !user
                            ) {

                                BOOKING
                                    .removeBookingListener();

                                BOOKING.state.booking =
                                    null;

                                BOOKING.state.rideStatus =
                                    "idle";

                                BOOKING.state.matching =
                                    false;

                            }

                        }
                    );

                }
            )
            .catch(
                function (error) {

                    console.warn(
                        "RiderX auth listener failed:",
                        error
                    );

                }
            );

    };


/* ============================================================
   EVENTS
   ============================================================ */

BOOKING.emit =
    function (
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

        } catch (error) {

            console.warn(
                "RiderX booking event failed:",
                error
            );

        }

    };


BOOKING.on =
    function (
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
                    event.detail ||
                    {}
                );

            }
        );

    };


/* ============================================================
   INITIALIZATION
   ============================================================ */

export async function initBookingModule() {

    if (
        BOOKING.state.initialized
    ) {

        return BOOKING;

    }


    if (
        !auth
    ) {

        throw new Error(
            "RiderX Firebase Authentication is not initialized."
        );

    }


    if (
        !realtimeDb &&
        !db
    ) {

        throw new Error(
            "RiderX Firebase database is not initialized."
        );

    }


    BOOKING.setService(
        BOOKING.config
            .defaultService
    );


    BOOKING.setPaymentMethod(
        BOOKING.config
            .defaultPayment
    );


    BOOKING.bindUI();

    BOOKING.setupAuth();


    BOOKING.updateLocationUI();

    BOOKING.updateFare();

    BOOKING.updateBookingUI();


    /*
     * Restore an active ride if one exists.
     */

    try {

        await BOOKING.restoreActiveRide();

    } catch (error) {

        console.warn(
            "RiderX active ride restore skipped:",
            error
        );

    }


    BOOKING.state.initialized =
        true;


    BOOKING.emit(
        "ready"
    );


    /*
     * Compatibility globals.
     *
     * customer/booking.html expects
     * window.RiderXBookingAPI.
     */

    window.RiderXBookingReady =
        true;


    window.RiderXBookingAPI = {

        auth:

            auth,

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

        getActiveBooking:

            function () {

                return BOOKING.state.booking;

            },

        state:

            BOOKING.state

    };


    console.log(
        "RiderX booking engine ready."
    );


    return BOOKING;

}


/* ============================================================
   PUBLIC GLOBAL RIDERX API
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


RX.cancelRide =
    BOOKING.cancelRide;


RX.getActiveBooking =
    function () {

        return BOOKING.state.booking;

    };


/* ============================================================
   AUTO INITIALIZATION
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initBookingModule()
                .catch(
                    function (error) {

                        console.error(
                            "RiderX booking engine initialization failed:",
                            error
                        );

                        window.RiderXBookingReady =
                            false;

                    }
                );

        },
        {
            once:
                true
        }
    );

} else {

    initBookingModule()
        .catch(
            function (error) {

                console.error(
                    "RiderX booking engine initialization failed:",
                    error
                );

                window.RiderXBookingReady =
                    false;

            }
        );

}


/* ============================================================
   MODULE READY
   ============================================================ */

export {

    BOOKING

};
