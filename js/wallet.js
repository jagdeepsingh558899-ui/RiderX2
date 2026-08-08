/* ============================================================
   RIDERX 2.0
   WALLET ENGINE
   File: js/wallet.js

   Features:
   - Customer wallet
   - Rider earnings wallet
   - Balance
   - Add money
   - Ride payment
   - Cash / online payment tracking
   - Refunds
   - Referral bonus
   - Promo bonus
   - Withdraw request
   - Transaction history
   - Firebase Realtime Database
   - Firestore fallback
   - Local cache
   - Wallet UI auto update
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.wallet = RX.wallet || {};

    const WALLET = RX.wallet;


    /* ========================================================
       CONFIG
       ======================================================== */

    WALLET.config = {

        localKey:
            "riderx_wallet",

        transactionsKey:
            "riderx_wallet_transactions",

        rtdbPath:
            "wallets",

        transactionsPath:
            "walletTransactions",

        firestoreWallets:
            "wallets",

        firestoreTransactions:
            "walletTransactions",

        currency:
            "₹",

        maxTransactions:
            100
    };


    /* ========================================================
       STATE
       ======================================================== */

    WALLET.state = {

        userId:
            null,

        role:
            null,

        balance:
            0,

        totalAdded:
            0,

        totalSpent:
            0,

        totalEarned:
            0,

        totalRefunded:
            0,

        pendingWithdraw:
            0,

        transactions:
            [],

        initialized:
            false,

        loading:
            false
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    WALLET.createId =
        function () {

            return (
                "txn_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 9)
            );
        };


    WALLET.number =
        function (value) {

            const number =
                Number(value);

            return Number.isFinite(number)
                ? number
                : 0;
        };


    WALLET.round =
        function (value) {

            return Math.round(
                WALLET.number(value) *
                100
            ) / 100;
        };


    WALLET.format =
        function (value) {

            return (
                WALLET.config.currency +
                WALLET.round(value)
                    .toLocaleString(
                        "en-IN",
                        {
                            minimumFractionDigits:
                                0,

                            maximumFractionDigits:
                                2
                        }
                    )
            );
        };


    WALLET.now =
        function () {

            return Date.now();
        };


    WALLET.escape =
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
       LOCAL STORAGE
       ======================================================== */

    WALLET.loadLocal =
        function () {

            try {

                const wallet =
                    localStorage.getItem(
                        WALLET.config.localKey
                    );

                if (wallet) {

                    const data =
                        JSON.parse(wallet);

                    WALLET.state.balance =
                        WALLET.number(
                            data.balance
                        );

                    WALLET.state.totalAdded =
                        WALLET.number(
                            data.totalAdded
                        );

                    WALLET.state.totalSpent =
                        WALLET.number(
                            data.totalSpent
                        );

                    WALLET.state.totalEarned =
                        WALLET.number(
                            data.totalEarned
                        );

                    WALLET.state.totalRefunded =
                        WALLET.number(
                            data.totalRefunded
                        );

                    WALLET.state.pendingWithdraw =
                        WALLET.number(
                            data.pendingWithdraw
                        );
                }


                const transactions =
                    localStorage.getItem(
                        WALLET.config
                            .transactionsKey
                    );


                if (transactions) {

                    const data =
                        JSON.parse(
                            transactions
                        );


                    if (
                        Array.isArray(data)
                    ) {

                        WALLET.state
                            .transactions =
                            data;
                    }
                }

            } catch (error) {

                console.warn(
                    "Wallet local load failed:",
                    error
                );
            }


            WALLET.updateUI();
        };


    WALLET.saveLocal =
        function () {

            try {

                localStorage.setItem(
                    WALLET.config.localKey,
                    JSON.stringify({

                        balance:
                            WALLET.state.balance,

                        totalAdded:
                            WALLET.state.totalAdded,

                        totalSpent:
                            WALLET.state.totalSpent,

                        totalEarned:
                            WALLET.state.totalEarned,

                        totalRefunded:
                            WALLET.state.totalRefunded,

                        pendingWithdraw:
                            WALLET.state
                                .pendingWithdraw
                    })
                );


                localStorage.setItem(
                    WALLET.config
                        .transactionsKey,

                    JSON.stringify(
                        WALLET.state
                            .transactions
                            .slice(
                                0,
                                WALLET.config
                                    .maxTransactions
                            )
                    )
                );

            } catch (error) {

                console.warn(
                    "Wallet local save failed:",
                    error
                );
            }
        };


    /* ========================================================
       AUTH USER
       ======================================================== */

    WALLET.getCurrentUser =
        function () {

            if (
                WALLET.state.userId
            ) {

                return {
                    uid:
                        WALLET.state.userId,

                    role:
                        WALLET.state.role
                };
            }


            if (
                RX.firebase &&
                RX.firebase.auth &&
                RX.firebase.auth.currentUser
            ) {

                return {
                    uid:
                        RX.firebase.auth
                            .currentUser.uid,

                    role:
                        WALLET.state.role
                };
            }


            return null;
        };


    /* ========================================================
       INITIAL WALLET
       ======================================================== */

    WALLET.defaultWallet =
        function (
            userId,
            role
        ) {

            return {

                userId:
                    userId,

                role:
                    role || "customer",

                balance:
                    0,

                totalAdded:
                    0,

                totalSpent:
                    0,

                totalEarned:
                    0,

                totalRefunded:
                    0,

                pendingWithdraw:
                    0,

                updatedAt:
                    WALLET.now(),

                createdAt:
                    WALLET.now()
            };
        };


    /* ========================================================
       LOAD FROM FIREBASE
       ======================================================== */

    WALLET.loadFromFirebase =
        async function (
            userId
        ) {

            if (!userId) {

                return null;
            }


            /*
             * Firestore first.
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    const doc =
                        await RX.firebase
                            .db
                            .collection(
                                WALLET.config
                                    .firestoreWallets
                            )
                            .doc(
                                userId
                            )
                            .get();


                    if (
                        doc.exists
                    ) {

                        const data =
                            doc.data();


                        WALLET.applyWallet(
                            data
                        );


                        await WALLET
                            .loadTransactionsFromFirestore(
                                userId
                            );


                        return data;
                    }

                } catch (error) {

                    console.warn(
                        "Firestore wallet load failed:",
                        error
                    );
                }
            }


            /*
             * Realtime Database fallback.
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    const snapshot =
                        await RX.firebase
                            .rtdb
                            .ref(
                                WALLET.config
                                    .rtdbPath +
                                "/" +
                                userId
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val();


                    if (
                        data
                    ) {

                        WALLET.applyWallet(
                            data
                        );

                        return data;
                    }

                } catch (error) {

                    console.warn(
                        "RTDB wallet load failed:",
                        error
                    );
                }
            }


            return null;
        };


    /* ========================================================
       APPLY WALLET
       ======================================================== */

    WALLET.applyWallet =
        function (
            data
        ) {

            if (!data) {
                return;
            }


            WALLET.state.balance =
                WALLET.number(
                    data.balance
                );


            WALLET.state.totalAdded =
                WALLET.number(
                    data.totalAdded
                );


            WALLET.state.totalSpent =
                WALLET.number(
                    data.totalSpent
                );


            WALLET.state.totalEarned =
                WALLET.number(
                    data.totalEarned
                );


            WALLET.state.totalRefunded =
                WALLET.number(
                    data.totalRefunded
                );


            WALLET.state.pendingWithdraw =
                WALLET.number(
                    data.pendingWithdraw
                );


            WALLET.saveLocal();

            WALLET.updateUI();
        };


    /* ========================================================
       CREATE WALLET
       ======================================================== */

    WALLET.create =
        async function (
            userId,
            role
        ) {

            if (!userId) {

                return false;
            }


            const wallet =
                WALLET.defaultWallet(
                    userId,
                    role
                );


            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            WALLET.config
                                .firestoreWallets
                        )
                        .doc(
                            userId
                        )
                        .set(
                            wallet,
                            {
                                merge:
                                    true
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Wallet creation failed:",
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
                            WALLET.config
                                .rtdbPath +
                            "/" +
                            userId
                        )
                        .update(
                            wallet
                        );

                } catch (error) {

                    console.warn(
                        "RTDB wallet creation failed:",
                        error
                    );
                }
            }


            WALLET.applyWallet(
                wallet
            );


            return wallet;
        };


    /* ========================================================
       SAVE WALLET
       ======================================================== */

    WALLET.save =
        async function () {

            const user =
                WALLET.getCurrentUser();


            if (!user) {

                WALLET.saveLocal();

                return false;
            }


            const data = {

                userId:
                    user.uid,

                role:
                    WALLET.state.role ||
                    user.role ||
                    "customer",

                balance:
                    WALLET.round(
                        WALLET.state.balance
                    ),

                totalAdded:
                    WALLET.round(
                        WALLET.state.totalAdded
                    ),

                totalSpent:
                    WALLET.round(
                        WALLET.state.totalSpent
                    ),

                totalEarned:
                    WALLET.round(
                        WALLET.state.totalEarned
                    ),

                totalRefunded:
                    WALLET.round(
                        WALLET.state.totalRefunded
                    ),

                pendingWithdraw:
                    WALLET.round(
                        WALLET.state
                            .pendingWithdraw
                    ),

                updatedAt:
                    WALLET.now()
            };


            WALLET.saveLocal();


            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            WALLET.config
                                .firestoreWallets
                        )
                        .doc(
                            user.uid
                        )
                        .set(
                            data,
                            {
                                merge:
                                    true
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Firestore wallet save failed:",
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
                            WALLET.config
                                .rtdbPath +
                            "/" +
                            user.uid
                        )
                        .update(
                            data
                        );

                } catch (error) {

                    console.warn(
                        "RTDB wallet save failed:",
                        error
                    );
                }
            }


            WALLET.updateUI();

            return true;
        };


    /* ========================================================
       ADD TRANSACTION
       ======================================================== */

    WALLET.addTransaction =
        async function (
            data
        ) {

            data =
                data || {};


            const transaction = {

                id:
                    data.id ||
                    WALLET.createId(),

                userId:
                    data.userId ||
                    WALLET.state.userId ||
                    null,

                type:
                    data.type ||
                    "general",

                amount:
                    WALLET.round(
                        data.amount
                    ),

                direction:
                    data.direction ||
                    (
                        WALLET.number(
                            data.amount
                        ) >= 0
                            ? "credit"
                            : "debit"
                    ),

                title:
                    data.title ||
                    "Wallet Transaction",

                description:
                    data.description ||
                    "",

                rideId:
                    data.rideId ||
                    null,

                paymentId:
                    data.paymentId ||
                    null,

                status:
                    data.status ||
                    "completed",

                timestamp:
                    data.timestamp ||
                    WALLET.now()
            };


            WALLET.state
                .transactions
                .unshift(
                    transaction
                );


            WALLET.state
                .transactions =
                WALLET.state
                    .transactions
                    .slice(
                        0,
                        WALLET.config
                            .maxTransactions
                    );


            WALLET.saveLocal();

            WALLET.renderTransactions();


            /*
             * Firestore.
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            WALLET.config
                                .firestoreTransactions
                        )
                        .doc(
                            transaction.id
                        )
                        .set(
                            transaction
                        );

                } catch (error) {

                    console.warn(
                        "Transaction Firestore save failed:",
                        error
                    );
                }
            }


            /*
             * RTDB.
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb &&
                transaction.userId
            ) {

                try {

                    await RX.firebase
                        .rtdb
                        .ref(
                            WALLET.config
                                .transactionsPath +
                            "/" +
                            transaction.userId +
                            "/" +
                            transaction.id
                        )
                        .set(
                            transaction
                        );

                } catch (error) {

                    console.warn(
                        "Transaction RTDB save failed:",
                        error
                    );
                }
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-wallet-transaction",
                    {
                        detail:
                            transaction
                    }
                )
            );


            return transaction;
        };


    /* ========================================================
       LOAD FIRESTORE TRANSACTIONS
       ======================================================== */

    WALLET.loadTransactionsFromFirestore =
        async function (
            userId
        ) {

            if (
                !RX.firebase ||
                !RX.firebase.db ||
                !userId
            ) {

                return [];
            }


            try {

                const snapshot =
                    await RX.firebase
                        .db
                        .collection(
                            WALLET.config
                                .firestoreTransactions
                        )
                        .where(
                            "userId",
                            "==",
                            userId
                        )
                        .orderBy(
                            "timestamp",
                            "desc"
                        )
                        .limit(
                            WALLET.config
                                .maxTransactions
                        )
                        .get();


                const transactions =
                    [];


                snapshot.forEach(
                    function (
                        doc
                    ) {

                        const data =
                            doc.data();


                        transactions.push(
                            {
                                ...data,

                                id:
                                    data.id ||
                                    doc.id
                            }
                        );
                    }
                );


                WALLET.state
                    .transactions =
                    transactions;


                WALLET.saveLocal();

                WALLET.renderTransactions();


                return transactions;

            } catch (error) {

                console.warn(
                    "Transaction load failed:",
                    error
                );


                return [];
            }
        };


    /* ========================================================
       CREDIT
       ======================================================== */

    WALLET.credit =
        async function (
            amount,
            options
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Invalid credit amount"
                );
            }


            options =
                options || {};


            WALLET.state.balance =
                WALLET.round(
                    WALLET.state.balance +
                    amount
                );


            if (
                options.type ===
                "earning"
            ) {

                WALLET.state.totalEarned =
                    WALLET.round(
                        WALLET.state
                            .totalEarned +
                        amount
                    );

            } else if (
                options.type ===
                "refund"
            ) {

                WALLET.state.totalRefunded =
                    WALLET.round(
                        WALLET.state
                            .totalRefunded +
                        amount
                    );

            } else {

                WALLET.state.totalAdded =
                    WALLET.round(
                        WALLET.state
                            .totalAdded +
                        amount
                    );
            }


            await WALLET.save();


            return WALLET.addTransaction(
                {

                    userId:
                        WALLET.state.userId,

                    type:
                        options.type ||
                        "credit",

                    amount:
                        amount,

                    direction:
                        "credit",

                    title:
                        options.title ||
                        "Money Added",

                    description:
                        options.description ||
                        "Wallet credited.",

                    rideId:
                        options.rideId ||
                        null,

                    paymentId:
                        options.paymentId ||
                        null,

                    status:
                        options.status ||
                        "completed"
                }
            );
        };


    /* ========================================================
       DEBIT
       ======================================================== */

    WALLET.debit =
        async function (
            amount,
            options
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Invalid debit amount"
                );
            }


            options =
                options || {};


            if (
                WALLET.state.balance <
                amount
            ) {

                throw new Error(
                    "Insufficient wallet balance"
                );
            }


            WALLET.state.balance =
                WALLET.round(
                    WALLET.state.balance -
                    amount
                );


            WALLET.state.totalSpent =
                WALLET.round(
                    WALLET.state
                        .totalSpent +
                    amount
                );


            await WALLET.save();


            return WALLET.addTransaction(
                {

                    userId:
                        WALLET.state.userId,

                    type:
                        options.type ||
                        "debit",

                    amount:
                        amount,

                    direction:
                        "debit",

                    title:
                        options.title ||
                        "Wallet Payment",

                    description:
                        options.description ||
                        "Wallet debited.",

                    rideId:
                        options.rideId ||
                        null,

                    paymentId:
                        options.paymentId ||
                        null,

                    status:
                        options.status ||
                        "completed"
                }
            );
        };


    /* ========================================================
       ADD MONEY
       ======================================================== */

    WALLET.addMoney =
        async function (
            amount,
            paymentData
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount < 10
            ) {

                throw new Error(
                    "Minimum wallet amount is ₹10"
                );
            }


            paymentData =
                paymentData ||
                {};


            /*
             * IMPORTANT:
             * Real payment gateway verification
             * must happen on a secure backend.
             *
             * This function records the
             * successfully verified payment.
             */

            return WALLET.credit(
                amount,
                {

                    type:
                        "add_money",

                    title:
                        "Money Added",

                    description:
                        "Wallet recharge completed.",

                    paymentId:
                        paymentData.paymentId ||
                        null,

                    status:
                        paymentData.status ||
                        "completed"
                }
            );
        };


    /* ========================================================
       RIDE PAYMENT
       ======================================================== */

    WALLET.payRide =
        async function (
            amount,
            rideId,
            paymentMethod
        ) {

            amount =
                WALLET.round(
                    amount
                );


            paymentMethod =
                paymentMethod ||
                "wallet";


            if (
                paymentMethod !==
                "wallet"
            ) {

                return {

                    success:
                        false,

                    external:
                        true,

                    message:
                        "External payment method selected."
                };
            }


            if (
                WALLET.state.balance <
                amount
            ) {

                return {

                    success:
                        false,

                    message:
                        "Insufficient wallet balance."
                };
            }


            const transaction =
                await WALLET.debit(
                    amount,
                    {

                        type:
                            "ride_payment",

                        title:
                            "Ride Payment",

                        description:
                            "Payment for RiderX ride.",

                        rideId:
                            rideId,

                        status:
                            "completed"
                    }
                );


            if (
                RX.notification &&
                RX.notification
                    .paymentSuccess
            ) {

                RX.notification
                    .paymentSuccess(
                        rideId,
                        amount
                    );
            }


            return {

                success:
                    true,

                transaction:
                    transaction,

                balance:
                    WALLET.state
                        .balance
            };
        };


    /* ========================================================
       REFUND
       ======================================================== */

    WALLET.refund =
        async function (
            amount,
            rideId,
            reason
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Invalid refund amount"
                );
            }


            return WALLET.credit(
                amount,
                {

                    type:
                        "refund",

                    title:
                        "Ride Refund",

                    description:
                        reason ||
                        "Ride payment refunded.",

                    rideId:
                        rideId,

                    status:
                        "completed"
                }
            );
        };


    /* ========================================================
       RIDER EARNING
       ======================================================== */

    WALLET.addEarning =
        async function (
            amount,
            rideId
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Invalid earning amount"
                );
            }


            return WALLET.credit(
                amount,
                {

                    type:
                        "earning",

                    title:
                        "Ride Earning",

                    description:
                        "Earning received from completed ride.",

                    rideId:
                        rideId,

                    status:
                        "completed"
                }
            );
        };


    /* ========================================================
       REFERRAL BONUS
       ======================================================== */

    WALLET.addReferralBonus =
        async function (
            amount,
            referralCode
        ) {

            amount =
                WALLET.round(
                    amount
                );


            return WALLET.credit(
                amount,
                {

                    type:
                        "referral",

                    title:
                        "Referral Bonus",

                    description:
                        referralCode
                            ? "Referral bonus for code " +
                              referralCode
                            : "Referral bonus credited.",

                    status:
                        "completed"
                }
            );
        };


    /* ========================================================
       PROMO BONUS
       ======================================================== */

    WALLET.addPromoBonus =
        async function (
            amount,
            promoCode
        ) {

            amount =
                WALLET.round(
                    amount
                );


            return WALLET.credit(
                amount,
                {

                    type:
                        "promo",

                    title:
                        "Promo Bonus",

                    description:
                        promoCode
                            ? "Promo code " +
                              promoCode +
                              " bonus."
                            : "Promotional bonus credited.",

                    status:
                        "completed"
                }
            );
        };


    /* ========================================================
       WITHDRAW REQUEST
       ======================================================== */

    WALLET.requestWithdraw =
        async function (
            amount,
            payoutData
        ) {

            amount =
                WALLET.round(
                    amount
                );


            payoutData =
                payoutData ||
                {};


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Invalid withdrawal amount"
                );
            }


            if (
                WALLET.state.balance <
                amount
            ) {

                throw new Error(
                    "Insufficient wallet balance"
                );
            }


            /*
             * Do not instantly deduct
             * until admin approves.
             */

            WALLET.state.pendingWithdraw =
                WALLET.round(
                    WALLET.state
                        .pendingWithdraw +
                    amount
                );


            await WALLET.save();


            const transaction =
                await WALLET.addTransaction(
                    {

                        userId:
                            WALLET.state.userId,

                        type:
                            "withdraw",

                        amount:
                            amount,

                        direction:
                            "debit",

                        title:
                            "Withdrawal Requested",

                        description:
                            "Withdrawal request submitted for admin approval.",

                        status:
                            "pending"
                    }
                );


            /*
             * Store withdrawal request.
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    const request = {

                        id:
                            transaction.id,

                        userId:
                            WALLET.state.userId,

                        role:
                            WALLET.state.role,

                        amount:
                            amount,

                        status:
                            "pending",

                        payout:
                            payoutData,

                        createdAt:
                            WALLET.now()
                    };


                    await RX.firebase
                        .db
                        .collection(
                            "withdrawRequests"
                        )
                        .doc(
                            transaction.id
                        )
                        .set(
                            request
                        );

                } catch (error) {

                    console.warn(
                        "Withdraw request failed:",
                        error
                    );
                }
            }


            return transaction;
        };


    /* ========================================================
       CHECK BALANCE
       ======================================================== */

    WALLET.getBalance =
        function () {

            return WALLET.state
                .balance;
        };


    WALLET.hasBalance =
        function (
            amount
        ) {

            return (
                WALLET.state.balance >=
                WALLET.number(amount)
            );
        };


    /* ========================================================
       GET TRANSACTIONS
       ======================================================== */

    WALLET.getTransactions =
        function (
            limit
        ) {

            const transactions =
                WALLET.state
                    .transactions;


            if (
                !limit
            ) {

                return [
                    ...transactions
                ];
            }


            return transactions.slice(
                0,
                Number(limit)
            );
        };


    /* ========================================================
       FILTER TRANSACTIONS
       ======================================================== */

    WALLET.filterTransactions =
        function (
            type
        ) {

            if (
                !type ||
                type ===
                "all"
            ) {

                return WALLET
                    .getTransactions();
            }


            return WALLET.state
                .transactions
                .filter(
                    function (
                        transaction
                    ) {

                        return (
                            transaction.type ===
                            type
                        );
                    }
                );
        };


    /* ========================================================
       TRANSACTION ICON
       ======================================================== */

    WALLET.transactionIcon =
        function (
            type
        ) {

            const icons = {

                add_money:
                    "＋",

                earning:
                    "₹",

                ride_payment:
                    "🚕",

                refund:
                    "↩",

                referral:
                    "🎁",

                promo:
                    "🎉",

                withdraw:
                    "↗",

                credit:
                    "+",

                debit:
                    "−",

                general:
                    "₹"
            };


            return (
                icons[type] ||
                icons.general
            );
        };


    /* ========================================================
       TRANSACTION TIME
       ======================================================== */

    WALLET.formatDate =
        function (
            timestamp
        ) {

            if (!timestamp) {

                return "";
            }


            const date =
                new Date(
                    timestamp
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "";
            }


            return date.toLocaleString(
                "en-IN",
                {

                    day:
                        "2-digit",

                    month:
                        "short",

                    year:
                        "numeric",

                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );
        };


    /* ========================================================
       RENDER TRANSACTIONS
       ======================================================== */

    WALLET.renderTransactions =
        function (
            container
        ) {

            if (!container) {

                container =
                    document.querySelector(
                        "[data-wallet-transactions]"
                    );
            }


            if (!container) {
                return;
            }


            const transactions =
                WALLET.state
                    .transactions;


            if (
                !transactions.length
            ) {

                container.innerHTML =
                    '<div class="wallet-empty">' +
                    '<div class="wallet-empty-icon">₹</div>' +
                    '<div class="wallet-empty-title">No transactions yet</div>' +
                    '<div class="wallet-empty-text">Your wallet activity will appear here.</div>' +
                    "</div>";

                return;
            }


            container.innerHTML =
                "";


            transactions.forEach(
                function (
                    transaction
                ) {

                    const row =
                        document.createElement(
                            "div"
                        );


                    row.className =
                        "wallet-transaction";


                    const credit =
                        transaction.direction ===
                        "credit";


                    row.classList.add(
                        credit
                            ? "credit"
                            : "debit"
                    );


                    row.innerHTML =

                        '<div class="wallet-transaction-icon">' +
                        WALLET.transactionIcon(
                            transaction.type
                        ) +
                        "</div>" +

                        '<div class="wallet-transaction-info">' +

                        '<div class="wallet-transaction-title">' +
                        WALLET.escape(
                            transaction.title
                        ) +
                        "</div>" +

                        '<div class="wallet-transaction-description">' +
                        WALLET.escape(
                            transaction.description
                        ) +
                        "</div>" +

                        '<div class="wallet-transaction-date">' +
                        WALLET.escape(
                            WALLET.formatDate(
                                transaction.timestamp
                            )
                        ) +
                        "</div>" +

                        "</div>" +

                        '<div class="wallet-transaction-amount">' +
                        (
                            credit
                                ? "+"
                                : "-"
                        ) +
                        WALLET.format(
                            transaction.amount
                        ) +
                        "</div>";


                    container.appendChild(
                        row
                    );
                }
            );
        };


    /* ========================================================
       UPDATE BALANCE UI
       ======================================================== */

    WALLET.updateUI =
        function () {

            const balance =
                WALLET.format(
                    WALLET.state
                        .balance
                );


            document
                .querySelectorAll(
                    "[data-wallet-balance]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            balance;
                    }
                );


            document
                .querySelectorAll(
                    "[data-wallet-total-added]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            WALLET.format(
                                WALLET.state
                                    .totalAdded
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-wallet-total-spent]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            WALLET.format(
                                WALLET.state
                                    .totalSpent
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-wallet-total-earned]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            WALLET.format(
                                WALLET.state
                                    .totalEarned
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-wallet-refunded]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            WALLET.format(
                                WALLET.state
                                    .totalRefunded
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-wallet-pending-withdraw]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            WALLET.format(
                                WALLET.state
                                    .pendingWithdraw
                            );
                    }
                );


            WALLET.updateWithdrawButton();
        };


    /* ========================================================
       WITHDRAW BUTTON
       ======================================================== */

    WALLET.updateWithdrawButton =
        function () {

            document
                .querySelectorAll(
                    "[data-wallet-withdraw]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        const disabled =
                            WALLET.state
                                .balance <= 0;


                        button.disabled =
                            disabled;

                        button.classList.toggle(
                            "disabled",
                            disabled
                        );
                    }
                );
        };


    /* ========================================================
       BIND UI
       ======================================================== */

    WALLET.bind =
        function () {

            /*
             * Add money buttons.
             */

            document
                .querySelectorAll(
                    "[data-wallet-add]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .walletBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .walletBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                const amount =
                                    Number(
                                        button.dataset
                                            .amount ||
                                        0
                                    );


                                window.dispatchEvent(
                                    new CustomEvent(
                                        "riderx-wallet-add-money",
                                        {
                                            detail: {
                                                amount:
                                                    amount
                                            }
                                        }
                                    )
                                );
                            }
                        );
                    }
                );


            /*
             * Withdraw buttons.
             */

            document
                .querySelectorAll(
                    "[data-wallet-withdraw]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .walletBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .walletBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                window.dispatchEvent(
                                    new CustomEvent(
                                        "riderx-wallet-withdraw",
                                        {
                                            detail: {
                                                balance:
                                                    WALLET.state
                                                        .balance
                                            }
                                        }
                                    )
                                );
                            }
                        );
                    }
                );


            /*
             * Transaction filters.
             */

            document
                .querySelectorAll(
                    "[data-wallet-filter]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.addEventListener(
                            "click",
                            function () {

                                const type =
                                    button.dataset
                                        .walletFilter;


                                const container =
                                    document.querySelector(
                                        "[data-wallet-transactions]"
                                    );


                                if (
                                    container
                                ) {

                                    const old =
                                        WALLET.state
                                            .transactions;


                                    WALLET.state
                                        .transactions =
                                        WALLET
                                            .filterTransactions(
                                                type
                                            );


                                    WALLET
                                        .renderTransactions(
                                            container
                                        );


                                    WALLET.state
                                        .transactions =
                                        old;
                                }
                            }
                        );
                    }
                );
        };


    /* ========================================================
       AUTH LISTENER
       ======================================================== */

    WALLET.listenToAuth =
        function () {

            if (
                !RX.firebase ||
                !RX.firebase.auth
            ) {

                return;
            }


            RX.firebase.auth
                .onAuthStateChanged(
                    async function (
                        user
                    ) {

                        if (!user) {

                            WALLET.state
                                .userId =
                                null;

                            WALLET.state
                                .role =
                                null;

                            return;
                        }


                        WALLET.state
                            .userId =
                            user.uid;


                        WALLET.state
                            .role =
                            user.role ||
                            localStorage.getItem(
                                "riderx_role"
                            ) ||
                            "customer";


                        WALLET.loadLocal();


                        const data =
                            await WALLET
                                .loadFromFirebase(
                                    user.uid
                                );


                        if (!data) {

                            await WALLET.create(
                                user.uid,
                                WALLET.state.role
                            );
                        }


                        WALLET.updateUI();

                        WALLET.renderTransactions();
                    }
                );
        };


    /* ========================================================
       INIT
       ======================================================== */

    WALLET.init =
        function () {

            if (
                WALLET.state.initialized
            ) {

                return;
            }


            WALLET.state.initialized =
                true;


            WALLET.loadLocal();

            WALLET.bind();

            WALLET.listenToAuth();

            WALLET.updateUI();

            WALLET.renderTransactions();


            console.log(
                "RiderX Wallet Engine loaded."
            );
        };


    /* ========================================================
       EXTERNAL RIDE EVENTS
       ======================================================== */

    window.addEventListener(
        "riderx-ride-completed",
        async function (
            event
        ) {

            const data =
                event.detail ||
                {};


            /*
             * Rider earnings are added
             * only when explicitly supplied.
             */

            if (
                WALLET.state.role ===
                "rider" &&
                data.earning
            ) {

                try {

                    await WALLET.addEarning(
                        data.earning,
                        data.rideId
                    );

                } catch (error) {

                    console.warn(
                        error
                    );
                }
            }
        }
    );


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            WALLET.init
        );

    } else {

        WALLET.init();
    }


})();
