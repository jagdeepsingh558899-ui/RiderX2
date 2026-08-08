/* ============================================================
   RIDERX - RIDER WALLET
   File: js/rider-wallet.js

   Handles:
   - Rider wallet balance
   - Total earnings
   - Today's earnings
   - Pending earnings
   - Transactions
   - Ride earnings
   - Withdrawal request
   - Cash / online earning records
   - Firebase synchronization
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Wallet =
        RX.riderWallet ||
        (RX.riderWallet = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Wallet.config = {

        ridersPath:
            "riders",

        ridesPath:
            "rides",

        transactionsPath:
            "walletTransactions",

        withdrawalsPath:
            "withdrawalRequests",

        walletPath:
            "wallet",

        cacheKey:
            "riderx_rider_wallet",

        transactionLimit:
            100
    };


    /* ========================================================
       STATE
       ======================================================== */

    Wallet.state = {

        initialized:
            false,

        riderId:
            null,

        balance:
            0,

        totalEarnings:
            0,

        todayEarnings:
            0,

        weekEarnings:
            0,

        monthEarnings:
            0,

        pendingAmount:
            0,

        withdrawnAmount:
            0,

        cashCollected:
            0,

        onlineEarnings:
            0,

        transactions:
            [],

        withdrawals:
            [],

        loading:
            false,

        withdrawalLoading:
            false
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Wallet.getDatabase =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.database
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

            } catch (error) {}


            return null;
        };


    /* ========================================================
       RIDER ID
       ======================================================== */

    Wallet.getRiderId =
        function () {

            if (
                Wallet.state.riderId
            ) {

                return Wallet.state.riderId;
            }


            try {

                if (
                    RX.getRiderProfile
                ) {

                    const profile =
                        RX.getRiderProfile();


                    if (
                        profile &&
                        (
                            profile.uid ||
                            profile.id
                        )
                    ) {

                        Wallet.state.riderId =
                            profile.uid ||
                            profile.id;

                        return Wallet.state.riderId;
                    }
                }

            } catch (error) {}


            try {

                const uid =
                    localStorage.getItem(
                        "riderx_uid"
                    );


                if (
                    uid
                ) {

                    Wallet.state.riderId =
                        uid;

                    return uid;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    const user =
                        firebase.auth()
                            .currentUser;


                    if (
                        user
                    ) {

                        Wallet.state.riderId =
                            user.uid;

                        return user.uid;
                    }
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       LOAD WALLET
       ======================================================== */

    Wallet.load =
        async function () {

            const riderId =
                Wallet.getRiderId();


            if (
                !riderId
            ) {

                Wallet.loadCache();

                Wallet.render();

                return Wallet.getSummary();
            }


            const database =
                Wallet.getDatabase();


            if (
                !database
            ) {

                Wallet.loadCache();

                Wallet.render();

                return Wallet.getSummary();
            }


            Wallet.state.loading =
                true;


            try {

                await Wallet.loadWalletRecord(
                    database,
                    riderId
                );


                await Wallet.loadRideEarnings(
                    database,
                    riderId
                );


                await Wallet.loadTransactions(
                    database,
                    riderId
                );


                await Wallet.loadWithdrawals(
                    database,
                    riderId
                );


                Wallet.calculate();

                Wallet.saveCache();

                Wallet.render();


                return Wallet.getSummary();

            } catch (error) {

                console.error(
                    "Rider wallet load failed:",
                    error
                );


                Wallet.loadCache();

                Wallet.render();


                return Wallet.getSummary();

            } finally {

                Wallet.state.loading =
                    false;
            }
        };


    /* ========================================================
       LOAD WALLET RECORD
       ======================================================== */

    Wallet.loadWalletRecord =
        async function (
            database,
            riderId
        ) {

            try {

                const snapshot =
                    await database
                        .ref(
                            Wallet.config
                                .ridersPath +
                            "/" +
                            riderId +
                            "/" +
                            Wallet.config
                                .walletPath
                        )
                        .once(
                            "value"
                        );


                const wallet =
                    snapshot.val();


                if (
                    wallet
                ) {

                    Wallet.state.balance =
                        Number(
                            wallet.balance ??
                            wallet.availableBalance ??
                            0
                        );


                    Wallet.state.pendingAmount =
                        Number(
                            wallet.pending ??
                            wallet.pendingAmount ??
                            0
                        );


                    Wallet.state.withdrawnAmount =
                        Number(
                            wallet.withdrawn ??
                            wallet.withdrawnAmount ??
                            0
                        );
                }

            } catch (error) {

                console.error(
                    "Wallet record failed:",
                    error
                );
            }
        };


    /* ========================================================
       LOAD RIDE EARNINGS
       ======================================================== */

    Wallet.loadRideEarnings =
        async function (
            database,
            riderId
        ) {

            try {

                const snapshot =
                    await database
                        .ref(
                            Wallet.config
                                .ridesPath
                        )
                        .orderByChild(
                            "riderId"
                        )
                        .equalTo(
                            riderId
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                const rides =
                    Object.entries(
                        data
                    )
                    .map(
                        function (
                            [
                                id,
                                ride
                            ]
                        ) {

                            return {

                                ...ride,

                                id:
                                    ride.id ||
                                    ride.rideId ||
                                    id,

                                status:
                                    String(
                                        ride.status ||
                                        ""
                                    ).toLowerCase(),

                                fare:
                                    Number(
                                        ride.finalFare ??
                                        ride.fare ??
                                        ride.totalFare ??
                                        0
                                    ),

                                distance:
                                    Number(
                                        ride.distance ??
                                        ride.distanceKm ??
                                        0
                                    ),

                                paymentMethod:
                                    String(
                                        ride.paymentMethod ||
                                        ride.payment ||
                                        "cash"
                                    ).toLowerCase(),

                                timestamp:
                                    Number(
                                        ride.completedAt ||
                                        ride.createdAt ||
                                        0
                                    )
                            };
                        }
                    );


                Wallet.state.transactions =
                    rides
                    .filter(
                        function (
                            ride
                        ) {

                            return (
                                ride.status ===
                                "completed"
                            );
                        }
                    )
                    .map(
                        function (
                            ride
                        ) {

                            return {

                                id:
                                    "ride_" +
                                    ride.id,

                                type:
                                    "ride",

                                title:
                                    "Ride earning",

                                description:
                                    ride.customerName ||
                                    ride.serviceType ||
                                    "Completed ride",

                                amount:
                                    ride.fare,

                                paymentMethod:
                                    ride.paymentMethod,

                                status:
                                    "completed",

                                timestamp:
                                    ride.timestamp,

                                rideId:
                                    ride.id
                            };
                        }
                    );

            } catch (error) {

                console.error(
                    "Ride earnings failed:",
                    error
                );
            }
        };


    /* ========================================================
       LOAD TRANSACTIONS
       ======================================================== */

    Wallet.loadTransactions =
        async function (
            database,
            riderId
        ) {

            try {

                const snapshot =
                    await database
                        .ref(
                            Wallet.config
                                .transactionsPath +
                            "/" +
                            riderId
                        )
                        .limitToLast(
                            Wallet.config
                                .transactionLimit
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                Object.entries(
                    data
                )
                .forEach(
                    function (
                        [
                            id,
                            transaction
                        ]
                    ) {

                        Wallet.state.transactions
                            .push(
                                {

                                    ...transaction,

                                    id:
                                        transaction.id ||
                                        id,

                                    amount:
                                        Number(
                                            transaction.amount ||
                                            0
                                        ),

                                    timestamp:
                                        Number(
                                            transaction.timestamp ||
                                            transaction.createdAt ||
                                            0
                                        )
                                }
                            );
                    }
                );


                /*
                 * Remove duplicate transactions.
                 */

                const unique =
                    new Map();


                Wallet.state.transactions
                    .forEach(
                        function (
                            transaction
                        ) {

                            unique.set(
                                transaction.id,
                                transaction
                            );
                        }
                    );


                Wallet.state.transactions =
                    Array.from(
                        unique.values()
                    );

            } catch (error) {

                console.error(
                    "Wallet transactions failed:",
                    error
                );
            }
        };


    /* ========================================================
       LOAD WITHDRAWALS
       ======================================================== */

    Wallet.loadWithdrawals =
        async function (
            database,
            riderId
        ) {

            try {

                const snapshot =
                    await database
                        .ref(
                            Wallet.config
                                .withdrawalsPath +
                            "/" +
                            riderId
                        )
                        .limitToLast(
                            50
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                Wallet.state.withdrawals =
                    Object.entries(
                        data
                    )
                    .map(
                        function (
                            [
                                id,
                                item
                            ]
                        ) {

                            return {

                                ...item,

                                id:
                                    item.id ||
                                    id,

                                amount:
                                    Number(
                                        item.amount ||
                                        0
                                    ),

                                timestamp:
                                    Number(
                                        item.timestamp ||
                                        item.createdAt ||
                                        0
                                    ),

                                status:
                                    String(
                                        item.status ||
                                        "pending"
                                    ).toLowerCase()
                            };
                        }
                    )
                    .sort(
                        function (
                            a,
                            b
                        ) {

                            return (
                                b.timestamp -
                                a.timestamp
                            );
                        }
                    );

            } catch (error) {

                console.error(
                    "Withdrawals failed:",
                    error
                );
            }
        };


    /* ========================================================
       CALCULATE
       ======================================================== */

    Wallet.calculate =
        function () {

            const transactions =
                Wallet.state.transactions ||
                [];


            let total =
                0;

            let today =
                0;

            let week =
                0;

            let month =
                0;

            let cash =
                0;

            let online =
                0;


            const now =
                Date.now();


            const startToday =
                Wallet.startOfToday();


            const startWeek =
                now -
                (
                    7 *
                    24 *
                    60 *
                    60 *
                    1000
                );


            const startMonth =
                now -
                (
                    30 *
                    24 *
                    60 *
                    60 *
                    1000
                );


            transactions.forEach(
                function (
                    transaction
                ) {

                    const amount =
                        Number(
                            transaction.amount ||
                            0
                        );


                    const timestamp =
                        Number(
                            transaction.timestamp ||
                            0
                        );


                    /*
                     * Only positive earning transactions
                     * count toward gross earnings.
                     */

                    if (
                        transaction.type ===
                        "ride" ||
                        amount > 0
                    ) {

                        total +=
                            amount;


                        if (
                            timestamp >=
                            startToday
                        ) {

                            today +=
                                amount;
                        }


                        if (
                            timestamp >=
                            startWeek
                        ) {

                            week +=
                                amount;
                        }


                        if (
                            timestamp >=
                            startMonth
                        ) {

                            month +=
                                amount;
                        }


                        const method =
                            String(
                                transaction.paymentMethod ||
                                ""
                            ).toLowerCase();


                        if (
                            method ===
                            "cash"
                        ) {

                            cash +=
                                amount;

                        } else {

                            online +=
                                amount;
                        }
                    }
                }
            );


            /*
             * If wallet record has an authoritative
             * balance, preserve it.
             */

            Wallet.state.totalEarnings =
                total;


            Wallet.state.todayEarnings =
                today;


            Wallet.state.weekEarnings =
                week;


            Wallet.state.monthEarnings =
                month;


            Wallet.state.cashCollected =
                cash;


            Wallet.state.onlineEarnings =
                online;


            /*
             * Calculate pending withdrawal amount.
             */

            let pending =
                0;


            let withdrawn =
                0;


            Wallet.state.withdrawals
                .forEach(
                    function (
                        item
                    ) {

                        if (
                            item.status ===
                            "pending"
                        ) {

                            pending +=
                                Number(
                                    item.amount ||
                                    0
                                );
                        }


                        if (
                            item.status ===
                            "approved" ||
                            item.status ===
                            "completed"
                        ) {

                            withdrawn +=
                                Number(
                                    item.amount ||
                                    0
                                );
                        }
                    }
                );


            if (
                pending > 0
            ) {

                Wallet.state.pendingAmount =
                    pending;
            }


            if (
                withdrawn > 0
            ) {

                Wallet.state.withdrawnAmount =
                    withdrawn;
            }
        };


    /* ========================================================
       WITHDRAW
       ======================================================== */

    Wallet.requestWithdrawal =
        async function (
            amount,
            method,
            details
        ) {

            const riderId =
                Wallet.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rider login required."
                };
            }


            const value =
                Number(
                    amount
                );


            if (
                !Number.isFinite(
                    value
                ) ||
                value <= 0
            ) {

                Wallet.showMessage(
                    "Enter a valid withdrawal amount.",
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        "Invalid amount."
                };
            }


            if (
                value >
                Number(
                    Wallet.state.balance
                )
            ) {

                Wallet.showMessage(
                    "Insufficient wallet balance.",
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        "Insufficient balance."
                };
            }


            const database =
                Wallet.getDatabase();


            if (
                !database
            ) {

                Wallet.showMessage(
                    "Wallet service is unavailable.",
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        "Database unavailable."
                };
            }


            Wallet.state.withdrawalLoading =
                true;


            try {

                const key =
                    database
                        .ref(
                            Wallet.config
                                .withdrawalsPath +
                            "/" +
                            riderId
                        )
                        .push()
                        .key;


                const request =
                    {

                        id:
                            key,

                        riderId:
                            riderId,

                        amount:
                            value,

                        method:
                            method ||
                            "bank",

                        details:
                            details ||
                            {},

                        status:
                            "pending",

                        createdAt:
                            Date.now(),

                        updatedAt:
                            Date.now()
                    };


                /*
                 * Create withdrawal request.
                 */

                await database
                    .ref(
                        Wallet.config
                            .withdrawalsPath +
                        "/" +
                        riderId +
                        "/" +
                        key
                    )
                    .set(
                        request
                    );


                /*
                 * Add transaction record.
                 */

                const transactionKey =
                    database
                        .ref(
                            Wallet.config
                                .transactionsPath +
                            "/" +
                            riderId
                        )
                        .push()
                        .key;


                await database
                    .ref(
                        Wallet.config
                            .transactionsPath +
                        "/" +
                        riderId +
                        "/" +
                        transactionKey
                    )
                    .set(
                        {

                            id:
                                transactionKey,

                            type:
                                "withdrawal",

                            title:
                                "Withdrawal requested",

                            amount:
                                -value,

                            status:
                                "pending",

                            method:
                                method ||
                                "bank",

                            timestamp:
                                Date.now(),

                            createdAt:
                                Date.now()
                        }
                    );


                /*
                 * Update wallet pending amount.
                 */

                await database
                    .ref(
                        Wallet.config
                            .ridersPath +
                        "/" +
                        riderId +
                        "/" +
                        Wallet.config
                            .walletPath
                    )
                    .update(
                        {

                            pending:
                                Number(
                                    Wallet.state
                                        .pendingAmount
                                ) +
                                value,

                            updatedAt:
                                Date.now()
                        }
                    );


                Wallet.state.withdrawals
                    .unshift(
                        request
                    );


                Wallet.state.pendingAmount +=
                    value;


                Wallet.state.balance -=
                    value;


                Wallet.saveCache();

                Wallet.render();


                Wallet.showMessage(
                    "Withdrawal request submitted.",
                    "success"
                );


                Wallet.emit(
                    "withdrawal-requested",
                    {

                        request:
                            request
                    }
                );


                return {

                    success:
                        true,

                    request:
                        request
                };

            } catch (error) {

                console.error(
                    "Withdrawal request failed:",
                    error
                );


                Wallet.showMessage(
                    "Unable to submit withdrawal request.",
                    "error"
                );


                return {

                    success:
                        false,

                    error:
                        error.message
                };

            } finally {

                Wallet.state.withdrawalLoading =
                    false;
            }
        };


    /* ========================================================
       RENDER
       ======================================================== */

    Wallet.render =
        function () {

            Wallet.renderBalances();

            Wallet.renderSummary();

            Wallet.renderTransactions();

            Wallet.renderWithdrawals();
        };


    /* ========================================================
       RENDER BALANCES
       ======================================================== */

    Wallet.renderBalances =
        function () {

            const values =
                {

                    balance:
                        Wallet.formatMoney(
                            Wallet.state.balance
                        ),

                    available:
                        Wallet.formatMoney(
                            Wallet.state.balance
                        ),

                    pending:
                        Wallet.formatMoney(
                            Wallet.state.pendingAmount
                        ),

                    withdrawn:
                        Wallet.formatMoney(
                            Wallet.state.withdrawnAmount
                        )
                };


            Object.entries(
                values
            )
            .forEach(
                function (
                    [
                        key,
                        value
                    ]
                ) {

                    document
                        .querySelectorAll(
                            `[data-wallet="${key}"]`
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


    /* ========================================================
       RENDER SUMMARY
       ======================================================== */

    Wallet.renderSummary =
        function () {

            const values =
                {

                    totalEarnings:
                        Wallet.formatMoney(
                            Wallet.state
                                .totalEarnings
                        ),

                    today:
                        Wallet.formatMoney(
                            Wallet.state
                                .todayEarnings
                        ),

                    todayEarnings:
                        Wallet.formatMoney(
                            Wallet.state
                                .todayEarnings
                        ),

                    week:
                        Wallet.formatMoney(
                            Wallet.state
                                .weekEarnings
                        ),

                    weekEarnings:
                        Wallet.formatMoney(
                            Wallet.state
                                .weekEarnings
                        ),

                    month:
                        Wallet.formatMoney(
                            Wallet.state
                                .monthEarnings
                        ),

                    monthEarnings:
                        Wallet.formatMoney(
                            Wallet.state
                                .monthEarnings
                        ),

                    cash:
                        Wallet.formatMoney(
                            Wallet.state
                                .cashCollected
                        ),

                    online:
                        Wallet.formatMoney(
                            Wallet.state
                                .onlineEarnings
                        )
                };


            Object.entries(
                values
            )
            .forEach(
                function (
                    [
                        key,
                        value
                    ]
                ) {

                    document
                        .querySelectorAll(
                            `[data-wallet-stat="${key}"]`
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


    /* ========================================================
       RENDER TRANSACTIONS
       ======================================================== */

    Wallet.renderTransactions =
        function () {

            const container =
                document.querySelector(
                    "[data-wallet-transactions]"
                );


            if (
                !container
            ) {

                return;
            }


            const transactions =
                [
                    ...Wallet.state
                        .transactions
                ]
                .sort(
                    function (
                        a,
                        b
                    ) {

                        return (
                            Number(
                                b.timestamp ||
                                0
                            ) -
                            Number(
                                a.timestamp ||
                                0
                            )
                        );
                    }
                );


            container.innerHTML =
                "";


            if (
                !transactions.length
            ) {

                container.innerHTML =
                    `
                    <div class="rx-empty-state">
                        <div class="rx-empty-icon">💳</div>
                        <h3>No transactions</h3>
                        <p>Your wallet transactions will appear here.</p>
                    </div>
                    `;

                return;
            }


            transactions
                .slice(
                    0,
                    100
                )
                .forEach(
                    function (
                        transaction
                    ) {

                        const item =
                            document.createElement(
                                "article"
                            );


                        item.className =
                            "rx-wallet-transaction";


                        const positive =
                            Number(
                                transaction.amount ||
                                0
                            ) >=
                            0;


                        item.innerHTML =
                            `
                            <div class="rx-wallet-transaction-main">

                                <div class="rx-wallet-transaction-icon">
                                    ${
                                        transaction.type ===
                                        "withdrawal"
                                            ? "↗"
                                            : "₹"
                                    }
                                </div>

                                <div>

                                    <strong>
                                        ${Wallet.escape(
                                            transaction.title ||
                                            "Wallet transaction"
                                        )}
                                    </strong>

                                    <small>
                                        ${Wallet.escape(
                                            transaction.description ||
                                            Wallet.formatDate(
                                                transaction.timestamp
                                            )
                                        )}
                                    </small>

                                </div>

                            </div>


                            <div class="rx-wallet-transaction-amount">

                                <strong
                                    data-positive="${positive}">
                                    ${
                                        positive
                                            ? "+"
                                            : ""
                                    }${Wallet.formatMoney(
                                        transaction.amount
                                    )}
                                </strong>

                                <small>
                                    ${Wallet.escape(
                                        Wallet.formatDate(
                                            transaction.timestamp
                                        )
                                    )}
                                </small>

                            </div>
                            `;


                        container.appendChild(
                            item
                        );
                    }
                );
        };


    /* ========================================================
       RENDER WITHDRAWALS
       ======================================================== */

    Wallet.renderWithdrawals =
        function () {

            const container =
                document.querySelector(
                    "[data-wallet-withdrawals]"
                );


            if (
                !container
            ) {

                return;
            }


            container.innerHTML =
                "";


            if (
                !Wallet.state.withdrawals.length
            ) {

                container.innerHTML =
                    `
                    <div class="rx-empty-state">
                        <p>No withdrawal requests.</p>
                    </div>
                    `;

                return;
            }


            Wallet.state.withdrawals
                .forEach(
                    function (
                        item
                    ) {

                        const element =
                            document.createElement(
                                "article"
                            );


                        element.className =
                            "rx-withdrawal-item";


                        element.innerHTML =
                            `
                            <div>

                                <strong>
                                    ${Wallet.formatMoney(
                                        item.amount
                                    )}
                                </strong>

                                <small>
                                    ${Wallet.escape(
                                        item.method ||
                                        "Bank"
                                    )}
                                </small>

                            </div>


                            <div>

                                <span
                                    data-status="${Wallet.escape(
                                        item.status
                                    )}">

                                    ${Wallet.escape(
                                        Wallet.statusLabel(
                                            item.status
                                        )
                                    )}

                                </span>

                                <small>
                                    ${Wallet.escape(
                                        Wallet.formatDate(
                                            item.timestamp
                                        )
                                    )}
                                </small>

                            </div>
                            `;


                        container.appendChild(
                            element
                        );
                    }
                );
        };


    /* ========================================================
       SUMMARY API
       ======================================================== */

    Wallet.getSummary =
        function () {

            return {

                riderId:
                    Wallet.state.riderId,

                balance:
                    Wallet.state.balance,

                totalEarnings:
                    Wallet.state.totalEarnings,

                todayEarnings:
                    Wallet.state.todayEarnings,

                weekEarnings:
                    Wallet.state.weekEarnings,

                monthEarnings:
                    Wallet.state.monthEarnings,

                pendingAmount:
                    Wallet.state.pendingAmount,

                withdrawnAmount:
                    Wallet.state.withdrawnAmount,

                cashCollected:
                    Wallet.state.cashCollected,

                onlineEarnings:
                    Wallet.state.onlineEarnings
            };
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Wallet.saveCache =
        function () {

            try {

                localStorage.setItem(
                    Wallet.config.cacheKey,
                    JSON.stringify(
                        {

                            balance:
                                Wallet.state.balance,

                            totalEarnings:
                                Wallet.state.totalEarnings,

                            todayEarnings:
                                Wallet.state.todayEarnings,

                            weekEarnings:
                                Wallet.state.weekEarnings,

                            monthEarnings:
                                Wallet.state.monthEarnings,

                            pendingAmount:
                                Wallet.state.pendingAmount,

                            withdrawnAmount:
                                Wallet.state.withdrawnAmount,

                            cashCollected:
                                Wallet.state.cashCollected,

                            onlineEarnings:
                                Wallet.state.onlineEarnings,

                            transactions:
                                Wallet.state.transactions,

                            withdrawals:
                                Wallet.state.withdrawals

                        }
                    )
                );

            } catch (error) {}
        };


    Wallet.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Wallet.config.cacheKey
                    );


                if (
                    !saved
                ) {

                    return;
                }


                const data =
                    JSON.parse(
                        saved
                    );


                Object.keys(
                    data
                )
                .forEach(
                    function (
                        key
                    ) {

                        if (
                            key in
                            Wallet.state
                        ) {

                            Wallet.state[
                                key
                            ] =
                                data[
                                    key
                                ];
                        }
                    }
                );

            } catch (error) {}
        };


    /* ========================================================
       DATE
       ======================================================== */

    Wallet.startOfToday =
        function () {

            const date =
                new Date();


            date.setHours(
                0,
                0,
                0,
                0
            );


            return date.getTime();
        };


    Wallet.formatDate =
        function (
            timestamp
        ) {

            if (
                !timestamp
            ) {

                return "";
            }


            try {

                return new Date(
                    timestamp
                ).toLocaleString(
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

            } catch (error) {

                return "";
            }
        };


    /* ========================================================
       MONEY
       ======================================================== */

    Wallet.formatMoney =
        function (
            amount
        ) {

            try {

                return new Intl.NumberFormat(
                    "en-IN",
                    {

                        style:
                            "currency",

                        currency:
                            "INR",

                        maximumFractionDigits:
                            0

                    }
                ).format(
                    Number(
                        amount ||
                        0
                    )
                );

            } catch (error) {

                return "₹" +
                    Math.round(
                        Number(
                            amount ||
                            0
                        )
                    );
            }
        };


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    Wallet.statusLabel =
        function (
            status
        ) {

            const labels =
                {

                    pending:
                        "Pending",

                    approved:
                        "Approved",

                    completed:
                        "Completed",

                    rejected:
                        "Rejected",

                    failed:
                        "Failed"
                };


            return (
                labels[
                    String(
                        status ||
                        ""
                    ).toLowerCase()
                ] ||
                "Pending"
            );
        };


    /* ========================================================
       ESCAPE
       ======================================================== */

    Wallet.escape =
        function (
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
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Wallet.showMessage =
        function (
            message,
            type
        ) {

            try {

                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        message,
                        type
                    );

                    return;
                }

            } catch (error) {}


            document
                .querySelectorAll(
                    "[data-wallet-message]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            message;

                        element.dataset.type =
                            type ||
                            "info";

                        element.hidden =
                            false;
                    }
                );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Wallet.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-wallet-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    Wallet.bindEvents =
        function () {

            /*
             * Refresh.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                        const button =
                            event.target.closest(
                                "[data-refresh-wallet]"
                            );


                        if (
                            button
                        ) {

                            Wallet.load();
                        }
                }
            );


            /*
             * Withdrawal form.
             */

            document.addEventListener(
                "submit",
                function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-withdraw-form]"
                        );


                    if (
                        !form
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const amountInput =
                        form.querySelector(
                            "[name='amount'], [data-withdraw-amount]"
                        );


                    const methodInput =
                        form.querySelector(
                            "[name='method'], [data-withdraw-method]"
                        );


                    const amount =
                        amountInput
                            ? amountInput.value
                            : 0;


                    const method =
                        methodInput
                            ? methodInput.value
                            : "bank";


                    const details =
                        {};


                    form.querySelectorAll(
                        "input, select"
                    )
                    .forEach(
                        function (
                            input
                        ) {

                            if (
                                input.name &&
                                input.name !==
                                "amount" &&
                                input.name !==
                                "method"
                            ) {

                                details[
                                    input.name
                                ] =
                                    input.value;
                            }
                        }
                    );


                    Wallet.requestWithdrawal(
                        amount,
                        method,
                        details
                    );
                }
            );


            /*
             * Quick withdrawal buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-withdraw-amount]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    const amount =
                        button.dataset
                            .withdrawAmount;


                    const input =
                        document.querySelector(
                            "[name='amount'], [data-withdraw-input]"
                        );


                    if (
                        input
                    ) {

                        input.value =
                            amount;

                        input.dispatchEvent(
                            new Event(
                                "input",
                                {
                                    bubbles:
                                        true
                                }
                            )
                        );
                    }
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.loadRiderWallet =
        Wallet.load;


    RX.getRiderWallet =
        Wallet.getSummary;


    RX.requestRiderWithdrawal =
        Wallet.requestWithdrawal;


    RX.formatRiderMoney =
        Wallet.formatMoney;


    /* ========================================================
       INIT
       ======================================================== */

    Wallet.init =
        async function () {

            if (
                Wallet.state.initialized
            ) {

                return;
            }


            Wallet.state.initialized =
                true;


            Wallet.loadCache();

            Wallet.bindEvents();

            Wallet.render();


            await Wallet.load();


            console.log(
                "RiderX rider-wallet.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Wallet.init
        );

    } else {

        Wallet.init();

    }

})();
