/* ============================================================
   RIDERX 2.0
   WALLET ENGINE
   File: js/wallet.js

   Supports:
   - Customer wallet
   - Rider wallet
   - Balance
   - Add money
   - Deduct money
   - Ride payment
   - Refund
   - Earnings
   - Transactions
   - Firebase Realtime Database
   - Local fallback
   - Wallet notifications
   - Transaction history
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

        currency:
            "₹",

        storagePrefix:
            "riderx_wallet_",

        transactionLimit:
            200,

        minimumAddMoney:
            10,

        maximumAddMoney:
            50000,

        minimumWithdrawal:
            100,

        maximumWithdrawal:
            50000
    };


    /* ========================================================
       STATE
       ======================================================== */

    WALLET.state = {

        user:
            null,

        userId:
            null,

        role:
            null,

        balance:
            0,

        transactions:
            [],

        loading:
            false,

        initialized:
            false,

        firebaseReference:
            null,

        firebaseListener:
            null
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    WALLET.getUser =
        function () {

            if (
                WALLET.state.user
            ) {

                return WALLET.state.user;
            }


            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    const user =
                        firebase.auth()
                            .currentUser;


                    if (user) {

                        WALLET.state.user =
                            user;

                        return user;
                    }
                }

            } catch (error) {

                console.warn(
                    "Wallet auth error:",
                    error
                );
            }


            try {

                const localUser =
                    JSON.parse(
                        localStorage.getItem(
                            "riderx_user"
                        ) ||
                        "null"
                    );


                if (localUser) {

                    WALLET.state.user =
                        localUser;

                    return localUser;
                }

            } catch (error) {

                console.warn(
                    "Wallet local user error:",
                    error
                );
            }


            return null;
        };


    WALLET.getUserId =
        function () {

            const user =
                WALLET.getUser();


            if (!user) {

                return null;
            }


            return (
                user.uid ||
                user.userId ||
                user.id ||
                null
            );
        };


    WALLET.getRole =
        function () {

            const user =
                WALLET.getUser();


            return (
                user &&
                (
                    user.role ||
                    user.userRole
                )
            ) ||
            localStorage.getItem(
                "riderx_role"
            ) ||
            null;
        };


    WALLET.round =
        function (
            amount
        ) {

            return Math.round(
                (
                    Number(amount) ||
                    0
                ) * 100
            ) / 100;
        };


    WALLET.formatMoney =
        function (
            amount
        ) {

            const value =
                WALLET.round(
                    amount
                );


            return (
                WALLET.config.currency +
                value.toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits:
                            2,

                        maximumFractionDigits:
                            2
                    }
                )
            );
        };


    WALLET.generateId =
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


    WALLET.now =
        function () {

            return Date.now();
        };


    /* ========================================================
       STORAGE KEY
       ======================================================== */

    WALLET.getStorageKey =
        function () {

            const userId =
                WALLET.getUserId();


            if (!userId) {

                return (
                    WALLET.config
                        .storagePrefix +
                    "guest"
                );
            }


            return (
                WALLET.config
                    .storagePrefix +
                userId
            );
        };


    /* ========================================================
       LOCAL LOAD
       ======================================================== */

    WALLET.loadLocal =
        function () {

            try {

                const saved =
                    JSON.parse(
                        localStorage.getItem(
                            WALLET
                                .getStorageKey()
                        ) ||
                        "null"
                    );


                if (
                    saved &&
                    typeof saved ===
                    "object"
                ) {

                    WALLET.state.balance =
                        WALLET.round(
                            saved.balance
                        );


                    WALLET.state
                        .transactions =
                        Array.isArray(
                            saved.transactions
                        )
                            ? saved
                                .transactions
                            : [];
                }

            } catch (error) {

                console.warn(
                    "Wallet local load error:",
                    error
                );


                WALLET.state.balance =
                    0;

                WALLET.state
                    .transactions =
                    [];
            }


            WALLET.render();
        };


    /* ========================================================
       LOCAL SAVE
       ======================================================== */

    WALLET.saveLocal =
        function () {

            try {

                localStorage.setItem(
                    WALLET
                        .getStorageKey(),

                    JSON.stringify({

                        balance:
                            WALLET.state
                                .balance,

                        transactions:
                            WALLET.state
                                .transactions
                                .slice(
                                    0,
                                    WALLET.config
                                        .transactionLimit
                                )
                    })
                );

            } catch (error) {

                console.warn(
                    "Wallet local save error:",
                    error
                );
            }
        };


    /* ========================================================
       FIREBASE DATABASE
       ======================================================== */

    WALLET.getDatabase =
        function () {

            try {

                if (
                    window.firebase &&
                    firebase.database
                ) {

                    return firebase.database();
                }

            } catch (error) {

                console.warn(
                    "Firebase database unavailable:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       FIREBASE WALLET REF
       ======================================================== */

    WALLET.getFirebaseReference =
        function () {

            const database =
                WALLET.getDatabase();

            const userId =
                WALLET.getUserId();


            if (
                !database ||
                !userId
            ) {

                return null;
            }


            return database.ref(
                "wallets/" +
                userId
            );
        };


    /* ========================================================
       TRANSACTION CREATOR
       ======================================================== */

    WALLET.createTransaction =
        function (
            data
        ) {

            const amount =
                WALLET.round(
                    data.amount
                );


            return {

                id:
                    data.id ||
                    WALLET.generateId(),

                type:
                    data.type ||
                    "general",

                direction:
                    data.direction ||
                    (
                        amount >= 0
                            ? "credit"
                            : "debit"
                    ),

                amount:
                    Math.abs(
                        amount
                    ),

                balanceAfter:
                    WALLET.round(
                        data.balanceAfter !==
                        undefined
                            ? data
                                .balanceAfter
                            : WALLET.state
                                .balance
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

                bookingId:
                    data.bookingId ||
                    null,

                paymentId:
                    data.paymentId ||
                    null,

                status:
                    data.status ||
                    "completed",

                method:
                    data.method ||
                    "wallet",

                timestamp:
                    data.timestamp ||
                    WALLET.now(),

                createdAt:
                    data.createdAt ||
                    WALLET.now()
            };
        };


    /* ========================================================
       ADD TRANSACTION
       ======================================================== */

    WALLET.addTransaction =
        function (
            data
        ) {

            const transaction =
                WALLET.createTransaction(
                    data
                );


            const exists =
                WALLET.state
                    .transactions
                    .some(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                transaction.id
                            );
                        }
                    );


            if (
                !exists
            ) {

                WALLET.state
                    .transactions
                    .unshift(
                        transaction
                    );
            }


            WALLET.state
                .transactions =
                WALLET.state
                    .transactions
                    .slice(
                        0,
                        WALLET.config
                            .transactionLimit
                    );


            WALLET.saveLocal();

            WALLET.renderTransactions();


            return transaction;
        };


    /* ========================================================
       SET BALANCE
       ======================================================== */

    WALLET.setBalance =
        async function (
            balance,
            saveFirebase = true
        ) {

            const newBalance =
                WALLET.round(
                    balance
                );


            if (
                newBalance < 0
            ) {

                throw new Error(
                    "Wallet balance cannot be negative."
                );
            }


            WALLET.state.balance =
                newBalance;


            WALLET.saveLocal();

            WALLET.renderBalance();


            if (
                saveFirebase
            ) {

                await WALLET
                    .saveFirebase();
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-wallet-updated",
                    {
                        detail: {

                            balance:
                                newBalance
                        }
                    }
                )
            );


            return newBalance;
        };


    /* ========================================================
       GET BALANCE
       ======================================================== */

    WALLET.getBalance =
        function () {

            return WALLET.round(
                WALLET.state.balance
            );
        };


    /* ========================================================
       ADD MONEY
       ======================================================== */

    WALLET.addMoney =
        async function (
            amount,
            options = {}
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {

                throw new Error(
                    "Enter a valid amount."
                );
            }


            if (
                amount <
                WALLET.config
                    .minimumAddMoney
            ) {

                throw new Error(
                    "Minimum wallet recharge is " +
                    WALLET.formatMoney(
                        WALLET.config
                            .minimumAddMoney
                    )
                );
            }


            if (
                amount >
                WALLET.config
                    .maximumAddMoney
            ) {

                throw new Error(
                    "Maximum wallet recharge is " +
                    WALLET.formatMoney(
                        WALLET.config
                            .maximumAddMoney
                    )
                );
            }


            const oldBalance =
                WALLET.state.balance;


            const newBalance =
                WALLET.round(
                    oldBalance +
                    amount
                );


            WALLET.state.balance =
                newBalance;


            const transaction =
                WALLET.addTransaction({

                    type:
                        "recharge",

                    direction:
                        "credit",

                    amount:
                        amount,

                    balanceAfter:
                        newBalance,

                    title:
                        "Wallet Recharge",

                    description:
                        options.description ||
                        "Money added to RiderX wallet.",

                    method:
                        options.method ||
                        "online",

                    paymentId:
                        options.paymentId ||
                        null,

                    status:
                        options.status ||
                        "completed"
                });


            await WALLET.saveFirebase();


            WALLET.notify(
                "wallet_credit",
                amount,
                transaction
            );


            WALLET.render();


            return {

                success:
                    true,

                balance:
                    newBalance,

                transaction:
                    transaction
            };
        };


    /* ========================================================
       DEDUCT MONEY
       ======================================================== */

    WALLET.deductMoney =
        async function (
            amount,
            options = {}
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {

                throw new Error(
                    "Enter a valid amount."
                );
            }


            const currentBalance =
                WALLET.state.balance;


            if (
                currentBalance <
                amount
            ) {

                throw new Error(
                    "Insufficient wallet balance."
                );
            }


            const newBalance =
                WALLET.round(
                    currentBalance -
                    amount
                );


            WALLET.state.balance =
                newBalance;


            const transaction =
                WALLET.addTransaction({

                    type:
                        options.type ||
                        "payment",

                    direction:
                        "debit",

                    amount:
                        amount,

                    balanceAfter:
                        newBalance,

                    title:
                        options.title ||
                        "Wallet Payment",

                    description:
                        options.description ||
                        "Payment made from RiderX wallet.",

                    rideId:
                        options.rideId ||
                        null,

                    bookingId:
                        options.bookingId ||
                        null,

                    paymentId:
                        options.paymentId ||
                        null,

                    method:
                        "wallet",

                    status:
                        options.status ||
                        "completed"
                });


            await WALLET.saveFirebase();


            WALLET.notify(
                "wallet_debit",
                amount,
                transaction
            );


            WALLET.render();


            return {

                success:
                    true,

                balance:
                    newBalance,

                transaction:
                    transaction
            };
        };


    /* ========================================================
       RIDE PAYMENT
       ======================================================== */

    WALLET.payRide =
        async function (
            amount,
            ride = {}
        ) {

            return WALLET.deductMoney(
                amount,
                {

                    type:
                        "ride_payment",

                    title:
                        "Ride Payment",

                    description:
                        "Payment for RiderX ride.",

                    rideId:
                        ride.rideId ||
                        ride.id ||
                        null,

                    bookingId:
                        ride.bookingId ||
                        null,

                    paymentId:
                        ride.paymentId ||
                        null
                }
            );
        };


    /* ========================================================
       REFUND
       ======================================================== */

    WALLET.refund =
        async function (
            amount,
            options = {}
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {

                throw new Error(
                    "Invalid refund amount."
                );
            }


            const newBalance =
                WALLET.round(
                    WALLET.state.balance +
                    amount
                );


            WALLET.state.balance =
                newBalance;


            const transaction =
                WALLET.addTransaction({

                    type:
                        "refund",

                    direction:
                        "credit",

                    amount:
                        amount,

                    balanceAfter:
                        newBalance,

                    title:
                        "Ride Refund",

                    description:
                        options.description ||
                        "Refund credited to RiderX wallet.",

                    rideId:
                        options.rideId ||
                        null,

                    bookingId:
                        options.bookingId ||
                        null,

                    paymentId:
                        options.paymentId ||
                        null,

                    method:
                        "refund"
                });


            await WALLET.saveFirebase();


            WALLET.notify(
                "wallet_credit",
                amount,
                transaction
            );


            WALLET.render();


            return {

                success:
                    true,

                balance:
                    newBalance,

                transaction:
                    transaction
            };
        };


    /* ========================================================
       RIDER EARNINGS
       ======================================================== */

    WALLET.addEarning =
        async function (
            amount,
            ride = {}
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount <= 0
            ) {

                throw new Error(
                    "Invalid earning amount."
                );
            }


            const newBalance =
                WALLET.round(
                    WALLET.state.balance +
                    amount
                );


            WALLET.state.balance =
                newBalance;


            const transaction =
                WALLET.addTransaction({

                    type:
                        "earning",

                    direction:
                        "credit",

                    amount:
                        amount,

                    balanceAfter:
                        newBalance,

                    title:
                        "Ride Earnings",

                    description:
                        "Earnings from completed RiderX ride.",

                    rideId:
                        ride.rideId ||
                        ride.id ||
                        null,

                    bookingId:
                        ride.bookingId ||
                        null,

                    method:
                        "ride_earning"
                });


            await WALLET.saveFirebase();


            WALLET.notify(
                "wallet_credit",
                amount,
                transaction
            );


            WALLET.render();


            return {

                success:
                    true,

                balance:
                    newBalance,

                transaction:
                    transaction
            };
        };


    /* ========================================================
       WITHDRAWAL REQUEST
       ======================================================== */

    WALLET.requestWithdrawal =
        async function (
            amount,
            options = {}
        ) {

            amount =
                WALLET.round(
                    amount
                );


            if (
                amount <
                WALLET.config
                    .minimumWithdrawal
            ) {

                throw new Error(
                    "Minimum withdrawal is " +
                    WALLET.formatMoney(
                        WALLET.config
                            .minimumWithdrawal
                    )
                );
            }


            if (
                amount >
                WALLET.config
                    .maximumWithdrawal
            ) {

                throw new Error(
                    "Maximum withdrawal is " +
                    WALLET.formatMoney(
                        WALLET.config
                            .maximumWithdrawal
                    )
                );
            }


            if (
                WALLET.state.balance <
                amount
            ) {

                throw new Error(
                    "Insufficient wallet balance."
                );
            }


            /*
             * Withdrawal is marked pending.
             * Balance is reserved/deducted.
             */

            const newBalance =
                WALLET.round(
                    WALLET.state.balance -
                    amount
                );


            WALLET.state.balance =
                newBalance;


            const transaction =
                WALLET.addTransaction({

                    type:
                        "withdrawal",

                    direction:
                        "debit",

                    amount:
                        amount,

                    balanceAfter:
                        newBalance,

                    title:
                        "Withdrawal Request",

                    description:
                        options.description ||
                        "Wallet withdrawal request submitted.",

                    method:
                        options.method ||
                        "bank",

                    status:
                        "pending"
                });


            await WALLET.saveFirebase();


            WALLET.render();


            return {

                success:
                    true,

                status:
                    "pending",

                balance:
                    newBalance,

                transaction:
                    transaction
            };
        };


    /* ========================================================
       FIREBASE SAVE
       ======================================================== */

    WALLET.saveFirebase =
        async function () {

            const reference =
                WALLET.getFirebaseReference();


            if (!reference) {

                return false;
            }


            try {

                await reference.update({

                    balance:
                        WALLET.state
                            .balance,

                    updatedAt:
                        WALLET.now(),

                    role:
                        WALLET.getRole() ||
                        null
                });


                await reference
                    .child(
                        "transactions"
                    )
                    .set(
                        WALLET.state
                            .transactions
                            .slice(
                                0,
                                WALLET.config
                                    .transactionLimit
                            )
                    );


                return true;

            } catch (error) {

                console.error(
                    "Firebase wallet save failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       FIREBASE LOAD
       ======================================================== */

    WALLET.loadFirebase =
        async function () {

            const reference =
                WALLET.getFirebaseReference();


            if (!reference) {

                return false;
            }


            try {

                const snapshot =
                    await reference.once(
                        "value"
                    );


                const data =
                    snapshot.val();


                if (!data) {

                    await reference.set({

                        balance:
                            0,

                        role:
                            WALLET.getRole() ||
                            null,

                        createdAt:
                            WALLET.now(),

                        updatedAt:
                            WALLET.now()
                    });


                    return true;
                }


                if (
                    data.balance !==
                    undefined
                ) {

                    WALLET.state.balance =
                        WALLET.round(
                            data.balance
                        );
                }


                if (
                    data.transactions
                ) {

                    if (
                        Array.isArray(
                            data.transactions
                        )
                    ) {

                        WALLET.state
                            .transactions =
                            data.transactions;

                    } else {

                        WALLET.state
                            .transactions =
                            Object.values(
                                data.transactions
                            );
                    }
                }


                WALLET.saveLocal();

                WALLET.render();


                return true;

            } catch (error) {

                console.warn(
                    "Firebase wallet load failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       REALTIME LISTENER
       ======================================================== */

    WALLET.startListener =
        function () {

            WALLET.stopListener();


            const reference =
                WALLET.getFirebaseReference();


            if (!reference) {

                return false;
            }


            const listener =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val();


                    if (!data) {
                        return;
                    }


                    if (
                        data.balance !==
                        undefined
                    ) {

                        WALLET.state.balance =
                            WALLET.round(
                                data.balance
                            );
                    }


                    if (
                        data.transactions
                    ) {

                        WALLET.state
                            .transactions =
                            Array.isArray(
                                data.transactions
                            )
                                ? data
                                    .transactions
                                : Object.values(
                                    data.transactions
                                );
                    }


                    WALLET.saveLocal();

                    WALLET.render();
                };


            reference.on(
                "value",
                listener
            );


            WALLET.state
                .firebaseReference =
                reference;


            WALLET.state
                .firebaseListener =
                listener;


            return true;
        };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    WALLET.stopListener =
        function () {

            if (
                WALLET.state
                    .firebaseReference &&
                WALLET.state
                    .firebaseListener
            ) {

                try {

                    WALLET.state
                        .firebaseReference
                        .off(
                            "value",
                            WALLET.state
                                .firebaseListener
                        );

                } catch (error) {

                    console.warn(
                        "Wallet listener stop error:",
                        error
                    );
                }
            }


            WALLET.state
                .firebaseReference =
                null;


            WALLET.state
                .firebaseListener =
                null;
        };


    /* ========================================================
       NOTIFICATION
       ======================================================== */

    WALLET.notify =
        function (
            type,
            amount,
            transaction
        ) {

            try {

                if (
                    RX.notifications
                ) {

                    if (
                        type ===
                        "wallet_credit"
                    ) {

                        RX.notifications
                            .walletCredit(
                                amount
                            );

                    } else {

                        RX.notifications
                            .walletDebit(
                                amount
                            );
                    }

                    return;
                }


                if (
                    RX.notify
                ) {

                    RX.notify({

                        type:
                            type,

                        title:
                            type ===
                            "wallet_credit"
                                ? "Wallet Credited"
                                : "Wallet Payment",

                        body:
                            WALLET.formatMoney(
                                amount
                            ) +
                            (
                                type ===
                                "wallet_credit"
                                    ? " added to your wallet."
                                    : " deducted from your wallet."
                            ),

                        data: {

                            transactionId:
                                transaction &&
                                transaction.id
                        }
                    });
                }

            } catch (error) {

                console.warn(
                    "Wallet notification error:",
                    error
                );
            }
        };


    /* ========================================================
       UI BALANCE RENDER
       ======================================================== */

    WALLET.renderBalance =
        function () {

            const balance =
                WALLET.formatMoney(
                    WALLET.state.balance
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
                    ".wallet-balance"
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
                    "[data-wallet-amount]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            balance;
                    }
                );
        };


    /* ========================================================
       TRANSACTION RENDER
       ======================================================== */

    WALLET.renderTransactions =
        function () {

            const containers =
                document.querySelectorAll(
                    "[data-wallet-transactions]"
                );


            if (
                !containers.length
            ) {

                return;
            }


            containers.forEach(
                function (
                    container
                ) {

                    if (
                        !WALLET.state
                            .transactions
                            .length
                    ) {

                        container.innerHTML =
                            `
                            <div class="wallet-empty">
                                <div>💳</div>
                                <h3>No transactions yet</h3>
                                <p>Your wallet activity will appear here.</p>
                            </div>
                            `;

                        return;
                    }


                    container.innerHTML =
                        WALLET.state
                            .transactions
                            .map(
                                function (
                                    transaction
                                ) {

                                    const credit =
                                        transaction
                                            .direction ===
                                        "credit";


                                    const sign =
                                        credit
                                            ? "+"
                                            : "-";


                                    const date =
                                        new Date(
                                            transaction
                                                .timestamp
                                        );


                                    return `
                                    <div
                                        class="wallet-transaction ${
                                            credit
                                                ? "credit"
                                                : "debit"
                                        }"
                                        data-transaction-id="${transaction.id}"
                                    >

                                        <div class="wallet-transaction-icon">
                                            ${
                                                credit
                                                    ? "↗"
                                                    : "↙"
                                            }
                                        </div>

                                        <div class="wallet-transaction-info">

                                            <strong>
                                                ${WALLET.escape(
                                                    transaction.title
                                                )}
                                            </strong>

                                            <span>
                                                ${WALLET.escape(
                                                    transaction.description
                                                )}
                                            </span>

                                            <small>
                                                ${date.toLocaleString(
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
                                                )}
                                            </small>

                                        </div>

                                        <div class="wallet-transaction-amount">

                                            <strong>
                                                ${sign}
                                                ${WALLET.formatMoney(
                                                    transaction.amount
                                                )}
                                            </strong>

                                            <small>
                                                ${WALLET.escape(
                                                    transaction.status
                                                )}
                                            </small>

                                        </div>

                                    </div>
                                    `;
                                }
                            )
                            .join("");
                }
            );
        };


    /* ========================================================
       ESCAPE HTML
       ======================================================== */

    WALLET.escape =
        function (
            value
        ) {

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
       FULL RENDER
       ======================================================== */

    WALLET.render =
        function () {

            WALLET.renderBalance();

            WALLET.renderTransactions();

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-wallet-rendered",
                    {
                        detail: {

                            balance:
                                WALLET.state
                                    .balance,

                            transactions:
                                WALLET.state
                                    .transactions
                        }
                    }
                )
            );
        };


    /* ========================================================
       UI EVENTS
       ======================================================== */

    WALLET.bindEvents =
        function () {

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const addButton =
                        event.target.closest(
                            "[data-wallet-add]"
                        );


                    if (
                        addButton
                    ) {

                        event.preventDefault();


                        const input =
                            document.querySelector(
                                "[data-wallet-add-amount]"
                            );


                        const amount =
                            input
                                ? Number(
                                    input.value
                                )
                                : 0;


                        try {

                            await WALLET
                                .addMoney(
                                    amount,
                                    {
                                        method:
                                            "online"
                                    }
                                );


                            if (input) {
                                input.value = "";
                            }


                            WALLET.showMessage(
                                "Money added to wallet."
                            );

                        } catch (error) {

                            WALLET.showMessage(
                                error.message,
                                true
                            );
                        }
                    }


                    const refreshButton =
                        event.target.closest(
                            "[data-wallet-refresh]"
                        );


                    if (
                        refreshButton
                    ) {

                        event.preventDefault();

                        await WALLET
                            .loadFirebase();
                    }
                }
            );
        };


    /* ========================================================
       UI MESSAGE
       ======================================================== */

    WALLET.showMessage =
        function (
            message,
            error = false
        ) {

            const existing =
                document.querySelector(
                    ".riderx-wallet-message"
                );


            if (existing) {
                existing.remove();
            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "riderx-wallet-message" +
                (
                    error
                        ? " error"
                        : " success"
                );


            element.textContent =
                message;


            document.body.appendChild(
                element
            );


            setTimeout(
                function () {

                    element.classList.add(
                        "hide"
                    );


                    setTimeout(
                        function () {

                            element.remove();

                        },
                        300
                    );

                },
                2500
            );
        };


    /* ========================================================
       AUTH STATE
       ======================================================== */

    WALLET.bindAuth =
        function () {

            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    firebase.auth()
                        .onAuthStateChanged(
                            async function (
                                user
                            ) {

                                WALLET.stopListener();


                                WALLET.state.user =
                                    user;


                                if (!user) {

                                    WALLET.state
                                        .userId =
                                        null;

                                    WALLET.state
                                        .balance =
                                        0;

                                    WALLET.state
                                        .transactions =
                                        [];

                                    WALLET.render();

                                    return;
                                }


                                WALLET.state
                                    .userId =
                                    user.uid;


                                WALLET.state
                                    .role =
                                    WALLET.getRole();


                                WALLET.loadLocal();

                                await WALLET
                                    .loadFirebase();

                                WALLET
                                    .startListener();
                            }
                        );
                }

            } catch (error) {

                console.warn(
                    "Wallet auth binding error:",
                    error
                );
            }
        };


    /* ========================================================
       INITIALIZE
       ======================================================== */

    WALLET.init =
        async function () {

            if (
                WALLET.state.initialized
            ) {

                return;
            }


            WALLET.state.user =
                WALLET.getUser();


            WALLET.state.userId =
                WALLET.getUserId();


            WALLET.state.role =
                WALLET.getRole();


            WALLET.loadLocal();

            WALLET.bindEvents();

            WALLET.bindAuth();


            if (
                WALLET.state.userId
            ) {

                await WALLET
                    .loadFirebase();

                WALLET
                    .startListener();
            }


            WALLET.render();


            WALLET.state.initialized =
                true;


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-wallet-ready"
                )
            );
        };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.getWalletBalance =
        function () {

            return WALLET
                .getBalance();
        };


    RX.addWalletMoney =
        function (
            amount,
            options
        ) {

            return WALLET
                .addMoney(
                    amount,
                    options
                );
        };


    RX.payFromWallet =
        function (
            amount,
            options
        ) {

            return WALLET
                .deductMoney(
                    amount,
                    options
                );
        };


    RX.refundWallet =
        function (
            amount,
            options
        ) {

            return WALLET
                .refund(
                    amount,
                    options
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

                WALLET.init();
            }
        );

    } else {

        WALLET.init();
    }


    console.log(
        "RiderX Wallet Engine loaded."
    );

})();
