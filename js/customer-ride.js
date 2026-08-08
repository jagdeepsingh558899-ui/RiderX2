/* ============================================================
   RIDERX CUSTOMER RIDE CONTROLLER
   File: js/customer-ride.js

   Customer ride lifecycle:
   - Create booking
   - Vehicle/service selection
   - Fare estimate
   - Driver searching
   - Driver matched
   - Driver accepted
   - Driver arrived
   - OTP verification
   - Trip started
   - Live trip
   - Trip completed
   - Cancellation
   - Payment
   - Rating
   - Firebase Realtime Database + Firestore
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const CR =
        RX.customerRide =
        RX.customerRide || {};


    /* ========================================================
       CONFIG
       ======================================================== */

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

        searchTimeout:
            45000,

        cancelBeforeAcceptFee:
            0,

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


    /* ========================================================
       STATE
       ======================================================== */

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
            false
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    CR.database = function () {

        try {

            if (
                window.firebase &&
                typeof firebase.database ===
                "function"
            ) {

                return firebase.database();
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
                typeof firebase.firestore ===
                "function"
            ) {

                return firebase.firestore();
            }

        } catch (error) {

            console.warn(
                "RiderX customer ride firestore error:",
                error
            );
        }

        return null;
    };


    /* ========================================================
       USER
       ======================================================== */

    CR.getUser = function () {

        if (
            RX.auth &&
            typeof RX.auth.getUser ===
            "function"
        ) {

            return RX.auth.getUser();
        }


        try {

            return JSON.parse(
                localStorage.getItem(
                    "riderx_user"
                ) || "null"
            );

        } catch (error) {

            return null;
        }
    };


    CR.getUid = function () {

        const user =
            CR.getUser();


        return (
            user?.uid ||
            user?.id ||
            user?.userId ||
            null
        );
    };


    /* ========================================================
       ID GENERATOR
       ======================================================== */

    CR.generateId = function (
        prefix
    ) {

        return (
            (
                prefix ||
                "ride"
            ) +
            "_" +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 9)
        );
    };


    /* ========================================================
       SERVICE
       ======================================================== */

    CR.getService =
        function (
            service
        ) {

            service =
                String(
                    service ||
                    CR.state.service ||
                    "bike"
                )
                .toLowerCase();


            return (
                CR.config.services[
                    service
                ] ||
                CR.config.services.bike
            );
        };


    CR.setService =
        function (
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


    /* ========================================================
       PAYMENT
       ======================================================== */

    CR.setPaymentMethod =
        function (
            method
        ) {

            method =
                String(
                    method ||
                    "cash"
                )
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
                    "cash";
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


    /* ========================================================
       LOCATION
       ======================================================== */

    CR.setPickup =
        function (
            pickup
        ) {

            if (!pickup) {
                return;
            }


            CR.state.pickup =
                {
                    lat:
                        Number(
                            pickup.lat
                        ),

                    lng:
                        Number(
                            pickup.lng
                        ),

                    address:
                        pickup.address ||
                        pickup.name ||
                        ""
                };


            CR.emit(
                "pickup-changed",
                {
                    pickup:
                        CR.state.pickup
                }
            );


            CR.updateFareUI();
        };


    CR.setDestination =
        function (
            destination
        ) {

            if (!destination) {
                return;
            }


            CR.state.destination =
                {
                    lat:
                        Number(
                            destination.lat
                        ),

                    lng:
                        Number(
                            destination.lng
                        ),

                    address:
                        destination.address ||
                        destination.name ||
                        ""
                };


            CR.emit(
                "destination-changed",
                {
                    destination:
                        CR.state.destination
                }
            );


            CR.updateFareUI();
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    CR.distance =
        function (
            a,
            b
        ) {

            if (!a || !b) {
                return 0;
            }


            const R =
                6371;


            const lat1 =
                Number(a.lat) *
                Math.PI /
                180;


            const lat2 =
                Number(b.lat) *
                Math.PI /
                180;


            const dLat =
                (
                    Number(b.lat) -
                    Number(a.lat)
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    Number(b.lng) -
                    Number(a.lng)
                ) *
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
                    lat1
                ) *
                Math.cos(
                    lat2
                ) *
                Math.sin(
                    dLng / 2
                ) *
                Math.sin(
                    dLng / 2
                );


            const y =
                2 *
                Math.atan2(
                    Math.sqrt(x),
                    Math.sqrt(
                        1 - x
                    )
                );


            return R * y;
        };


    /* ========================================================
       FARE
       ======================================================== */

    CR.calculateFare =
        function (
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


            /*
             * RiderX pricing architecture:
             * daytime standard rate
             * >10 km higher rate
             * night rate
             */

            const hour =
                new Date()
                    .getHours();


            if (
                hour >= 22 ||
                hour < 6
            ) {

                if (
                    service.id ===
                    "bike"
                ) {

                    perKm =
                        11;
                }
            } else if (
                distance > 10
            ) {

                if (
                    service.id ===
                    "bike"
                ) {

                    perKm =
                        9;
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
                Number(
                    options.surge
                ) ||
                1;


            const surgeAmount =
                subtotal *
                Math.max(
                    0,
                    surge - 1
                );


            const discount =
                Number(
                    options.discount
                ) ||
                0;


            const tax =
                Number(
                    options.tax
                ) ||
                0;


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


    CR.updateFareUI =
        function () {

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


    /* ========================================================
       ROUTE
       ======================================================== */

    CR.calculateRoute =
        async function () {

            if (
                !CR.state.pickup ||
                !CR.state.destination
            ) {

                return null;
            }


            if (
                RX.customerMap &&
                typeof RX.customerMap
                    .drawRoute ===
                "function"
            ) {

                const route =
                    await RX.customerMap
                        .drawRoute(
                            CR.state.pickup,
                            CR.state.destination
                        );


                if (route) {

                    CR.state.route =
                        route;


                    const distanceKm =
                        Number(
                            route.distance
                        ) /
                        1000;


                    CR.state.fare =
                        CR.calculateFare(
                            distanceKm,
                            CR.state.service
                        );


                    CR.updateFareUI();
                }


                return route;
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


    /* ========================================================
       VALIDATE BOOKING
       ======================================================== */

    CR.validateBooking =
        function () {

            const errors = [];


            if (
                !CR.getUid()
            ) {

                errors.push(
                    "Please login first."
                );
            }


            if (
                !CR.state.pickup
            ) {

                errors.push(
                    "Pickup location is required."
                );
            }


            if (
                !CR.state.destination
            ) {

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


    /* ========================================================
       CREATE BOOKING
       ======================================================== */

    CR.createBooking =
        async function (
            options
        ) {

            options =
                options ||
                {};


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


                const bookingId =
                    CR.generateId(
                        "RX"
                    );


                const distanceKm =
                    CR.state.route &&
                    CR.state.route.distance
                        ? Number(
                            CR.state.route.distance
                        ) / 1000
                        : CR.distance(
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

                    customerId:
                        uid,

                    customerUid:
                        uid,

                    customerName:
                        user.name ||
                        user.displayName ||
                        "Customer",

                    customerPhone:
                        user.phone ||
                        user.phoneNumber ||
                        "",

                    customerPhoto:
                        user.photoURL ||
                        user.photo ||
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

                    status:
                        "searching",

                    driverId:
                        null,

                    riderId:
                        null,

                    riderName:
                        null,

                    riderPhone:
                        null,

                    riderPhoto:
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
                        null
                };


                CR.state.booking =
                    booking;


                CR.state.ride =
                    booking;


                CR.state.status =
                    "searching";


                CR.state.searchStartedAt =
                    now;


                /*
                 * Realtime Database.
                 */

                const database =
                    CR.database();


                if (!database) {

                    throw new Error(
                        "Firebase database is not available."
                    );
                }


                const bookingPath =
                    CR.config.bookingsPath +
                    "/" +
                    bookingId;


                await database
                    .ref(
                        bookingPath
                    )
                    .set(
                        booking
                    );


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
                 * Matching queue.
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

                            service:
                                booking.service,

                            pickup:
                                booking.pickup,

                            destination:
                                booking.destination,

                            status:
                                "searching",

                            createdAt:
                                now
                        }
                    );


                /*
                 * Firestore mirror.
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


    /* ========================================================
       SEARCH TIMEOUT
       ======================================================== */

    CR.startSearchTimeout =
        function () {

            CR.clearSearchTimeout();


            CR.state.searchTimer =
                setTimeout(
                    function () {

                        if (
                            CR.state.status ===
                            "searching"
                        ) {

                            CR.emit(
                                "search-timeout"
                            );
                        }

                    },
                    CR.config.searchTimeout
                );
        };


    CR.clearSearchTimeout =
        function () {

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


    /* ========================================================
       RIDE LISTENER
       ======================================================== */

    CR.startRideListener =
        function (
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


                    CR.state.ride =
                        {
                            ...CR.state.ride,
                            ...ride
                        };


                    CR.state.booking =
                        CR.state.ride;


                    CR.state.status =
                        ride.status ||
                        "searching";


                    CR.updateDriver(
                        ride
                    );


                    CR.updateStatusUI();


                    CR.handleStatus(
                        ride
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


    CR.removeRideListener =
        function () {

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

            } catch (error) {}

            CR.state.rideListener =
                null;
        };


    /* ========================================================
       STATUS HANDLER
       ======================================================== */

    CR.handleStatus =
        function (
            ride
        ) {

            const status =
                String(
                    ride.status ||
                    ""
                )
                .toLowerCase();


            if (
                [
                    "accepted",
                    "driver_assigned",
                    "driver_assigned"
                ]
                .includes(
                    status
                )
            ) {

                CR.clearSearchTimeout();

                CR.startDriverLocationListener(
                    ride.driverId ||
                    ride.riderId
                );
            }


            if (
                [
                    "driver_arriving",
                    "arriving",
                    "arrived",
                    "started",
                    "on_trip"
                ]
                .includes(
                    status
                )
            ) {

                CR.startDriverLocationListener(
                    ride.driverId ||
                    ride.riderId
                );
            }


            if (
                [
                    "completed",
                    "complete"
                ]
                .includes(
                    status
                )
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


            if (
                [
                    "cancelled",
                    "canceled"
                ]
                .includes(
                    status
                )
            ) {

                CR.clearSearchTimeout();

                CR.stopDriverLocationListener();

                CR.removeLocalRide();

                CR.emit(
                    "ride-cancelled",
                    {
                        ride:
                            ride
                    }
                );
            }
        };


    /* ========================================================
       DRIVER UPDATE
       ======================================================== */

    CR.updateDriver =
        function (
            ride
        ) {

            const driverId =
                ride.driverId ||
                ride.riderId;


            if (!driverId) {
                return;
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
                        ride.driverRating ||
                        ride.riderRating ||
                        5
                };


            document
                .querySelectorAll(
                    "[data-driver-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            CR.state.currentDriver
                                .name;
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
                            CR.state.currentDriver
                                .phone;
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
                            CR.state.currentDriver
                                .rating;
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
                            CR.state.currentDriver
                                .vehicle ||
                            "";
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
                            CR.state.currentDriver
                                .vehicleNumber ||
                            "";
                    }
                );


            CR.emit(
                "driver-updated",
                {
                    driver:
                        CR.state.currentDriver
                }
            );
        };


    /* ========================================================
       DRIVER LOCATION
       ======================================================== */

    CR.startDriverLocationListener =
        function (
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


            CR.stopDriverLocationListener();


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


                    const point = {

                        lat:
                            Number(
                                location.lat
                            ),

                        lng:
                            Number(
                                location.lng
                            ),

                        heading:
                            Number(
                                location.heading ||
                                location.bearing ||
                                0
                            )
                    };


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


                    CR.emit(
                        "driver-location",
                        {
                            location:
                                point
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
                        callback
                };
        };


    CR.stopDriverLocationListener =
        function () {

            const listener =
                CR.state
                    .driverLocationListener;


            if (!listener) {
                return;
            }


            try {

                listener.reference.off(
                    "value",
                    listener.callback
                );

            } catch (error) {}

            CR.state
                .driverLocationListener =
                null;
        };


    /* ========================================================
       OTP
       ======================================================== */

    CR.generateOTP =
        function () {

            return String(
                Math.floor(
                    1000 +
                    Math.random() *
                    9000
                )
            );
        };


    CR.verifyOTP =
        async function (
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
                );


            if (
                !correctOtp
            ) {

                return {
                    verified:
                        false,

                    message:
                        "OTP is not available yet."
                };
            }


            if (
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


            CR.emit(
                "otp-verified",
                {
                    ride:
                        ride
                }
            );


            return {
                verified:
                    true
            };
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    CR.cancelRide =
        async function (
            reason
        ) {

            const ride =
                CR.state.ride;


            if (!ride) {

                throw new Error(
                    "No active ride."
                );
            }


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
                    "canceled"
                ]
                .includes(
                    status
                )
            ) {

                return false;
            }


            reason =
                reason ||
                "Customer cancelled";


            const database =
                CR.database();


            if (!database) {

                throw new Error(
                    "Firebase database unavailable."
                );
            }


            const now =
                Date.now();


            const updates = {

                status:
                    "cancelled",

                cancellationReason:
                    reason,

                cancelledBy:
                    "customer",

                cancelledAt:
                    now,

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
             * Remove from matching queue.
             */

            await database
                .ref(
                    CR.config.matchingPath +
                    "/" +
                    ride.id
                )
                .remove();


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


            CR.removeLocalRide();


            CR.emit(
                "cancelled",
                {
                    ride:
                        {
                            ...ride,
                            ...updates
                        }
                }
            );


            return true;
        };


    /* ========================================================
       COMPLETE PAYMENT
       ======================================================== */

    CR.payFare =
        async function (
            method
        ) {

            const ride =
                CR.state.ride;


            if (!ride) {

                throw new Error(
                    "No ride found."
                );
            }


            method =
                method ||
                ride.paymentMethod ||
                "cash";


            const amount =
                Number(
                    ride.fare?.total ||
                    ride.estimatedFare ||
                    0
                );


            const payment = {

                rideId:
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
                    Date.now()
            };


            const database =
                CR.database();


            if (database) {

                await database
                    .ref(
                        "payments/" +
                        ride.id
                    )
                    .set(
                        payment
                    );
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


    /* ========================================================
       RATING
       ======================================================== */

    CR.submitRating =
        async function (
            stars,
            comment
        ) {

            const ride =
                CR.state.ride;


            if (!ride) {

                throw new Error(
                    "No completed ride found."
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

                rideId:
                    ride.id,

                customerId:
                    CR.getUid(),

                riderId:
                    ride.riderId ||
                    ride.driverId ||
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
                        "ratings/" +
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


    /* ========================================================
       STATUS UI
       ======================================================== */

    CR.getStatusText =
        function (
            status
        ) {

            const texts = {

                searching:
                    "Finding your rider...",

                accepted:
                    "Rider is on the way",

                driver_assigned:
                    "Rider is on the way",

                driver_arriving:
                    "Rider is arriving",

                arriving:
                    "Rider is arriving",

                arrived:
                    "Rider has arrived",

                otp_pending:
                    "Enter OTP to start ride",

                started:
                    "You're on your way",

                on_trip:
                    "Trip in progress",

                completed:
                    "Trip completed",

                cancelled:
                    "Ride cancelled"
            };


            return (
                texts[
                    status
                ] ||
                "Your ride"
            );
        };


    CR.updateStatusUI =
        function () {

            const status =
                CR.state.status;


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
                            [
                                "completed",
                                "cancelled",
                                "canceled"
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


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    CR.saveLocalRide =
        function () {

            try {

                localStorage.setItem(
                    "riderx_active_ride",
                    JSON.stringify(
                        CR.state.ride ||
                        CR.state.booking
                    )
                );


                if (
                    CR.state.ride?.id
                ) {

                    localStorage.setItem(
                        "riderx_active_ride_id",
                        CR.state.ride.id
                    );
                }

            } catch (error) {

                console.warn(
                    "Could not save active ride:",
                    error
                );
            }
        };


    CR.restoreLocalRide =
        function () {

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
                    String(
                        ride.status ||
                        ""
                    )
                    .toLowerCase();


                if (
                    [
                        "completed",
                        "cancelled",
                        "canceled"
                    ]
                    .includes(
                        status
                    )
                ) {

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


                return null;
            }
        };


    CR.removeLocalRide =
        function () {

            try {

                localStorage.removeItem(
                    "riderx_active_ride"
                );

                localStorage.removeItem(
                    "riderx_active_ride_id"
                );

            } catch (error) {}
        };


    /* ========================================================
       ERROR
       ======================================================== */

    CR.showError =
        function (
            message
        ) {

            if (
                RX.toast &&
                typeof RX.toast ===
                "function"
            ) {

                RX.toast(
                    message,
                    "error"
                );

                return;
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


    /* ========================================================
       EVENT BUS
       ======================================================== */

    CR.emit =
        function (
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


    CR.on =
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
                "riderx-ride-" +
                eventName,
                function (
                    event
                ) {

                    callback(
                        event.detail ||
                        {}
                    );
                }
            );
        };


    /* ========================================================
       UI BINDINGS
       ======================================================== */

    CR.bindUI =
        function () {

            /*
             * Service selection.
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


                    if (service) {

                        CR.setService(
                            service.dataset
                                .service
                        );
                    }
                }
            );


            /*
             * Payment selection.
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


                    if (payment) {

                        CR.setPaymentMethod(
                            payment.dataset
                                .paymentMethod
                        );
                    }
                }
            );


            /*
             * Book ride.
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


                    CR.createBooking()
                        .catch(
                            function (
                                error
                            ) {

                                console.error(
                                    error
                                );
                            }
                        );
                }
            );


            /*
             * Cancel ride.
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
                        button.dataset
                            .cancelReason ||
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
             * OTP verification.
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


                            if (
                                input
                            ) {

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
             * Rating.
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


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    CR.init =
        function () {

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
             * Read URL ride ID.
             */

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


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.bookRide =
        function (
            options
        ) {

            return CR.createBooking(
                options
            );
        };


    RX.cancelRide =
        function (
            reason
        ) {

            return CR.cancelRide(
                reason
            );
        };


    RX.getCurrentRide =
        function () {

            return (
                CR.state.ride ||
                CR.state.booking ||
                null
            );
        };


    RX.getRideStatus =
        function () {

            return CR.state.status;
        };


    RX.getRideFare =
        function () {

            return CR.state.fare;
        };


    RX.setRideService =
        function (
            service
        ) {

            return CR.setService(
                service
            );
        };


    RX.setRidePayment =
        function (
            method
        ) {

            return CR.setPaymentMethod(
                method
            );
        };


    /* ========================================================
       AUTO INIT
       ======================================================== */

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
