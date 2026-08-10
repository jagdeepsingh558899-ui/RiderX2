/* ============================================================
   RIDERX
   BOOKING ENGINE
   File: js/booking.js

   RIDERX 2.0 - FINAL
   ------------------------------------------------------------
   Handles:
   - Pickup / destination
   - Service selection
   - Route / distance / duration
   - Fare estimate
   - Coupon / promo
   - Ride creation
   - Firebase RTDB + Firestore mirror
   - Rider matching trigger
   - Booking cancellation
   - Ride status
   - Active ride restore
   - Booking events
   - Customer booking UI
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


    /* ========================================================
       STATE
       ======================================================== */

    BOOKING.state = BOOKING.state || {};

    Object.assign(
        BOOKING.state,
        {

            initialized:
                BOOKING.state.initialized === true,

            loading: false,

            booking:
                BOOKING.state.booking || null,

            pickup:
                BOOKING.state.pickup || null,

            destination:
                BOOKING.state.destination || null,

            distanceKm:
                BOOKING.number(
                    BOOKING.state.distanceKm
                ),

            durationMinutes:
                BOOKING.number(
                    BOOKING.state.durationMinutes
                ),

            service:
                BOOKING.state.service ||
                BOOKING.config.defaultService,

            paymentMethod:
                BOOKING.state.paymentMethod ||
                BOOKING.config.defaultPayment,

            coupon:
                BOOKING.state.coupon || null,

            discount:
                BOOKING.number(
                    BOOKING.state.discount
                ),

            fare:
                BOOKING.number(
                    BOOKING.state.fare
                ),

            estimatedFare:
                BOOKING.number(
                    BOOKING.state.estimatedFare
                ),

            rideStatus:
                BOOKING.state.rideStatus ||
                "idle",

            matching:
                BOOKING.state.matching === true,

            bookingListener:
                BOOKING.state.bookingListener ||
                null,

            riderListener:
                BOOKING.state.riderListener ||
                null,

            emittedStatuses:
                BOOKING.state.emittedStatuses ||
                {},

            uiBound:
                BOOKING.state.uiBound === true,

            requestInProgress:
                false
        }
    );


    /* ========================================================
       FIREBASE
       ======================================================== */

    BOOKING.database = function () {

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
                typeof window.firebase.firestore ===
                "function"
            ) {

                return window.firebase.firestore();
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
            typeof RX.auth.getUser === "function"
        ) {

            try {

                const user =
                    RX.auth.getUser();

                if (user) {
                    return user;
                }

            } catch (error) {

                console.warn(
                    "RiderX auth user lookup failed:",
                    error
                );
            }
        }


        const keys = [
            "riderx_user",
            "riderx_customer"
        ];


        for (const key of keys) {

            try {

                const value =
                    localStorage.getItem(key);

                if (!value) {
                    continue;
                }


                const user =
                    JSON.parse(value);


                if (user) {
                    return user;
                }

            } catch (error) {

                console.warn(
                    "RiderX local user lookup failed:",
                    error
                );
            }
        }


        return null;
    };


    BOOKING.getUid = function () {

        const user =
            BOOKING.getUser();


        return (
            user?.uid ||
            user?.id ||
            user?.userId ||
            user?.customerId ||
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


    BOOKING.number = function (value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return 0;
        }


        const number =
            Number(value);


        return Number.isFinite(number)
            ? number
            : 0;
    };


    BOOKING.round = function (value) {

        return Math.round(
            BOOKING.number(value)
        );
    };


    BOOKING.now = function () {

        return Date.now();
    };


    BOOKING.normalizeStatus = function (
        status
    ) {

        return String(
            status || "idle"
        )
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
    };


    BOOKING.isActiveStatus = function (
        status
    ) {

        return [
            "searching",
            "requested",
            "accepted",
            "arriving",
            "driver_arriving",
            "started",
            "ongoing",
            "in_progress",
            "picked_up"
        ].includes(
            BOOKING.normalizeStatus(status)
        );
    };


    BOOKING.isCompletedStatus = function (
        status
    ) {

        return [
            "completed",
            "complete",
            "finished"
        ].includes(
            BOOKING.normalizeStatus(status)
        );
    };


    BOOKING.isCancelledStatus = function (
        status
    ) {

        return [
            "cancelled",
            "canceled",
            "rejected",
            "expired"
        ].includes(
            BOOKING.normalizeStatus(status)
        );
    };


    BOOKING.isTerminalStatus = function (
        status
    ) {

        return (
            BOOKING.isCompletedStatus(status) ||
            BOOKING.isCancelledStatus(status)
        );
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
                BOOKING.config.defaultService
            )
                .trim()
                .toLowerCase();


        const aliases = {

            "bike taxi": "bike",

            "bike_taxi": "bike",

            "motorcycle": "bike",

            "motorbike": "bike",

            "two_wheeler": "bike",

            "two-wheeler": "bike",

            "car": "cab",

            "taxi": "cab",

            "delivery": "parcel",

            "package": "parcel",

            "food_delivery": "food",

            "food-delivery": "food"
        };


        service =
            aliases[service] ||
            service;


        return (
            BOOKING.config.services[service] ||
            BOOKING.config.services.bike
        );
    };


    BOOKING.setService = function (
        service
    ) {

        const selected =
            BOOKING.getService(service);


        BOOKING.state.service =
            selected.id;


        if (document.body) {

            document.body.dataset.service =
                selected.id;
        }


        document
            .querySelectorAll("[data-service]")
            .forEach(function (element) {

                const value =
                    String(
                        element.dataset.service || ""
                    )
                        .trim()
                        .toLowerCase();


                const normalized =
                    BOOKING.getService(value).id;


                const active =
                    normalized === selected.id;


                element.classList.toggle(
                    "active",
                    active
                );


                element.setAttribute(
                    "aria-selected",
                    String(active)
                );


                if (
                    element.tagName === "BUTTON" ||
                    element.tagName === "INPUT"
                ) {

                    element.setAttribute(
                        "aria-pressed",
                        String(active)
                    );
                }
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


    /* ========================================================
       PAYMENT
       ======================================================== */

    BOOKING.setPaymentMethod =
        function (method) {

            method =
                String(
                    method || "cash"
                )
                    .trim()
                    .toLowerCase();


            const aliases = {

                "cod": "cash",

                "card": "online",

                "upi": "upi",

                "wallet": "wallet"
            };


            method =
                aliases[method] ||
                method;


            const allowed = [
                "cash",
                "online",
                "wallet",
                "upi"
            ];


            if (!allowed.includes(method)) {
                method = "cash";
            }


            BOOKING.state.paymentMethod =
                method;


            document
                .querySelectorAll(
                    "[data-payment-method]"
                )
                .forEach(function (element) {

                    const value =
                        String(
                            element.dataset
                                .paymentMethod || ""
                        )
                            .trim()
                            .toLowerCase();


                    const active =
                        value === method;


                    element.classList.toggle(
                        "active",
                        active
                    );


                    element.setAttribute(
                        "aria-selected",
                        String(active)
                    );


                    if (
                        element.tagName === "BUTTON" ||
                        element.tagName === "INPUT"
                    ) {

                        element.setAttribute(
                            "aria-pressed",
                            String(active)
                        );
                    }
                });


            BOOKING.emit(
                "payment-method-changed",
                {
                    method: method
                }
            );


            return method;
        };


    /* ========================================================
       LOCATION
       ======================================================== */

    BOOKING.normalizeLocation = function (
        location,
        fallbackName
    ) {

        if (!location) {
            return null;
        }


        if (
            Array.isArray(location) &&
            location.length >= 2
        ) {

            location = {

                lat: location[0],

                lng: location[1]
            };
        }


        const lat =
            BOOKING.number(
                location.lat ??
                location.latitude
            );


        const lng =
            BOOKING.number(
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
            String(
                location.address ||
                location.formattedAddress ||
                location.display_name ||
                location.name ||
                fallbackName ||
                ""
            ).trim();


        return {

            lat: lat,

            lng: lng,

            address:
                address ||
                fallbackName ||
                "Location",

            name:
                location.name ||
                address ||
                fallbackName ||
                "Location"
        };
    };


    BOOKING.setPickup = function (
        location
    ) {

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
        function (location) {

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

            BOOKING.state.pickup = null;

            BOOKING.state.destination = null;

            BOOKING.state.distanceKm = 0;

            BOOKING.state.durationMinutes = 0;


            BOOKING.updateLocationUI();

            BOOKING.updateFare();


            BOOKING.emit(
                "locations-cleared"
            );
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
                );


            if (pickupInput) {

                pickupInput.value =
                    pickup?.address || "";
            }


            const destinationInput =
                document.querySelector(
                    "#destination"
                );


            if (destinationInput) {

                destinationInput.value =
                    destination?.address || "";
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
                BOOKING.number(pickup.lat);

            const lon1 =
                BOOKING.number(pickup.lng);

            const lat2 =
                BOOKING.number(destination.lat);

            const lon2 =
                BOOKING.number(destination.lng);


            if (
                !Number.isFinite(lat1) ||
                !Number.isFinite(lon1) ||
                !Number.isFinite(lat2) ||
                !Number.isFinite(lon2)
            ) {

                return 0;
            }


            if (
                lat1 === lat2 &&
                lon1 === lon2
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
                    Math.sqrt(
                        Math.max(
                            0,
                            1 - a
                        )
                    )
                );


            return R * c;
        };


    BOOKING.normalizeDistance =
        function (value) {

            let distance =
                BOOKING.number(value);


            if (distance <= 0) {
                return 0;
            }


            /*
             * Values larger than 100 are assumed
             * to be metres when coming from route
             * APIs that return metres.
             */

            if (distance > 100) {
                distance /= 1000;
            }


            return distance;
        };


    BOOKING.normalizeDuration =
        function (value) {

            let duration =
                BOOKING.number(value);


            if (duration <= 0) {
                return 0;
            }


            /*
             * Route APIs commonly return seconds.
             * Large values are treated as seconds.
             */

            if (duration > 1000) {
                duration /= 60;
            }


            return duration;
        };


    /* ========================================================
       EXISTING DISTANCE MODULE
       ======================================================== */

    BOOKING.getDistance =
        async function () {

            if (
                !BOOKING.state.pickup ||
                !BOOKING.state.destination
            ) {

                return 0;
            }


            if (
                RX.distance &&
                typeof RX.distance.calculate ===
                "function"
            ) {

                try {

                    const result =
                        await RX.distance.calculate(
                            BOOKING.state.pickup,
                            BOOKING.state.destination
                        );


                    const raw =
                        result?.distanceKm ??
                        result?.distance ??
                        result?.meters ??
                        result?.distanceMeters ??
                        result;


                    const distance =
                        BOOKING.normalizeDistance(
                            raw
                        );


                    if (distance > 0) {
                        return distance;
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
                    BOOKING.number(distanceKm)
                );


            const selected =
                BOOKING.getService(service);


            const now =
                new Date();


            const hour =
                now.getHours();


            let fare = 0;


            /*
             * RIDERX BIKE PRICING
             *
             * 06:00 - 22:00
             * First 10 km = ₹8/km
             * Above 10 km = ₹9/km
             *
             * 22:00 - 06:00
             * ₹11/km
             *
             * Base fare remains ₹30.
             */

            if (selected.id === "bike") {

                if (
                    hour >= 22 ||
                    hour < 6
                ) {

                    fare =
                        selected.baseFare +
                        distanceKm * 11;

                } else if (
                    distanceKm > 10
                ) {

                    fare =
                        selected.baseFare +
                        10 * 8 +
                        (
                            distanceKm - 10
                        ) * 9;

                } else {

                    fare =
                        selected.baseFare +
                        distanceKm * 8;
                }

            } else {

                fare =
                    selected.baseFare +
                    distanceKm *
                    selected.perKm;
            }


            fare =
                Math.max(
                    fare,
                    selected.minimumFare
                );


            return BOOKING.round(fare);
        };


    /* ========================================================
       COUPON
       ======================================================== */

    BOOKING.applyCoupon =
        async function (code) {

            code =
                String(code || "")
                    .trim()
                    .toUpperCase();


            if (!code) {

                throw new Error(
                    "Enter a coupon code."
                );
            }


            if (
                BOOKING.state.distanceKm <= 0 ||
                BOOKING.state.estimatedFare <= 0
            ) {

                await BOOKING.estimate();
            }


            /*
             * Existing offers module.
             */

            if (
                RX.offers &&
                typeof RX.offers.validateCoupon ===
                "function"
            ) {

                try {

                    const result =
                        await RX.offers.validateCoupon(
                            code,
                            {
                                ...BOOKING.state,

                                fare:
                                    BOOKING.state
                                        .estimatedFare
                            }
                        );


                    if (
                        result &&
                        result.valid
                    ) {

                        let discount = 0;


                        if (
                            String(result.type)
                                .toLowerCase() ===
                            "percent"
                        ) {

                            discount =
                                BOOKING.state
                                    .estimatedFare *
                                (
                                    BOOKING.number(
                                        result.value
                                    ) / 100
                                );

                        } else {

                            discount =
                                BOOKING.number(
                                    result.discount ??
                                    result.value
                                );
                        }


                        discount =
                            Math.min(
                                Math.max(0, discount),
                                BOOKING.state
                                    .estimatedFare
                            );


                        BOOKING.state.coupon = {

                            ...result,

                            code: code
                        };


                        BOOKING.state.discount =
                            BOOKING.round(
                                discount
                            );


                        BOOKING.updateFare();


                        return BOOKING.state.coupon;
                    }

                } catch (error) {

                    console.warn(
                        "Offers coupon validation failed:",
                        error
                    );
                }
            }


            /*
             * Firebase RTDB fallback.
             */

            const database =
                BOOKING.database();


            if (database) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                "coupons/" + code
                            )
                            .once("value");


                    if (snapshot.exists()) {

                        const coupon =
                            snapshot.val() || {};


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
                            BOOKING.number(
                                coupon.expiry
                            )
                        ) {

                            throw new Error(
                                "This coupon has expired."
                            );
                        }


                        let discount = 0;


                        if (
                            String(coupon.type)
                                .toLowerCase() ===
                            "percent"
                        ) {

                            discount =
                                BOOKING.state
                                    .estimatedFare *
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
                                Math.max(0, discount),
                                BOOKING.state
                                    .estimatedFare
                            );


                        BOOKING.state.coupon = {

                            code: code,

                            type:
                                coupon.type ||
                                "flat",

                            value:
                                coupon.value,

                            valid: true
                        };


                        BOOKING.state.discount =
                            BOOKING.round(
                                discount
                            );


                        BOOKING.updateFare();


                        return BOOKING.state.coupon;
                    }

                } catch (error) {

                    if (
                        error &&
                        error.message &&
                        (
                            error.message.includes(
                                "inactive"
                            ) ||
                            error.message.includes(
                                "expired"
                            )
                        )
                    ) {

                        throw error;
                    }


                    console.warn(
                        "Firebase coupon lookup failed:",
                        error
                    );
                }
            }


            throw new Error(
                "Invalid coupon code."
            );
        };


    BOOKING.removeCoupon =
        function () {

            BOOKING.state.coupon = null;

            BOOKING.state.discount = 0;


            BOOKING.updateFare();


            BOOKING.emit(
                "coupon-removed"
            );
        };


    /* ========================================================
       UPDATE FARE
       ======================================================== */

    BOOKING.updateFare =
        function () {

            const distance =
                Math.max(
                    0,
                    BOOKING.number(
                        BOOKING.state.distanceKm
                    )
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
                    Math.max(
                        0,
                        BOOKING.number(
                            BOOKING.state.discount
                        )
                    )
                );


            const total =
                Math.max(
                    0,
                    base - discount
                );


            BOOKING.state.estimatedFare =
                BOOKING.round(base);


            BOOKING.state.fare =
                BOOKING.round(total);


            document
                .querySelectorAll(
                    "[data-fare]"
                )
                .forEach(function (element) {

                    element.textContent =
                        BOOKING.config.currency +
                        BOOKING.state.fare;
                });


            document
                .querySelectorAll(
                    "[data-estimated-fare]"
                )
                .forEach(function (element) {

                    element.textContent =
                        BOOKING.config.currency +
                        BOOKING.state.estimatedFare;
                });


            document
                .querySelectorAll(
                    "[data-discount]"
                )
                .forEach(function (element) {

                    element.textContent =
                        BOOKING.config.currency +
                        BOOKING.round(discount);
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

                    const duration =
                        BOOKING.number(
                            BOOKING.state
                                .durationMinutes
                        );


                    element.textContent =
                        Math.round(duration) +
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
                        BOOKING.round(discount),

                    distanceKm:
                        distance,

                    durationMinutes:
                        BOOKING.state
                            .durationMinutes,

                    service:
                        service.id
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

                BOOKING.state.distanceKm = 0;

                BOOKING.state.durationMinutes = 0;

                BOOKING.updateFare();


                return {

                    distanceKm: 0,

                    durationMinutes: 0,

                    fare: 0,

                    service:
                        BOOKING.state.service
                };
            }


            let distance =
                await BOOKING.getDistance();


            let duration = 0;


            /*
             * Existing route module.
             */

            if (
                RX.route &&
                typeof RX.route.calculate ===
                "function"
            ) {

                try {

                    const route =
                        await RX.route.calculate(
                            BOOKING.state.pickup,
                            BOOKING.state.destination
                        );


                    if (route) {

                        const routeDistance =
                            route.distanceKm ??
                            route.distance ??
                            route.meters ??
                            route.distanceMeters ??
                            0;


                        const normalizedDistance =
                            BOOKING.normalizeDistance(
                                routeDistance
                            );


                        if (
                            normalizedDistance > 0
                        ) {

                            distance =
                                normalizedDistance;
                        }


                        const routeDuration =
                            route.durationMinutes ??
                            route.duration ??
                            route.seconds ??
                            0;


                        duration =
                            BOOKING.normalizeDuration(
                                routeDuration
                            );
                    }

                } catch (error) {

                    console.warn(
                        "RiderX route estimate failed:",
                        error
                    );
                }
            }


            BOOKING.state.distanceKm =
                BOOKING.number(distance);


            BOOKING.state.durationMinutes =
                BOOKING.number(duration);


            const fare =
                BOOKING.updateFare();


            return {

                distanceKm:
                    BOOKING.state.distanceKm,

                durationMinutes:
                    BOOKING.state.durationMinutes,

                fare: fare,

                estimatedFare:
                    BOOKING.state.estimatedFare,

                discount:
                    BOOKING.state.discount,

                service:
                    BOOKING.state.service
            };
        };


    /* ========================================================
       VALIDATE
       ======================================================== */

    BOOKING.validate =
        function (requireDistance = true) {

            const user =
                BOOKING.getUser();


            if (!user) {

                return {

                    valid: false,

                    message:
                        "Please login before booking a ride."
                };
            }


            if (!BOOKING.getUid()) {

                return {

                    valid: false,

                    message:
                        "Your account information is incomplete. Please login again."
                };
            }


            if (
                !BOOKING.state.pickup
            ) {

                return {

                    valid: false,

                    message:
                        "Please select your pickup location."
                };
            }


            if (
                !BOOKING.state.destination
            ) {

                return {

                    valid: false,

                    message:
                        "Please select your destination."
                };
            }


            const pickup =
                BOOKING.state.pickup;


            const destination =
                BOOKING.state.destination;


            if (
                pickup.lat === destination.lat &&
                pickup.lng === destination.lng
            ) {

                return {

                    valid: false,

                    message:
                        "Pickup and destination cannot be the same."
                };
            }


            if (requireDistance) {

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
            }


            return {

                valid: true,

                message: "Ready"
            };
        };


    /* ========================================================
       ACTIVE REQUEST GUARD
       ======================================================== */

    BOOKING.hasActiveRide =
        function () {

            const booking =
                BOOKING.state.booking;


            if (!booking) {
                return false;
            }


            return BOOKING.isActiveStatus(
                booking.status
            );
        };


    /* ========================================================
       CREATE BOOKING OBJECT
       ======================================================== */

    BOOKING.createObject =
        function (extra) {

            const user =
                BOOKING.getUser();


            const service =
                BOOKING.getService();


            const id =
                BOOKING.id();


            const now =
                Date.now();


            const customerId =
                user?.uid ||
                user?.id ||
                user?.userId ||
                user?.customerId ||
                "";


            return {

                id: id,

                bookingId: id,

                customerId:
                    customerId,

                customerUid:
                    customerId,

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
                    BOOKING.state.pickup?.address ||
                    "",

                destinationAddress:
                    BOOKING.state.destination?.address ||
                    "",

                distanceKm:
                    BOOKING.number(
                        BOOKING.state.distanceKm
                    ),

                durationMinutes:
                    BOOKING.number(
                        BOOKING.state.durationMinutes
                    ),

                estimatedFare:
                    BOOKING.number(
                        BOOKING.state.estimatedFare
                    ),

                discount:
                    BOOKING.number(
                        BOOKING.state.discount
                    ),

                fare:
                    BOOKING.number(
                        BOOKING.state.fare
                    ),

                totalFare:
                    BOOKING.number(
                        BOOKING.state.fare
                    ),

                currency: "INR",

                paymentMethod:
                    BOOKING.state.paymentMethod,

                coupon:
                    BOOKING.state.coupon?.code ||
                    null,

                status: "searching",

                riderId: null,

                riderUid: null,

                riderName: null,

                riderPhone: null,

                riderPhoto: null,

                riderRating: null,

                vehicle: null,

                vehicleModel: null,

                vehicleNumber: null,

                plateNumber: null,

                otp: null,

                createdAt: now,

                requestedAt: now,

                updatedAt: now,

                city:
                    BOOKING.config.city,

                source: "riderx-web",

                ...(extra || {})
            };
        };


    /* ========================================================
       SAVE BOOKING
       ======================================================== */

    BOOKING.saveBooking =
        async function (booking) {

            if (
                !booking ||
                !booking.id
            ) {

                throw new Error(
                    "Invalid booking."
                );
            }


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


            let rtdbSaved = false;


            /*
             * RTDB is the primary live ride source.
             */

            if (database) {

                await database
                    .ref(
                        "rides/" +
                        booking.id
                    )
                    .set(booking);


                rtdbSaved = true;


                if (booking.customerId) {

                    await database
                        .ref(
                            "customerRides/" +
                            booking.customerId +
                            "/" +
                            booking.id
                        )
                        .set({

                            bookingId:
                                booking.id,

                            status:
                                booking.status,

                            createdAt:
                                booking.createdAt,

                            updatedAt:
                                booking.updatedAt,

                            service:
                                booking.service,

                            pickupAddress:
                                booking.pickupAddress,

                            destinationAddress:
                                booking.destinationAddress,

                            fare:
                                booking.fare
                        });
                }
            }


            /*
             * Firestore is a mirror only.
             * Failure here must not make a
             * successfully-created RTDB ride fail.
             */

            if (firestore) {

                try {

                    await firestore
                        .collection("rides")
                        .doc(booking.id)
                        .set(
                            booking,
                            {
                                merge: true
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Firestore booking mirror failed:",
                        error
                    );
                }
            }


            if (
                !rtdbSaved &&
                !firestore
            ) {

                throw new Error(
                    "Unable to save booking."
                );
            }


            return booking;
        };


    /* ========================================================
       START BOOKING
       ======================================================== */

    BOOKING.requestRide =
        async function (options) {

            options =
                options || {};


            if (
                BOOKING.state.requestInProgress ||
                BOOKING.state.loading
            ) {

                throw new Error(
                    "A booking request is already being processed."
                );
            }


            /*
             * Never create a second ride while
             * an existing ride is active.
             */

            if (
                BOOKING.hasActiveRide()
            ) {

                throw new Error(
                    "You already have an active ride."
                );
            }


            const basicValidation =
                BOOKING.validate(false);


            if (!basicValidation.valid) {

                throw new Error(
                    basicValidation.message
                );
            }


            BOOKING.state.loading = true;

            BOOKING.state.requestInProgress =
                true;


            try {

                /*
                 * Always calculate fresh route/fare.
                 */

                await BOOKING.estimate();


                const validation =
                    BOOKING.validate(true);


                if (!validation.valid) {

                    throw new Error(
                        validation.message
                    );
                }


                const booking =
                    BOOKING.createObject({

                        scheduled:
                            options.scheduled === true,

                        scheduledAt:
                            options.scheduledAt ||
                            null,

                        notes:
                            String(
                                options.notes || ""
                            )
                                .trim()
                    });


                BOOKING.state.booking =
                    booking;


                BOOKING.state.rideStatus =
                    "searching";


                BOOKING.state.matching =
                    true;


                BOOKING.state.emittedStatuses =
                    {};


                /*
                 * Save exactly once here.
                 */

                await BOOKING.saveBooking(
                    booking
                );


                BOOKING.attachBookingListener(
                    booking.id
                );


                /*
                 * Matching engine.
                 *
                 * This is a trigger only. If the
                 * matching module owns request
                 * creation, it is used here.
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
                 * Legacy request module.
                 *
                 * Do NOT call it if the matching
                 * engine already declares ownership.
                 */

                else if (
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
                        booking: booking
                    }
                );


                return booking;

            } catch (error) {

                /*
                 * If creation failed before a valid
                 * booking reached Firebase, clear
                 * local matching state.
                 */

                if (
                    !BOOKING.state.booking ||
                    !BOOKING.state.booking.id
                ) {

                    BOOKING.state.matching =
                        false;

                    BOOKING.state.rideStatus =
                        "idle";
                }


                throw error;

            } finally {

                BOOKING.state.loading =
                    false;

                BOOKING.state.requestInProgress =
                    false;
            }
        };


    /* ========================================================
       BOOKING LISTENER
       ======================================================== */

    BOOKING.attachBookingListener =
        function (bookingId) {

            const database =
                BOOKING.database();


            if (
                !database ||
                !bookingId
            ) {
                return;
            }


            BOOKING.removeBookingListener();


            const reference =
                database.ref(
                    "rides/" +
                    bookingId
                );


            const callback =
                function (snapshot) {

                    const booking =
                        snapshot.val();


                    if (!booking) {
                        return;
                    }


                    const previousBooking =
                        BOOKING.state.booking;


                    const previousStatus =
                        BOOKING.normalizeStatus(
                            previousBooking?.status
                        );


                    const currentStatus =
                        BOOKING.normalizeStatus(
                            booking.status
                        );


                    BOOKING.state.booking =
                        booking;


                    BOOKING.state.rideStatus =
                        currentStatus;


                    BOOKING.state.matching =
                        [
                            "searching",
                            "requested"
                        ].includes(
                            currentStatus
                        );


                    if (
                        booking.pickup
                    ) {

                        BOOKING.state.pickup =
                            BOOKING.normalizeLocation(
                                booking.pickup,
                                "Pickup location"
                            );
                    }


                    if (
                        booking.destination
                    ) {

                        BOOKING.state.destination =
                            BOOKING.normalizeLocation(
                                booking.destination,
                                "Destination"
                            );
                    }


                    if (
                        booking.distanceKm != null
                    ) {

                        BOOKING.state.distanceKm =
                            BOOKING.number(
                                booking.distanceKm
                            );
                    }


                    if (
                        booking.durationMinutes != null
                    ) {

                        BOOKING.state.durationMinutes =
                            BOOKING.number(
                                booking.durationMinutes
                            );
                    }


                    if (
                        booking.fare != null
                    ) {

                        BOOKING.state.fare =
                            BOOKING.number(
                                booking.fare
                            );
                    }


                    if (
                        booking.estimatedFare != null
                    ) {

                        BOOKING.state.estimatedFare =
                            BOOKING.number(
                                booking.estimatedFare
                            );
                    }


                    if (
                        booking.discount != null
                    ) {

                        BOOKING.state.discount =
                            BOOKING.number(
                                booking.discount
                            );
                    }


                    if (
                        booking.service
                    ) {

                        BOOKING.state.service =
                            BOOKING.getService(
                                booking.service
                            ).id;
                    }


                    if (
                        booking.paymentMethod
                    ) {

                        BOOKING.state.paymentMethod =
                            booking.paymentMethod;
                    }


                    BOOKING.updateLocationUI();

                    BOOKING.updateBookingUI();


                    BOOKING.emit(
                        "booking-updated",
                        {

                            booking: booking,

                            previousStatus:
                                previousStatus,

                            status:
                                currentStatus
                        }
                    );


                    /*
                     * Rider assigned.
                     */

                    if (
                        (
                            booking.riderId ||
                            booking.riderUid
                        ) &&
                        [
                            "accepted",
                            "arriving",
                            "driver_arriving",
                            "started",
                            "ongoing",
                            "in_progress",
                            "picked_up"
                        ].includes(
                            currentStatus
                        )
                    ) {

                        BOOKING.emitOnce(
                            "rider-assigned",
                            booking.id,
                            {
                                booking: booking
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
                            "in_progress",
                            "picked_up"
                        ].includes(
                            currentStatus
                        )
                    ) {

                        BOOKING.emitOnce(
                            "ride-started",
                            booking.id,
                            {
                                booking: booking
                            }
                        );
                    }


                    /*
                     * Ride completed.
                     */

                    if (
                        BOOKING.isCompletedStatus(
                            currentStatus
                        )
                    ) {

                        BOOKING.state.matching =
                            false;


                        BOOKING.emitOnce(
                            "ride-completed",
                            booking.id,
                            {
                                booking: booking
                            }
                        );


                        BOOKING.removeBookingListener();
                    }


                    /*
                     * Ride cancelled.
                     */

                    if (
                        BOOKING.isCancelledStatus(
                            currentStatus
                        )
                    ) {

                        BOOKING.state.matching =
                            false;


                        BOOKING.emitOnce(
                            "ride-cancelled",
                            booking.id,
                            {
                                booking: booking
                            }
                        );


                        BOOKING.removeBookingListener();
                    }
                };


            reference.on(
                "value",
                callback
            );


            BOOKING.state.bookingListener =
                {

                    reference: reference,

                    callback: callback
                };
        };


    BOOKING.removeBookingListener =
        function () {

            const listener =
                BOOKING.state.bookingListener;


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


            const safeUpdates =
                {

                    ...(updates || {}),

                    updatedAt:
                        Date.now()
                };


            const database =
                BOOKING.database();


            const firestore =
                BOOKING.firestore();


            if (
                !database &&
                !firestore
            ) {

                throw new Error(
                    "Firebase is not available."
                );
            }


            if (database) {

                await database
                    .ref(
                        "rides/" +
                        bookingId
                    )
                    .update(
                        safeUpdates
                    );


                const customerId =
                    BOOKING.state.booking?.customerId ||
                    BOOKING.getUid();


                if (customerId) {

                    const summaryUpdates = {

                        updatedAt:
                            safeUpdates.updatedAt
                    };


                    if (
                        safeUpdates.status
                    ) {

                        summaryUpdates.status =
                            safeUpdates.status;
                    }


                    if (
                        safeUpdates.fare != null
                    ) {

                        summaryUpdates.fare =
                            safeUpdates.fare;
                    }


                    await database
                        .ref(
                            "customerRides/" +
                            customerId +
                            "/" +
                            bookingId
                        )
                        .update(
                            summaryUpdates
                        );
                }
            }


            if (firestore) {

                try {

                    await firestore
                        .collection("rides")
                        .doc(bookingId)
                        .set(
                            safeUpdates,
                            {
                                merge: true
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

                    ...(BOOKING.state.booking || {}),

                    ...safeUpdates
                };


            if (
                safeUpdates.status
            ) {

                BOOKING.state.rideStatus =
                    BOOKING.normalizeStatus(
                        safeUpdates.status
                    );


                BOOKING.state.matching =
                    [
                        "searching",
                        "requested"
                    ].includes(
                        BOOKING.state.rideStatus
                    );
            }


            BOOKING.updateBookingUI();


            return BOOKING.state.booking;
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    BOOKING.cancelRide =
        async function (reason) {

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
                BOOKING.normalizeStatus(
                    booking.status
                );


            if (
                BOOKING.isCompletedStatus(status) ||
                BOOKING.isCancelledStatus(status)
            ) {

                return booking;
            }


            const allowedStatuses = [

                "searching",

                "requested",

                "accepted",

                "arriving",

                "driver_arriving"
            ];


            if (
                !allowedStatuses.includes(status)
            ) {

                throw new Error(
                    "This ride cannot be cancelled now."
                );
            }


            await BOOKING.updateBooking(
                booking.id,
                {

                    status:
                        "cancelled",

                    cancelledBy:
                        "customer",

                    cancellationReason:
                        String(
                            reason ||
                            "Cancelled by customer"
                        ).trim(),

                    cancelledAt:
                        Date.now()
                }
            );


            BOOKING.state.matching =
                false;


            BOOKING.emitOnce(
                "ride-cancelled",
                booking.id,
                {

                    booking:
                        BOOKING.state.booking
                }
            );


            return BOOKING.state.booking;
        };


    /* ========================================================
       RIDER INFO
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
                    BOOKING.number(
                        booking.riderRating
                    ) || 5,

                otp:
                    booking.otp ||
                    ""
            };
        };


    /* ========================================================
       BOOKING UI
       ======================================================== */

    BOOKING.updateBookingUI =
        function () {

            const booking =
                BOOKING.state.booking;


            const status =
                BOOKING.normalizeStatus(
                    booking?.status ||
                    BOOKING.state.rideStatus ||
                    "idle"
                );


            if (document.body) {

                document.body.dataset.rideStatus =
                    status;
            }


            document
                .querySelectorAll(
                    "[data-ride-status]"
                )
                .forEach(function (element) {

                    element.textContent =
                        status;
                });


            document
                .querySelectorAll(
                    "[data-booking-id]"
                )
                .forEach(function (element) {

                    element.textContent =
                        booking?.id ||
                        booking?.bookingId ||
                        "";
                });


            const rider =
                BOOKING.getRider();


            document
                .querySelectorAll(
                    "[data-rider-name]"
                )
                .forEach(function (element) {

                    element.textContent =
                        rider?.name ||
                        (
                            [
                                "searching",
                                "requested"
                            ].includes(status)
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
                        rider?.phone || "";
                });


            document
                .querySelectorAll(
                    "[data-rider-rating]"
                )
                .forEach(function (element) {

                    element.textContent =
                        rider?.rating
                            ? Number(
                                rider.rating
                            ).toFixed(1)
                            : "5.0";
                });


            document
                .querySelectorAll(
                    "[data-ride-otp]"
                )
                .forEach(function (element) {

                    element.textContent =
                        rider?.otp ||
                        "----";
                });


            document
                .querySelectorAll(
                    "[data-booking-fare]"
                )
                .forEach(function (element) {

                    element.textContent =
                        BOOKING.config.currency +
                        BOOKING.number(
                            booking?.fare ??
                            BOOKING.state.fare
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
                            "accepted",
                            "arriving",
                            "driver_arriving"
                        ].includes(status);


                    element.disabled =
                        !canCancel;
                });


            document
                .querySelectorAll(
                    "[data-matching]"
                )
                .forEach(function (element) {

                    element.hidden =
                        ![
                            "searching",
                            "requested"
                        ].includes(status);
                });


            document
                .querySelectorAll(
                    "[data-rider-section]"
                )
                .forEach(function (element) {

                    element.hidden =
                        !(
                            booking &&
                            (
                                booking.riderId ||
                                booking.riderUid
                            )
                        );
                });


            document
                .querySelectorAll(
                    "[data-booking-active]"
                )
                .forEach(function (element) {

                    element.hidden =
                        !BOOKING.isActiveStatus(
                            status
                        );
                });


            document
                .querySelectorAll(
                    "[data-booking-completed]"
                )
                .forEach(function (element) {

                    element.hidden =
                        !BOOKING.isCompletedStatus(
                            status
                        );
                });


            document
                .querySelectorAll(
                    "[data-booking-cancelled]"
                )
                .forEach(function (element) {

                    element.hidden =
                        !BOOKING.isCancelledStatus(
                            status
                        );
                });
        };


    /* ========================================================
       ACTIVE RIDE RESTORE
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
                        .once("value");


                const rides =
                    snapshot.val() || {};


                const entries =
                    Object.entries(rides);


                if (!entries.length) {
                    return null;
                }


                entries.sort(
                    function (a, b) {

                        const aTime =
                            BOOKING.number(
                                a[1]?.createdAt
                            );

                        const bTime =
                            BOOKING.number(
                                b[1]?.createdAt
                            );


                        return bTime - aTime;
                    }
                );


                for (
                    const [id, summary]
                    of entries
                ) {

                    const summaryStatus =
                        BOOKING.normalizeStatus(
                            summary?.status
                        );


                    if (
                        !BOOKING.isActiveStatus(
                            summaryStatus
                        )
                    ) {

                        continue;
                    }


                    const rideSnapshot =
                        await database
                            .ref(
                                "rides/" + id
                            )
                            .once("value");


                    const ride =
                        rideSnapshot.val();


                    if (!ride) {
                        continue;
                    }


                    const rideStatus =
                        BOOKING.normalizeStatus(
                            ride.status
                        );


                    if (
                        !BOOKING.isActiveStatus(
                            rideStatus
                        )
                    ) {

                        continue;
                    }


                    /*
                     * Safety check:
                     * restore only the current user's ride.
                     */

                    const rideCustomer =
                        ride.customerId ||
                        ride.customerUid;


                    if (
                        rideCustomer &&
                        String(rideCustomer) !==
                        String(uid)
                    ) {

                        continue;
                    }


                    BOOKING.state.booking =
                        ride;


                    BOOKING.state.rideStatus =
                        rideStatus;


                    BOOKING.state.matching =
                        [
                            "searching",
                            "requested"
                        ].includes(
                            rideStatus
                        );


                    BOOKING.state.pickup =
                        BOOKING.normalizeLocation(
                            ride.pickup,
                            ride.pickupAddress ||
                            "Pickup location"
                        );


                    BOOKING.state.destination =
                        BOOKING.normalizeLocation(
                            ride.destination,
                            ride.destinationAddress ||
                            "Destination"
                        );


                    BOOKING.state.distanceKm =
                        BOOKING.number(
                            ride.distanceKm
                        );


                    BOOKING.state.durationMinutes =
                        BOOKING.number(
                            ride.durationMinutes
                        );


                    BOOKING.state.estimatedFare =
                        BOOKING.number(
                            ride.estimatedFare
                        );


                    BOOKING.state.discount =
                        BOOKING.number(
                            ride.discount
                        );


                    BOOKING.state.fare =
                        BOOKING.number(
                            ride.fare ||
                            ride.totalFare
                        );


                    if (ride.service) {

                        BOOKING.state.service =
                            BOOKING.getService(
                                ride.service
                            ).id;
                    }


                    if (ride.paymentMethod) {

                        BOOKING.state.paymentMethod =
                            ride.paymentMethod;
                    }


                    BOOKING.attachBookingListener(
                        ride.id
                    );


                    BOOKING.updateLocationUI();

                    BOOKING.updateFare();

                    BOOKING.updateBookingUI();


                    BOOKING.emit(
                        "active-ride-restored",
                        {
                            booking: ride
                        }
                    );


                    return ride;
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

            if (BOOKING.state.uiBound) {
                return;
            }


            BOOKING.state.uiBound = true;


            document.addEventListener(
                "click",
                function (event) {

                    const serviceButton =
                        event.target.closest?.(
                            "[data-service]"
                        );


                    if (serviceButton) {

                        event.preventDefault();


                        BOOKING.setService(
                            serviceButton.dataset
                                .service
                        );


                        return;
                    }


                    const paymentButton =
                        event.target.closest?.(
                            "[data-payment-method]"
                        );


                    if (paymentButton) {

                        event.preventDefault();


                        BOOKING.setPaymentMethod(
                            paymentButton.dataset
                                .paymentMethod
                        );


                        return;
                    }


                    const bookButton =
                        event.target.closest?.(
                            "[data-book-ride]"
                        );


                    if (bookButton) {

                        event.preventDefault();


                        BOOKING.handleBookButton(
                            bookButton
                        );


                        return;
                    }


                    const cancelButton =
                        event.target.closest?.(
                            "[data-cancel-ride]"
                        );


                    if (cancelButton) {

                        event.preventDefault();


                        BOOKING.handleCancelButton(
                            cancelButton
                        );


                        return;
                    }


                    const couponButton =
                        event.target.closest?.(
                            "[data-apply-coupon]"
                        );


                    if (couponButton) {

                        event.preventDefault();


                        BOOKING.handleCouponButton(
                            couponButton
                        );
                    }
                }
            );
        };


    /* ========================================================
       BOOK BUTTON
       ======================================================== */

    BOOKING.handleBookButton =
        async function (button) {

            if (
                BOOKING.state.loading ||
                BOOKING.state.requestInProgress
            ) {

                return null;
            }


            try {

                button.disabled = true;


                if (
                    RX.app &&
                    typeof RX.app.showLoading ===
                    "function"
                ) {

                    RX.app.showLoading(
                        "Finding a rider..."
                    );
                }


                const booking =
                    await BOOKING.requestRide();


                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        "Ride request sent.",
                        "success"
                    );
                }


                return booking;

            } catch (error) {

                console.error(
                    "RiderX booking failed:",
                    error
                );


                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        error?.message ||
                        "Unable to book ride.",
                        "error"
                    );
                }


                return null;

            } finally {

                button.disabled =
                    false;


                if (
                    RX.app &&
                    typeof RX.app.hideLoading ===
                    "function"
                ) {

                    RX.app.hideLoading();
                }
            }
        };


    /* ========================================================
       CANCEL BUTTON
       ======================================================== */

    BOOKING.handleCancelButton =
        async function () {

            try {

                await BOOKING.cancelRide(
                    "Cancelled by customer"
                );


                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        "Ride cancelled.",
                        "success"
                    );
                }

            } catch (error) {

                console.error(
                    "RiderX cancellation failed:",
                    error
                );


                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        error?.message ||
                        "Unable to cancel ride.",
                        "error"
                    );
                }
            }
        };


    /* ========================================================
       COUPON BUTTON
       ======================================================== */

    BOOKING.handleCouponButton =
        async function () {

            const input =
                document.querySelector(
                    "[data-coupon-input]"
                ) ||
                document.querySelector(
                    "#coupon"
                );


            const code =
                input?.value || "";


            try {

                await BOOKING.applyCoupon(
                    code
                );


                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        "Coupon applied.",
                        "success"
                    );
                }

            } catch (error) {

                console.error(
                    "Coupon error:",
                    error
                );


                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        error?.message ||
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


                        BOOKING.state.matching =
                            false;


                        BOOKING.state.loading =
                            false;


                        BOOKING.state.requestInProgress =
                            false;


                        BOOKING.state.emittedStatuses =
                            {};


                        BOOKING.updateBookingUI();
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
                                detail || {}
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


    BOOKING.emitOnce =
        function (
            eventName,
            key,
            detail
        ) {

            const eventKey =
                eventName +
                ":" +
                String(
                    key ||
                    "default"
                );


            if (
                BOOKING.state.emittedStatuses[
                    eventKey
                ]
            ) {

                return;
            }


            BOOKING.state.emittedStatuses[
                eventKey
            ] = true;


            BOOKING.emit(
                eventName,
                detail
            );
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

                return function () {};
            }


            const eventNameFull =
                "riderx-booking-" +
                eventName;


            const handler =
                function (event) {

                    callback(
                        event.detail || {}
                    );
                };


            window.addEventListener(
                eventNameFull,
                handler
            );


            return function () {

                window.removeEventListener(
                    eventNameFull,
                    handler
                );
            };
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
                BOOKING.config.defaultService
            );


            BOOKING.setPaymentMethod(
                BOOKING.config.defaultPayment
            );


            BOOKING.bindUI();

            BOOKING.setupAuth();

            BOOKING.updateLocationUI();

            BOOKING.updateFare();

            BOOKING.updateBookingUI();


            /*
             * Restore an active customer ride.
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
        function (location) {

            return BOOKING.setPickup(
                location
            );
        };


    RX.setDestination =
        function (location) {

            return BOOKING.setDestination(
                location
            );
        };


    RX.setService =
        function (service) {

            return BOOKING.setService(
                service
            );
        };


    RX.setPaymentMethod =
        function (method) {

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


    RX.estimateRide =
        function () {

            return BOOKING.estimate();
        };


    RX.requestRide =
        function (options) {

            return BOOKING.requestRide(
                options
            );
        };


    RX.cancelRide =
        function (reason) {

            return BOOKING.cancelRide(
                reason
            );
        };


    RX.getActiveBooking =
        function () {

            return BOOKING.state.booking;
        };


    RX.getBookingState =
        function () {

            return {
                ...BOOKING.state
            };
        };


    RX.applyCoupon =
        function (code) {

            return BOOKING.applyCoupon(
                code
            );
        };


    RX.removeCoupon =
        function () {

            return BOOKING.removeCoupon();
        };


    RX.hasActiveRide =
        function () {

            return BOOKING.hasActiveRide();
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
                once: true
            }
        );

    } else {

        BOOKING.init();
    }

})();
