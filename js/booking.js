/* ============================================================
   RIDERX 2.0
   BOOKING ENGINE
   File: js/booking.js

   Main features:
   - Bike / Cab / Parcel / Food
   - Pickup & destination
   - Fare estimation
   - Day / night pricing
   - Distance based pricing
   - Booking creation
   - Firebase Firestore
   - Firebase Realtime Database
   - Rider matching
   - Ride status
   - Cancellation
   - Promo code
   - Payment method
   - Live booking events
   - Booking UI synchronization
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.booking = RX.booking || {};

    const BOOKING = RX.booking;


    /* ========================================================
       CONFIG
       ======================================================== */

    BOOKING.config = {

        ridesCollection:
            "rides",

        rideRequestsCollection:
            "rideRequests",

        usersCollection:
            "users",

        ridersCollection:
            "riders",

        rtdbRides:
            "rides",

        rtdbRequests:
            "rideRequests",

        currency:
            "₹",

        city:
            "Chandigarh",

        searchRadiusKm:
            10,

        requestTimeout:
            45000,

        maxFare:
            50000,

        minFare:
            20
    };


    /* ========================================================
       SERVICES
       ======================================================== */

    BOOKING.services = {

        bike: {

            id:
                "bike",

            name:
                "Bike Taxi",

            shortName:
                "Bike",

            baseFare:
                20,

            perKmDay:
                8,

            perKmNight:
                11,

            extraKmRate:
                9,

            extraKmAfter:
                10,

            perMinute:
                0.5,

            minimumFare:
                30,

            icon:
                "🏍️"
        },


        cab: {

            id:
                "cab",

            name:
                "Cab",

            shortName:
                "Cab",

            baseFare:
                50,

            perKmDay:
                14,

            perKmNight:
                18,

            extraKmRate:
                16,

            extraKmAfter:
                10,

            perMinute:
                1,

            minimumFare:
                80,

            icon:
                "🚕"
        },


        parcel: {

            id:
                "parcel",

            name:
                "Parcel",

            shortName:
                "Parcel",

            baseFare:
                30,

            perKmDay:
                10,

            perKmNight:
                13,

            extraKmRate:
                11,

            extraKmAfter:
                10,

            perMinute:
                0.5,

            minimumFare:
                40,

            icon:
                "📦"
        },


        food: {

            id:
                "food",

            name:
                "Food Delivery",

            shortName:
                "Food",

            baseFare:
                30,

            perKmDay:
                9,

            perKmNight:
                12,

            extraKmRate:
                10,

            extraKmAfter:
                10,

            perMinute:
                0.5,

            minimumFare:
                40,

            icon:
                "🍔"
        }
    };


    /* ========================================================
       STATE
       ======================================================== */

    BOOKING.state = {

        service:
            "bike",

        pickup:
            null,

        destination:
            null,

        distanceKm:
            0,

        durationMin:
            0,

        fare:
            0,

        baseFare:
            0,

        distanceFare:
            0,

        timeFare:
            0,

        surge:
            0,

        discount:
            0,

        paymentMethod:
            "cash",

        promoCode:
            null,

        promoDiscount:
            0,

        rideId:
            null,

        requestId:
            null,

        status:
            "idle",

        rider:
            null,

        booking:
            null,

        initialized:
            false
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    BOOKING.number =
        function (value) {

            const n =
                Number(value);

            return Number.isFinite(n)
                ? n
                : 0;
        };


    BOOKING.round =
        function (value) {

            return Math.round(
                BOOKING.number(value) *
                100
            ) / 100;
        };


    BOOKING.createId =
        function (prefix) {

            return (
                prefix +
                "_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 9)
            );
        };


    BOOKING.escape =
        function (value) {

            const div =
                document.createElement(
                    "div"
                );

            div.textContent =
                String(
                    value ?? ""
                );

            return div.innerHTML;
        };


    /* ========================================================
       CURRENT USER
       ======================================================== */

    BOOKING.getUser =
        function () {

            if (
                RX.firebase &&
                RX.firebase.auth &&
                RX.firebase.auth.currentUser
            ) {

                return RX.firebase.auth
                    .currentUser;
            }


            return null;
        };


    BOOKING.getUserId =
        function () {

            const user =
                BOOKING.getUser();

            return user
                ? user.uid
                : localStorage.getItem(
                    "riderx_user_id"
                );
        };


    BOOKING.getRole =
        function () {

            return (
                localStorage.getItem(
                    "riderx_role"
                ) ||
                "customer"
            );
        };


    /* ========================================================
       SERVICE
       ======================================================== */

    BOOKING.setService =
        function (service) {

            service =
                String(
                    service ||
                    "bike"
                )
                .toLowerCase();


            if (
                !BOOKING.services[service]
            ) {

                service =
                    "bike";
            }


            BOOKING.state.service =
                service;


            document
                .querySelectorAll(
                    "[data-service]"
                )
                .forEach(
                    function (element) {

                        element.classList.toggle(
                            "active",
                            element.dataset
                                .service ===
                            service
                        );
                    }
                );


            BOOKING.updateFareUI();


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-service-changed",
                    {
                        detail: {
                            service:
                                service,

                            data:
                                BOOKING
                                    .services[
                                    service
                                ]
                        }
                    }
                )
            );


            return BOOKING
                .services[service];
        };


    /* ========================================================
       LOCATION
       ======================================================== */

    BOOKING.setPickup =
        function (
            location
        ) {

            if (!location) {
                return;
            }


            BOOKING.state.pickup = {

                lat:
                    BOOKING.number(
                        location.lat
                    ),

                lng:
                    BOOKING.number(
                        location.lng
                    ),

                address:
                    location.address ||
                    location.name ||
                    "Current location",

                name:
                    location.name ||
                    location.address ||
                    "Pickup"
            };


            BOOKING.updateLocationUI();


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-pickup-changed",
                    {
                        detail:
                            BOOKING.state
                                .pickup
                    }
                )
            );


            BOOKING.recalculate();
        };


    BOOKING.setDestination =
        function (
            location
        ) {

            if (!location) {
                return;
            }


            BOOKING.state.destination = {

                lat:
                    BOOKING.number(
                        location.lat
                    ),

                lng:
                    BOOKING.number(
                        location.lng
                    ),

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


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-destination-changed",
                    {
                        detail:
                            BOOKING.state
                                .destination
                    }
                )
            );


            BOOKING.recalculate();
        };


    /* ========================================================
       DISTANCE CALCULATION
       ======================================================== */

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


            const R =
                6371;


            const lat1 =
                BOOKING.number(
                    pickup.lat
                ) *
                Math.PI /
                180;


            const lat2 =
                BOOKING.number(
                    destination.lat
                ) *
                Math.PI /
                180;


            const deltaLat =
                (
                    BOOKING.number(
                        destination.lat
                    ) -
                    BOOKING.number(
                        pickup.lat
                    )
                ) *
                Math.PI /
                180;


            const deltaLng =
                (
                    BOOKING.number(
                        destination.lng
                    ) -
                    BOOKING.number(
                        pickup.lng
                    )
                ) *
                Math.PI /
                180;


            const a =
                Math.sin(
                    deltaLat / 2
                ) ** 2 +
                Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(
                    deltaLng / 2
                ) ** 2;


            const c =
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(1 - a)
                );


            return BOOKING.round(
                R * c
            );
        };


    /* ========================================================
       PRICING TIME
       ======================================================== */

    BOOKING.isNight =
        function () {

            const hour =
                new Date()
                    .getHours();


            return (
                hour >= 22 ||
                hour < 6
            );
        };


    /* ========================================================
       FARE CALCULATION
       ======================================================== */

    BOOKING.calculateFare =
        function (
            distanceKm,
            durationMin,
            service
        ) {

            service =
                service ||
                BOOKING.state.service;


            const config =
                BOOKING.services[
                    service
                ] ||
                BOOKING.services.bike;


            distanceKm =
                Math.max(
                    0,
                    BOOKING.number(
                        distanceKm
                    )
                );


            durationMin =
                Math.max(
                    0,
                    BOOKING.number(
                        durationMin
                    )
                );


            const night =
                BOOKING.isNight();


            const base =
                config.baseFare;


            let distanceFare =
                0;


            /*
             * RiderX requested pricing:
             *
             * Day:
             * up to 10 km = ₹8/km for Bike
             * above 10 km = ₹9/km
             *
             * Night:
             * ₹11/km for Bike
             */

            if (
                night
            ) {

                distanceFare =
                    distanceKm *
                    config.perKmNight;

            } else {

                if (
                    distanceKm <=
                    config.extraKmAfter
                ) {

                    distanceFare =
                        distanceKm *
                        config.perKmDay;

                } else {

                    distanceFare =
                        config.extraKmAfter *
                        config.perKmDay;

                    distanceFare +=
                        (
                            distanceKm -
                            config.extraKmAfter
                        ) *
                        config.extraKmRate;
                }
            }


            const timeFare =
                durationMin *
                config.perMinute;


            let total =
                base +
                distanceFare +
                timeFare;


            /*
             * Small dynamic pricing.
             * Kept disabled by default.
             */

            const surge =
                BOOKING.state.surge || 0;


            total += surge;


            const discount =
                BOOKING.state.promoDiscount ||
                0;


            total -= discount;


            total =
                Math.max(
                    config.minimumFare,
                    total
                );


            total =
                Math.max(
                    BOOKING.config.minFare,
                    total
                );


            total =
                Math.min(
                    BOOKING.config.maxFare,
                    total
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

                timeFare:
                    BOOKING.round(
                        timeFare
                    ),

                surge:
                    BOOKING.round(
                        surge
                    ),

                discount:
                    BOOKING.round(
                        discount
                    ),

                total:
                    BOOKING.round(
                        total
                    )
            };
        };


    /* ========================================================
       RECALCULATE
       ======================================================== */

    BOOKING.recalculate =
        function () {

            const pickup =
                BOOKING.state.pickup;


            const destination =
                BOOKING.state.destination;


            if (
                !pickup ||
                !destination
            ) {

                BOOKING.state.distanceKm =
                    0;

                BOOKING.state.durationMin =
                    0;

                BOOKING.state.fare =
                    0;

                BOOKING.updateFareUI();

                return;
            }


            const distance =
                BOOKING.calculateDistance(
                    pickup,
                    destination
                );


            /*
             * If Map.js has route duration,
             * use that. Otherwise estimate.
             */

            let duration =
                BOOKING.state
                    .durationMin;


            if (
                !duration ||
                duration <= 0
            ) {

                duration =
                    Math.max(
                        5,
                        distance *
                        3
                    );
            }


            BOOKING.state.distanceKm =
                distance;


            BOOKING.state.durationMin =
                BOOKING.round(
                    duration
                );


            const fare =
                BOOKING.calculateFare(
                    distance,
                    duration,
                    BOOKING.state.service
                );


            BOOKING.state.baseFare =
                fare.baseFare;


            BOOKING.state.distanceFare =
                fare.distanceFare;


            BOOKING.state.timeFare =
                fare.timeFare;


            BOOKING.state.surge =
                fare.surge;


            BOOKING.state.discount =
                fare.discount;


            BOOKING.state.fare =
                fare.total;


            BOOKING.updateFareUI();


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-fare-updated",
                    {
                        detail: {
                            ...fare,

                            distanceKm:
                                distance,

                            durationMin:
                                duration,

                            service:
                                BOOKING.state
                                    .service
                        }
                    }
                )
            );


            return fare;
        };


    /* ========================================================
       PROMO CODE
       ======================================================== */

    BOOKING.applyPromo =
        function (
            code
        ) {

            code =
                String(
                    code || ""
                )
                .trim()
                .toUpperCase();


            BOOKING.state.promoCode =
                code;


            BOOKING.state.promoDiscount =
                0;


            /*
             * Demo/default RiderX promo
             * rules. Admin can later control
             * these from Firebase.
             */

            if (
                code ===
                "RIDERX50"
            ) {

                BOOKING.state
                    .promoDiscount =
                    Math.min(
                        50,
                        Math.max(
                            0,
                            BOOKING.state.fare
                        )
                    );

            } else if (
                code ===
                "WELCOME"
            ) {

                BOOKING.state
                    .promoDiscount =
                    Math.min(
                        30,
                        Math.max(
                            0,
                            BOOKING.state.fare
                        )
                    );

            } else if (
                code ===
                "RIDERX10"
            ) {

                BOOKING.state
                    .promoDiscount =
                    Math.round(
                        BOOKING.state.fare *
                        0.10
                    );

            } else {

                BOOKING.state
                    .promoDiscount =
                    0;

                BOOKING.updateFareUI();


                return {

                    success:
                        false,

                    message:
                        "Invalid promo code."
                };
            }


            BOOKING.recalculate();


            return {

                success:
                    true,

                code:
                    code,

                discount:
                    BOOKING.state
                        .promoDiscount,

                message:
                    "Promo code applied."
            };
        };


    /* ========================================================
       PAYMENT
       ======================================================== */

    BOOKING.setPaymentMethod =
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
                "wallet",
                "online"
            ];


            if (
                !allowed.includes(
                    method
                )
            ) {

                method =
                    "cash";
            }


            BOOKING.state
                .paymentMethod =
                method;


            document
                .querySelectorAll(
                    "[data-payment]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.classList.toggle(
                            "active",
                            element.dataset
                                .payment ===
                            method
                        );
                    }
                );


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-payment-method-changed",
                    {
                        detail: {
                            method:
                                method
                        }
                    }
                )
            );


            return method;
        };


    /* ========================================================
       CREATE RIDE OBJECT
       ======================================================== */

    BOOKING.createRideObject =
        function () {

            const userId =
                BOOKING.getUserId();


            const rideId =
                BOOKING.state.rideId ||
                BOOKING.createId(
                    "ride"
                );


            const requestId =
                BOOKING.state.requestId ||
                BOOKING.createId(
                    "request"
                );


            const fare =
                BOOKING.calculateFare(
                    BOOKING.state
                        .distanceKm,

                    BOOKING.state
                        .durationMin,

                    BOOKING.state
                        .service
                );


            return {

                rideId:
                    rideId,

                requestId:
                    requestId,

                customerId:
                    userId,

                riderId:
                    null,

                service:
                    BOOKING.state
                        .service,

                serviceName:
                    BOOKING.services[
                        BOOKING.state
                            .service
                    ].name,

                status:
                    "searching",

                paymentMethod:
                    BOOKING.state
                        .paymentMethod,

                pickup:
                    BOOKING.state.pickup,

                destination:
                    BOOKING.state.destination,

                distanceKm:
                    BOOKING.state
                        .distanceKm,

                durationMin:
                    BOOKING.state
                        .durationMin,

                fare:
                    fare.total,

                fareDetails:
                    fare,

                promoCode:
                    BOOKING.state
                        .promoCode ||
                    null,

                promoDiscount:
                    BOOKING.state
                        .promoDiscount ||
                    0,

                city:
                    BOOKING.config.city,

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now()
            };
        };


    /* ========================================================
       FIRESTORE CREATE
       ======================================================== */

    BOOKING.saveRideFirestore =
        async function (
            ride
        ) {

            if (
                !RX.firebase ||
                !RX.firebase.db
            ) {

                return false;
            }


            try {

                await RX.firebase
                    .db
                    .collection(
                        BOOKING.config
                            .ridesCollection
                    )
                    .doc(
                        ride.rideId
                    )
                    .set(
                        ride
                    );


                return true;

            } catch (error) {

                console.error(
                    "Ride Firestore save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       RTDB CREATE
       ======================================================== */

    BOOKING.saveRideRTDB =
        async function (
            ride
        ) {

            if (
                !RX.firebase ||
                !RX.firebase.rtdb
            ) {

                return false;
            }


            try {

                await RX.firebase
                    .rtdb
                    .ref(
                        BOOKING.config
                            .rtdbRides +
                        "/" +
                        ride.rideId
                    )
                    .set(
                        ride
                    );


                return true;

            } catch (error) {

                console.error(
                    "Ride RTDB save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       CREATE RIDE REQUEST
       ======================================================== */

    BOOKING.createRideRequest =
        async function (
            ride
        ) {

            const request = {

                ...ride,

                type:
                    "ride_request",

                status:
                    "searching",

                requestedAt:
                    Date.now(),

                expiresAt:
                    Date.now() +
                    BOOKING.config
                        .requestTimeout
            };


            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            BOOKING.config
                                .rideRequestsCollection
                        )
                        .doc(
                            ride.requestId
                        )
                        .set(
                            request
                        );

                } catch (error) {

                    console.warn(
                        "Ride request Firestore failed:",
                        error
                    );
                }
            }


            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    await RX.firebase
                        .rtdb
                        .ref(
                            BOOKING.config
                                .rtdbRequests +
                            "/" +
                            ride.requestId
                        )
                        .set(
                            request
                        );

                } catch (error) {

                    console.warn(
                        "Ride request RTDB failed:",
                        error
                    );
                }
            }


            return request;
        };


    /* ========================================================
       BOOK RIDE
       ======================================================== */

    BOOKING.bookRide =
        async function (
            options
        ) {

            options =
                options ||
                {};


            if (
                !BOOKING.state.pickup
            ) {

                return {

                    success:
                        false,

                    message:
                        "Please select pickup location."
                };
            }


            if (
                !BOOKING.state.destination
            ) {

                return {

                    success:
                        false,

                    message:
                        "Please select destination."
                };
            }


            if (
                BOOKING.state.distanceKm <=
                0
            ) {

                BOOKING.recalculate();
            }


            if (
                BOOKING.state.fare <=
                0
            ) {

                return {

                    success:
                        false,

                    message:
                        "Unable to calculate fare."
                };
            }


            const userId =
                BOOKING.getUserId();


            if (!userId) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-login-required"
                    )
                );


                return {

                    success:
                        false,

                    message:
                        "Please login first."
                };
            }


            if (
                options.service
            ) {

                BOOKING.setService(
                    options.service
                );
            }


            if (
                options.paymentMethod
            ) {

                BOOKING.setPaymentMethod(
                    options.paymentMethod
                );
            }


            const ride =
                BOOKING.createRideObject();


            BOOKING.state.rideId =
                ride.rideId;


            BOOKING.state.requestId =
                ride.requestId;


            BOOKING.state.booking =
                ride;


            BOOKING.state.status =
                "searching";


            /*
             * Save main ride.
             */

            await BOOKING
                .saveRideFirestore(
                    ride
                );


            await BOOKING
                .saveRideRTDB(
                    ride
                );


            /*
             * Create rider request.
             */

            await BOOKING
                .createRideRequest(
                    ride
                );


            BOOKING.updateBookingUI();


            BOOKING.listenToRide(
                ride.rideId
            );


            BOOKING.listenToRequest(
                ride.requestId
            );


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-booked",
                    {
                        detail:
                            ride
                    }
                )
            );


            return {

                success:
                    true,

                ride:
                    ride
            };
        };


    /* ========================================================
       LISTEN TO RIDE
       ======================================================== */

    BOOKING.listenToRide =
        function (
            rideId
        ) {

            if (
                !rideId
            ) {

                return;
            }


            /*
             * Realtime Database
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    const ref =
                        RX.firebase
                            .rtdb
                            .ref(
                                BOOKING.config
                                    .rtdbRides +
                                "/" +
                                rideId
                            );


                    ref.on(
                        "value",
                        function (
                            snapshot
                        ) {

                            const data =
                                snapshot.val();


                            if (
                                data
                            ) {

                                BOOKING.handleRideUpdate(
                                    data
                                );
                            }
                        }
                    );


                    BOOKING.state
                        .rideListener =
                        ref;

                } catch (error) {

                    console.warn(
                        "Ride listener failed:",
                        error
                    );
                }
            }


            /*
             * Firestore listener
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    RX.firebase
                        .db
                        .collection(
                            BOOKING.config
                                .ridesCollection
                        )
                        .doc(
                            rideId
                        )
                        .onSnapshot(
                            function (
                                doc
                            ) {

                                if (
                                    doc.exists
                                ) {

                                    BOOKING
                                        .handleRideUpdate(
                                            doc.data()
                                        );
                                }
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Firestore ride listener failed:",
                        error
                    );
                }
            }
        };


    /* ========================================================
       LISTEN REQUEST
       ======================================================== */

    BOOKING.listenToRequest =
        function (
            requestId
        ) {

            if (
                !requestId
            ) {

                return;
            }


            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    const ref =
                        RX.firebase
                            .rtdb
                            .ref(
                                BOOKING.config
                                    .rtdbRequests +
                                "/" +
                                requestId
                            );


                    ref.on(
                        "value",
                        function (
                            snapshot
                        ) {

                            const data =
                                snapshot.val();


                            if (
                                data
                            ) {

                                BOOKING
                                    .handleRideUpdate(
                                        data
                                    );
                            }
                        }
                    );


                    BOOKING.state
                        .requestListener =
                        ref;

                } catch (error) {

                    console.warn(
                        "Request listener failed:",
                        error
                    );
                }
            }
        };


    /* ========================================================
       HANDLE RIDE UPDATE
       ======================================================== */

    BOOKING.handleRideUpdate =
        function (
            ride
        ) {

            if (!ride) {
                return;
            }


            BOOKING.state.booking =
                {
                    ...BOOKING.state.booking,
                    ...ride
                };


            BOOKING.state.status =
                ride.status ||
                BOOKING.state.status;


            if (
                ride.riderId
            ) {

                BOOKING.state.rider = {

                    id:
                        ride.riderId,

                    name:
                        ride.riderName ||
                        "Rider",

                    phone:
                        ride.riderPhone ||
                        "",

                    photo:
                        ride.riderPhoto ||
                        "",

                    vehicle:
                        ride.vehicle ||
                        "",

                    rating:
                        ride.riderRating ||
                        5
                };
            }


            BOOKING.updateBookingUI();


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-status-changed",
                    {
                        detail:
                            ride
                    }
                )
            );


            /*
             * Ride accepted
             */

            if (
                ride.status ===
                "accepted"
            ) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-accepted",
                        {
                            detail:
                                ride
                        }
                    )
                );
            }


            /*
             * Driver arrived
             */

            if (
                ride.status ===
                "arrived"
            ) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-rider-arrived",
                        {
                            detail:
                                ride
                        }
                    )
                );
            }


            /*
             * Ride started
             */

            if (
                ride.status ===
                "started"
            ) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-started",
                        {
                            detail:
                                ride
                        }
                    )
                );
            }


            /*
             * Ride completed
             */

            if (
                ride.status ===
                "completed"
            ) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-completed",
                        {
                            detail:
                                ride
                        }
                    )
                );
            }


            /*
             * Ride cancelled
             */

            if (
                ride.status ===
                "cancelled"
            ) {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-ride-cancelled",
                        {
                            detail:
                                ride
                        }
                    )
                );
            }
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    BOOKING.cancelRide =
        async function (
            reason
        ) {

            const rideId =
                BOOKING.state.rideId;


            if (!rideId) {

                return {

                    success:
                        false,

                    message:
                        "No active ride."
                };
            }


            reason =
                reason ||
                "Cancelled by customer";


            const update = {

                status:
                    "cancelled",

                cancelReason:
                    reason,

                cancelledBy:
                    "customer",

                cancelledAt:
                    Date.now(),

                updatedAt:
                    Date.now()
            };


            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            BOOKING.config
                                .ridesCollection
                        )
                        .doc(
                            rideId
                        )
                        .update(
                            update
                        );

                } catch (error) {

                    console.warn(
                        "Ride cancellation Firestore failed:",
                        error
                    );
                }
            }


            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    await RX.firebase
                        .rtdb
                        .ref(
                            BOOKING.config
                                .rtdbRides +
                            "/" +
                            rideId
                        )
                        .update(
                            update
                        );

                } catch (error) {

                    console.warn(
                        "Ride cancellation RTDB failed:",
                        error
                    );
                }
            }


            if (
                BOOKING.state.requestId
            ) {

                if (
                    RX.firebase &&
                    RX.firebase.rtdb
                ) {

                    try {

                        await RX.firebase
                            .rtdb
                            .ref(
                                BOOKING.config
                                    .rtdbRequests +
                                "/" +
                                BOOKING.state
                                    .requestId
                            )
                            .update(
                                update
                            );

                    } catch (error) {

                        console.warn(
                            error
                        );
                    }
                }
            }


            BOOKING.state.status =
                "cancelled";


            BOOKING.updateBookingUI();


            return {

                success:
                    true,

                rideId:
                    rideId
            };
        };


    /* ========================================================
       CLEAR BOOKING
       ======================================================== */

    BOOKING.reset =
        function () {

            if (
                BOOKING.state
                    .rideListener
            ) {

                try {

                    BOOKING.state
                        .rideListener
                        .off();

                } catch (e) {}
            }


            if (
                BOOKING.state
                    .requestListener
            ) {

                try {

                    BOOKING.state
                        .requestListener
                        .off();

                } catch (e) {}
            }


            BOOKING.state.pickup =
                null;

            BOOKING.state.destination =
                null;

            BOOKING.state.distanceKm =
                0;

            BOOKING.state.durationMin =
                0;

            BOOKING.state.fare =
                0;

            BOOKING.state.baseFare =
                0;

            BOOKING.state.distanceFare =
                0;

            BOOKING.state.timeFare =
                0;

            BOOKING.state.discount =
                0;

            BOOKING.state.promoCode =
                null;

            BOOKING.state.promoDiscount =
                0;

            BOOKING.state.rideId =
                null;

            BOOKING.state.requestId =
                null;

            BOOKING.state.status =
                "idle";

            BOOKING.state.rider =
                null;

            BOOKING.state.booking =
                null;


            BOOKING.updateLocationUI();

            BOOKING.updateFareUI();

            BOOKING.updateBookingUI();
        };


    /* ========================================================
       UI LOCATION
       ======================================================== */

    BOOKING.updateLocationUI =
        function () {

            const pickup =
                BOOKING.state.pickup;


            const destination =
                BOOKING.state.destination;


            document
                .querySelectorAll(
                    "[data-pickup]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            pickup
                                ? pickup.address
                                : "Choose pickup";
                    }
                );


            document
                .querySelectorAll(
                    "[data-destination]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            destination
                                ? destination.address
                                : "Choose destination";
                    }
                );
        };


    /* ========================================================
       UI FARE
       ======================================================== */

    BOOKING.updateFareUI =
        function () {

            const fare =
                BOOKING.state.fare;


            document
                .querySelectorAll(
                    "[data-fare]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.config
                                .currency +
                            BOOKING.round(
                                fare
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-distance]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.round(
                                BOOKING.state
                                    .distanceKm
                            ) +
                            " km";
                    }
                );


            document
                .querySelectorAll(
                    "[data-duration]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Math.round(
                                BOOKING.state
                                    .durationMin
                            ) +
                            " min";
                    }
                );


            document
                .querySelectorAll(
                    "[data-base-fare]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.config
                                .currency +
                            BOOKING.round(
                                BOOKING.state
                                    .baseFare
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-distance-fare]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.config
                                .currency +
                            BOOKING.round(
                                BOOKING.state
                                    .distanceFare
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-time-fare]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.config
                                .currency +
                            BOOKING.round(
                                BOOKING.state
                                    .timeFare
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-discount]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            "-" +
                            BOOKING.config
                                .currency +
                            BOOKING.round(
                                BOOKING.state
                                    .promoDiscount
                            );
                    }
                );
        };


    /* ========================================================
       UI BOOKING STATUS
       ======================================================== */

    BOOKING.updateBookingUI =
        function () {

            const status =
                BOOKING.state.status;


            document
                .querySelectorAll(
                    "[data-ride-status]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.getStatusText(
                                status
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-ride-id]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.state
                                .rideId ||
                            "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.state.rider
                                ? BOOKING.state
                                    .rider.name
                                : "Finding rider...";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-rating]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.state.rider
                                ? "★ " +
                                  BOOKING.state
                                      .rider.rating
                                : "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-phone]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            BOOKING.state.rider
                                ? BOOKING.state
                                    .rider.phone
                                : "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-cancel-ride]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.disabled =
                            [
                                "completed",
                                "cancelled"
                            ].includes(
                                status
                            );
                    }
                );
        };


    /* ========================================================
       STATUS TEXT
       ======================================================== */

    BOOKING.getStatusText =
        function (
            status
        ) {

            const text = {

                idle:
                    "Choose your ride",

                searching:
                    "Finding nearby riders...",

                accepted:
                    "Rider is coming",

                arrived:
                    "Rider has arrived",

                started:
                    "Ride in progress",

                completed:
                    "Ride completed",

                cancelled:
                    "Ride cancelled",

                payment_pending:
                    "Payment pending",

                payment_completed:
                    "Payment completed"
            };


            return (
                text[status] ||
                "Ride"
            );
        };


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    BOOKING.bind =
        function () {

            /*
             * Service buttons
             */

            document
                .querySelectorAll(
                    "[data-service]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .bookingBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .bookingBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                BOOKING
                                    .setService(
                                        button.dataset
                                            .service
                                    );
                            }
                        );
                    }
                );


            /*
             * Payment buttons
             */

            document
                .querySelectorAll(
                    "[data-payment]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .bookingBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .bookingBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                BOOKING
                                    .setPaymentMethod(
                                        button.dataset
                                            .payment
                                    );
                            }
                        );
                    }
                );


            /*
             * Book buttons
             */

            document
                .querySelectorAll(
                    "[data-book-ride]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .bookingBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .bookingBound =
                            "true";


                        button.addEventListener(
                            "click",
                            async function () {

                                button.disabled =
                                    true;


                                try {

                                    const result =
                                        await BOOKING
                                            .bookRide();


                                    if (
                                        !result.success
                                    ) {

                                        alert(
                                            result.message
                                        );
                                    }

                                } catch (error) {

                                    console.error(
                                        error
                                    );


                                    alert(
                                        error.message ||
                                        "Unable to book ride."
                                    );

                                } finally {

                                    button.disabled =
                                        false;
                                }
                            }
                        );
                    }
                );


            /*
             * Cancel buttons
             */

            document
                .querySelectorAll(
                    "[data-cancel-ride]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .bookingBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .bookingBound =
                            "true";


                        button.addEventListener(
                            "click",
                            async function () {

                                const confirmed =
                                    window.confirm(
                                        "Cancel this ride?"
                                    );


                                if (
                                    !confirmed
                                ) {

                                    return;
                                }


                                await BOOKING
                                    .cancelRide();
                            }
                        );
                    }
                );


            /*
             * Promo button
             */

            document
                .querySelectorAll(
                    "[data-apply-promo]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.addEventListener(
                            "click",
                            function () {

                                const input =
                                    document.querySelector(
                                        "[data-promo-input]"
                                    );


                                if (
                                    !input
                                ) {

                                    return;
                                }


                                const result =
                                    BOOKING
                                        .applyPromo(
                                            input.value
                                        );


                                window.dispatchEvent(
                                    new CustomEvent(
                                        "riderx-promo-result",
                                        {
                                            detail:
                                                result
                                        }
                                    )
                                );


                                if (
                                    !result.success
                                ) {

                                    alert(
                                        result.message
                                    );
                                }
                            }
                        );
                    }
                );
        };


    /* ========================================================
       INIT
       ======================================================== */

    BOOKING.init =
        function () {

            if (
                BOOKING.state
                    .initialized
            ) {

                return;
            }


            BOOKING.state
                .initialized =
                true;


            BOOKING.bind();

            BOOKING.setService(
                "bike"
            );

            BOOKING.setPaymentMethod(
                "cash"
            );

            BOOKING.updateLocationUI();

            BOOKING.updateFareUI();

            BOOKING.updateBookingUI();


            console.log(
                "RiderX Booking Engine loaded."
            );
        };


    /* ========================================================
       PUBLIC QUICK METHODS
       ======================================================== */

    RX.bookRide =
        BOOKING.bookRide;


    RX.cancelRide =
        BOOKING.cancelRide;


    RX.calculateFare =
        BOOKING.calculateFare;


    RX.setPickup =
        BOOKING.setPickup;


    RX.setDestination =
        BOOKING.setDestination;


    RX.setService =
        BOOKING.setService;


    RX.setPaymentMethod =
        BOOKING.setPaymentMethod;


    RX.applyPromo =
        BOOKING.applyPromo;


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            BOOKING.init
        );

    } else {

        BOOKING.init();
    }

})();
