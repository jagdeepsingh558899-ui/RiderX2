/* ============================================================
   RIDERX OFFERS & COUPONS ENGINE
   File: js/offers.js

   Handles:
   - Offers
   - Coupons
   - Discount calculation
   - Coupon validation
   - Expiry
   - Usage limits
   - Service restrictions
   - Firebase RTDB
   - Firestore fallback
   - Booking integration
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Offers =
        RX.offers =
        RX.offers || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Offers.config = {

        offersPath:
            "offers",

        couponsPath:
            "coupons",

        usagePath:
            "couponUsage",

        defaultCurrency:
            "INR",

        maxCouponResults:
            50
    };


    /* ========================================================
       STATE
       ======================================================== */

    Offers.state = {

        initialized:
            false,

        offers:
            [],

        coupons:
            [],

        activeCoupon:
            null,

        activeDiscount:
            0,

        lastValidation:
            null
    };


    /* ========================================================
       FIREBASE HELPERS
       ======================================================== */

    Offers.getDatabase =
        function () {

            try {

                if (
                    RX.firebase?.database
                ) {

                    return RX.firebase.database;
                }


                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {

                console.warn(
                    "RiderX offers RTDB error:",
                    error
                );
            }


            return null;
        };


    Offers.getFirestore =
        function () {

            try {

                if (
                    RX.firebase?.firestore
                ) {

                    return RX.firebase.firestore;
                }


                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {

                console.warn(
                    "RiderX offers Firestore error:",
                    error
                );
            }


            return null;
        };


    Offers.getUser =
        function () {

            try {

                if (
                    RX.auth?.currentUser
                ) {

                    return RX.auth.currentUser;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    return firebase.auth()
                        .currentUser;
                }

            } catch (error) {}


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {}


            return null;
        };


    Offers.getUserId =
        function () {

            const user =
                Offers.getUser();


            return (
                user?.uid ||
                user?.id ||
                user?.userId ||
                localStorage.getItem(
                    "riderx_uid"
                ) ||
                null
            );
        };


    /* ========================================================
       NORMALIZE OFFER
       ======================================================== */

    Offers.normalize =
        function (
            offer,
            id
        ) {

            if (
                !offer
            ) {

                return null;
            }


            const normalized = {

                id:
                    offer.id ||
                    id ||
                    null,

                code:
                    String(
                        offer.code ||
                        offer.couponCode ||
                        ""
                    )
                    .trim()
                    .toUpperCase(),

                title:
                    offer.title ||
                    offer.name ||
                    "RiderX Offer",

                description:
                    offer.description ||
                    "",

                type:
                    String(
                        offer.type ||
                        offer.discountType ||
                        "percentage"
                    )
                    .toLowerCase(),

                value:
                    Number(
                        offer.value ??
                        offer.discount ??
                        offer.amount ??
                        0
                    ),

                minFare:
                    Number(
                        offer.minFare ??
                        offer.minimumFare ??
                        offer.minAmount ??
                        0
                    ),

                maxDiscount:
                    Number(
                        offer.maxDiscount ??
                        offer.maximumDiscount ??
                        0
                    ),

                service:
                    offer.service ||
                    offer.serviceType ||
                    "all",

                services:
                    Array.isArray(
                        offer.services
                    )
                        ? offer.services
                        : null,

                active:
                    offer.active !== false &&
                    offer.enabled !== false,

                startAt:
                    Offers.toTimestamp(
                        offer.startAt ||
                        offer.startDate ||
                        offer.validFrom
                    ),

                expiresAt:
                    Offers.toTimestamp(
                        offer.expiresAt ||
                        offer.expiryDate ||
                        offer.validUntil ||
                        offer.endDate
                    ),

                usageLimit:
                    Number(
                        offer.usageLimit ??
                        offer.maxUsage ??
                        0
                    ),

                perUserLimit:
                    Number(
                        offer.perUserLimit ??
                        offer.userLimit ??
                        0
                    ),

                usedCount:
                    Number(
                        offer.usedCount ||
                        offer.usageCount ||
                        0
                    ),

                newUsersOnly:
                    offer.newUsersOnly === true,

                firstRideOnly:
                    offer.firstRideOnly === true,

                paymentMethods:
                    Array.isArray(
                        offer.paymentMethods
                    )
                        ? offer.paymentMethods
                        : null,

                createdAt:
                    Offers.toTimestamp(
                        offer.createdAt
                    ) ||
                    Date.now()
            };


            return normalized;
        };


    /* ========================================================
       TIMESTAMP
       ======================================================== */

    Offers.toTimestamp =
        function (
            value
        ) {

            if (
                value == null
            ) {

                return null;
            }


            if (
                typeof value ===
                "number"
            ) {

                return value;
            }


            if (
                value instanceof Date
            ) {

                return value.getTime();
            }


            if (
                typeof value?.toMillis ===
                "function"
            ) {

                return value.toMillis();
            }


            if (
                typeof value ===
                "object" &&
                value.seconds != null
            ) {

                return (
                    Number(
                        value.seconds
                    ) * 1000
                );
            }


            const parsed =
                Date.parse(
                    value
                );


            return Number.isFinite(
                parsed
            )
                ? parsed
                : null;
        };


    /* ========================================================
       LOAD OFFERS RTDB
       ======================================================== */

    Offers.loadFromRTDB =
        async function (
            path
        ) {

            const database =
                Offers.getDatabase();


            if (
                !database
            ) {

                return [];
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            path
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val();


                if (
                    !data
                ) {

                    return [];
                }


                return Object.keys(
                    data
                )
                .map(
                    function (
                        id
                    ) {

                        return Offers.normalize(
                            data[id],
                            id
                        );
                    }
                )
                .filter(
                    Boolean
                );

            } catch (error) {

                console.warn(
                    "Offers RTDB load failed:",
                    error
                );


                return [];
            }
        };


    /* ========================================================
       LOAD OFFERS FIRESTORE
       ======================================================== */

    Offers.loadFromFirestore =
        async function (
            collectionName
        ) {

            const firestore =
                Offers.getFirestore();


            if (
                !firestore
            ) {

                return [];
            }


            try {

                const snapshot =
                    await firestore
                        .collection(
                            collectionName
                        )
                        .get();


                return snapshot.docs
                    .map(
                        function (
                            doc
                        ) {

                            return Offers.normalize(
                                doc.data(),
                                doc.id
                            );
                        }
                    )
                    .filter(
                        Boolean
                    );

            } catch (error) {

                console.warn(
                    "Offers Firestore load failed:",
                    error
                );


                return [];
            }
        };


    /* ========================================================
       LOAD ALL OFFERS
       ======================================================== */

    Offers.loadOffers =
        async function () {

            let offers =
                await Offers.loadFromRTDB(
                    Offers.config
                        .offersPath
                );


            if (
                !offers.length
            ) {

                offers =
                    await Offers
                        .loadFromFirestore(
                            Offers.config
                                .offersPath
                        );
            }


            Offers.state.offers =
                offers;


            Offers.emit(
                "offers-loaded",
                {
                    offers:
                        offers
                }
            );


            return offers;
        };


    /* ========================================================
       LOAD ALL COUPONS
       ======================================================== */

    Offers.loadCoupons =
        async function () {

            let coupons =
                await Offers.loadFromRTDB(
                    Offers.config
                        .couponsPath
                );


            if (
                !coupons.length
            ) {

                coupons =
                    await Offers
                        .loadFromFirestore(
                            Offers.config
                                .couponsPath
                        );
            }


            Offers.state.coupons =
                coupons;


            Offers.emit(
                "coupons-loaded",
                {
                    coupons:
                        coupons
                }
            );


            return coupons;
        };


    /* ========================================================
       GET AVAILABLE OFFERS
       ======================================================== */

    Offers.getAvailableOffers =
        function (
            options
        ) {

            options =
                options || {};


            const now =
                Date.now();


            const service =
                String(
                    options.service ||
                    "all"
                )
                .toLowerCase();


            return Offers.state
                .offers
                .filter(
                    function (
                        offer
                    ) {

                        if (
                            !offer.active
                        ) {

                            return false;
                        }


                        if (
                            offer.startAt &&
                            now <
                            offer.startAt
                        ) {

                            return false;
                        }


                        if (
                            offer.expiresAt &&
                            now >
                            offer.expiresAt
                        ) {

                            return false;
                        }


                        if (
                            offer.usageLimit > 0 &&
                            offer.usedCount >=
                            offer.usageLimit
                        ) {

                            return false;
                        }


                        if (
                            service !== "all" &&
                            offer.service !== "all" &&
                            offer.service !== service
                        ) {

                            if (
                                !offer.services ||
                                !offer.services
                                    .includes(
                                        service
                                    )
                            ) {

                                return false;
                            }
                        }


                        return true;
                    }
                )
                .slice(
                    0,
                    Offers.config
                        .maxCouponResults
                );
        };


    /* ========================================================
       FIND COUPON
       ======================================================== */

    Offers.findCoupon =
        function (
            code
        ) {

            code =
                String(
                    code ||
                    ""
                )
                .trim()
                .toUpperCase();


            if (
                !code
            ) {

                return null;
            }


            const all =
                [
                    ...Offers.state.coupons,
                    ...Offers.state.offers
                ];


            return (
                all.find(
                    function (
                        item
                    ) {

                        return (
                            item.code ===
                            code
                        );
                    }
                ) ||
                null
            );
        };


    /* ========================================================
       SERVICE CHECK
       ======================================================== */

    Offers.isServiceAllowed =
        function (
            coupon,
            service
        ) {

            service =
                String(
                    service ||
                    "all"
                )
                .toLowerCase();


            if (
                !coupon
            ) {

                return false;
            }


            if (
                coupon.service ===
                "all"
            ) {

                return true;
            }


            if (
                coupon.service ===
                service
            ) {

                return true;
            }


            if (
                Array.isArray(
                    coupon.services
                ) &&
                coupon.services
                    .includes(
                        service
                    )
            ) {

                return true;
            }


            return false;
        };


    /* ========================================================
       VALIDATE COUPON
       ======================================================== */

    Offers.validateCoupon =
        async function (
            code,
            options
        ) {

            options =
                options || {};


            const coupon =
                Offers.findCoupon(
                    code
                );


            const fare =
                Number(
                    options.fare ||
                    options.amount ||
                    0
                );


            const service =
                options.service ||
                options.serviceType ||
                "all";


            const paymentMethod =
                String(
                    options.paymentMethod ||
                    ""
                )
                .toLowerCase();


            const userId =
                options.userId ||
                Offers.getUserId();


            const now =
                Date.now();


            /*
             * Coupon not found.
             */

            if (
                !coupon
            ) {

                return Offers.invalid(
                    "Invalid coupon code."
                );
            }


            /*
             * Disabled.
             */

            if (
                !coupon.active
            ) {

                return Offers.invalid(
                    "This coupon is currently unavailable."
                );
            }


            /*
             * Start date.
             */

            if (
                coupon.startAt &&
                now <
                coupon.startAt
            ) {

                return Offers.invalid(
                    "This coupon is not active yet."
                );
            }


            /*
             * Expiry.
             */

            if (
                coupon.expiresAt &&
                now >
                coupon.expiresAt
            ) {

                return Offers.invalid(
                    "This coupon has expired."
                );
            }


            /*
             * Global usage.
             */

            if (
                coupon.usageLimit > 0 &&
                coupon.usedCount >=
                coupon.usageLimit
            ) {

                return Offers.invalid(
                    "This coupon usage limit has been reached."
                );
            }


            /*
             * Minimum fare.
             */

            if (
                fare <
                coupon.minFare
            ) {

                return Offers.invalid(
                    "Minimum fare for this coupon is ₹" +
                    coupon.minFare
                );
            }


            /*
             * Service.
             */

            if (
                !Offers.isServiceAllowed(
                    coupon,
                    service
                )
            ) {

                return Offers.invalid(
                    "This coupon is not available for this service."
                );
            }


            /*
             * Payment method.
             */

            if (
                Array.isArray(
                    coupon.paymentMethods
                ) &&
                coupon.paymentMethods.length
            ) {

                if (
                    !coupon.paymentMethods
                        .map(
                            function (
                                item
                            ) {

                                return String(
                                    item
                                )
                                .toLowerCase();
                            }
                        )
                        .includes(
                            paymentMethod
                        )
                ) {

                    return Offers.invalid(
                        "This coupon is not valid for the selected payment method."
                    );
                }
            }


            /*
             * Save validation.
             */

            const result = {

                valid:
                    true,

                coupon:
                    coupon,

                code:
                    coupon.code,

                message:
                    "Coupon applied successfully.",

                fare:
                    fare,

                discount:
                    0,

                finalFare:
                    fare,

                currency:
                    Offers.config
                        .defaultCurrency,

                userId:
                    userId
            };


            /*
             * Calculate discount.
             */

            result.discount =
                Offers.calculateDiscount(
                    coupon,
                    fare
                );


            result.finalFare =
                Math.max(
                    0,
                    fare -
                    result.discount
                );


            Offers.state
                .lastValidation =
                result;


            Offers.state
                .activeCoupon =
                coupon;


            Offers.state
                .activeDiscount =
                result.discount;


            Offers.emit(
                "coupon-applied",
                result
            );


            return result;
        };


    /* ========================================================
       INVALID RESULT
       ======================================================== */

    Offers.invalid =
        function (
            message
        ) {

            const result = {

                valid:
                    false,

                coupon:
                    null,

                code:
                    null,

                message:
                    message,

                fare:
                    0,

                discount:
                    0,

                finalFare:
                    0
            };


            Offers.state
                .lastValidation =
                result;


            Offers.state
                .activeCoupon =
                null;


            Offers.state
                .activeDiscount =
                0;


            Offers.emit(
                "coupon-invalid",
                result
            );


            return result;
        };


    /* ========================================================
       CALCULATE DISCOUNT
       ======================================================== */

    Offers.calculateDiscount =
        function (
            coupon,
            fare
        ) {

            fare =
                Math.max(
                    0,
                    Number(
                        fare ||
                        0
                    )
                );


            if (
                !coupon ||
                fare <= 0
            ) {

                return 0;
            }


            let discount =
                0;


            const type =
                String(
                    coupon.type ||
                    "percentage"
                )
                .toLowerCase();


            /*
             * Percentage.
             */

            if (
                type ===
                    "percentage" ||
                type ===
                    "percent" ||
                type ===
                    "%"
            ) {

                discount =
                    fare *
                    Number(
                        coupon.value ||
                        0
                    ) /
                    100;
            }


            /*
             * Fixed amount.
             */

            else if (
                type ===
                    "fixed" ||
                type ===
                    "flat" ||
                type ===
                    "amount"
            ) {

                discount =
                    Number(
                        coupon.value ||
                        0
                    );
            }


            /*
             * Never discount more than fare.
             */

            discount =
                Math.min(
                    discount,
                    fare
                );


            /*
             * Maximum discount.
             */

            if (
                coupon.maxDiscount > 0
            ) {

                discount =
                    Math.min(
                        discount,
                        coupon.maxDiscount
                    );
            }


            /*
             * Round to 2 decimals.
             */

            return Math.round(
                discount *
                100
            ) / 100;
        };


    /* ========================================================
       APPLY COUPON
       ======================================================== */

    Offers.applyCoupon =
        async function (
            code,
            fare,
            options
        ) {

            options =
                {
                    ...(options || {}),
                    fare:
                        fare
                };


            const result =
                await Offers
                    .validateCoupon(
                        code,
                        options
                    );


            if (
                result.valid
            ) {

                Offers.saveLocalCoupon(
                    result
                );
            }


            return result;
        };


    /* ========================================================
       REMOVE COUPON
       ======================================================== */

    Offers.removeCoupon =
        function () {

            Offers.state
                .activeCoupon =
                null;


            Offers.state
                .activeDiscount =
                0;


            Offers.state
                .lastValidation =
                null;


            try {

                localStorage.removeItem(
                    "riderx_coupon"
                );

            } catch (error) {}


            Offers.emit(
                "coupon-removed"
            );


            return true;
        };


    /* ========================================================
       SAVE LOCAL COUPON
       ======================================================== */

    Offers.saveLocalCoupon =
        function (
            result
        ) {

            try {

                localStorage.setItem(
                    "riderx_coupon",
                    JSON.stringify({

                        code:
                            result.code,

                        discount:
                            result.discount,

                        finalFare:
                            result.finalFare,

                        appliedAt:
                            Date.now()
                    })
                );

            } catch (error) {}
        };


    /* ========================================================
       GET ACTIVE COUPON
       ======================================================== */

    Offers.getActiveCoupon =
        function () {

            return (
                Offers.state
                    .activeCoupon ||
                null
            );
        };


    /* ========================================================
       GET DISCOUNT
       ======================================================== */

    Offers.getDiscount =
        function () {

            return Number(
                Offers.state
                    .activeDiscount ||
                0
            );
        };


    /* ========================================================
       GET FINAL FARE
       ======================================================== */

    Offers.getFinalFare =
        function (
            fare
        ) {

            fare =
                Number(
                    fare ||
                    0
                );


            return Math.max(
                0,
                fare -
                Offers.getDiscount()
            );
        };


    /* ========================================================
       RECORD COUPON USAGE
       ======================================================== */

    Offers.recordUsage =
        async function (
            code,
            rideId,
            discount
        ) {

            const userId =
                Offers.getUserId();


            if (
                !code ||
                !userId
            ) {

                return false;
            }


            const usage = {

                userId:
                    userId,

                code:
                    String(
                        code
                    )
                    .toUpperCase(),

                rideId:
                    rideId ||
                    null,

                discount:
                    Number(
                        discount ||
                        0
                    ),

                createdAt:
                    Date.now()
            };


            const usageId =
                (
                    String(
                        userId
                    ) +
                    "_" +
                    String(
                        rideId ||
                        Date.now()
                    )
                )
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_"
                );


            const database =
                Offers.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Offers.config
                                .usagePath +
                            "/" +
                            usageId
                        )
                        .set(
                            usage
                        );


                    Offers.emit(
                        "usage-recorded",
                        usage
                    );


                    return true;

                } catch (error) {

                    console.warn(
                        "Coupon usage RTDB failed:",
                        error
                    );
                }
            }


            const firestore =
                Offers.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Offers.config
                                .usagePath
                        )
                        .doc(
                            usageId
                        )
                        .set(
                            usage
                        );


                    Offers.emit(
                        "usage-recorded",
                        usage
                    );


                    return true;

                } catch (error) {}
            }


            return false;
        };


    /* ========================================================
       RENDER OFFERS
       ======================================================== */

    Offers.render =
        function (
            container,
            options
        ) {

            if (
                typeof container ===
                "string"
            ) {

                container =
                    document.querySelector(
                        container
                    );
            }


            if (
                !container
            ) {

                return;
            }


            options =
                options || {};


            const offers =
                Offers.getAvailableOffers(
                    options
                );


            container.innerHTML =
                "";


            if (
                !offers.length
            ) {

                container.innerHTML =

                    '<div class="rx-empty-offers">' +
                        '<div class="rx-empty-icon">🎁</div>' +
                        '<strong>No offers available</strong>' +
                        '<span>Check again later for new RiderX offers.</span>' +
                    '</div>';

                return;
            }


            offers.forEach(
                function (
                    offer
                ) {

                    const card =
                        document.createElement(
                            "div"
                        );


                    card.className =
                        "rx-offer-card";


                    const discountText =
                        offer.type ===
                        "percentage"

                            ? offer.value +
                              "% OFF"

                            : "₹" +
                              offer.value +
                              " OFF";


                    card.innerHTML =

                        '<div class="rx-offer-top">' +
                            '<span class="rx-offer-badge">' +
                                escapeHTML(
                                    discountText
                                ) +
                            '</span>' +
                            '<span class="rx-offer-code">' +
                                escapeHTML(
                                    offer.code
                                ) +
                            '</span>' +
                        '</div>' +

                        '<div class="rx-offer-title">' +
                            escapeHTML(
                                offer.title
                            ) +
                        '</div>' +

                        '<div class="rx-offer-description">' +
                            escapeHTML(
                                offer.description
                            ) +
                        '</div>' +

                        '<button type="button" class="rx-offer-apply">' +
                            'Apply' +
                        '</button>';


                    const button =
                        card.querySelector(
                            ".rx-offer-apply"
                        );


                    button.addEventListener(
                        "click",
                        function () {

                            Offers.emit(
                                "offer-selected",
                                {
                                    offer:
                                        offer
                                }
                            );


                            const input =
                                document.querySelector(
                                    "[data-coupon-input], #couponInput, #couponCode"
                                );


                            if (
                                input
                            ) {

                                input.value =
                                    offer.code;

                                input.focus();
                            }
                        }
                    );


                    container.appendChild(
                        card
                    );
                }
            );
        };


    /* ========================================================
       SIMPLE HTML ESCAPE
       ======================================================== */

    function escapeHTML(
        value
    ) {

        return String(
            value ??
            ""
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
    }


    /* ========================================================
       EVENTS
       ======================================================== */

    Offers.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-offers-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Offers.on =
        function (
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
                "riderx-offers-" +
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
       BOOKING INTEGRATION
       ======================================================== */

    Offers.getBookingPrice =
        function (
            fare
        ) {

            fare =
                Number(
                    fare ||
                    0
                );


            const discount =
                Offers.getDiscount();


            return {

                originalFare:
                    fare,

                discount:
                    discount,

                finalFare:
                    Math.max(
                        0,
                        fare -
                        discount
                    ),

                coupon:
                    Offers.getActiveCoupon()
                        ?.code ||
                    null
            };
        };


    /* ========================================================
       INIT
       ======================================================== */

    Offers.init =
        async function () {

            if (
                Offers.state
                    .initialized
            ) {

                return;
            }


            Offers.state
                .initialized =
                true;


            await Promise.allSettled(
                [
                    Offers.loadOffers(),
                    Offers.loadCoupons()
                ]
            );


            Offers.emit(
                "ready",
                {
                    offers:
                        Offers.state
                            .offers,

                    coupons:
                        Offers.state
                            .coupons
                }
            );


            console.log(
                "RiderX offers.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.applyCoupon =
        Offers.applyCoupon;

    RX.removeCoupon =
        Offers.removeCoupon;

    RX.validateCoupon =
        Offers.validateCoupon;

    RX.calculateDiscount =
        Offers.calculateDiscount;

    RX.getActiveCoupon =
        Offers.getActiveCoupon;

    RX.getFinalFare =
        Offers.getFinalFare;

    RX.loadOffers =
        Offers.loadOffers;


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Offers.init
        );

    } else {

        Offers.init();
    }


})();
