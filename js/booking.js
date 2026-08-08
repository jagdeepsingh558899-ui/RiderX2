/* ============================================================
   RIDERX
   BOOKING ENGINE
   File: js/booking.js

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
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const BOOKING =
        RX.booking =
        RX.booking || {};


    /* ========================================================
       CONFIG
       ======================================================== */

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


    /* ========================================================
       STATE
       ======================================================== */

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

        riderListener:
            null
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    BOOKING.database = function () {

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
                "RiderX booking database error:",
                error
            );
        }

        return null;
    };


    BOOKING.firestore = function () {

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
                "RiderX booking firestore error:",
                error
            );
        }

        return null;
    };


    /* ========================================================
       USER
       ======================================================== */

    BOOKING.getUser = function () {

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


    /* ========================================================
       HELPERS
       ======================================================== */

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


    BOOKING.number = function (
        value
    ) {

        const number =
            Number(value);


        return Number.isFinite(
            number
        )
            ? number
            : 0;
    };


    BOOKING.round = function (
        value
    ) {

        return Math.round(
            BOOKING.number(
                value
            )
        );
    };


    BOOKING.now = function () {

        return Date.now();
    };


    /* ========================================================
       SERVICE
       ======================================================== */

    BOOKING.getService = function (
        service
    ) {

        service =
            String(
                service ||
                BOOKING.state.service ||
                ""
            )
            .toLowerCase();


        if (
            service ===
            "bike taxi"
        ) {
            service = "bike";
        }


        if (
            service ===
            "bike_taxi"
        ) {
            service = "bike";
        }


        if (
            service ===
            "car"
        ) {
            service = "cab";
        }


        return (
            BOOKING.config
                .services[service] ||
            BOOKING.config
                .services.bike
        );
    };


    BOOKING.setService = function (
        service
    ) {

        const selected =
            BOOKING.getService(
                service
            );


        BOOKING.state.service =
            selected.id;


        document.body.dataset
            .service =
            selected.id;


        document
            .querySelectorAll(
                "[data-service]"
            )
            .forEach(
                function (
                    element
                ) {

                    const value =
                        String(
                            element.dataset
                                .service ||
                            ""
                        )
                        .toLowerCase();


                    element.classList.toggle(
                        "active",
                        value ===
                        selected.id
                    );


                    element.setAttribute(
                        "aria-selected",
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
                    function (
                        element
                    ) {

                        const value =
                            String(
                                element.dataset
                                    .paymentMethod ||
                                ""
                            )
                            .toLowerCase();


                        element.classList.toggle(
                            "active",
                            value ===
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


    /* ========================================================
       LOCATION
       ======================================================== */

    BOOKING.setPickup = function (
        location
    ) {

        if (
            !location
        ) {
            return null;
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
                "Pickup location",

            name:
                location.name ||
                location.address ||
                "Pickup location"
        };


        BOOKING.updateLocationUI();


        BOOKING.emit(
            "pickup-changed",
            {
                pickup:
                    BOOKING.state.pickup
            }
        );


        BOOKING.updateFare();


        return BOOKING.state.pickup;
    };


    BOOKING.setDestination =
        function (
            location
        ) {

            if (
                !location
            ) {
                return null;
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


            BOOKING.emit(
                "destination-changed",
                {
                    destination:
                        BOOKING.state.destination
                }
            );


            BOOKING.updateFare();


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
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

                        element.textContent =
                            destination?.address ||
                            "Choose destination";
                    }
                );


            const pickupInput =
                document.querySelector(
                    "#pickup"
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
                );


            if (
                destinationInput &&
                destination
            ) {

                destinationInput.value =
                    destination.address;
            }
        };


    /* ========================================================
       DISTANCE
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


            if (
                !lat1 &&
                !lon1 &&
                !lat2 &&
                !lon2
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
                R *
                c
            );
        };


    /* ========================================================
       DISTANCE FROM EXISTING MODULE
       ======================================================== */

    BOOKING.getDistance =
        async function () {

            if (
                !BOOKING.state.pickup ||
                !BOOKING.state.destination
            ) {

                return 0;
            }


            /*
             * Use existing distance module.
             */

            if (
                RX.distance &&
                typeof RX.distance.calculate ===
                "function"
            ) {

                try {

                    const result =
                        await RX.distance
                            .calculate(
                                BOOKING.state.pickup,
                                BOOKING.state.destination
                            );


                    const distance =
                        BOOKING.number(
                            result?.distance ||
                            result
                        );


                    if (
                        distance > 0
                    ) {

                        return (
                            distance >
                            100
                                ? distance / 1000
                                : distance
                        );
                    }

                } catch (error) {

                    console.warn(
                        "RiderX distance module failed:",
                        error
                    );
                }
            }


            return BOOKING.calculateDistance(
                BOOKING.state.pickup,
                BOOKING.state.destination
            );
        };


    /* ========================================================
       FARE
       ======================================================== */

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


            /*
             * RiderX pricing:
             * 08:00 - 22:00
             * up to 10 km = ₹8/km
             * above 10 km = ₹9/km
             *
             * 22:00 - 06:00 = ₹11/km
             *
             * Service-specific base fare
             * remains applied.
             */

            const now =
                new Date();


            const hour =
                now.getHours();


            let perKm;


            if (
                hour >= 22 ||
                hour < 6
            ) {

                perKm =
                    11;

            } else if (
                distanceKm > 10
            ) {

                perKm =
                    9;

            } else {

                perKm =
                    8;
            }


            /*
             * Cab / parcel / food use their
             * own service rate when configured.
             */

            if (
                selected.id !==
                "bike"
            ) {

                perKm =
                    selected.perKm;
            }


            let fare =
                selected.baseFare +
                (
                    distanceKm *
                    perKm
                );


            /*
             * Long distance pricing.
             */

            if (
                selected.id ===
                    "bike" &&
                distanceKm > 10
            ) {

                fare =
                    selected.baseFare +
                    (
                        10 * 8
                    ) +
                    (
                        (
                            distanceKm -
                            10
                        ) * 9
                    );
            }


            /*
             * Night pricing.
             */

            if (
                selected.id ===
                    "bike" &&
                (
                    hour >= 22 ||
                    hour < 6
                )
            ) {

                fare =
                    selected.baseFare +
                    (
                        distanceKm *
                        11
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


    /* ========================================================
       COUPON
       ======================================================== */

    BOOKING.applyCoupon =
        async function (
            code
        ) {

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
             * Existing offers/coupon module.
             */

            if (
                RX.offers &&
                typeof RX.offers.validateCoupon ===
                "function"
            ) {

                const result =
                    await RX.offers
                        .validateCoupon(
                            code,
                            BOOKING.state
                        );


                if (
                    result &&
                    result.valid
                ) {

                    BOOKING.state.coupon =
                        result;


                    BOOKING.state.discount =
                        BOOKING.number(
                            result.discount
                        );


                    BOOKING.updateFare();


                    return result;
                }
            }


            /*
             * Firebase coupons fallback.
             */

            const database =
                BOOKING.database();


            if (database) {

                const snapshot =
                    await database
                        .ref(
                            "coupons/" +
                            code
                        )
                        .once(
                            "value"
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
                                .fare *
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
                            BOOKING.state.fare
                        );


                    BOOKING.state.coupon =
                        {
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


    /* ========================================================
       UPDATE FARE
       ======================================================== */

    BOOKING.updateFare =
        function () {

            const distance =
                BOOKING.number(
                    BOOKING.state.distanceKm
                );


            const service =
                BOOKING.getService();


            const base =
                BOOKING.calculateFare(
                    distance,
                    service
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
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

                        element.textContent =
                            distance
                                .toFixed(1) +
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
                                BOOKING
                                    .state
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


    /* ========================================================
       ESTIMATE
       ======================================================== */

    BOOKING.estimate =
        async function () {

            if (
                !BOOKING.state.pickup ||
                !BOOKING.state.destination
            ) {

                return {
                    distanceKm:
                        0,

                    fare:
                        0
                };
            }


            BOOKING.state.distanceKm =
                await BOOKING.getDistance();


            /*
             * Existing route module can provide
             * better travel duration.
             */

            if (
                RX.route &&
                typeof RX.route.calculate ===
                "function"
            ) {

                try {

                    const route =
                        await RX.route
                            .calculate(
                                BOOKING.state.pickup,
                                BOOKING.state.destination
                            );


                    if (
                        route
                    ) {

                        BOOKING.state.distanceKm =
                            BOOKING.number(
                                route.distanceKm ||
                                route.distance ||
                                BOOKING.state.distanceKm
                            );


                        BOOKING.state.durationMinutes =
                            BOOKING.number(
                                route.durationMinutes ||
                                route.duration ||
                                0
                            );
                    }

                } catch (error) {

                    console.warn(
                        "RiderX route estimate failed:",
                        error
                    );
                }
            }


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


    /* ========================================================
       VALIDATE
       ======================================================== */

    BOOKING.validate =
        function () {

            const user =
                BOOKING.getUser();


            if (!user) {

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


    /* ========================================================
       CREATE BOOKING OBJECT
       ======================================================== */

    BOOKING.createObject =
        function (
            extra
        ) {

            const user =
                BOOKING.getUser();


            const service =
                BOOKING.getService();


            const id =
                BOOKING.id();


            return {

                id:
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

                coupon:
                    BOOKING.state.coupon
                        ?.code ||
                    null,

                status:
                    "searching",

                riderId:
                    null,

                riderUid:
                    null,

                riderName:
                    null,

                riderPhone:
                    null,

                otp:
                    null,

                createdAt:
                    Date.now(),

                requestedAt:
                    Date.now(),

                updatedAt:
                    Date.now(),

                city:
                    BOOKING.config.city,

                source:
                    "riderx-web",

                ...(extra || {})
            };
        };


    /* ========================================================
       SAVE BOOKING
       ======================================================== */

    BOOKING.saveBooking =
        async function (
            booking
        ) {

            const database =
                BOOKING.database();


            const firestore =
                BOOKING.firestore();


            if (
                !database &&
                !firestore
            ) {

                throw new Error(
                    "Firebase database is not available."
                );
            }


            /*
             * Realtime Database.
             */

            if (database) {

                await database
                    .ref(
                        "rides/" +
                        booking.id
                    )
                    .set(
                        booking
                    );


                /*
                 * Customer active ride.
                 */

                if (
                    booking.customerId
                ) {

                    await database
                        .ref(
                            "customerRides/" +
                            booking.customerId +
                            "/" +
                            booking.id
                        )
                        .set(
                            {
                                bookingId:
                                    booking.id,

                                status:
                                    booking.status,

                                createdAt:
                                    booking.createdAt
                            }
                        );
                }
            }


            /*
             * Firestore mirror.
             */

            if (firestore) {

                try {

                    await firestore
                        .collection(
                            "rides"
                        )
                        .doc(
                            booking.id
                        )
                        .set(
                            booking,
                            {
                                merge:
                                    true
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Firestore booking mirror failed:",
                        error
                    );
                }
            }


            return booking;
        };


    /* ========================================================
       START BOOKING
       ======================================================== */

    BOOKING.requestRide =
        async function (
            options
        ) {

            options =
                options || {};


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

                await BOOKING.estimate();


                const booking =
                    BOOKING.createObject(
                        {
                            scheduled:
                                options.scheduled ||
                                false,

                            scheduledAt:
                                options.scheduledAt ||
                                null,

                            notes:
                                options.notes ||
                                ""
                        }
                    );


                BOOKING.state.booking =
                    booking;


                BOOKING.state.rideStatus =
                    "searching";


                BOOKING.state.matching =
                    true;


                await BOOKING.saveBooking(
                    booking
                );


                BOOKING.attachBookingListener(
                    booking.id
                );


                /*
                 * Notify matching engine.
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
                            "Matching engine start failed:",
                            error
                        );
                    }
                }


                /*
                 * Notify request module.
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
                            "Request module failed:",
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


    /* ========================================================
       BOOKING LISTENER
       ======================================================== */

    BOOKING.attachBookingListener =
        function (
            bookingId
        ) {

            const database =
                BOOKING.database();


            if (!database) {
                return;
            }


            BOOKING.removeBookingListener();


            const reference =
                database.ref(
                    "rides/" +
                    bookingId
                );


            const callback =
                function (
                    snapshot
                ) {

                    const booking =
                        snapshot.val();


                    if (!booking) {
                        return;
                    }


                    BOOKING.state.booking =
                        booking;


                    BOOKING.state.rideStatus =
                        booking.status ||
                        "searching";


                    BOOKING.state.matching =
                        [
                            "searching",
                            "requested"
                        ].includes(
                            BOOKING.state
                                .rideStatus
                        );


                    BOOKING.updateBookingUI();


                    BOOKING.emit(
                        "booking-updated",
                        {
                            booking:
                                booking
                        }
                    );


                    /*
                     * Rider accepted.
                     */

                    if (
                        booking.riderId &&
                        (
                            booking.status ===
                                "accepted" ||
                            booking.status ===
                                "arriving" ||
                            booking.status ===
                                "driver_arriving"
                        )
                    ) {

                        BOOKING.emit(
                            "rider-assigned",
                            {
                                booking:
                                    booking
                            }
                        );
                    }


                    /*
                     * Ride started.
                     */

                    if (
                        [
                            "started",
                            "ongoing",
                            "in_progress"
                        ].includes(
                            booking.status
                        )
                    ) {

                        BOOKING.emit(
                            "ride-started",
                            {
                                booking:
                                    booking
                            }
                        );
                    }


                    /*
                     * Ride completed.
                     */

                    if (
                        [
                            "completed",
                            "complete",
                            "finished"
                        ].includes(
                            booking.status
                        )
                    ) {

                        BOOKING.emit(
                            "ride-completed",
                            {
                                booking:
                                    booking
                            }
                        );
                    }


                    /*
                     * Cancelled.
                     */

                    if (
                        [
                            "cancelled",
                            "canceled"
                        ].includes(
                            booking.status
                        )
                    ) {

                        BOOKING.emit(
                            "ride-cancelled",
                            {
                                booking:
                                    booking
                            }
                        );
                    }
                };


            reference.on(
                "value",
                callback
            );


            BOOKING.state.bookingListener =
                {
                    reference:
                        reference,

                    callback:
                        callback
                };
        };


    BOOKING.removeBookingListener =
        function () {

            const listener =
                BOOKING.state
                    .bookingListener;


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
                    "Booking listener cleanup failed:",
                    error
                );
            }


            BOOKING.state.bookingListener =
                null;
        };


    /* ========================================================
       UPDATE BOOKING
       ======================================================== */

    BOOKING.updateBooking =
        async function (
            bookingId,
            updates
        ) {

            if (!bookingId) {

                throw new Error(
                    "Booking ID is required."
                );
            }


            updates =
                {
                    ...(updates || {}),
                    updatedAt:
                        Date.now()
                };


            const database =
                BOOKING.database();


            if (database) {

                await database
                    .ref(
                        "rides/" +
                        bookingId
                    )
                    .update(
                        updates
                    );
            }


            const firestore =
                BOOKING.firestore();


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
                            updates,
                            {
                                merge:
                                    true
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Firestore ride update failed:",
                        error
                    );
                }
            }


            BOOKING.state.booking =
                {
                    ...(
                        BOOKING.state.booking ||
                        {}
                    ),

                    ...updates
                };


            BOOKING.updateBookingUI();


            return BOOKING.state.booking;
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    BOOKING.cancelRide =
        async function (
            reason
        ) {

            const booking =
                BOOKING.state.booking;


            if (
                !booking ||
                !booking.id
            ) {

                throw new Error(
                    "No active ride found."
                );
            }


            const status =
                String(
                    booking.status ||
                    ""
                )
                .toLowerCase();


            if (
                [
                    "completed",
                    "complete",
                    "finished",
                    "cancelled",
                    "canceled"
                ].includes(
                    status
                )
            ) {

                return booking;
            }


            await BOOKING.updateBooking(
                booking.id,
                {
                    status:
                        "cancelled",

                    cancelledBy:
                        "customer",

                    cancellationReason:
                        reason ||
                        "Cancelled by customer",

                    cancelledAt:
                        Date.now()
                }
            );


            BOOKING.state.matching =
                false;


            BOOKING.emit(
                "ride-cancelled",
                {
                    booking:
                        BOOKING.state.booking
                }
            );


            return BOOKING.state.booking;
        };


    /* ========================================================
       ACCEPTED RIDER INFO
       ======================================================== */

    BOOKING.getRider =
        function () {

            const booking =
                BOOKING.state.booking;


            if (!booking) {
                return null;
            }


            return {

                id:
                    booking.riderId ||
                    booking.riderUid ||
                    null,

                name:
                    booking.riderName ||
                    "Rider",

                phone:
                    booking.riderPhone ||
                    "",

                photo:
                    booking.riderPhoto ||
                    "",

                vehicle:
                    booking.vehicle ||
                    booking.vehicleModel ||
                    "",

                plate:
                    booking.vehicleNumber ||
                    booking.plateNumber ||
                    "",

                rating:
                    booking.riderRating ||
                    5,

                otp:
                    booking.otp ||
                    ""
            };
        };


    /* ========================================================
       UI
       ======================================================== */

    BOOKING.updateBookingUI =
        function () {

            const booking =
                BOOKING.state.booking;


            const status =
                booking?.status ||
                BOOKING.state.rideStatus ||
                "idle";


            document.body.dataset
                .rideStatus =
                status;


            document
                .querySelectorAll(
                    "[data-ride-status]"
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
                    "[data-booking-id]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            booking?.id ||
                            booking?.bookingId ||
                            "";
                    }
                );


            const rider =
                BOOKING.getRider();


            document
                .querySelectorAll(
                    "[data-rider-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rider?.name ||
                            "Finding rider...";
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
                            rider?.phone ||
                            "";
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
                            rider?.rating ||
                            "5.0";
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

                        element.textContent =
                            rider?.otp ||
                            "----";
                    }
                );


            document
                .querySelectorAll(
                    "[data-booking-fare]"
                )
                .forEach(
                    function (
                        element
                    ) {

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
                    function (
                        element
                    ) {

                        const canCancel =
                            [
                                "searching",
                                "requested",
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


    /* ========================================================
       ACTIVE BOOKING RESTORE
       ======================================================== */

    BOOKING.restoreActiveRide =
        async function () {

            const uid =
                BOOKING.getUid();


            if (!uid) {
                return null;
            }


            const database =
                BOOKING.database();


            if (!database) {
                return null;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            "customerRides/" +
                            uid
                        )
                        .once(
                            "value"
                        );


                const rides =
                    snapshot.val() ||
                    {};


                const ids =
                    Object.keys(
                        rides
                    );


                if (!ids.length) {
                    return null;
                }


                /*
                 * Check latest active ride.
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
                        await database
                            .ref(
                                "rides/" +
                                id
                            )
                            .once(
                                "value"
                            );


                    const ride =
                        rideSnapshot.val();


                    if (!ride) {
                        continue;
                    }


                    if (
                        [
                            "searching",
                            "requested",
                            "accepted",
                            "arriving",
                            "driver_arriving",
                            "started",
                            "ongoing",
                            "in_progress"
                        ].includes(
                            ride.status
                        )
                    ) {

                        BOOKING.state.booking =
                            ride;

                        BOOKING.state.rideStatus =
                            ride.status;

                        BOOKING.attachBookingListener(
                            ride.id
                        );

                        BOOKING.updateBookingUI();


                        return ride;
                    }
                }

            } catch (error) {

                console.warn(
                    "Active ride restore failed:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       FORM HANDLERS
       ======================================================== */

    BOOKING.bindUI =
        function () {

            /*
             * Service buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const serviceButton =
                        event.target.closest(
                            "[data-service]"
                        );


                    if (
                        serviceButton
                    ) {

                        event.preventDefault();


                        BOOKING.setService(
                            serviceButton.dataset
                                .service
                        );


                        return;
                    }


                    /*
                     * Payment buttons.
                     */

                    const paymentButton =
                        event.target.closest(
                            "[data-payment-method]"
                        );


                    if (
                        paymentButton
                    ) {

                        event.preventDefault();


                        BOOKING.setPaymentMethod(
                            paymentButton.dataset
                                .paymentMethod
                        );


                        return;
                    }


                    /*
                     * Book ride.
                     */

                    const bookButton =
                        event.target.closest(
                            "[data-book-ride]"
                        );


                    if (
                        bookButton
                    ) {

                        event.preventDefault();


                        BOOKING.handleBookButton(
                            bookButton
                        );


                        return;
                    }


                    /*
                     * Cancel ride.
                     */

                    const cancelButton =
                        event.target.closest(
                            "[data-cancel-ride]"
                        );


                    if (
                        cancelButton
                    ) {

                        event.preventDefault();


                        BOOKING.handleCancelButton(
                            cancelButton
                        );


                        return;
                    }


                    /*
                     * Coupon.
                     */

                    const couponButton =
                        event.target.closest(
                            "[data-apply-coupon]"
                        );


                    if (
                        couponButton
                    ) {

                        event.preventDefault();


                        BOOKING.handleCouponButton(
                            couponButton
                        );
                    }
                }
            );
        };


    BOOKING.handleBookButton =
        async function (
            button
        ) {

            try {

                button.disabled =
                    true;


                if (
                    RX.app &&
                    RX.app.showLoading
                ) {

                    RX.app.showLoading(
                        "Finding a rider..."
                    );
                }


                const booking =
                    await BOOKING.requestRide();


                if (
                    RX.toast
                ) {

                    RX.toast(
                        "Ride request sent.",
                        "success"
                    );
                }


                return booking;

            } catch (error) {

                console.error(
                    "Booking failed:",
                    error
                );


                if (
                    RX.toast
                ) {

                    RX.toast(
                        error.message ||
                        "Unable to book ride.",
                        "error"
                    );
                }

            } finally {

                button.disabled =
                    false;


                if (
                    RX.app &&
                    RX.app.hideLoading
                ) {

                    RX.app.hideLoading();
                }
            }
        };


    BOOKING.handleCancelButton =
        async function () {

            try {

                const reason =
                    "Cancelled by customer";


                await BOOKING.cancelRide(
                    reason
                );


                if (
                    RX.toast
                ) {

                    RX.toast(
                        "Ride cancelled.",
                        "success"
                    );
                }

            } catch (error) {

                if (
                    RX.toast
                ) {

                    RX.toast(
                        error.message ||
                        "Unable to cancel ride.",
                        "error"
                    );
                }
            }
        };


    BOOKING.handleCouponButton =
        async function (
            button
        ) {

            const input =
                document.querySelector(
                    "[data-coupon-input]"
                ) ||
                document.querySelector(
                    "#coupon"
                );


            const code =
                input?.value ||
                "";


            try {

                await BOOKING.applyCoupon(
                    code
                );


                if (
                    RX.toast
                ) {

                    RX.toast(
                        "Coupon applied.",
                        "success"
                    );
                }

            } catch (error) {

                if (
                    RX.toast
                ) {

                    RX.toast(
                        error.message ||
                        "Coupon could not be applied.",
                        "error"
                    );
                }
            }
        };


    /* ========================================================
       AUTH EVENTS
       ======================================================== */

    BOOKING.setupAuth =
        function () {

            if (
                RX.auth &&
                typeof RX.auth.on ===
                "function"
            ) {

                RX.auth.on(
                    "logout",
                    function () {

                        BOOKING.removeBookingListener();


                        BOOKING.state.booking =
                            null;

                        BOOKING.state.rideStatus =
                            "idle";
                    }
                );
            }
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    BOOKING.emit =
        function (
            eventName,
            detail
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-booking-" +
                        eventName,
                        {
                            detail:
                                detail ||
                                {}
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
       INITIALIZATION
       ======================================================== */

    BOOKING.init =
        async function () {

            if (
                BOOKING.state.initialized
            ) {
                return;
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
             * Restore active customer ride.
             */

            await BOOKING.restoreActiveRide();


            BOOKING.state.initialized =
                true;


            BOOKING.emit(
                "ready"
            );


            console.log(
                "RiderX booking.js loaded."
            );
        };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.setPickup =
        function (
            location
        ) {

            return BOOKING.setPickup(
                location
            );
        };


    RX.setDestination =
        function (
            location
        ) {

            return BOOKING.setDestination(
                location
            );
        };


    RX.setService =
        function (
            service
        ) {

            return BOOKING.setService(
                service
            );
        };


    RX.setPaymentMethod =
        function (
            method
        ) {

            return BOOKING.setPaymentMethod(
                method
            );
        };


    RX.calculateFare =
        function (
            distance,
            service
        ) {

            return BOOKING.calculateFare(
                distance,
                service
            );
        };


    RX.requestRide =
        function (
            options
        ) {

            return BOOKING.requestRide(
                options
            );
        };


    RX.cancelRide =
        function (
            reason
        ) {

            return BOOKING.cancelRide(
                reason
            );
        };


    RX.getActiveBooking =
        function () {

            return BOOKING.state.booking;
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

                BOOKING.init();

            },
            {
                once:
                    true
            }
        );

    } else {

        BOOKING.init();
    }

})();
