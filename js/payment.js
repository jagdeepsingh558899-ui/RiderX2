/* ============================================================
   RIDERX PAYMENT ENGINE
   File: js/payment.js

   Handles:
   - Cash payment
   - Online payment architecture
   - Wallet payment
   - Payment state
   - Firebase payment records
   - Ride/payment linking
   - Coupon/discount integration
   - Payment status
   - Refund-ready structure
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Payment =
        RX.payment =
        RX.payment || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Payment.config = {

        currency:
            "INR",

        currencySymbol:
            "₹",

        defaultMethod:
            "cash",

        paymentsPath:
            "payments",

        transactionsPath:
            "transactions",

        walletPath:
            "wallets",

        ridesPath:
            "rides",

        paymentTimeout:
            120000,

        onlineMethods: [
            "upi",
            "card",
            "netbanking",
            "wallet"
        ],

        methods: [
            "cash",
            "upi",
            "card",
            "netbanking",
            "wallet"
        ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    Payment.state = {

        initialized:
            false,

        method:
            Payment.config.defaultMethod,

        amount:
            0,

        originalAmount:
            0,

        discount:
            0,

        finalAmount:
            0,

        rideId:
            null,

        bookingId:
            null,

        paymentId:
            null,

        status:
            "idle",

        currency:
            Payment.config.currency,

        processing:
            false
    };


    /* ========================================================
       FIREBASE HELPERS
       ======================================================== */

    Payment.getDatabase =
        function () {

            try {

                if (
                    RX.firebase?.database
                ) {

                    return RX.firebase.database;
                }

            } catch (error) {}


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
                    "RiderX payment database error:",
                    error
                );
            }


            return null;
        };


    Payment.getFirestore =
        function () {

            try {

                if (
                    RX.firebase?.firestore
                ) {

                    return RX.firebase.firestore;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {}


            return null;
        };


    Payment.getAuth =
        function () {

            try {

                if (
                    RX.firebase?.auth
                ) {

                    return RX.firebase.auth;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth();
                }

            } catch (error) {}


            return null;
        };


    Payment.getUser =
        function () {

            const auth =
                Payment.getAuth();


            try {

                if (
                    auth?.currentUser
                ) {

                    return auth.currentUser;
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


    Payment.getUserId =
        function () {

            const user =
                Payment.getUser();


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
       FORMAT MONEY
       ======================================================== */

    Payment.format =
        function (
            amount
        ) {

            amount =
                Number(
                    amount ||
                    0
                );


            return (
                Payment.config
                    .currencySymbol +
                amount.toFixed(
                    2
                )
            );
        };


    /* ========================================================
       NORMALIZE AMOUNT
       ======================================================== */

    Payment.normalizeAmount =
        function (
            amount
        ) {

            amount =
                Number(
                    amount
                );


            if (
                !Number.isFinite(
                    amount
                )
            ) {

                return 0;
            }


            return Math.max(
                0,
                Math.round(
                    amount *
                    100
                ) / 100
            );
        };


    /* ========================================================
       PAYMENT METHODS
       ======================================================== */

    Payment.getMethods =
        function () {

            return [
                {
                    id:
                        "cash",

                    name:
                        "Cash",

                    icon:
                        "💵",

                    online:
                        false,

                    enabled:
                        true
                },

                {
                    id:
                        "upi",

                    name:
                        "UPI",

                    icon:
                        "📱",

                    online:
                        true,

                    enabled:
                        true
                },

                {
                    id:
                        "card",

                    name:
                        "Card",

                    icon:
                        "💳",

                    online:
                        true,

                    enabled:
                        true
                },

                {
                    id:
                        "netbanking",

                    name:
                        "Net Banking",

                    icon:
                        "🏦",

                    online:
                        true,

                    enabled:
                        true
                },

                {
                    id:
                        "wallet",

                    name:
                        "RiderX Wallet",

                    icon:
                        "👛",

                    online:
                        true,

                    enabled:
                        true
                }
            ];
        };


    Payment.isValidMethod =
        function (
            method
        ) {

            return Payment.config
                .methods
                .includes(
                    String(
                        method ||
                        ""
                    )
                    .toLowerCase()
                );
        };


    /* ========================================================
       SET METHOD
       ======================================================== */

    Payment.setMethod =
        function (
            method
        ) {

            method =
                String(
                    method ||
                    ""
                )
                .toLowerCase()
                .trim();


            if (
                !Payment.isValidMethod(
                    method
                )
            ) {

                return false;
            }


            Payment.state.method =
                method;


            Payment.updateMethodUI();

            Payment.emit(
                "method-changed",
                {
                    method:
                        method
                }
            );


            return true;
        };


    Payment.getMethod =
        function () {

            return Payment.state
                .method;
        };


    /* ========================================================
       CALCULATE PAYMENT
       ======================================================== */

    Payment.calculate =
        function (
            originalAmount,
            discount
        ) {

            originalAmount =
                Payment.normalizeAmount(
                    originalAmount
                );


            discount =
                Payment.normalizeAmount(
                    discount
                );


            discount =
                Math.min(
                    discount,
                    originalAmount
                );


            const finalAmount =
                Payment.normalizeAmount(
                    originalAmount -
                    discount
                );


            Payment.state
                .originalAmount =
                originalAmount;


            Payment.state
                .amount =
                originalAmount;


            Payment.state
                .discount =
                discount;


            Payment.state
                .finalAmount =
                finalAmount;


            Payment.updateSummaryUI();


            Payment.emit(
                "amount-calculated",
                {
                    originalAmount:
                        originalAmount,

                    discount:
                        discount,

                    finalAmount:
                        finalAmount
                }
            );


            return {

                originalAmount:
                    originalAmount,

                discount:
                    discount,

                finalAmount:
                    finalAmount,

                currency:
                    Payment.config
                        .currency
            };
        };


    /* ========================================================
       CALCULATE WITH RIDERX COUPON
       ======================================================== */

    Payment.calculateWithCoupon =
        async function (
            amount,
            couponCode,
            options
        ) {

            amount =
                Payment.normalizeAmount(
                    amount
                );


            let discount =
                0;


            let coupon =
                null;


            if (
                couponCode &&
                RX.offers?.validateCoupon
            ) {

                const result =
                    await RX.offers
                        .validateCoupon(
                            couponCode,
                            {
                                ...(options || {}),
                                fare:
                                    amount
                            }
                        );


                if (
                    result.valid
                ) {

                    discount =
                        result.discount;

                    coupon =
                        result.coupon;
                }
            }


            const result =
                Payment.calculate(
                    amount,
                    discount
                );


            return {

                ...result,

                coupon:
                    coupon
                        ?.code ||
                    null
            };
        };


    /* ========================================================
       CREATE PAYMENT ID
       ======================================================== */

    Payment.generateId =
        function () {

            return (
                "RXPAY_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(
                        36
                    )
                    .slice(
                        2,
                        10
                    )
                    .toUpperCase()
            );
        };


    /* ========================================================
       CREATE PAYMENT OBJECT
       ======================================================== */

    Payment.createPayment =
        function (
            options
        ) {

            options =
                options || {};


            const user =
                Payment.getUser();


            const amount =
                Payment.normalizeAmount(
                    options.amount ??
                    Payment.state.finalAmount
                );


            const paymentId =
                options.paymentId ||
                Payment.generateId();


            const payment = {

                paymentId:
                    paymentId,

                userId:
                    options.userId ||
                    Payment.getUserId(),

                rideId:
                    options.rideId ||
                    Payment.state.rideId ||
                    null,

                bookingId:
                    options.bookingId ||
                    Payment.state.bookingId ||
                    null,

                riderId:
                    options.riderId ||
                    null,

                amount:
                    amount,

                originalAmount:
                    Payment.normalizeAmount(
                        options.originalAmount ??
                        Payment.state.originalAmount
                    ),

                discount:
                    Payment.normalizeAmount(
                        options.discount ??
                        Payment.state.discount
                    ),

                currency:
                    options.currency ||
                    Payment.config.currency,

                method:
                    options.method ||
                    Payment.state.method,

                status:
                    options.status ||
                    "pending",

                coupon:
                    options.coupon ||
                    null,

                userPhone:
                    user?.phoneNumber ||
                    user?.phone ||
                    "",

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now(),

                gateway:
                    null,

                gatewayPaymentId:
                    null,

                gatewayOrderId:
                    null,

                failureReason:
                    null,

                refundStatus:
                    "none"
            };


            Payment.state.paymentId =
                paymentId;


            return payment;
        };


    /* ========================================================
       SAVE PAYMENT - RTDB
       ======================================================== */

    Payment.saveRTDB =
        async function (
            payment
        ) {

            const database =
                Payment.getDatabase();


            if (
                !database
            ) {

                return false;
            }


            try {

                await database
                    .ref(
                        Payment.config
                            .paymentsPath +
                        "/" +
                        payment.paymentId
                    )
                    .set(
                        payment
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Payment RTDB save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       SAVE PAYMENT - FIRESTORE
       ======================================================== */

    Payment.saveFirestore =
        async function (
            payment
        ) {

            const firestore =
                Payment.getFirestore();


            if (
                !firestore
            ) {

                return false;
            }


            try {

                await firestore
                    .collection(
                        Payment.config
                            .paymentsPath
                    )
                    .doc(
                        payment.paymentId
                    )
                    .set(
                        payment
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Payment Firestore save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       SAVE PAYMENT
       ======================================================== */

    Payment.save =
        async function (
            payment
        ) {

            const rtdbSaved =
                await Payment
                    .saveRTDB(
                        payment
                    );


            if (
                rtdbSaved
            ) {

                return true;
            }


            return await Payment
                .saveFirestore(
                    payment
                );
        };


    /* ========================================================
       UPDATE PAYMENT STATUS
       ======================================================== */

    Payment.updateStatus =
        async function (
            paymentId,
            status,
            extra
        ) {

            if (
                !paymentId
            ) {

                return false;
            }


            const data = {

                status:
                    status,

                updatedAt:
                    Date.now(),

                ...(extra || {})
            };


            let updated =
                false;


            const database =
                Payment.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Payment.config
                                .paymentsPath +
                            "/" +
                            paymentId
                        )
                        .update(
                            data
                        );


                    updated =
                        true;

                } catch (error) {

                    console.warn(
                        "Payment status RTDB update failed:",
                        error
                    );
                }
            }


            if (
                updated
            ) {

                return true;
            }


            const firestore =
                Payment.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Payment.config
                                .paymentsPath
                        )
                        .doc(
                            paymentId
                        )
                        .update(
                            data
                        );


                    updated =
                        true;

                } catch (error) {}
            }


            if (
                updated
            ) {

                Payment.state.status =
                    status;


                Payment.emit(
                    "status-changed",
                    {
                        paymentId:
                            paymentId,

                        status:
                            status
                    }
                );
            }


            return updated;
        };


    /* ========================================================
       CASH PAYMENT
       ======================================================== */

    Payment.payCash =
        async function (
            options
        ) {

            options =
                options || {};


            Payment.setMethod(
                "cash"
            );


            const payment =
                Payment.createPayment(
                    {
                        ...options,

                        method:
                            "cash",

                        status:
                            "pending"
                    }
                );


            const saved =
                await Payment.save(
                    payment
                );


            if (
                !saved
            ) {

                throw new Error(
                    "Unable to create cash payment."
                );
            }


            Payment.state.status =
                "pending";


            Payment.emit(
                "cash-created",
                {
                    payment:
                        payment
                }
            );


            return payment;
        };


    /* ========================================================
       MARK CASH COLLECTED
       ======================================================== */

    Payment.markCashCollected =
        async function (
            paymentId,
            options
        ) {

            options =
                options || {};


            if (
                !paymentId
            ) {

                return false;
            }


            const success =
                await Payment
                    .updateStatus(
                        paymentId,
                        "paid",
                        {
                            paidAt:
                                Date.now(),

                            collectedBy:
                                options.collectedBy ||
                                "rider",

                            collectionMethod:
                                "cash"
                        }
                    );


            if (
                success
            ) {

                Payment.emit(
                    "cash-collected",
                    {
                        paymentId:
                            paymentId
                    }
                );
            }


            return success;
        };


    /* ========================================================
       ONLINE PAYMENT
       ======================================================== */

    Payment.payOnline =
        async function (
            options
        ) {

            options =
                options || {};


            const method =
                String(
                    options.method ||
                    Payment.state.method ||
                    "upi"
                )
                .toLowerCase();


            if (
                !Payment.config
                    .onlineMethods
                    .includes(
                        method
                    )
            ) {

                throw new Error(
                    "Invalid online payment method."
                );
            }


            Payment.setMethod(
                method
            );


            const payment =
                Payment.createPayment(
                    {
                        ...options,

                        method:
                            method,

                        status:
                            "pending"
                    }
                );


            /*
             * Save payment before
             * gateway processing.
             */

            const saved =
                await Payment.save(
                    payment
                );


            if (
                !saved
            ) {

                throw new Error(
                    "Unable to create payment."
                );
            }


            Payment.state.status =
                "processing";


            Payment.state.processing =
                true;


            Payment.emit(
                "online-started",
                {
                    payment:
                        payment
                }
            );


            /*
             * If a real payment gateway
             * is configured, use it.
             */

            if (
                typeof Payment.gatewayPay ===
                "function"
            ) {

                try {

                    const result =
                        await Payment.gatewayPay(
                            payment
                        );


                    return result;

                } catch (error) {

                    await Payment
                        .updateStatus(
                            payment.paymentId,
                            "failed",
                            {
                                failureReason:
                                    error?.message ||
                                    "Payment failed."
                            }
                        );


                    throw error;

                } finally {

                    Payment.state
                        .processing =
                        false;
                }
            }


            /*
             * No gateway configured.
             *
             * Keep payment pending instead
             * of falsely marking it paid.
             */

            Payment.state.processing =
                false;


            Payment.showMessage(
                "Online payment gateway is not connected yet.",
                "warning"
            );


            Payment.emit(
                "gateway-required",
                {
                    payment:
                        payment
                }
            );


            return {

                success:
                    false,

                pending:
                    true,

                payment:
                    payment,

                message:
                    "Payment gateway configuration required."
            };
        };


    /* ========================================================
       WALLET BALANCE
       ======================================================== */

    Payment.getWalletBalance =
        async function (
            userId
        ) {

            userId =
                userId ||
                Payment.getUserId();


            if (
                !userId
            ) {

                return 0;
            }


            const database =
                Payment.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Payment.config
                                    .walletPath +
                                "/" +
                                userId
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val() ||
                        {};


                    return Number(
                        data.balance ||
                        0
                    );

                } catch (error) {}
            }


            const firestore =
                Payment.getFirestore();


            if (
                firestore
            ) {

                try {

                    const doc =
                        await firestore
                            .collection(
                                "wallets"
                            )
                            .doc(
                                userId
                            )
                            .get();


                    if (
                        doc.exists
                    ) {

                        return Number(
                            doc.data()
                                .balance ||
                            0
                        );
                    }

                } catch (error) {}
            }


            return 0;
        };


    /* ========================================================
       WALLET PAYMENT
       ======================================================== */

    Payment.payWallet =
        async function (
            options
        ) {

            options =
                options || {};


            const userId =
                options.userId ||
                Payment.getUserId();


            const amount =
                Payment.normalizeAmount(
                    options.amount ??
                    Payment.state.finalAmount
                );


            const balance =
                await Payment
                    .getWalletBalance(
                        userId
                    );


            if (
                balance <
                amount
            ) {

                throw new Error(
                    "Insufficient RiderX Wallet balance."
                );
            }


            Payment.setMethod(
                "wallet"
            );


            const payment =
                Payment.createPayment(
                    {
                        ...options,

                        method:
                            "wallet",

                        status:
                            "paid"
                    }
                );


            payment.paidAt =
                Date.now();


            payment.walletBalanceBefore =
                balance;


            payment.walletBalanceAfter =
                Payment.normalizeAmount(
                    balance -
                    amount
                );


            const saved =
                await Payment.save(
                    payment
                );


            if (
                !saved
            ) {

                throw new Error(
                    "Unable to create wallet payment."
                );
            }


            const walletUpdated =
                await Payment
                    .deductWallet(
                        userId,
                        amount,
                        payment
                    );


            if (
                !walletUpdated
            ) {

                await Payment
                    .updateStatus(
                        payment.paymentId,
                        "failed",
                        {
                            failureReason:
                                "Wallet deduction failed."
                        }
                    );


                throw new Error(
                    "Wallet payment could not be completed."
                );
            }


            Payment.state.status =
                "paid";


            Payment.emit(
                "wallet-paid",
                {
                    payment:
                        payment
                }
            );


            return payment;
        };


    /* ========================================================
       DEDUCT WALLET
       ======================================================== */

    Payment.deductWallet =
        async function (
            userId,
            amount,
            payment
        ) {

            const database =
                Payment.getDatabase();


            if (
                database
            ) {

                try {

                    const ref =
                        database.ref(
                            Payment.config
                                .walletPath +
                            "/" +
                            userId
                        );


                    const result =
                        await ref
                            .transaction(
                                function (
                                    wallet
                                ) {

                                    wallet =
                                        wallet ||
                                        {
                                            balance:
                                                0
                                        };


                                    const balance =
                                        Number(
                                            wallet.balance ||
                                            0
                                        );


                                    if (
                                        balance <
                                        amount
                                    ) {

                                        return;
                                    }


                                    wallet.balance =
                                        Payment
                                            .normalizeAmount(
                                                balance -
                                                amount
                                            );


                                    wallet.updatedAt =
                                        Date.now();


                                    return wallet;
                                }
                            );


                    return result.committed;

                } catch (error) {

                    console.warn(
                        "Wallet deduction failed:",
                        error
                    );


                    return false;
                }
            }


            return false;
        };


    /* ========================================================
       REFUND
       ======================================================== */

    Payment.refund =
        async function (
            paymentId,
            amount,
            reason
        ) {

            amount =
                Payment.normalizeAmount(
                    amount
                );


            if (
                !paymentId
            ) {

                return false;
            }


            /*
             * Real gateway refund should
             * be connected here.
             */

            const result =
                await Payment
                    .updateStatus(
                        paymentId,
                        "refund_pending",
                        {
                            refundAmount:
                                amount,

                            refundReason:
                                reason ||
                                "Customer refund request.",

                            refundRequestedAt:
                                Date.now()
                        }
                    );


            if (
                result
            ) {

                Payment.emit(
                    "refund-requested",
                    {
                        paymentId:
                            paymentId,

                        amount:
                            amount
                    }
                );
            }


            return result;
        };


    /* ========================================================
       GET PAYMENT
       ======================================================== */

    Payment.get =
        async function (
            paymentId
        ) {

            if (
                !paymentId
            ) {

                return null;
            }


            const database =
                Payment.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Payment.config
                                    .paymentsPath +
                                "/" +
                                paymentId
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val();


                    if (
                        data
                    ) {

                        return data;
                    }

                } catch (error) {}
            }


            const firestore =
                Payment.getFirestore();


            if (
                firestore
            ) {

                try {

                    const doc =
                        await firestore
                            .collection(
                                Payment.config
                                    .paymentsPath
                            )
                            .doc(
                                paymentId
                            )
                            .get();


                    if (
                        doc.exists
                    ) {

                        return doc.data();
                    }

                } catch (error) {}
            }


            return null;
        };


    /* ========================================================
       LINK PAYMENT TO RIDE
       ======================================================== */

    Payment.linkToRide =
        async function (
            paymentId,
            rideId
        ) {

            if (
                !paymentId ||
                !rideId
            ) {

                return false;
            }


            const data = {

                rideId:
                    rideId,

                updatedAt:
                    Date.now()
            };


            const database =
                Payment.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Payment.config
                                .paymentsPath +
                            "/" +
                            paymentId
                        )
                        .update(
                            data
                        );


                    Payment.state.rideId =
                        rideId;


                    return true;

                } catch (error) {}
            }


            const firestore =
                Payment.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Payment.config
                                .paymentsPath
                        )
                        .doc(
                            paymentId
                        )
                        .update(
                            data
                        );


                    Payment.state.rideId =
                        rideId;


                    return true;

                } catch (error) {}
            }


            return false;
        };


    /* ========================================================
       UI HELPERS
       ======================================================== */

    Payment.updateMethodUI =
        function () {

            const method =
                Payment.state.method;


            document
                .querySelectorAll(
                    "[data-payment-method]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const active =
                            element
                                .dataset
                                .paymentMethod ===
                            method;


                        element.classList.toggle(
                            "active",
                            active
                        );


                        element.setAttribute(
                            "aria-selected",
                            active
                                ? "true"
                                : "false"
                        );
                    }
                );


            document
                .querySelectorAll(
                    "input[name='paymentMethod']"
                )
                .forEach(
                    function (
                        input
                    ) {

                        input.checked =
                            input.value
                                .toLowerCase() ===
                            method;
                    }
                );
        };


    Payment.updateSummaryUI =
        function () {

            const original =
                Payment.state
                    .originalAmount;


            const discount =
                Payment.state
                    .discount;


            const final =
                Payment.state
                    .finalAmount;


            Payment.setText(
                [
                    "[data-payment-original]",
                    "#originalFare",
                    "#paymentOriginal"
                ],
                Payment.format(
                    original
                )
            );


            Payment.setText(
                [
                    "[data-payment-discount]",
                    "#discountAmount",
                    "#paymentDiscount"
                ],
                discount > 0
                    ? "-" +
                      Payment.format(
                          discount
                      )
                    : Payment.format(
                          0
                      )
            );


            Payment.setText(
                [
                    "[data-payment-total]",
                    "#finalFare",
                    "#paymentTotal",
                    "#paymentAmount"
                ],
                Payment.format(
                    final
                )
            );
        };


    Payment.setText =
        function (
            selectors,
            value
        ) {

            selectors.forEach(
                function (
                    selector
                ) {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.textContent =
                                    value;
                            }
                        );
                }
            );
        };


    Payment.showMessage =
        function (
            message,
            type
        ) {

            type =
                type ||
                "info";


            const elements =
                document.querySelectorAll(
                    "[data-payment-message], #paymentMessage, .payment-message"
                );


            if (
                !elements.length
            ) {

                console.log(
                    "RiderX Payment:",
                    message
                );


                return;
            }


            elements.forEach(
                function (
                    element
                ) {

                    element.textContent =
                        message;


                    element.classList.remove(
                        "success",
                        "error",
                        "warning",
                        "info"
                    );


                    element.classList.add(
                        type
                    );
                }
            );
        };


    /* ========================================================
       PAYMENT BUTTON HANDLER
       ======================================================== */

    Payment.process =
        async function (
            options
        ) {

            options =
                options || {};


            const method =
                String(
                    options.method ||
                    Payment.state.method ||
                    "cash"
                )
                .toLowerCase();


            const amount =
                Payment.normalizeAmount(
                    options.amount ??
                    Payment.state.finalAmount
                );


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Payment amount must be greater than zero."
                );
            }


            if (
                method ===
                "cash"
            ) {

                return Payment.payCash(
                    {
                        ...options,
                        amount:
                            amount
                    }
                );
            }


            if (
                method ===
                "wallet"
            ) {

                return Payment.payWallet(
                    {
                        ...options,
                        amount:
                            amount
                    }
                );
            }


            return Payment.payOnline(
                {
                    ...options,

                    amount:
                        amount,

                    method:
                        method
                }
            );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Payment.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-payment-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Payment.on =
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
                "riderx-payment-" +
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
       BIND UI
       ======================================================== */

    Payment.bindEvents =
        function () {

            document
                .querySelectorAll(
                    "[data-payment-method]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.addEventListener(
                            "click",
                            function () {

                                Payment.setMethod(
                                    element
                                        .dataset
                                        .paymentMethod
                                );
                            }
                        );
                    }
                );


            document
                .querySelectorAll(
                    "input[name='paymentMethod']"
                )
                .forEach(
                    function (
                        input
                    ) {

                        input.addEventListener(
                            "change",
                            function () {

                                if (
                                    input.checked
                                ) {

                                    Payment.setMethod(
                                        input.value
                                    );
                                }
                            }
                        );
                    }
                );


            Payment.updateMethodUI();

            Payment.updateSummaryUI();
        };


    /* ========================================================
       INIT
       ======================================================== */

    Payment.init =
        function () {

            if (
                Payment.state
                    .initialized
            ) {

                return;
            }


            Payment.state
                .initialized =
                true;


            Payment.bindEvents();


            console.log(
                "RiderX payment.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.setPaymentMethod =
        Payment.setMethod;

    RX.calculatePayment =
        Payment.calculate;

    RX.processPayment =
        Payment.process;

    RX.payCash =
        Payment.payCash;

    RX.payOnline =
        Payment.payOnline;

    RX.payWallet =
        Payment.payWallet;

    RX.getPayment =
        Payment.get;


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Payment.init
        );

    } else {

        Payment.init();
    }


})();
