/* ============================================================
   RIDERX PRICING ENGINE
   File: js/pricing.js

   Handles:
   - Bike Taxi
   - Cab
   - Parcel
   - Food
   - Base fare
   - Per km
   - Per minute
   - Minimum fare
   - Day / Night pricing
   - Long-distance pricing
   - Surge
   - Admin Firebase pricing
   - Fare calculation
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Pricing = RX.pricing = RX.pricing || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Pricing.config = {

        pricingPath: "pricing",

        defaultCity: "Chandigarh",

        currency: "INR",

        currencySymbol: "₹",

        timezone: "Asia/Kolkata",

        dayStartHour: 8,

        dayEndHour: 22,

        longDistanceLimitKm: 10,

        maxDistanceKm: 500,

        maxDurationMinutes: 720,

        defaultSurge: 1
    };


    /* ========================================================
       DEFAULT PRICING
       ======================================================== */

    Pricing.defaults = {

        bike: {

            name: "Bike Taxi",

            enabled: true,

            baseFare: 25,

            perKm: 8,

            longDistancePerKm: 9,

            perMinute: 1,

            minimumFare: 40,

            bookingFee: 0,

            serviceFee: 0,

            cancellationFee: 20
        },


        cab: {

            name: "Cab",

            enabled: true,

            baseFare: 50,

            perKm: 12,

            longDistancePerKm: 14,

            perMinute: 2,

            minimumFare: 80,

            bookingFee: 0,

            serviceFee: 0,

            cancellationFee: 50
        },


        parcel: {

            name: "Parcel",

            enabled: true,

            baseFare: 35,

            perKm: 10,

            longDistancePerKm: 11,

            perMinute: 1,

            minimumFare: 50,

            bookingFee: 0,

            serviceFee: 0,

            cancellationFee: 30
        },


        food: {

            name: "Food Delivery",

            enabled: true,

            baseFare: 25,

            perKm: 7,

            longDistancePerKm: 8,

            perMinute: 1,

            minimumFare: 35,

            bookingFee: 0,

            serviceFee: 0,

            cancellationFee: 20
        }

    };


    /* ========================================================
       CURRENT PRICING
       ======================================================== */

    Pricing.state = {

        initialized: false,

        loaded: false,

        city: Pricing.config.defaultCity,

        data: null,

        lastCalculation: null,

        surge: {

            bike: 1,

            cab: 1,

            parcel: 1,

            food: 1
        }
    };


    /* ========================================================
       FIREBASE HELPERS
       ======================================================== */

    Pricing.getDatabase = function () {

        try {

            if (RX.firebase?.database) {

                return RX.firebase.database;

            }

        } catch (error) {}


        try {

            if (
                window.firebase &&
                typeof firebase.database === "function"
            ) {

                return firebase.database();

            }

        } catch (error) {

            console.warn(
                "RiderX pricing database error:",
                error
            );

        }

        return null;
    };


    Pricing.getFirestore = function () {

        try {

            if (RX.firebase?.firestore) {

                return RX.firebase.firestore;

            }

        } catch (error) {}


        try {

            if (
                window.firebase &&
                typeof firebase.firestore === "function"
            ) {

                return firebase.firestore();

            }

        } catch (error) {}

        return null;
    };


    /* ========================================================
       SERVICE NORMALIZATION
       ======================================================== */

    Pricing.normalizeService = function (service) {

        service = String(
            service ||
            "bike"
        )
        .toLowerCase()
        .trim();


        const aliases = {

            "bike taxi": "bike",

            "bike-taxi": "bike",

            "motorcycle": "bike",

            "motorbike": "bike",

            "driver": "bike",

            "car": "cab",

            "taxi": "cab",

            "auto": "cab",

            "parcel delivery": "parcel",

            "delivery": "parcel",

            "food delivery": "food"

        };


        return aliases[service] || service;
    };


    /* ========================================================
       NUMBER HELPERS
       ======================================================== */

    Pricing.number = function (
        value,
        fallback
    ) {

        const number = Number(value);

        if (
            Number.isFinite(number)
        ) {

            return number;

        }

        return Number(
            fallback || 0
        );
    };


    Pricing.round = function (
        value
    ) {

        return Math.round(
            Number(value || 0) * 100
        ) / 100;
    };


    Pricing.clamp = function (
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                Number(value || 0),
                min
            ),
            max
        );
    };


    /* ========================================================
       MERGE OBJECTS
       ======================================================== */

    Pricing.merge = function (
        base,
        override
    ) {

        return {

            ...(base || {}),

            ...(override || {})

        };
    };


    /* ========================================================
       LOAD PRICING FROM RTDB
       ======================================================== */

    Pricing.loadFromRTDB = async function () {

        const database =
            Pricing.getDatabase();


        if (!database) {

            return null;

        }


        try {

            const snapshot =
                await database
                    .ref(
                        Pricing.config.pricingPath
                    )
                    .once(
                        "value"
                    );


            return snapshot.val() || null;

        } catch (error) {

            console.warn(
                "Pricing RTDB load failed:",
                error
            );


            return null;
        }
    };


    /* ========================================================
       LOAD PRICING FROM FIRESTORE
       ======================================================== */

    Pricing.loadFromFirestore = async function () {

        const firestore =
            Pricing.getFirestore();


        if (!firestore) {

            return null;

        }


        try {

            const result = {};

            const snapshot =
                await firestore
                    .collection(
                        Pricing.config.pricingPath
                    )
                    .get();


            snapshot.forEach(
                function (doc) {

                    result[doc.id] =
                        doc.data();

                }
            );


            return Object.keys(result).length
                ? result
                : null;

        } catch (error) {

            console.warn(
                "Pricing Firestore load failed:",
                error
            );


            return null;
        }
    };


    /* ========================================================
       LOAD PRICING
       ======================================================== */

    Pricing.load = async function () {

        let firebaseData =
            await Pricing.loadFromRTDB();


        if (!firebaseData) {

            firebaseData =
                await Pricing
                    .loadFromFirestore();

        }


        const source =
            firebaseData || {};


        Pricing.state.data = {};


        Object.keys(
            Pricing.defaults
        )
        .forEach(
            function (service) {

                Pricing.state.data[service] =
                    Pricing.merge(
                        Pricing.defaults[
                            service
                        ],
                        source[
                            service
                        ]
                    );

            }
        );


        /*
         * Optional global settings.
         */

        if (
            source.global
        ) {

            Pricing.state.data.global =
                source.global;

        } else {

            Pricing.state.data.global = {

                taxPercent: 0,

                platformFee: 0,

                waitingPerMinute: 0
            };

        }


        Pricing.state.loaded =
            true;


        Pricing.emit(
            "loaded",
            {

                pricing:
                    Pricing.state.data
            }
        );


        return Pricing.state.data;
    };


    /* ========================================================
       GET SERVICE PRICING
       ======================================================== */

    Pricing.get = function (
        service
    ) {

        service =
            Pricing.normalizeService(
                service
            );


        if (
            !Pricing.state.data
        ) {

            Pricing.state.data = {};

            Object.keys(
                Pricing.defaults
            )
            .forEach(
                function (key) {

                    Pricing.state.data[key] =
                        {
                            ...Pricing.defaults[key]
                        };

                }
            );

        }


        return (
            Pricing.state.data[
                service
            ] ||
            Pricing.defaults[
                service
            ] ||
            null
        );
    };


    /* ========================================================
       SERVICE ENABLED
       ======================================================== */

    Pricing.isServiceEnabled = function (
        service
    ) {

        const config =
            Pricing.get(
                service
            );


        return Boolean(
            config &&
            config.enabled !== false
        );
    };


    /* ========================================================
       SET SURGE
       ======================================================== */

    Pricing.setSurge = function (
        service,
        multiplier
    ) {

        service =
            Pricing.normalizeService(
                service
            );


        multiplier =
            Pricing.number(
                multiplier,
                1
            );


        multiplier =
            Pricing.clamp(
                multiplier,
                1,
                5
            );


        Pricing.state.surge[
            service
        ] =
            multiplier;


        Pricing.emit(
            "surge-changed",
            {

                service:
                    service,

                multiplier:
                    multiplier
            }
        );


        return multiplier;
    };


    /* ========================================================
       GET SURGE
       ======================================================== */

    Pricing.getSurge = function (
        service,
        options
    ) {

        service =
            Pricing.normalizeService(
                service
            );


        options =
            options || {};


        if (
            options.surgeMultiplier != null
        ) {

            return Pricing.clamp(
                options.surgeMultiplier,
                1,
                5
            );

        }


        const stateSurge =
            Pricing.state.surge[
                service
            ];


        if (
            stateSurge
        ) {

            return Pricing.clamp(
                stateSurge,
                1,
                5
            );

        }


        const config =
            Pricing.get(
                service
            );


        return Pricing.clamp(
            config?.surgeMultiplier ||
            1,
            1,
            5
        );
    };


    /* ========================================================
       TIME HELPERS
       ======================================================== */

    Pricing.getHour = function (
        date
    ) {

        const value =
            date
            ? new Date(date)
            : new Date();


        return value.getHours();
    };


    Pricing.isNight = function (
        date
    ) {

        const hour =
            Pricing.getHour(
                date
            );


        return (
            hour <
            Pricing.config.dayStartHour ||
            hour >=
            Pricing.config.dayEndHour
        );
    };


    /* ========================================================
       GET TIME RATE
       ======================================================== */

    Pricing.getTimeRate = function (
        config,
        date
    ) {

        const night =
            Pricing.isNight(
                date
            );


        if (
            night
        ) {

            return {

                mode:
                    "night",

                perKm:
                    Pricing.number(
                        config.nightPerKm,
                        config.perKm
                    ),

                longDistancePerKm:
                    Pricing.number(
                        config.nightLongDistancePerKm,
                        config.longDistancePerKm ||
                        config.perKm
                    ),

                perMinute:
                    Pricing.number(
                        config.nightPerMinute,
                        config.perMinute
                    ),

                baseFare:
                    Pricing.number(
                        config.nightBaseFare,
                        config.baseFare
                    ),

                minimumFare:
                    Pricing.number(
                        config.nightMinimumFare,
                        config.minimumFare
                    )
            };

        }


        return {

            mode:
                "day",

            perKm:
                Pricing.number(
                    config.dayPerKm,
                    config.perKm
                ),

            longDistancePerKm:
                Pricing.number(
                    config.dayLongDistancePerKm,
                    config.longDistancePerKm ||
                    config.perKm
                ),

            perMinute:
                Pricing.number(
                    config.dayPerMinute,
                    config.perMinute
                ),

            baseFare:
                Pricing.number(
                    config.dayBaseFare,
                    config.baseFare
                ),

            minimumFare:
                Pricing.number(
                    config.dayMinimumFare,
                    config.minimumFare
                )
        };
    };


    /* ========================================================
       DISTANCE FARE
       ======================================================== */

    Pricing.calculateDistanceFare = function (
        distanceKm,
        rate
    ) {

        distanceKm =
            Pricing.clamp(
                distanceKm,
                0,
                Pricing.config.maxDistanceKm
            );


        const limit =
            Pricing.config
                .longDistanceLimitKm;


        const normalKm =
            Math.min(
                distanceKm,
                limit
            );


        const longKm =
            Math.max(
                distanceKm -
                limit,
                0
            );


        const normalFare =
            normalKm *
            Pricing.number(
                rate.perKm,
                0
            );


        const longFare =
            longKm *
            Pricing.number(
                rate.longDistancePerKm,
                rate.perKm
            );


        return {

            normalKm:
                Pricing.round(
                    normalKm
                ),

            longKm:
                Pricing.round(
                    longKm
                ),

            normalFare:
                Pricing.round(
                    normalFare
                ),

            longFare:
                Pricing.round(
                    longFare
                ),

            total:
                Pricing.round(
                    normalFare +
                    longFare
                )
        };
    };


    /* ========================================================
       TIME FARE
       ======================================================== */

    Pricing.calculateTimeFare = function (
        durationMinutes,
        rate
    ) {

        durationMinutes =
            Pricing.clamp(
                durationMinutes,
                0,
                Pricing.config
                    .maxDurationMinutes
            );


        const fare =
            durationMinutes *
            Pricing.number(
                rate.perMinute,
                0
            );


        return {

            minutes:
                Pricing.round(
                    durationMinutes
                ),

            total:
                Pricing.round(
                    fare
                )
        };
    };


    /* ========================================================
       MAIN FARE CALCULATOR
       ======================================================== */

    Pricing.calculate = function (
        options
    ) {

        options =
            options || {};


        const service =
            Pricing.normalizeService(
                options.service ||
                options.serviceType ||
                "bike"
            );


        if (
            !Pricing.isServiceEnabled(
                service
            )
        ) {

            return {

                success:
                    false,

                error:
                    "This service is currently unavailable.",

                service:
                    service
            };
        }


        const config =
            Pricing.get(
                service
            );


        /*
         * Distance.
         */

        const distanceKm =
            Pricing.clamp(
                Pricing.number(
                    options.distanceKm ??
                    options.distance ??
                    0
                ),
                0,
                Pricing.config
                    .maxDistanceKm
            );


        /*
         * Duration.
         */

        const durationMinutes =
            Pricing.clamp(
                Pricing.number(
                    options.durationMinutes ??
                    options.duration ??
                    options.time ??
                    0
                ),
                0,
                Pricing.config
                    .maxDurationMinutes
            );


        /*
         * Day/night rate.
         */

        const rate =
            Pricing.getTimeRate(
                config,
                options.date ||
                options.time
            );


        /*
         * Base.
         */

        const baseFare =
            rate.baseFare;


        /*
         * Distance.
         */

        const distanceFare =
            Pricing.calculateDistanceFare(
                distanceKm,
                rate
            );


        /*
         * Time.
         */

        const timeFare =
            Pricing.calculateTimeFare(
                durationMinutes,
                rate
            );


        /*
         * Waiting.
         */

        const waitingMinutes =
            Pricing.number(
                options.waitingMinutes,
                0
            );


        const waitingRate =
            Pricing.number(
                config.waitingPerMinute,
                Pricing.number(
                    Pricing.state
                        .data
                        ?.global
                        ?.waitingPerMinute,
                    0
                )
            );


        const waitingFare =
            waitingMinutes *
            waitingRate;


        /*
         * Extra booking/platform fee.
         */

        const bookingFee =
            Pricing.number(
                config.bookingFee,
                0
            );


        const serviceFee =
            Pricing.number(
                config.serviceFee,
                0
            );


        const toll =
            Pricing.number(
                options.toll,
                0
            );


        const parking =
            Pricing.number(
                options.parking,
                0
            );


        const extraCharges =
            Pricing.number(
                options.extraCharges,
                0
            );


        /*
         * Subtotal before surge.
         */

        let subtotal =
            baseFare +
            distanceFare.total +
            timeFare.total +
            waitingFare +
            bookingFee +
            serviceFee +
            toll +
            parking +
            extraCharges;


        /*
         * Minimum fare.
         */

        const minimumFare =
            rate.minimumFare;


        subtotal =
            Math.max(
                subtotal,
                minimumFare
            );


        /*
         * Surge.
         */

        const surgeMultiplier =
            Pricing.getSurge(
                service,
                options
            );


        const surgeAmount =
            subtotal *
            Math.max(
                surgeMultiplier -
                1,
                0
            );


        const surgedSubtotal =
            subtotal *
            surgeMultiplier;


        /*
         * Tax.
         */

        const global =
            Pricing.state
                .data
                ?.global ||
            {};


        const taxPercent =
            Pricing.number(
                options.taxPercent ??
                config.taxPercent ??
                global.taxPercent,
                0
            );


        const tax =
            surgedSubtotal *
            taxPercent /
            100;


        /*
         * Discount.
         */

        const discount =
            Pricing.clamp(
                Pricing.number(
                    options.discount,
                    0
                ),
                0,
                surgedSubtotal +
                tax
            );


        /*
         * Final fare.
         */

        const finalFare =
            Math.max(
                0,
                surgedSubtotal +
                tax -
                discount
            );


        const result = {

            success:
                true,

            service:
                service,

            serviceName:
                config.name,

            city:
                options.city ||
                Pricing.state.city,

            distanceKm:
                Pricing.round(
                    distanceKm
                ),

            durationMinutes:
                Pricing.round(
                    durationMinutes
                ),

            pricingMode:
                rate.mode,

            baseFare:
                Pricing.round(
                    baseFare
                ),

            normalDistanceKm:
                distanceFare.normalKm,

            longDistanceKm:
                distanceFare.longKm,

            distanceFare:
                distanceFare.total,

            timeFare:
                timeFare.total,

            waitingMinutes:
                Pricing.round(
                    waitingMinutes
                ),

            waitingFare:
                Pricing.round(
                    waitingFare
                ),

            bookingFee:
                Pricing.round(
                    bookingFee
                ),

            serviceFee:
                Pricing.round(
                    serviceFee
                ),

            toll:
                Pricing.round(
                    toll
                ),

            parking:
                Pricing.round(
                    parking
                ),

            extraCharges:
                Pricing.round(
                    extraCharges
                ),

            minimumFare:
                Pricing.round(
                    minimumFare
                ),

            subtotal:
                Pricing.round(
                    subtotal
                ),

            surgeMultiplier:
                Pricing.round(
                    surgeMultiplier
                ),

            surgeAmount:
                Pricing.round(
                    surgeAmount
                ),

            taxPercent:
                Pricing.round(
                    taxPercent
                ),

            tax:
                Pricing.round(
                    tax
                ),

            discount:
                Pricing.round(
                    discount
                ),

            finalFare:
                Pricing.round(
                    finalFare
                ),

            currency:
                Pricing.config.currency,

            currencySymbol:
                Pricing.config.currencySymbol,

            calculatedAt:
                Date.now()
        };


        Pricing.state
            .lastCalculation =
            result;


        Pricing.emit(
            "calculated",
            result
        );


        Pricing.updateUI(
            result
        );


        return result;
    };


    /* ========================================================
       ESTIMATE ALL SERVICES
       ======================================================== */

    Pricing.estimateAll = function (
        options
    ) {

        options =
            options || {};


        const services = [
            "bike",
            "cab",
            "parcel",
            "food"
        ];


        const result = {};


        services.forEach(
            function (service) {

                result[service] =
                    Pricing.calculate(
                        {
                            ...options,

                            service:
                                service
                        }
                    );

            }
        );


        return result;
    };


    /* ========================================================
       FORMAT MONEY
       ======================================================== */

    Pricing.format = function (
        amount
    ) {

        return (
            Pricing.config
                .currencySymbol +
            Pricing.round(
                amount
            ).toFixed(
                2
            )
        );
    };


    /* ========================================================
       UPDATE FARE UI
       ======================================================== */

    Pricing.updateUI = function (
        result
    ) {

        if (
            !result ||
            !result.success
        ) {

            return;
        }


        const values = {

            original:
                result.subtotal,

            base:
                result.baseFare,

            distance:
                result.distanceFare,

            time:
                result.timeFare,

            waiting:
                result.waitingFare,

            surge:
                result.surgeAmount,

            tax:
                result.tax,

            discount:
                result.discount,

            total:
                result.finalFare
        };


        const selectors = {

            original: [
                "[data-fare-original]",
                "#fareOriginal"
            ],

            base: [
                "[data-fare-base]",
                "#baseFare"
            ],

            distance: [
                "[data-fare-distance]",
                "#distanceFare"
            ],

            time: [
                "[data-fare-time]",
                "#timeFare"
            ],

            waiting: [
                "[data-fare-waiting]",
                "#waitingFare"
            ],

            surge: [
                "[data-fare-surge]",
                "#surgeFare"
            ],

            tax: [
                "[data-fare-tax]",
                "#taxFare"
            ],

            discount: [
                "[data-fare-discount]",
                "#discountFare"
            ],

            total: [
                "[data-fare-total]",
                "#totalFare",
                "#estimatedFare"
            ]

        };


        Object.keys(
            values
        )
        .forEach(
            function (key) {

                selectors[key]
                    .forEach(
                        function (selector) {

                            document
                                .querySelectorAll(
                                    selector
                                )
                                .forEach(
                                    function (
                                        element
                                    ) {

                                        element.textContent =
                                            Pricing.format(
                                                values[key]
                                            );

                                    }
                                );

                        }
                    );

            }
        );


        document
            .querySelectorAll(
                "[data-surge-multiplier]"
            )
            .forEach(
                function (
                    element
                ) {

                    if (
                        result.surgeMultiplier >
                        1
                    ) {

                        element.textContent =
                            result.surgeMultiplier +
                            "x";

                        element.hidden =
                            false;

                    } else {

                        element.hidden =
                            true;
                    }

                }
            );


        document
            .querySelectorAll(
                "[data-fare-service]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        result.serviceName;

                }
            );


        document
            .querySelectorAll(
                "[data-fare-distance-text]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        result.distanceKm +
                        " km";

                }
            );


        document
            .querySelectorAll(
                "[data-fare-duration-text]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        Math.round(
                            result.durationMinutes
                        ) +
                        " min";

                }
            );
    };


    /* ========================================================
       ADMIN PRICING UPDATE
       ======================================================== */

    Pricing.saveServicePricing = async function (
        service,
        values
    ) {

        service =
            Pricing.normalizeService(
                service
            );


        if (
            !Pricing.defaults[
                service
            ]
        ) {

            throw new Error(
                "Invalid service."
            );
        }


        values =
            values || {};


        const current =
            Pricing.get(
                service
            );


        const updated = {

            ...current,

            ...values,

            updatedAt:
                Date.now()
        };


        let saved =
            false;


        const database =
            Pricing.getDatabase();


        if (
            database
        ) {

            try {

                await database
                    .ref(
                        Pricing.config
                            .pricingPath +
                        "/" +
                        service
                    )
                    .update(
                        updated
                    );


                saved =
                    true;

            } catch (error) {

                console.warn(
                    "Pricing RTDB save failed:",
                    error
                );

            }
        }


        if (
            !saved
        ) {

            const firestore =
                Pricing.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Pricing.config
                                .pricingPath
                        )
                        .doc(
                            service
                        )
                        .set(
                            updated,
                            {
                                merge:
                                    true
                            }
                        );


                    saved =
                        true;

                } catch (error) {

                    console.warn(
                        "Pricing Firestore save failed:",
                        error
                    );

                }
            }

        }


        if (
            saved
        ) {

            Pricing.state.data[
                service
            ] =
                updated;


            Pricing.emit(
                "updated",
                {

                    service:
                        service,

                    pricing:
                        updated
                }
            );

        }


        return saved;
    };


    /* ========================================================
       SAVE GLOBAL PRICING
       ======================================================== */

    Pricing.saveGlobalPricing = async function (
        values
    ) {

        values =
            values || {};


        const updated = {

            ...(
                Pricing.state
                    .data
                    ?.global ||
                {}
            ),

            ...values,

            updatedAt:
                Date.now()
        };


        let saved =
            false;


        const database =
            Pricing.getDatabase();


        if (
            database
        ) {

            try {

                await database
                    .ref(
                        Pricing.config
                            .pricingPath +
                        "/global"
                    )
                    .update(
                        updated
                    );


                saved =
                    true;

            } catch (error) {}
        }


        if (
            !saved
        ) {

            const firestore =
                Pricing.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                    .collection(
                        Pricing.config
                            .pricingPath
                    )
                    .doc(
                        "global"
                    )
                    .set(
                        updated,
                        {
                            merge:
                                true
                        }
                    );


                    saved =
                        true;

                } catch (error) {}

            }

        }


        if (
            saved
        ) {

            Pricing.state.data.global =
                updated;

        }


        return saved;
    };


    /* ========================================================
       PRICE BREAKDOWN
       ======================================================== */

    Pricing.getBreakdown = function (
        result
    ) {

        if (
            !result
        ) {

            return [];
        }


        return [

            {
                label:
                    "Base fare",

                amount:
                    result.baseFare
            },

            {
                label:
                    "Distance",

                amount:
                    result.distanceFare
            },

            {
                label:
                    "Time",

                amount:
                    result.timeFare
            },

            {
                label:
                    "Waiting",

                amount:
                    result.waitingFare
            },

            {
                label:
                    "Booking fee",

                amount:
                    result.bookingFee
            },

            {
                label:
                    "Service fee",

                amount:
                    result.serviceFee
            },

            {
                label:
                    "Surge",

                amount:
                    result.surgeAmount
            },

            {
                label:
                    "Tax",

                amount:
                    result.tax
            },

            {
                label:
                    "Discount",

                amount:
                    -result.discount
            }

        ];
    };


    /* ========================================================
       EVENTS
       ======================================================== */

    Pricing.emit = function (
        name,
        data
    ) {

        window.dispatchEvent(
            new CustomEvent(
                "riderx-pricing-" +
                name,
                {

                    detail:
                        data || {}
                }
            )
        );
    };


    Pricing.on = function (
        name,
        callback
    ) {

        if (
            typeof callback !==
            "function"
        ) {

            return;
        }


        window.addEventListener(
            "riderx-pricing-" +
            name,
            function (
                event
            ) {

                callback(
                    event.detail || {},
                    event
                );

            }
        );
    };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.calculateFare =
        Pricing.calculate;

    RX.getPricing =
        Pricing.get;

    RX.estimateAllFares =
        Pricing.estimateAll;

    RX.formatFare =
        Pricing.format;


    /* ========================================================
       INIT
       ======================================================== */

    Pricing.init = async function () {

        if (
            Pricing.state.initialized
        ) {

            return;
        }


        Pricing.state.initialized =
            true;


        /*
         * Defaults are immediately
         * available. Firebase pricing
         * overrides them when loaded.
         */

        Pricing.state.data = {};


        Object.keys(
            Pricing.defaults
        )
        .forEach(
            function (service) {

                Pricing.state.data[
                    service
                ] =
                    {
                        ...Pricing.defaults[
                            service
                        ]
                    };

            }
        );


        Pricing.state.data.global = {

            taxPercent:
                0,

            platformFee:
                0,

            waitingPerMinute:
                0
        };


        /*
         * Load admin pricing.
         */

        try {

            await Pricing.load();

        } catch (error) {

            console.warn(
                "RiderX pricing initialized with defaults.",
                error
            );

        }


        console.log(
            "RiderX pricing.js loaded."
        );
    };


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Pricing.init
        );

    } else {

        Pricing.init();

    }


})();
