/* ============================================================
   RIDERX FARE CALCULATOR
   File: js/fare-calculator.js

   Uber-style fare calculation engine.

   Supports:
   - Bike Taxi
   - Cab
   - Parcel
   - Food Delivery
   - Base fare
   - Per KM
   - Per minute
   - Minimum fare
   - Booking/platform fee
   - Night pricing
   - Surge
   - Discount
   - Tax
   - Coupon
   - Wallet
   - Cash / Online
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Fare =
        RX.fareCalculator =
        RX.fareCalculator || {};


    /* ========================================================
       DEFAULT CONFIG
       ======================================================== */

    Fare.defaults = {

        currency:
            "₹",

        currencyCode:
            "INR",

        taxPercent:
            0,

        bookingFee:
            0,

        serviceFee:
            0,

        minimumFare:
            0,

        nightMultiplier:
            1,

        surgeMultiplier:
            1,

        waitingPerMinute:
            0,

        cancellationFee:
            0,

        services: {

            bike: {

                name:
                    "Bike Taxi",

                baseFare:
                    20,

                perKm:
                    8,

                perMinute:
                    0,

                minimumFare:
                    30
            },

            cab: {

                name:
                    "Cab",

                baseFare:
                    50,

                perKm:
                    12,

                perMinute:
                    1,

                minimumFare:
                    80
            },

            parcel: {

                name:
                    "Parcel",

                baseFare:
                    30,

                perKm:
                    10,

                perMinute:
                    0,

                minimumFare:
                    40
            },

            food: {

                name:
                    "Food Delivery",

                baseFare:
                    20,

                perKm:
                    8,

                perMinute:
                    0,

                minimumFare:
                    30
            }
        }
    };


    /* ========================================================
       STATE
       ======================================================== */

    Fare.config =
        JSON.parse(
            JSON.stringify(
                Fare.defaults
            )
        );


    /* ========================================================
       NUMBER
       ======================================================== */

    Fare.number =
        function (
            value,
            fallback
        ) {

            const number =
                Number(value);


            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;
            }


            return (
                fallback ??
                0
            );
        };


    Fare.round =
        function (
            value,
            decimals
        ) {

            const places =
                Number.isFinite(
                    Number(decimals)
                )
                    ? Number(decimals)
                    : 2;


            const factor =
                Math.pow(
                    10,
                    places
                );


            return (
                Math.round(
                    Fare.number(
                        value
                    ) *
                    factor
                ) /
                factor
            );
        };


    /* ========================================================
       SERVICE NORMALIZATION
       ======================================================== */

    Fare.normalizeService =
        function (
            service
        ) {

            service =
                String(
                    service ||
                    "bike"
                )
                .trim()
                .toLowerCase();


            const aliases = {

                bike:
                    "bike",

                biketaxi:
                    "bike",

                "bike-taxi":
                    "bike",

                "bike taxi":
                    "bike",

                motorcycle:
                    "bike",

                moto:
                    "bike",


                cab:
                    "cab",

                car:
                    "cab",

                taxi:
                    "cab",

                sedan:
                    "cab",


                parcel:
                    "parcel",

                delivery:
                    "parcel",

                package:
                    "parcel",


                food:
                    "food",

                "food-delivery":
                    "food",

                "food delivery":
                    "food"
            };


            return (
                aliases[service] ||
                "bike"
            );
        };


    /* ========================================================
       MERGE CONFIG
       ======================================================== */

    Fare.deepMerge =
        function (
            target,
            source
        ) {

            if (
                !source ||
                typeof source !==
                "object"
            ) {

                return target;
            }


            Object.keys(
                source
            )
            .forEach(
                function (
                    key
                ) {

                    const value =
                        source[key];


                    if (
                        value &&
                        typeof value ===
                        "object" &&
                        !Array.isArray(
                            value
                        )
                    ) {

                        if (
                            !target[key] ||
                            typeof target[key] !==
                            "object"
                        ) {

                            target[key] =
                                {};
                        }


                        Fare.deepMerge(
                            target[key],
                            value
                        );

                    } else {

                        target[key] =
                            value;
                    }
                }
            );


            return target;
        };


    Fare.setConfig =
        function (
            config
        ) {

            Fare.config =
                Fare.deepMerge(
                    JSON.parse(
                        JSON.stringify(
                            Fare.defaults
                        )
                    ),
                    config ||
                    {}
                );


            Fare.emit(
                "config-updated",
                {
                    config:
                        Fare.config
                }
            );


            return Fare.config;
        };


    Fare.getConfig =
        function () {

            return Fare.config;
        };


    /* ========================================================
       SERVICE CONFIG
       ======================================================== */

    Fare.getServiceConfig =
        function (
            service
        ) {

            const key =
                Fare.normalizeService(
                    service
                );


            return (
                Fare.config.services?.[
                    key
                ] ||
                Fare.defaults.services.bike
            );
        };


    /* ========================================================
       TIME HELPERS
       ======================================================== */

    Fare.getHour =
        function (
            date
        ) {

            const value =
                date instanceof Date
                    ? date
                    : new Date(
                        date ||
                        Date.now()
                    );


            return value.getHours();
        };


    Fare.isNight =
        function (
            date,
            options
        ) {

            options =
                options ||
                {};


            const hour =
                Fare.getHour(
                    date
                );


            const start =
                Fare.number(
                    options.startHour,
                    22
                );


            const end =
                Fare.number(
                    options.endHour,
                    6
                );


            /*
             * 22:00 → 06:00
             */

            if (
                start > end
            ) {

                return (
                    hour >= start ||
                    hour < end
                );
            }


            return (
                hour >= start &&
                hour < end
            );
        };


    /* ========================================================
       NIGHT MULTIPLIER
       ======================================================== */

    Fare.getNightMultiplier =
        function (
            date,
            options
        ) {

            options =
                options ||
                {};


            if (
                options.nightPricing ===
                false
            ) {

                return 1;
            }


            if (
                !Fare.isNight(
                    date,
                    options
                )
            ) {

                return 1;
            }


            return Math.max(
                1,
                Fare.number(
                    options.nightMultiplier,
                    Fare.config
                        .nightMultiplier ||
                    1
                )
            );
        };


    /* ========================================================
       SURGE
       ======================================================== */

    Fare.getSurgeMultiplier =
        function (
            options
        ) {

            options =
                options ||
                {};


            if (
                options.surge ===
                false
            ) {

                return 1;
            }


            const multiplier =
                Fare.number(
                    options.surgeMultiplier,
                    Fare.config
                        .surgeMultiplier ||
                    1
                );


            return Math.max(
                1,
                multiplier
            );
        };


    /* ========================================================
       COUPON
       ======================================================== */

    Fare.calculateDiscount =
        function (
            subtotal,
            coupon
        ) {

            const amount =
                Math.max(
                    0,
                    Fare.number(
                        subtotal
                    )
                );


            if (
                !coupon
            ) {

                return {

                    amount:
                        0,

                    type:
                        null
                };
            }


            let discount =
                0;


            const type =
                String(
                    coupon.type ||
                    coupon.discountType ||
                    "flat"
                )
                .toLowerCase();


            if (
                type ===
                "percent" ||
                type ===
                "percentage"
            ) {

                discount =
                    amount *
                    (
                        Fare.number(
                            coupon.value
                        ) /
                        100
                    );

            } else {

                discount =
                    Fare.number(
                        coupon.value ??
                        coupon.amount
                    );
            }


            const maxDiscount =
                coupon.maxDiscount !==
                undefined
                    ? Fare.number(
                        coupon.maxDiscount
                    )
                    : Infinity;


            discount =
                Math.min(
                    discount,
                    maxDiscount,
                    amount
                );


            return {

                amount:
                    Fare.round(
                        Math.max(
                            0,
                            discount
                        )
                    ),

                type:
                    type,

                code:
                    coupon.code ||
                    null
            };
        };


    /* ========================================================
       TAX
       ======================================================== */

    Fare.calculateTax =
        function (
            amount,
            options
        ) {

            options =
                options ||
                {};


            const percent =
                Math.max(
                    0,
                    Fare.number(
                        options.taxPercent,
                        Fare.config
                            .taxPercent ||
                        0
                    )
                );


            const tax =
                amount *
                (
                    percent /
                    100
                );


            return {

                percent:
                    percent,

                amount:
                    Fare.round(
                        tax
                    )
            };
        };


    /* ========================================================
       PAYMENT METHOD
       ======================================================== */

    Fare.normalizePayment =
        function (
            payment
        ) {

            const value =
                String(
                    payment ||
                    "cash"
                )
                .toLowerCase()
                .trim();


            if (
                [
                    "online",
                    "card",
                    "upi",
                    "wallet",
                    "razorpay",
                    "stripe"
                ].includes(
                    value
                )
            ) {

                return "online";
            }


            return "cash";
        };


    /* ========================================================
       MAIN CALCULATOR
       ======================================================== */

    Fare.calculate =
        function (
            distanceKm,
            service,
            options
        ) {

            options =
                options ||
                {};


            const distance =
                Math.max(
                    0,
                    Fare.number(
                        distanceKm
                    )
                );


            const serviceKey =
                Fare.normalizeService(
                    service
                );


            const serviceConfig =
                Fare.getServiceConfig(
                    serviceKey
                );


            const durationMinutes =
                Math.max(
                    0,
                    Fare.number(
                        options.durationMinutes ??
                        options.minutes
                    )
                );


            /*
             * Rates
             */

            const baseFare =
                Math.max(
                    0,
                    Fare.number(
                        options.baseFare,
                        serviceConfig.baseFare
                    )
                );


            const perKm =
                Math.max(
                    0,
                    Fare.number(
                        options.perKm,
                        serviceConfig.perKm
                    )
                );


            const perMinute =
                Math.max(
                    0,
                    Fare.number(
                        options.perMinute,
                        serviceConfig.perMinute
                    )
                );


            const minimumFare =
                Math.max(
                    0,
                    Fare.number(
                        options.minimumFare,
                        serviceConfig.minimumFare ??
                        Fare.config.minimumFare
                    )
                );


            /*
             * Distance charge
             */

            const distanceFare =
                distance *
                perKm;


            /*
             * Time charge
             */

            const timeFare =
                durationMinutes *
                perMinute;


            /*
             * Base subtotal before
             * multipliers.
             */

            const rawFare =
                baseFare +
                distanceFare +
                timeFare;


            /*
             * Minimum fare
             */

            const minimumApplied =
                Math.max(
                    rawFare,
                    minimumFare
                );


            /*
             * Night pricing
             */

            const nightMultiplier =
                Fare.getNightMultiplier(
                    options.date ||
                    Date.now(),
                    options
                );


            /*
             * Surge
             */

            const surgeMultiplier =
                Fare.getSurgeMultiplier(
                    options
                );


            /*
             * Combined multiplier.
             */

            const multiplier =
                nightMultiplier *
                surgeMultiplier;


            const adjustedFare =
                minimumApplied *
                multiplier;


            /*
             * Booking/platform fee
             */

            const bookingFee =
                Math.max(
                    0,
                    Fare.number(
                        options.bookingFee,
                        Fare.config.bookingFee
                    )
                );


            /*
             * Service fee
             */

            const serviceFee =
                Math.max(
                    0,
                    Fare.number(
                        options.serviceFee,
                        Fare.config.serviceFee
                    )
                );


            /*
             * Waiting charge
             */

            const waitingMinutes =
                Math.max(
                    0,
                    Fare.number(
                        options.waitingMinutes
                    )
                );


            const waitingPerMinute =
                Math.max(
                    0,
                    Fare.number(
                        options.waitingPerMinute,
                        Fare.config.waitingPerMinute
                    )
                );


            const waitingFare =
                waitingMinutes *
                waitingPerMinute;


            /*
             * Subtotal before discount.
             */

            const subtotal =
                adjustedFare +
                bookingFee +
                serviceFee +
                waitingFare;


            /*
             * Coupon.
             */

            const discount =
                Fare.calculateDiscount(
                    subtotal,
                    options.coupon
                );


            const afterDiscount =
                Math.max(
                    0,
                    subtotal -
                    discount.amount
                );


            /*
             * Tax.
             */

            const tax =
                Fare.calculateTax(
                    afterDiscount,
                    options
                );


            /*
             * Final amount.
             */

            let total =
                afterDiscount +
                tax.amount;


            /*
             * Optional rounding.
             */

            if (
                options.roundFare !==
                false
            ) {

                total =
                    Math.round(
                        total
                    );
            }


            /*
             * Wallet payment.
             */

            const walletBalance =
                Math.max(
                    0,
                    Fare.number(
                        options.walletBalance
                    )
                );


            const paymentMethod =
                Fare.normalizePayment(
                    options.paymentMethod
                );


            let walletUsed =
                0;


            if (
                paymentMethod ===
                "wallet"
            ) {

                walletUsed =
                    Math.min(
                        walletBalance,
                        total
                    );
            }


            const payable =
                Math.max(
                    0,
                    total -
                    walletUsed
                );


            /*
             * Build full fare breakdown.
             */

            const result = {

                service:
                    serviceKey,

                serviceName:
                    serviceConfig.name ||
                    serviceKey,

                currency:
                    options.currency ||
                    Fare.config.currency,

                currencyCode:
                    options.currencyCode ||
                    Fare.config.currencyCode,


                distanceKm:
                    Fare.round(
                        distance,
                        2
                    ),

                distanceMeters:
                    Math.round(
                        distance *
                        1000
                    ),


                durationMinutes:
                    Math.round(
                        durationMinutes
                    ),


                baseFare:
                    Fare.round(
                        baseFare
                    ),

                perKm:
                    Fare.round(
                        perKm,
                        2
                    ),

                distanceFare:
                    Fare.round(
                        distanceFare
                    ),

                perMinute:
                    Fare.round(
                        perMinute,
                        2
                    ),

                timeFare:
                    Fare.round(
                        timeFare
                    ),


                minimumFare:
                    Fare.round(
                        minimumFare
                    ),

                minimumApplied:
                    Fare.round(
                        minimumApplied
                    ),


                nightPricing:
                    nightMultiplier >
                    1,

                nightMultiplier:
                    Fare.round(
                        nightMultiplier,
                        2
                    ),


                surge:
                    surgeMultiplier >
                    1,

                surgeMultiplier:
                    Fare.round(
                        surgeMultiplier,
                        2
                    ),


                multiplier:
                    Fare.round(
                        multiplier,
                        2
                    ),


                bookingFee:
                    Fare.round(
                        bookingFee
                    ),

                serviceFee:
                    Fare.round(
                        serviceFee
                    ),


                waitingMinutes:
                    Math.round(
                        waitingMinutes
                    ),

                waitingPerMinute:
                    Fare.round(
                        waitingPerMinute,
                        2
                    ),

                waitingFare:
                    Fare.round(
                        waitingFare
                    ),


                subtotal:
                    Fare.round(
                        subtotal
                    ),


                discount:
                    Fare.round(
                        discount.amount
                    ),

                coupon:
                    discount.code,


                taxPercent:
                    tax.percent,

                tax:
                    tax.amount,


                total:
                    Fare.round(
                        total
                    ),


                paymentMethod:
                    paymentMethod,

                walletUsed:
                    Fare.round(
                        walletUsed
                    ),

                payable:
                    Fare.round(
                        payable
                    ),


                estimated:
                    options.estimated !==
                    false
            };


            Fare.emit(
                "calculated",
                {
                    fare:
                        result
                }
            );


            return result;
        };


    /* ========================================================
       QUICK METHODS
       ======================================================== */

    Fare.calculateBike =
        function (
            distanceKm,
            options
        ) {

            return Fare.calculate(
                distanceKm,
                "bike",
                options
            );
        };


    Fare.calculateCab =
        function (
            distanceKm,
            options
        ) {

            return Fare.calculate(
                distanceKm,
                "cab",
                options
            );
        };


    Fare.calculateParcel =
        function (
            distanceKm,
            options
        ) {

            return Fare.calculate(
                distanceKm,
                "parcel",
                options
            );
        };


    Fare.calculateFood =
        function (
            distanceKm,
            options
        ) {

            return Fare.calculate(
                distanceKm,
                "food",
                options
            );
        };


    /* ========================================================
       DISPLAY PRICE
       ======================================================== */

    Fare.format =
        function (
            amount,
            options
        ) {

            options =
                options ||
                {};


            const value =
                Fare.number(
                    amount
                );


            const currency =
                options.currency ||
                Fare.config.currency;


            return (
                currency +
                value.toLocaleString(
                    "en-IN",
                    {
                        maximumFractionDigits:
                            0
                    }
                )
            );
        };


    Fare.formatDetailed =
        function (
            amount,
            options
        ) {

            options =
                options ||
                {};


            const value =
                Fare.number(
                    amount
                );


            const currency =
                options.currency ||
                Fare.config.currency;


            return (
                currency +
                value.toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits:
                            options.decimals ??
                            2,

                        maximumFractionDigits:
                            options.decimals ??
                            2
                    }
                )
            );
        };


    /* ========================================================
       UPDATE FARE UI
       ======================================================== */

    Fare.updateUI =
        function (
            result
        ) {

            if (!result) {
                return;
            }


            document
                .querySelectorAll(
                    "[data-fare-total]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Fare.format(
                                result.total
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-fare-payable]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Fare.format(
                                result.payable
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-fare-base]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Fare.format(
                                result.baseFare
                            );
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
                            Fare.format(
                                result.distanceFare
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-fare-booking]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Fare.format(
                                result.bookingFee
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-fare-tax]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Fare.format(
                                result.tax
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-fare-discount]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            "-" +
                            Fare.format(
                                result.discount
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-fare-distance-km]"
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
                    "[data-fare-eta]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            result.durationMinutes +
                            " min";
                    }
                );
        };


    /* ========================================================
       FIREBASE / ADMIN PRICING
       ======================================================== */

    Fare.loadRemotePricing =
        async function () {

            try {

                /*
                 * Prefer existing pricing.js
                 * when available.
                 */

                if (
                    RX.pricing &&
                    typeof RX.pricing
                        .getPricing ===
                    "function"
                ) {

                    const pricing =
                        await RX.pricing
                            .getPricing();


                    if (
                        pricing
                    ) {

                        Fare.setConfig(
                            pricing
                        );


                        return Fare.config;
                    }
                }


                /*
                 * Firebase Realtime Database.
                 */

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    const database =
                        firebase.database();


                    const snapshot =
                        await database
                            .ref(
                                "settings/pricing"
                            )
                            .once(
                                "value"
                            );


                    const pricing =
                        snapshot.val();


                    if (
                        pricing
                    ) {

                        Fare.setConfig(
                            pricing
                        );
                    }


                    return Fare.config;
                }

            } catch (error) {

                console.warn(
                    "Remote pricing unavailable:",
                    error
                );
            }


            return Fare.config;
        };


    /* ========================================================
       PRICING TIME RULES
       ======================================================== */

    Fare.getTimeBasedRate =
        function (
            date,
            options
        ) {

            options =
                options ||
                {};


            const hour =
                Fare.getHour(
                    date
                );


            /*
             * Default RiderX night window:
             * 22:00 → 06:00
             */

            const night =
                Fare.isNight(
                    date,
                    options
                );


            return {

                isNight:
                    night,

                hour:
                    hour,

                multiplier:
                    night
                        ? Fare.getNightMultiplier(
                            date,
                            options
                        )
                        : 1
            };
        };


    /* ========================================================
       ESTIMATE
       ======================================================== */

    Fare.estimate =
        function (
            distanceKm,
            service,
            options
        ) {

            options =
                {
                    ...(options || {}),
                    estimated:
                        true
                };


            return Fare.calculate(
                distanceKm,
                service,
                options
            );
        };


    /* ========================================================
       COMPARE SERVICES
       ======================================================== */

    Fare.compare =
        function (
            distanceKm,
            options
        ) {

            options =
                options ||
                {};


            const services = [
                "bike",
                "cab",
                "parcel",
                "food"
            ];


            const results =
                {};


            services.forEach(
                function (
                    service
                ) {

                    results[
                        service
                    ] =
                        Fare.calculate(
                            distanceKm,
                            service,
                            options
                        );
                }
            );


            return results;
        };


    /* ========================================================
       SURGE CONTROL
       ======================================================== */

    Fare.setSurge =
        function (
            multiplier
        ) {

            const value =
                Math.max(
                    1,
                    Fare.number(
                        multiplier,
                        1
                    )
                );


            Fare.config.surgeMultiplier =
                value;


            return value;
        };


    Fare.clearSurge =
        function () {

            Fare.config.surgeMultiplier =
                1;
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Fare.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-fare-" +
                    name,
                    {
                        detail:
                            data ||
                            {}
                    }
                )
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.calculateFare =
        Fare.calculate;


    RX.calculateBikeFare =
        Fare.calculateBike;


    RX.calculateCabFare =
        Fare.calculateCab;


    RX.calculateParcelFare =
        Fare.calculateParcel;


    RX.calculateFoodFare =
        Fare.calculateFood;


    RX.formatFare =
        Fare.format;


    /* ========================================================
       INIT
       ======================================================== */

    Fare.ready =
        true;


    /*
     * Load remote pricing in background.
     * If Firebase/admin pricing is not available,
     * defaults continue working.
     */

    Fare.loadRemotePricing()
        .catch(
            function () {}
        );


    Fare.emit(
        "ready",
        {
            version:
                "1.0.0"
        }
    );


    console.log(
        "RiderX fare-calculator.js loaded."
    );

})();
