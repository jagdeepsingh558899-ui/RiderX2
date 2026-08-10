/* ============================================================
RIDERX 2.0
CUSTOMER RIDE CONTROLLER
File: js/customer-ride.js

Customer ride lifecycle:

- Create booking
- Vehicle/service selection
- Fare estimate
- Driver searching
- Driver matched
- Driver accepted
- Driver arriving
- Driver arrived
- OTP verification
- Trip started
- Live trip
- Trip completed
- Cancellation
- Payment
- Rating
- Firebase Realtime Database + Firestore

Compatible statuses:
REQUESTED / searching
ACCEPTED / accepted / driver_assigned
ARRIVING / driver_arriving / arriving
ARRIVED / arrived
STARTED / started / on_trip
COMPLETED / completed / complete
CANCELLED / cancelled / canceled
============================================================ */

(function () {

"use strict";


/* ============================================================
   GLOBAL
   ============================================================ */

window.RiderX = window.RiderX || {};

const RX = window.RiderX;

const CR =
    RX.customerRide =
    RX.customerRide || {};


/* ============================================================
   CONFIG
   ============================================================ */

CR.config = {

    ridesPath:
        "rides",

    bookingsPath:
        "bookings",

    driversPath:
        "drivers",

    usersPath:
        "users",

    matchingPath:
        "rideRequests",

    paymentsPath:
        "payments",

    ratingsPath:
        "ratings",

    searchTimeout:
        45000,

    cancelBeforeAcceptFee:
        0,

    defaultPayment:
        "cash",

    /*
     * RiderX canonical lifecycle.
     */
    statuses: {

        requested:
            "REQUESTED",

        accepted:
            "ACCEPTED",

        arriving:
            "ARRIVING",

        arrived:
            "ARRIVED",

        started:
            "STARTED",

        completed:
            "COMPLETED",

        cancelled:
            "CANCELLED"
    },

    services: {

        bike: {

            id:
                "bike",

            name:
                "Bike Taxi",

            icon:
                "🏍️",

            baseFare:
                30,

            perKm:
                8,

            minimumFare:
                40,

            capacity:
                1
        },

        auto: {

            id:
                "auto",

            name:
                "Auto",

            icon:
                "🛺",

            baseFare:
                40,

            perKm:
                10,

            minimumFare:
                50,

            capacity:
                3
        },

        cab: {

            id:
                "cab",

            name:
                "Cab",

            icon:
                "🚕",

            baseFare:
                60,

            perKm:
                14,

            minimumFare:
                80,

            capacity:
                4
        },

        parcel: {

            id:
                "parcel",

            name:
                "Parcel",

            icon:
                "📦",

            baseFare:
                40,

            perKm:
                10,

            minimumFare:
                50,

            capacity:
                1
        }
    }
};


/* ============================================================
   STATE
   ============================================================ */

CR.state = {

    initialized:
        false,

    booking:
        null,

    ride:
        null,

    status:
        "idle",

    service:
        "bike",

    paymentMethod:
        "cash",

    pickup:
        null,

    destination:
        null,

    route:
        null,

    fare:
        null,

    searchStartedAt:
        null,

    searchTimer:
        null,

    rideListener:
        null,

    bookingListener:
        null,

    driverListener:
        null,

    driverLocationListener:
        null,

    currentDriver:
        null,

    otp:
        null,

    cancellationReason:
        null,

    loading:
        false,

    listenersBound:
        false,

    statusHandling:
        false,

    lastStatus:
        null
};


/* ============================================================
   FIREBASE
   ============================================================ */

CR.database = function () {

    try {

        if (
            window.firebase &&
            typeof window.firebase.database ===
            "function"
        ) {

            return window.firebase.database();
        }

    } catch (error) {

        console.warn(
            "RiderX customer ride database error:",
            error
        );
    }

    return null;
};


CR.firestore = function () {

    try {

        if (
            window.firebase &&
            typeof window.firebase.firestore ===
            "function"
        ) {

            return window.firebase.firestore();
        }

    } catch (error) {

        console.warn(
            "RiderX customer ride firestore error:",
            error
        );
    }

    return null;
};


/* ============================================================
   USER
   ============================================================ */

CR.getUser = function () {

    try {

        if (
            RX.auth &&
            typeof RX.auth.getUser ===
            "function"
        ) {

            const user =
                RX.auth.getUser();

            if (user) {
                return user;
            }
        }

    } catch (error) {

        console.warn(
            "RiderX auth user lookup failed:",
            error
        );
    }


    try {

        const saved =
            localStorage.getItem(
                "riderx_user"
            );

        if (!saved) {
            return null;
        }

        return JSON.parse(
            saved
        );

    } catch (error) {

        return null;
    }
};


CR.getUid = function () {

    const user =
        CR.getUser();

    if (!user) {
        return null;
    }

    return (
        user.uid ||
        user.id ||
        user.userId ||
        user.customerId ||
        null
    );
};


/* ============================================================
   ID
   ============================================================ */

CR.generateId = function (
    prefix
) {

    return (
        String(
            prefix ||
            "ride"
        ) +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
};


/* ============================================================
   STATUS HELPERS
   ============================================================ */

CR.normalizeStatus = function (
    status
) {

    const value =
        String(
            status ||
            ""
        )
        .trim()
        .toLowerCase();


    const map = {

        requested:
            "searching",

        request:
            "searching",

        searching:
            "searching",

        pending:
            "searching",

        accepted:
            "accepted",

        driver_assigned:
            "accepted",

        assigned:
            "accepted",

        arriving:
            "driver_arriving",

        driver_arriving:
            "driver_arriving",

        arrived:
            "arrived",

        otp_pending:
            "otp_pending",

        started:
            "started",

        on_trip:
            "started",

        trip_started:
            "started",

        completed:
            "completed",

        complete:
            "completed",

        cancelled:
            "cancelled",

        canceled:
            "cancelled"
    };


    return (
        map[value] ||
        value ||
        "idle"
    );
};


CR.isActiveStatus = function (
    status
) {

    return [
        "searching",
        "accepted",
        "driver_arriving",
        "arrived",
        "otp_pending",
        "started"
    ].includes(
        CR.normalizeStatus(
            status
        )
    );
};


CR.isTerminalStatus = function (
    status
) {

    return [
        "completed",
        "cancelled"
    ].includes(
        CR.normalizeStatus(
            status
        )
    );
};


CR.getCanonicalStatus = function (
    status
) {

    const normalized =
        CR.normalizeStatus(
            status
        );


    const map = {

        searching:
            CR.config.statuses.requested,

        accepted:
            CR.config.statuses.accepted,

        driver_arriving:
            CR.config.statuses.arriving,

        arrived:
            CR.config.statuses.arrived,

        otp_pending:
            CR.config.statuses.arrived,

        started:
            CR.config.statuses.started,

        completed:
            CR.config.statuses.completed,

        cancelled:
            CR.config.statuses.cancelled
    };


    return (
        map[normalized] ||
        status ||
        CR.config.statuses.requested
    );
};


/* ============================================================
   SERVICE
   ============================================================ */

CR.getService = function (
    service
) {

    const id =
        String(
            service ||
            CR.state.service ||
            "bike"
        )
        .trim()
        .toLowerCase();


    return (
        CR.config.services[id] ||
        CR.config.services.bike
    );
};


CR.setService = function (
    service
) {

    const selected =
        CR.getService(
            service
        );


    CR.state.service =
        selected.id;


    document
        .querySelectorAll(
            "[data-service]"
        )
        .forEach(
            function (
                element
            ) {

                element.classList.toggle(
                    "active",
                    element.dataset.service ===
                    selected.id
                );
            }
        );


    CR.updateFareUI();


    CR.emit(
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

CR.setPaymentMethod = function (
    method
) {

    method =
        String(
            method ||
            CR.config.defaultPayment
        )
        .trim()
        .toLowerCase();


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
            CR.config.defaultPayment;
    }


    CR.state.paymentMethod =
        method;


    document
        .querySelectorAll(
            "[data-payment-method]"
        )
        .forEach(
            function (
                element
            ) {

                element.classList.toggle(
                    "active",
                    element.dataset.paymentMethod ===
                    method
                );
            }
        );


    CR.emit(
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

CR.normalizePoint = function (
    point
) {

    if (!point) {
        return null;
    }


    const lat =
        Number(
            point.lat
        );


    const lng =
        Number(
            point.lng
        );


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return null;
    }


    if (
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
    ) {

        return null;
    }


    return {

        lat:
            lat,

        lng:
            lng,

        address:
            point.address ||
            point.name ||
            ""
    };
};


CR.setPickup = function (
    pickup
) {

    const point =
        CR.normalizePoint(
            pickup
        );


    if (!point) {
        return null;
    }


    CR.state.pickup =
        point;


    CR.emit(
        "pickup-changed",
        {
            pickup:
                point
        }
    );


    CR.updateFareUI();


    return point;
};


CR.setDestination = function (
    destination
) {

    const point =
        CR.normalizePoint(
            destination
        );


    if (!point) {
        return null;
    }


    CR.state.destination =
        point;


    CR.emit(
        "destination-changed",
        {
            destination:
                point
        }
    );


    CR.updateFareUI();


    return point;
};


/* ============================================================
   DISTANCE
   ============================================================ */

CR.distance = function (
    a,
    b
) {

    if (!a || !b) {
        return 0;
    }


    const lat1 =
        Number(a.lat);


    const lat2 =
        Number(b.lat);


    const lng1 =
        Number(a.lng);


    const lng2 =
        Number(b.lng);


    if (
        ![
            lat1,
            lat2,
            lng1,
            lng2
        ]
        .every(
            Number.isFinite
        )
    ) {

        return 0;
    }


    const R =
        6371;


    const dLat =
        (
            lat2 -
            lat1
        ) *
        Math.PI /
        180;


    const dLng =
        (
            lng2 -
            lng1
        ) *
        Math.PI /
        180;


    const radLat1 =
        lat1 *
        Math.PI /
        180;


    const radLat2 =
        lat2 *
        Math.PI /
        180;


    const x =
        Math.sin(
            dLat / 2
        ) *
        Math.sin(
            dLat / 2
        ) +
        Math.cos(
            radLat1
        ) *
        Math.cos(
            radLat2
        ) *
        Math.sin(
            dLng / 2
        ) *
        Math.sin(
            dLng / 2
        );


    const safeX =
        Math.min(
            1,
            Math.max(
                0,
                x
            )
        );


    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(
                safeX
            ),
            Math.sqrt(
                1 -
                safeX
            )
        )
    );
};


/* ============================================================
   ROUTE DISTANCE NORMALIZER
   ============================================================ */

CR.getRouteDistanceKm = function (
    route
) {

    if (!route) {
        return null;
    }


    let distance =
        route.distance;


    if (
        distance === undefined ||
        distance === null
    ) {

        distance =
            route.distanceMeters ??
            route.distanceKm;
    }


    distance =
        Number(
            distance
        );


    if (
        !Number.isFinite(
            distance
        ) ||
        distance <= 0
    ) {

        return null;
    }


    /*
     * Most Leaflet routing plugins return meters.
     * Explicit distanceKm is already kilometres.
     */

    if (
        route.distanceKm !== undefined &&
        route.distanceMeters === undefined &&
        route.distance !== undefined
    ) {

        const explicitKm =
            Number(
                route.distanceKm
            );

        if (
            Number.isFinite(
                explicitKm
            ) &&
            explicitKm > 0
        ) {

            return explicitKm;
        }
    }


    if (
        route.distanceMeters !== undefined
    ) {

        return (
            distance /
            1000
        );
    }


    /*
     * Standard customerMap.drawRoute()
     * implementation is expected to return
     * distance in metres.
     */

    if (
        distance > 100
    ) {

        return (
            distance /
            1000
        );
    }


    return distance;
};


/* ============================================================
   FARE
   ============================================================ */

CR.calculateFare = function (
    distanceKm,
    serviceId,
    options
) {

    const service =
        CR.getService(
            serviceId
        );


    const distance =
        Math.max(
            0,
            Number(
                distanceKm
            ) ||
            0
        );


    options =
        options ||
        {};


    let perKm =
        Number(
            service.perKm
        ) ||
        0;


    const hour =
        new Date()
            .getHours();


    /*
     * RiderX pricing:
     *
     * 06:00 - 22:00
     * Bike <= 10 km: ₹8/km
     *
     * 06:00 - 22:00
     * Bike > 10 km: ₹9/km
     *
     * 22:00 - 06:00
     * Bike: ₹11/km
     */

    if (
        service.id ===
        "bike"
    ) {

        if (
            hour >= 22 ||
            hour < 6
        ) {

            perKm =
                11;

        } else if (
            distance > 10
        ) {

            perKm =
                9;

        } else {

            perKm =
                8;
        }
    }


    const baseFare =
        Number(
            service.baseFare
        ) ||
        0;


    const minimumFare =
        Number(
            service.minimumFare
        ) ||
        0;


    let subtotal =
        baseFare +
        (
            distance *
            perKm
        );


    subtotal =
        Math.max(
            subtotal,
            minimumFare
        );


    const surge =
        Math.max(
            1,
            Number(
                options.surge
            ) ||
            1
        );


    const surgeAmount =
        subtotal *
        (
            surge -
            1
        );


    const discount =
        Math.max(
            0,
            Number(
                options.discount
            ) ||
            0
        );


    const tax =
        Math.max(
            0,
            Number(
                options.tax
            ) ||
            0
        );


    const total =
        Math.max(
            0,
            subtotal +
            surgeAmount +
            tax -
            discount
        );


    return {

        service:
            service.id,

        serviceName:
            service.name,

        distanceKm:
            Number(
                distance.toFixed(
                    2
                )
            ),

        baseFare:
            Number(
                baseFare.toFixed(
                    2
                )
            ),

        perKm:
            perKm,

        subtotal:
            Number(
                subtotal.toFixed(
                    2
                )
            ),

        surge:
            Number(
                surgeAmount.toFixed(
                    2
                )
            ),

        discount:
            Number(
                discount.toFixed(
                    2
                )
            ),

        tax:
            Number(
                tax.toFixed(
                    2
                )
            ),

        total:
            Math.round(
                total
            ),

        currency:
            "INR"
    };
};


CR.updateFareUI = function () {

    if (
        !CR.state.pickup ||
        !CR.state.destination
    ) {

        return null;
    }


    const distance =
        CR.distance(
            CR.state.pickup,
            CR.state.destination
        );


    const fare =
        CR.calculateFare(
            distance,
            CR.state.service
        );


    CR.state.fare =
        fare;


    document
        .querySelectorAll(
            "[data-fare]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    "₹" +
                    fare.total;
            }
        );


    document
        .querySelectorAll(
            "[data-fare-distance]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    fare.distanceKm +
                    " km";
            }
        );


    document
        .querySelectorAll(
            "[data-fare-breakdown]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    "₹" +
                    fare.total;
            }
        );


    CR.emit(
        "fare-updated",
        {
            fare:
                fare
        }
    );


    return fare;
};


/* ============================================================
   ROUTE
   ============================================================ */

CR.calculateRoute = async function () {

    if (
        !CR.state.pickup ||
        !CR.state.destination
    ) {

        return null;
    }


    if (
        RX.customerMap &&
        typeof RX.customerMap.drawRoute ===
        "function"
    ) {

        try {

            const route =
                await RX.customerMap
                    .drawRoute(
                        CR.state.pickup,
                        CR.state.destination
                    );


            if (route) {

                CR.state.route =
                    route;


                const routeDistanceKm =
                    CR.getRouteDistanceKm(
                        route
                    );


                const distanceKm =
                    routeDistanceKm ||
                    CR.distance(
                        CR.state.pickup,
                        CR.state.destination
                    );


                CR.state.fare =
                    CR.calculateFare(
                        distanceKm,
                        CR.state.service
                    );


                CR.updateFareUI();


                return route;
            }

        } catch (error) {

            console.warn(
                "RiderX route calculation failed:",
                error
            );
        }
    }


    const distance =
        CR.distance(
            CR.state.pickup,
            CR.state.destination
        );


    CR.state.fare =
        CR.calculateFare(
            distance,
            CR.state.service
        );


    return null;
};


/* ============================================================
   VALIDATION
   ============================================================ */

CR.validateBooking = function () {

    const errors = [];


    if (!CR.getUid()) {

        errors.push(
            "Please login first."
        );
    }


    if (!CR.state.pickup) {

        errors.push(
            "Pickup location is required."
        );
    }


    if (!CR.state.destination) {

        errors.push(
            "Destination is required."
        );
    }


    if (
        CR.state.pickup &&
        CR.state.destination
    ) {

        const distance =
            CR.distance(
                CR.state.pickup,
                CR.state.destination
            );


        if (
            distance <
            0.05
        ) {

            errors.push(
                "Pickup and destination are too close."
            );
        }
    }


    return {

        valid:
            errors.length === 0,

        errors:
            errors
    };
};


/* ============================================================
   CREATE BOOKING
   ============================================================ */

CR.createBooking = async function (
    options
) {

    options =
        options ||
        {};


    if (CR.state.loading) {

        throw new Error(
            "Ride booking is already in progress."
        );
    }


    const existing =
        CR.state.ride;


    if (
        existing &&
        CR.isActiveStatus(
            existing.status
        )
    ) {

        CR.showError(
            "You already have an active ride."
        );

        return existing;
    }


    const validation =
        CR.validateBooking();


    if (!validation.valid) {

        CR.showError(
            validation.errors[0]
        );

        throw new Error(
            validation.errors.join(
                " "
            )
        );
    }


    CR.state.loading =
        true;


    try {

        await CR.calculateRoute();


        const user =
            CR.getUser();


        const uid =
            CR.getUid();


        if (!uid) {

            throw new Error(
                "Please login first."
            );
        }


        const bookingId =
            CR.generateId(
                "RX"
            );


        const routeDistanceKm =
            CR.getRouteDistanceKm(
                CR.state.route
            );


        const distanceKm =
            routeDistanceKm ||
            CR.distance(
                CR.state.pickup,
                CR.state.destination
            );


        const fare =
            CR.calculateFare(
                distanceKm,
                CR.state.service,
                {

                    surge:
                        options.surge ||
                        1,

                    discount:
                        options.discount ||
                        0,

                    tax:
                        options.tax ||
                        0
                }
            );


        const now =
            Date.now();


        const booking = {

            id:
                bookingId,

            bookingId:
                bookingId,

            rideId:
                bookingId,

            customerId:
                uid,

            customerUid:
                uid,

            customerName:
                user?.name ||
                user?.displayName ||
                "Customer",

            customerPhone:
                user?.phone ||
                user?.phoneNumber ||
                "",

            customerPhoto:
                user?.photoURL ||
                user?.photo ||
                "",

            service:
                CR.state.service,

            serviceName:
                CR.getService()
                    .name,

            pickup:
                CR.state.pickup,

            destination:
                CR.state.destination,

            route:
                CR.state.route ||
                null,

            distanceKm:
                Number(
                    distanceKm.toFixed(
                        2
                    )
                ),

            fare:
                fare,

            estimatedFare:
                fare.total,

            paymentMethod:
                CR.state.paymentMethod,

            /*
             * Canonical state is REQUESTED.
             * "searching" is retained as the
             * customer-side normalized state.
             */
            status:
                CR.config.statuses.requested,

            rideStatus:
                CR.config.statuses.requested,

            driverId:
                null,

            riderId:
                null,

            driverName:
                null,

            riderName:
                null,

            driverPhone:
                null,

            riderPhone:
                null,

            driverPhoto:
                null,

            riderPhoto:
                null,

            vehicle:
                null,

            vehicleName:
                null,

            vehicleNumber:
                null,

            numberPlate:
                null,

            driverRating:
                null,

            riderRating:
                null,

            otp:
                null,

            createdAt:
                now,

            updatedAt:
                now,

            cancelledAt:
                null,

            completedAt:
                null,

            cancellationReason:
                null,

            cancelledBy:
                null
        };


        CR.state.booking =
            booking;

        CR.state.ride =
            booking;

        CR.state.status =
            "searching";

        CR.state.lastStatus =
            "searching";

        CR.state.searchStartedAt =
            now;


        const database =
            CR.database();


        if (!database) {

            throw new Error(
                "Firebase database is not available."
            );
        }


        /*
         * ----------------------------------------------------
         * RTDB BOOKING
         * ----------------------------------------------------
         */

        await database
            .ref(
                CR.config.bookingsPath +
                "/" +
                bookingId
            )
            .set(
                booking
            );


        /*
         * ----------------------------------------------------
         * RTDB RIDE
         * ----------------------------------------------------
         */

        await database
            .ref(
                CR.config.ridesPath +
                "/" +
                bookingId
            )
            .set(
                booking
            );


        /*
         * ----------------------------------------------------
         * DRIVER MATCHING QUEUE
         * ----------------------------------------------------
         */

        await database
            .ref(
                CR.config.matchingPath +
                "/" +
                bookingId
            )
            .set(
                {

                    rideId:
                        bookingId,

                    bookingId:
                        bookingId,

                    customerId:
                        uid,

                    customerUid:
                        uid,

                    service:
                        booking.service,

                    serviceName:
                        booking.serviceName,

                    pickup:
                        booking.pickup,

                    destination:
                        booking.destination,

                    distanceKm:
                        booking.distanceKm,

                    fare:
                        booking.fare,

                    paymentMethod:
                        booking.paymentMethod,

                    status:
                        CR.config.statuses.requested,

                    createdAt:
                        now,

                    updatedAt:
                        now
                }
            );


        /*
         * ----------------------------------------------------
         * FIRESTORE MIRROR
         * ----------------------------------------------------
         */

        const firestore =
            CR.firestore();


        if (firestore) {

            try {

                await firestore
                    .collection(
                        "rides"
                    )
                    .doc(
                        bookingId
                    )
                    .set(
                        booking
                    );

            } catch (error) {

                console.warn(
                    "Firestore ride mirror failed:",
                    error
                );
            }
        }


        CR.saveLocalRide();


        CR.startRideListener(
            bookingId
        );


        CR.startSearchTimeout();


        CR.emit(
            "ride-created",
            {
                ride:
                    booking
            }
        );


        CR.updateStatusUI();


        return booking;

    } catch (error) {

        console.error(
            "RiderX booking error:",
            error
        );


        CR.showError(
            error.message ||
            "Ride booking failed."
        );


        throw error;

    } finally {

        CR.state.loading =
            false;
    }
};


/* ============================================================
   SEARCH TIMEOUT
   ============================================================ */

CR.startSearchTimeout = function () {

    CR.clearSearchTimeout();


    CR.state.searchTimer =
        setTimeout(
            async function () {

                if (
                    CR.state.status !==
                    "searching"
                ) {

                    return;
                }


                CR.emit(
                    "search-timeout"
                );


                /*
                 * Do not silently cancel the ride.
                 * First notify the UI. The customer can
                 * decide whether to cancel.
                 */
                CR.showError(
                    "No rider accepted the ride yet."
                );

            },
            CR.config.searchTimeout
        );
};


CR.clearSearchTimeout = function () {

    if (
        CR.state.searchTimer
    ) {

        clearTimeout(
            CR.state.searchTimer
        );
    }


    CR.state.searchTimer =
        null;
};


/* ============================================================
   RIDE LISTENER
   ============================================================ */

CR.startRideListener = function (
    rideId
) {

    const database =
        CR.database();


    if (
        !database ||
        !rideId
    ) {

        return;
    }


    CR.removeRideListener();


    const reference =
        database.ref(
            CR.config.ridesPath +
            "/" +
            rideId
        );


    const callback =
        function (
            snapshot
        ) {

            const ride =
                snapshot.val();


            if (!ride) {

                return;
            }


            const previousStatus =
                CR.state.status;


            CR.state.ride =
                {
                    ...(CR.state.ride || {}),
                    ...ride
                };


            CR.state.booking =
                CR.state.ride;


            CR.state.status =
                CR.normalizeStatus(
                    ride.status ||
                    ride.rideStatus
                );


            if (
                CR.state.status ===
                "idle"
            ) {

                CR.state.status =
                    "searching";
            }


            CR.state.lastStatus =
                CR.state.status;


            CR.updateDriver(
                CR.state.ride
            );


            CR.saveLocalRide();


            CR.updateStatusUI();


            CR.handleStatus(
                CR.state.ride,
                previousStatus
            );


            CR.emit(
                "ride-updated",
                {
                    ride:
                        CR.state.ride
                }
            );
        };


    reference.on(
        "value",
        callback
    );


    CR.state.rideListener =
        {

            reference:
                reference,

            callback:
                callback
        };
};


CR.removeRideListener = function () {

    const listener =
        CR.state.rideListener;


    if (!listener) {
        return;
    }


    try {

        listener.reference.off(
            "value",
            listener.callback
        );

    } catch (error) {

        console.warn(
            "Ride listener removal failed:",
            error
        );
    }


    CR.state.rideListener =
        null;
};


/* ============================================================
   STATUS HANDLER
   ============================================================ */

CR.handleStatus = function (
    ride,
    previousStatus
) {

    if (!ride) {
        return;
    }


    if (CR.state.statusHandling) {
        return;
    }


    CR.state.statusHandling =
        true;


    try {

        const status =
            CR.normalizeStatus(
                ride.status ||
                ride.rideStatus
            );


        /*
         * SEARCHING
         */

        if (
            status ===
            "searching"
        ) {

            CR.startSearchTimeout();
        }


        /*
         * ACCEPTED
         */

        if (
            status ===
            "accepted"
        ) {

            CR.clearSearchTimeout();


            const driverId =
                ride.driverId ||
                ride.riderId;


            if (driverId) {

                CR.updateDriver(
                    ride
                );


                CR.startDriverLocationListener(
                    driverId
                );
            }


            CR.emit(
                "driver-accepted",
                {
                    ride:
                        ride
                }
            );
        }


        /*
         * ARRIVING
         */

        if (
            status ===
            "driver_arriving"
        ) {

            CR.clearSearchTimeout();


            const driverId =
                ride.driverId ||
                ride.riderId;


            if (driverId) {

                CR.startDriverLocationListener(
                    driverId
                );
            }


            CR.emit(
                "driver-arriving",
                {
                    ride:
                        ride
                }
            );
        }


        /*
         * ARRIVED
         */

        if (
            status ===
            "arrived"
        ) {

            CR.clearSearchTimeout();


            const driverId =
                ride.driverId ||
                ride.riderId;


            if (driverId) {

                CR.startDriverLocationListener(
                    driverId
                );
            }


            CR.state.otp =
                ride.otp ||
                CR.state.otp ||
                null;


            CR.emit(
                "driver-arrived",
                {
                    ride:
                        ride,

                    otp:
                        CR.state.otp
                }
            );
        }


        /*
         * STARTED
         */

        if (
            status ===
            "started"
        ) {

            CR.clearSearchTimeout();


            const driverId =
                ride.driverId ||
                ride.riderId;


            if (driverId) {

                CR.startDriverLocationListener(
                    driverId
                );
            }


            CR.emit(
                "trip-started",
                {
                    ride:
                        ride
                }
            );
        }


        /*
         * COMPLETED
         */

        if (
            status ===
            "completed"
        ) {

            CR.clearSearchTimeout();

            CR.stopDriverLocationListener();

            CR.saveLocalRide();


            CR.emit(
                "trip-completed",
                {
                    ride:
                        ride
                }
            );
        }


        /*
         * CANCELLED
         */

        if (
            status ===
            "cancelled"
        ) {

            CR.clearSearchTimeout();

            CR.stopDriverLocationListener();

            CR.saveLocalRide();


            CR.emit(
                "ride-cancelled",
                {
                    ride:
                        ride
                }
            );
        }


        /*
         * STATUS TRANSITION EVENT
         */

        if (
            previousStatus &&
            previousStatus !==
            status
        ) {

            CR.emit(
                "status-changed",
                {

                    previous:
                        previousStatus,

                    status:
                        status,

                    ride:
                        ride
                }
            );
        }

    } finally {

        CR.state.statusHandling =
            false;
    }
};


/* ============================================================
   DRIVER UPDATE
   ============================================================ */

CR.updateDriver = function (
    ride
) {

    if (!ride) {
        return null;
    }


    const driverId =
        ride.driverId ||
        ride.riderId;


    if (!driverId) {
        return null;
    }


    CR.state.currentDriver =
        {

            id:
                driverId,

            uid:
                driverId,

            name:
                ride.driverName ||
                ride.riderName ||
                "Rider",

            phone:
                ride.driverPhone ||
                ride.riderPhone ||
                "",

            photo:
                ride.driverPhoto ||
                ride.riderPhoto ||
                "",

            vehicle:
                ride.vehicle ||
                ride.vehicleName ||
                "",

            vehicleNumber:
                ride.vehicleNumber ||
                ride.numberPlate ||
                "",

            rating:
                Number(
                    ride.driverRating ||
                    ride.riderRating ||
                    5
                )
        };


    const driver =
        CR.state.currentDriver;


    document
        .querySelectorAll(
            "[data-driver-name]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    driver.name;
            }
        );


    document
        .querySelectorAll(
            "[data-driver-phone]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    driver.phone;
            }
        );


    document
        .querySelectorAll(
            "[data-driver-rating]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    driver.rating;
            }
        );


    document
        .querySelectorAll(
            "[data-driver-vehicle]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    driver.vehicle;
            }
        );


    document
        .querySelectorAll(
            "[data-driver-number]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    driver.vehicleNumber;
            }
        );


    CR.emit(
        "driver-updated",
        {
            driver:
                driver
        }
    );


    return driver;
};


/* ============================================================
   DRIVER LOCATION
   ============================================================ */

CR.startDriverLocationListener = function (
    driverId
) {

    if (!driverId) {
        return;
    }


    const database =
        CR.database();


    if (!database) {
        return;
    }


    /*
     * Do not restart the same listener.
     */

    const existing =
        CR.state.driverLocationListener;


    if (
        existing &&
        existing.driverId ===
        driverId
    ) {

        return;
    }


    CR.stopDriverLocationListener();


    /*
     * RiderX primary path.
     */

    const reference =
        database.ref(
            CR.config.driversPath +
            "/" +
            driverId +
            "/location"
        );


    const callback =
        function (
            snapshot
        ) {

            const location =
                snapshot.val();


            if (!location) {
                return;
            }


            const lat =
                Number(
                    location.lat
                );


            const lng =
                Number(
                    location.lng
                );


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return;
            }


            const point = {

                lat:
                    lat,

                lng:
                    lng,

                heading:
                    Number(
                        location.heading ??
                        location.bearing ??
                        0
                    )
            };


            /*
             * Update customer map.
             */

            if (
                RX.customerMap &&
                typeof RX.customerMap
                    .setRiderLocation ===
                "function"
            ) {

                RX.customerMap
                    .setRiderLocation(
                        point,
                        point.heading
                    );
            }


            /*
             * Alternative map APIs,
             * if already present in project.
             */

            if (
                RX.map &&
                typeof RX.map
                    .setRiderLocation ===
                "function"
            ) {

                try {

                    RX.map.setRiderLocation(
                        point,
                        point.heading
                    );

                } catch (error) {}
            }


            CR.emit(
                "driver-location",
                {
                    location:
                        point,

                    driverId:
                        driverId
                }
            );
        };


    reference.on(
        "value",
        callback
    );


    CR.state.driverLocationListener =
        {

            reference:
                reference,

            callback:
                callback,

            driverId:
                driverId
        };
};


CR.stopDriverLocationListener =
    function () {

        const listener =
            CR.state.driverLocationListener;


        if (!listener) {
            return;
        }


        try {

            listener.reference.off(
                "value",
                listener.callback
            );

        } catch (error) {

            console.warn(
                "Driver location listener removal failed:",
                error
            );
        }


        CR.state.driverLocationListener =
            null;
    };


/* ============================================================
   UPDATE RIDE STATUS
   ============================================================ */

CR.updateRideStatus = async function (
    status,
    extra
) {

    const ride =
        CR.state.ride;


    if (!ride?.id) {

        throw new Error(
            "No active ride."
        );
    }


    const normalized =
        CR.normalizeStatus(
            status
        );


    const canonical =
        CR.getCanonicalStatus(
            normalized
        );


    const now =
        Date.now();


    const updates = {

        status:
            canonical,

        rideStatus:
            canonical,

        updatedAt:
            now,

        ...(extra || {})
    };


    const database =
        CR.database();


    if (!database) {

        throw new Error(
            "Firebase database unavailable."
        );
    }


    await database
        .ref(
            CR.config.ridesPath +
            "/" +
            ride.id
        )
        .update(
            updates
        );


    await database
        .ref(
            CR.config.bookingsPath +
            "/" +
            ride.id
        )
        .update(
            updates
        );


    const firestore =
        CR.firestore();


    if (firestore) {

        try {

            await firestore
                .collection(
                    "rides"
                )
                .doc(
                    ride.id
                )
                .update(
                    updates
                );

        } catch (error) {

            console.warn(
                "Firestore ride status update failed:",
                error
            );
        }
    }


    CR.state.ride =
        {
            ...CR.state.ride,
            ...updates
        };


    CR.state.booking =
        CR.state.ride;


    CR.state.status =
        normalized;


    CR.updateStatusUI();

    CR.saveLocalRide();


    return CR.state.ride;
};


/* ============================================================
   OTP
   ============================================================ */

CR.generateOTP = function () {

    return String(
        Math.floor(
            1000 +
            Math.random() *
            9000
        )
    );
};


CR.verifyOTP = async function (
    enteredOtp
) {

    enteredOtp =
        String(
            enteredOtp ||
            ""
        )
        .trim();


    const ride =
        CR.state.ride;


    if (!ride) {

        throw new Error(
            "No active ride."
        );
    }


    const correctOtp =
        String(
            ride.otp ||
            CR.state.otp ||
            ""
        )
        .trim();


    if (!correctOtp) {

        return {

            verified:
                false,

            message:
                "OTP is not available yet."
        };
    }


    if (
        enteredOtp.length !==
        4 ||
        enteredOtp !==
        correctOtp
    ) {

        return {

            verified:
                false,

            message:
                "Invalid OTP."
        };
    }


    /*
     * OTP is verified by customer.
     *
     * The ride is allowed to move to STARTED.
     * This makes the customer side actually
     * synchronize with the rider side.
     */

    const currentStatus =
        CR.normalizeStatus(
            ride.status
        );


    if (
        [
            "arrived",
            "otp_pending"
        ].includes(
            currentStatus
        )
    ) {

        await CR.updateRideStatus(
            "started",
            {
                otpVerified:
                    true,

                otpVerifiedAt:
                    Date.now(),

                tripStartedAt:
                    Date.now()
            }
        );
    }


    CR.emit(
        "otp-verified",
        {
            ride:
                CR.state.ride
        }
    );


    return {

        verified:
            true
    };
};


/* ============================================================
   CANCEL RIDE
   ============================================================ */

CR.cancelRide = async function (
    reason
) {

    const ride =
        CR.state.ride;


    if (!ride?.id) {

        throw new Error(
            "No active ride."
        );
    }


    const status =
        CR.normalizeStatus(
            ride.status
        );


    if (
        [
            "completed",
            "cancelled"
        ]
        .includes(
            status
        )
    ) {

        return false;
    }


    reason =
        String(
            reason ||
            "Customer cancelled"
        )
        .trim();


    const database =
        CR.database();


    if (!database) {

        throw new Error(
            "Firebase database unavailable."
        );
    }


    const now =
        Date.now();


    const cancellationFee =
        status ===
        "accepted" ||
        status ===
        "driver_arriving" ||
        status ===
        "arrived"
            ? Number(
                CR.config.cancelBeforeAcceptFee
            ) || 0
            : 0;


    const updates = {

        status:
            CR.config.statuses.cancelled,

        rideStatus:
            CR.config.statuses.cancelled,

        cancellationReason:
            reason,

        cancelledBy:
            "customer",

        cancelledAt:
            now,

        cancellationFee:
            cancellationFee,

        updatedAt:
            now
    };


    await database
        .ref(
            CR.config.ridesPath +
            "/" +
            ride.id
        )
        .update(
            updates
        );


    await database
        .ref(
            CR.config.bookingsPath +
            "/" +
            ride.id
        )
        .update(
            updates
        );


    /*
     * Remove only the matching request.
     * Do not remove the actual ride.
     */

    try {

        await database
            .ref(
                CR.config.matchingPath +
                "/" +
                ride.id
            )
            .remove();

    } catch (error) {

        console.warn(
            "Matching queue cleanup failed:",
            error
        );
    }


    const firestore =
        CR.firestore();


    if (firestore) {

        try {

            await firestore
                .collection(
                    "rides"
                )
                .doc(
                    ride.id
                )
                .update(
                    updates
                );

        } catch (error) {

            console.warn(
                "Firestore cancellation update failed:",
                error
            );
        }
    }


    CR.state.status =
        "cancelled";


    CR.state.cancellationReason =
        reason;


    CR.clearSearchTimeout();

    CR.stopDriverLocationListener();


    CR.state.ride =
        {
            ...ride,
            ...updates
        };


    CR.state.booking =
        CR.state.ride;


    CR.saveLocalRide();


    CR.updateStatusUI();


    CR.emit(
        "cancelled",
        {
            ride:
                CR.state.ride,

            fee:
                cancellationFee
        }
    );


    return true;
};


/* ============================================================
   PAYMENT
   ============================================================ */

CR.payFare = async function (
    method
) {

    const ride =
        CR.state.ride;


    if (!ride?.id) {

        throw new Error(
            "No ride found."
        );
    }


    method =
        String(
            method ||
            ride.paymentMethod ||
            CR.state.paymentMethod ||
            "cash"
        )
        .toLowerCase();


    const amount =
        Number(
            ride.fare?.total ??
            ride.estimatedFare ??
            0
        );


    if (
        !Number.isFinite(
            amount
        ) ||
        amount < 0
    ) {

        throw new Error(
            "Invalid fare amount."
        );
    }


    const payment = {

        id:
            ride.id,

        rideId:
            ride.id,

        bookingId:
            ride.bookingId ||
            ride.id,

        customerId:
            CR.getUid(),

        amount:
            amount,

        method:
            method,

        currency:
            "INR",

        status:
            method === "cash"
                ? "pending"
                : "initiated",

        createdAt:
            Date.now(),

        updatedAt:
            Date.now()
    };


    const database =
        CR.database();


    if (database) {

        await database
            .ref(
                CR.config.paymentsPath +
                "/" +
                ride.id
            )
            .set(
                payment
            );
    }


    const firestore =
        CR.firestore();


    if (firestore) {

        try {

            await firestore
                .collection(
                    "payments"
                )
                .doc(
                    ride.id
                )
                .set(
                    payment
                );

        } catch (error) {

            console.warn(
                "Firestore payment mirror failed:",
                error
            );
        }
    }


    CR.emit(
        "payment-created",
        {
            payment:
                payment
        }
    );


    return payment;
};


/* ============================================================
   RATING
   ============================================================ */

CR.submitRating = async function (
    stars,
    comment
) {

    const ride =
        CR.state.ride;


    if (!ride?.id) {

        throw new Error(
            "No completed ride found."
        );
    }


    if (
        ![
            "completed"
        ]
        .includes(
            CR.normalizeStatus(
                ride.status
            )
        )
    ) {

        throw new Error(
            "Rating is available after trip completion."
        );
    }


    stars =
        Math.max(
            1,
            Math.min(
                5,
                Number(
                    stars
                ) ||
                5
            )
        );


    const rating = {

        id:
            ride.id,

        rideId:
            ride.id,

        bookingId:
            ride.bookingId ||
            ride.id,

        customerId:
            CR.getUid(),

        riderId:
            ride.riderId ||
            ride.driverId ||
            null,

        driverId:
            ride.driverId ||
            ride.riderId ||
            null,

        stars:
            stars,

        comment:
            String(
                comment ||
                ""
            )
            .trim(),

        createdAt:
            Date.now()
    };


    const database =
        CR.database();


    if (database) {

        await database
            .ref(
                CR.config.ratingsPath +
                "/" +
                ride.id
            )
            .set(
                rating
            );
    }


    const firestore =
        CR.firestore();


    if (firestore) {

        try {

            await firestore
                .collection(
                    "ratings"
                )
                .doc(
                    ride.id
                )
                .set(
                    rating
                );

        } catch (error) {

            console.warn(
                "Firestore rating failed:",
                error
            );
        }
    }


    CR.emit(
        "rating-submitted",
        {
            rating:
                rating
        }
    );


    return rating;
};


/* ============================================================
   STATUS TEXT
   ============================================================ */

CR.getStatusText = function (
    status
) {

    const normalized =
        CR.normalizeStatus(
            status
        );


    const texts = {

        idle:
            "Choose your ride",

        searching:
            "Finding your rider...",

        accepted:
            "Rider is on the way",

        driver_arriving:
            "Rider is arriving",

        arrived:
            "Rider has arrived",

        otp_pending:
            "Enter OTP to start ride",

        started:
            "You're on your way",

        completed:
            "Trip completed",

        cancelled:
            "Ride cancelled"
    };


    return (
        texts[
            normalized
        ] ||
        "Your ride"
    );
};


/* ============================================================
   STATUS UI
   ============================================================ */

CR.updateStatusUI = function () {

    const status =
        CR.normalizeStatus(
            CR.state.status
        );


    const text =
        CR.getStatusText(
            status
        );


    document
        .querySelectorAll(
            "[data-ride-status]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    text;
            }
        );


    document
        .querySelectorAll(
            "[data-ride-status-code]"
        )
        .forEach(
            function (
                element
            ) {

                element.textContent =
                    status;
            }
        );


    document
        .querySelectorAll(
            "[data-ride-searching]"
        )
        .forEach(
            function (
                element
            ) {

                element.hidden =
                    status !==
                    "searching";
            }
        );


    document
        .querySelectorAll(
            "[data-ride-cancel]"
        )
        .forEach(
            function (
                element
            ) {

                element.hidden =
                    !CR.isActiveStatus(
                        status
                    );
            }
        );


    document
        .querySelectorAll(
            "[data-ride-otp]"
        )
        .forEach(
            function (
                element
            ) {

                element.disabled =
                    ![
                        "arrived",
                        "otp_pending"
                    ]
                    .includes(
                        status
                    );
            }
        );


    CR.emit(
        "status-ui-updated",
        {

            status:
                status,

            text:
                text
        }
    );
};


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

CR.saveLocalRide = function () {

    try {

        const ride =
            CR.state.ride ||
            CR.state.booking;


        if (!ride?.id) {
            return;
        }


        localStorage.setItem(
            "riderx_active_ride",
            JSON.stringify(
                ride
            )
        );


        localStorage.setItem(
            "riderx_active_ride_id",
            ride.id
        );

    } catch (error) {

        console.warn(
            "Could not save active ride:",
            error
        );
    }
};


CR.restoreLocalRide = function () {

    try {

        const saved =
            localStorage.getItem(
                "riderx_active_ride"
            );


        if (!saved) {
            return null;
        }


        const ride =
            JSON.parse(
                saved
            );


        if (!ride?.id) {
            return null;
        }


        const status =
            CR.normalizeStatus(
                ride.status ||
                ride.rideStatus
            );


        if (
            [
                "completed",
                "cancelled"
            ]
            .includes(
                status
            )
        ) {

            CR.removeLocalRide();

            return null;
        }


        CR.state.ride =
            ride;


        CR.state.booking =
            ride;


        CR.state.status =
            status ||
            "searching";


        CR.state.service =
            ride.service ||
            "bike";


        CR.state.paymentMethod =
            ride.paymentMethod ||
            "cash";


        CR.state.pickup =
            ride.pickup ||
            null;


        CR.state.destination =
            ride.destination ||
            null;


        CR.state.route =
            ride.route ||
            null;


        CR.state.fare =
            ride.fare ||
            null;


        CR.state.otp =
            ride.otp ||
            null;


        CR.updateDriver(
            ride
        );


        CR.startRideListener(
            ride.id
        );


        CR.handleStatus(
            ride
        );


        CR.updateStatusUI();


        return ride;

    } catch (error) {

        console.warn(
            "Ride restore failed:",
            error
        );


        CR.removeLocalRide();


        return null;
    }
};


CR.removeLocalRide = function () {

    try {

        localStorage.removeItem(
            "riderx_active_ride"
        );

        localStorage.removeItem(
            "riderx_active_ride_id"
        );

    } catch (error) {

        console.warn(
            "Active ride cleanup failed:",
            error
        );
    }
};


/* ============================================================
   ERROR
   ============================================================ */

CR.showError = function (
    message
) {

    message =
        String(
            message ||
            "Something went wrong."
        );


    if (
        RX.toast &&
        typeof RX.toast ===
        "function"
    ) {

        try {

            RX.toast(
                message,
                "error"
            );

            return;

        } catch (error) {}
    }


    window.dispatchEvent(
        new CustomEvent(
            "riderx-ride-error",
            {

                detail: {

                    message:
                        message
                }
            }
        )
    );
};


/* ============================================================
   EVENT BUS
   ============================================================ */

CR.emit = function (
    eventName,
    detail
) {

    window.dispatchEvent(
        new CustomEvent(
            "riderx-ride-" +
            eventName,
            {

                detail:
                    detail ||
                    {}
            }
        )
    );
};


CR.on = function (
    eventName,
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {

        return function () {};
    }


    const handler =
        function (
            event
        ) {

            callback(
                event.detail ||
                {}
            );
        };


    window.addEventListener(
        "riderx-ride-" +
        eventName,
        handler
    );


    return function () {

        window.removeEventListener(
            "riderx-ride-" +
            eventName,
            handler
        );
    };
};


/* ============================================================
   UI BINDINGS
   ============================================================ */

CR.bindUI = function () {

    if (
        CR.state.listenersBound
    ) {

        return;
    }


    CR.state.listenersBound =
        true;


    /*
     * SERVICE
     */

    document.addEventListener(
        "click",
        function (
            event
        ) {

            const service =
                event.target.closest(
                    "[data-service]"
                );


            if (!service) {
                return;
            }


            CR.setService(
                service.dataset.service
            );
        }
    );


    /*
     * PAYMENT
     */

    document.addEventListener(
        "click",
        function (
            event
        ) {

            const payment =
                event.target.closest(
                    "[data-payment-method]"
                );


            if (!payment) {
                return;
            }


            CR.setPaymentMethod(
                payment.dataset.paymentMethod
            );
        }
    );


    /*
     * BOOK RIDE
     */

    document.addEventListener(
        "click",
        function (
            event
        ) {

            const button =
                event.target.closest(
                    "[data-book-ride]"
                );


            if (!button) {
                return;
            }


            event.preventDefault();


            if (
                button.disabled ||
                CR.state.loading
            ) {

                return;
            }


            CR.createBooking()
                .catch(
                    function (
                        error
                    ) {

                        console.error(
                            "Book ride:",
                            error
                        );
                    }
                );
        }
    );


    /*
     * CANCEL RIDE
     */

    document.addEventListener(
        "click",
        function (
            event
        ) {

            const button =
                event.target.closest(
                    "[data-cancel-ride]"
                );


            if (!button) {
                return;
            }


            event.preventDefault();


            const reason =
                button.dataset.cancelReason ||
                "Customer cancelled";


            CR.cancelRide(
                reason
            )
            .catch(
                function (
                    error
                ) {

                    CR.showError(
                        error.message
                    );
                }
            );
        }
    );


    /*
     * OTP
     */

    document.addEventListener(
        "submit",
        function (
            event
        ) {

            const form =
                event.target.closest(
                    "[data-ride-otp-form]"
                );


            if (!form) {
                return;
            }


            event.preventDefault();


            const input =
                form.querySelector(
                    "[data-ride-otp]"
                ) ||
                form.querySelector(
                    "input"
                );


            CR.verifyOTP(
                input?.value
            )
            .then(
                function (
                    result
                ) {

                    if (
                        !result.verified
                    ) {

                        CR.showError(
                            result.message
                        );

                        return;
                    }


                    if (input) {

                        input.value =
                            "";
                    }
                }
            )
            .catch(
                function (
                    error
                ) {

                    CR.showError(
                        error.message
                    );
                }
            );
        }
    );


    /*
     * RATING
     */

    document.addEventListener(
        "submit",
        function (
            event
        ) {

            const form =
                event.target.closest(
                    "[data-rating-form]"
                );


            if (!form) {
                return;
            }


            event.preventDefault();


            const rating =
                form.querySelector(
                    "[data-rating]"
                );


            const comment =
                form.querySelector(
                    "[data-rating-comment]"
                );


            CR.submitRating(
                rating?.value ||
                5,

                comment?.value ||
                ""
            )
            .then(
                function (
                    result
                ) {

                    CR.emit(
                        "rating-success",
                        {
                            rating:
                                result
                        }
                    );
                }
            )
            .catch(
                function (
                    error
                ) {

                    CR.showError(
                        error.message
                    );
                }
            );
        }
    );
};


/* ============================================================
   CLEANUP
   ============================================================ */

CR.destroy = function () {

    CR.clearSearchTimeout();

    CR.removeRideListener();

    CR.stopDriverLocationListener();

    CR.state.initialized =
        false;

    CR.state.listenersBound =
        false;
};


/* ============================================================
   INITIALIZATION
   ============================================================ */

CR.init = function () {

    if (
        CR.state.initialized
    ) {

        return;
    }


    CR.bindUI();


    /*
     * Restore active ride.
     */

    const restored =
        CR.restoreLocalRide();


    if (!restored) {

        CR.state.status =
            "idle";
    }


    /*
     * URL ride ID.
     */

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const rideId =
            params.get(
                "rideId"
            ) ||
            params.get(
                "bookingId"
            );


        if (
            rideId &&
            !restored
        ) {

            CR.startRideListener(
                rideId
            );
        }

    } catch (error) {

        console.warn(
            "Ride URL parameter parsing failed:",
            error
        );
    }


    /*
     * Apply default selections.
     */

    CR.setService(
        CR.state.service
    );


    CR.setPaymentMethod(
        CR.state.paymentMethod
    );


    CR.state.initialized =
        true;


    CR.updateStatusUI();


    CR.emit(
        "ready"
    );


    console.log(
        "RiderX customer-ride.js loaded."
    );
};


/* ============================================================
   PUBLIC API
   ============================================================ */

RX.bookRide = function (
    options
) {

    return CR.createBooking(
        options
    );
};


RX.cancelRide = function (
    reason
) {

    return CR.cancelRide(
        reason
    );
};


RX.getCurrentRide = function () {

    return (
        CR.state.ride ||
        CR.state.booking ||
        null
    );
};


RX.getRideStatus = function () {

    return CR.state.status;
};


RX.getRideFare = function () {

    return CR.state.fare;
};


RX.setRideService = function (
    service
) {

    return CR.setService(
        service
    );
};


RX.setRidePayment = function (
    method
) {

    return CR.setPaymentMethod(
        method
    );
};


RX.verifyRideOTP = function (
    otp
) {

    return CR.verifyOTP(
        otp
    );
};


RX.payRideFare = function (
    method
) {

    return CR.payFare(
        method
    );
};


RX.rateRide = function (
    stars,
    comment
) {

    return CR.submitRating(
        stars,
        comment
    );
};


RX.updateRideStatus = function (
    status,
    extra
) {

    return CR.updateRideStatus(
        status,
        extra
    );
};


/* ============================================================
   AUTO INIT
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            CR.init();

        },
        {
            once:
                true
        }
    );

} else {

    CR.init();
}

})();
