/* ============================================================
   RIDERX 2.0
   ADMIN CORE
   File: js/admin.js

   Handles:
   - Admin authentication guard
   - Admin profile
   - Dashboard statistics
   - Customers
   - Riders
   - Rides
   - Support
   - Search / filters
   - Admin actions
   - Firestore realtime listeners
   ============================================================ */

(function () {
    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.admin = RX.admin || {};

    const ADMIN = RX.admin;


    /* ========================================================
       STATE
       ======================================================== */

    ADMIN.state = {
        ready: false,
        authorized: false,

        stats: {
            customers: 0,
            riders: 0,
            activeRiders: 0,
            rides: 0,
            activeRides: 0,
            completedRides: 0,
            cancelledRides: 0,
            revenue: 0,
            pendingSupport: 0
        },

        customers: [],
        riders: [],
        rides: [],
        support: [],

        listeners: []
    };


    /* ========================================================
       COLLECTION NAMES
       ======================================================== */

    ADMIN.collections = {
        users: "users",
        riders: "riders",
        customers: "customers",
        rides: "rides",
        support: "support",
        notifications: "notifications"
    };


    /* ========================================================
       ADMIN GUARD
       ======================================================== */

    ADMIN.guard = function () {

        if (
            !RX ||
            !RX.state ||
            !RX.state.authReady
        ) {
            return false;
        }

        if (
            !RX.isLoggedIn()
        ) {

            RX.redirectToLogin();

            return false;
        }

        if (
            RX.getCurrentRole() !== "admin"
        ) {

            RX.redirectByRole();

            return false;
        }

        ADMIN.state.authorized = true;
        ADMIN.state.ready = true;

        ADMIN.updateAdminUI();

        return true;
    };


    /* ========================================================
       WAIT FOR AUTH
       ======================================================== */

    ADMIN.waitForAuth = function () {

        if (
            RX.state &&
            RX.state.authReady
        ) {

            ADMIN.guard();

            return;
        }

        window.addEventListener(
            "riderx-auth-changed",
            function () {

                ADMIN.guard();
            },
            {
                once: true
            }
        );
    };


    /* ========================================================
       ADMIN UI
       ======================================================== */

    ADMIN.updateAdminUI = function () {

        if (
            !ADMIN.state.authorized
        ) {
            return;
        }

        const profile =
            RX.getCurrentProfile();

        const user =
            RX.getCurrentUser();

        const name =
            (
                profile &&
                (
                    profile.name ||
                    profile.displayName
                )
            ) ||
            (
                user &&
                user.displayName
            ) ||
            "Admin";

        const email =
            (
                profile &&
                profile.email
            ) ||
            (
                user &&
                user.email
            ) ||
            "";

        document
            .querySelectorAll(
                "[data-admin-name]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        name;
                }
            );

        document
            .querySelectorAll(
                "[data-admin-email]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        email;
                }
            );

        document
            .querySelectorAll(
                "[data-admin-role]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        "Administrator";
                }
            );
    };


    /* ========================================================
       FIRESTORE
       ======================================================== */

    ADMIN.db = function () {

        if (
            RX.firebase &&
            RX.firebase.db
        ) {

            return RX.firebase.db;
        }

        return null;
    };


    /* ========================================================
       DASHBOARD STATS
       ======================================================== */

    ADMIN.loadStats = async function () {

        if (
            !ADMIN.state.authorized
        ) {
            return null;
        }

        const db =
            ADMIN.db();

        if (!db) {
            return null;
        }

        try {

            const [
                usersSnapshot,
                ridersSnapshot,
                ridesSnapshot,
                supportSnapshot
            ] = await Promise.all([

                db.collection(
                    ADMIN.collections.users
                ).get(),

                db.collection(
                    ADMIN.collections.riders
                ).get(),

                db.collection(
                    ADMIN.collections.rides
                ).get(),

                db.collection(
                    ADMIN.collections.support
                )
                .where(
                    "status",
                    "==",
                    "open"
                )
                .get()

            ]);


            let customers = 0;
            let riders = 0;
            let activeRiders = 0;

            usersSnapshot.forEach(
                function (doc) {

                    const data =
                        doc.data() || {};

                    const role =
                        String(
                            data.role || "customer"
                        ).toLowerCase();

                    if (
                        role === "customer"
                    ) {

                        customers++;
                    }
                }
            );


            ridersSnapshot.forEach(
                function (doc) {

                    const data =
                        doc.data() || {};

                    riders++;

                    if (
                        data.online === true ||
                        data.status === "online"
                    ) {

                        activeRiders++;
                    }
                }
            );


            let rides = 0;
            let activeRides = 0;
            let completedRides = 0;
            let cancelledRides = 0;
            let revenue = 0;

            ridesSnapshot.forEach(
                function (doc) {

                    const data =
                        doc.data() || {};

                    rides++;

                    const status =
                        String(
                            data.status || ""
                        ).toLowerCase();

                    if (
                        [
                            "requested",
                            "searching",
                            "accepted",
                            "arriving",
                            "arrived",
                            "started",
                            "ongoing",
                            "in_progress"
                        ].includes(status)
                    ) {

                        activeRides++;
                    }

                    if (
                        status === "completed" ||
                        status === "complete"
                    ) {

                        completedRides++;

                        revenue +=
                            Number(
                                data.fare ||
                                data.amount ||
                                data.totalFare ||
                                0
                            );
                    }

                    if (
                        status === "cancelled" ||
                        status === "canceled"
                    ) {

                        cancelledRides++;
                    }
                }
            );


            ADMIN.state.stats = {
                customers,
                riders,
                activeRiders,
                rides,
                activeRides,
                completedRides,
                cancelledRides,
                revenue,
                pendingSupport:
                    supportSnapshot.size
            };


            ADMIN.renderStats();

            return ADMIN.state.stats;

        } catch (error) {

            console.error(
                "RiderX admin stats error:",
                error
            );

            RX.showToast(
                "Dashboard error",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return null;
        }
    };


    /* ========================================================
       RENDER STATS
       ======================================================== */

    ADMIN.renderStats = function () {

        const stats =
            ADMIN.state.stats;

        const map = {

            customers:
                stats.customers,

            riders:
                stats.riders,

            "active-riders":
                stats.activeRiders,

            rides:
                stats.rides,

            "active-rides":
                stats.activeRides,

            "completed-rides":
                stats.completedRides,

            "cancelled-rides":
                stats.cancelledRides,

            revenue:
                RX.formatCurrency(
                    stats.revenue
                ),

            support:
                stats.pendingSupport
        };


        Object.keys(map)
            .forEach(
                function (key) {

                    document
                        .querySelectorAll(
                            "[data-stat='" +
                            key +
                            "']"
                        )
                        .forEach(
                            function (element) {

                                element.textContent =
                                    map[key];
                            }
                        );
                }
            );
    };


    /* ========================================================
       LOAD CUSTOMERS
       ======================================================== */

    ADMIN.loadCustomers = async function (
        options
    ) {

        options = options || {};

        const db =
            ADMIN.db();

        if (!db) {
            return [];
        }

        try {

            let query =
                db.collection(
                    ADMIN.collections.customers
                );

            if (
                options.limit
            ) {

                query =
                    query.limit(
                        Number(
                            options.limit
                        )
                    );
            }

            const snapshot =
                await query.get();

            const customers = [];

            snapshot.forEach(
                function (doc) {

                    customers.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            );

            ADMIN.state.customers =
                customers;

            ADMIN.renderCustomers(
                customers
            );

            return customers;

        } catch (error) {

            /*
             * If the customers collection does not exist,
             * fallback to users collection.
             */

            try {

                const snapshot =
                    await db
                        .collection(
                            ADMIN.collections.users
                        )
                        .where(
                            "role",
                            "==",
                            "customer"
                        )
                        .get();

                const customers = [];

                snapshot.forEach(
                    function (doc) {

                        customers.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    }
                );

                ADMIN.state.customers =
                    customers;

                ADMIN.renderCustomers(
                    customers
                );

                return customers;

            } catch (fallbackError) {

                console.error(
                    "Customer loading failed:",
                    fallbackError
                );

                return [];
            }
        }
    };


    /* ========================================================
       RENDER CUSTOMERS
       ======================================================== */

    ADMIN.renderCustomers = function (
        customers
    ) {

        const containers =
            document.querySelectorAll(
                "[data-customers-list]"
            );

        containers.forEach(
            function (container) {

                container.innerHTML = "";

                if (
                    !customers.length
                ) {

                    container.innerHTML =
                        ADMIN.emptyState(
                            "No customers found."
                        );

                    return;
                }

                customers.forEach(
                    function (customer) {

                        container.appendChild(
                            ADMIN.customerElement(
                                customer
                            )
                        );
                    }
                );
            }
        );
    };


    /* ========================================================
       CUSTOMER ELEMENT
       ======================================================== */

    ADMIN.customerElement = function (
        customer
    ) {

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "rx-list-item";

        const name =
            customer.name ||
            customer.displayName ||
            "Customer";

        const email =
            customer.email ||
            "";

        const phone =
            customer.phone ||
            customer.phoneNumber ||
            "";

        const status =
            customer.status ||
            "active";

        element.innerHTML = `
            <div class="rx-avatar">
                ${
                    customer.photoURL
                    ?
                    `<img src="${RX.escapeHTML(customer.photoURL)}"
                          alt="Customer">`
                    :
                    RX.escapeHTML(
                        name
                            .charAt(0)
                            .toUpperCase()
                    )
                }
            </div>

            <div style="flex:1;min-width:0;">

                <div style="font-weight:800;">
                    ${RX.escapeHTML(name)}
                </div>

                <div class="rx-text-muted"
                     style="font-size:10px;">
                    ${RX.escapeHTML(
                        phone || email
                    )}
                </div>

            </div>

            <span class="rx-badge ${
                status === "active"
                ? "success"
                : "danger"
            }">
                ${RX.escapeHTML(status)}
            </span>
        `;

        element.dataset.customerId =
            customer.id;

        return element;
    };


    /* ========================================================
       LOAD RIDERS
       ======================================================== */

    ADMIN.loadRiders = async function (
        options
    ) {

        options = options || {};

        const db =
            ADMIN.db();

        if (!db) {
            return [];
        }

        try {

            let query =
                db.collection(
                    ADMIN.collections.riders
                );

            if (
                options.status
            ) {

                query =
                    query.where(
                        "status",
                        "==",
                        options.status
                    );
            }

            if (
                options.limit
            ) {

                query =
                    query.limit(
                        Number(
                            options.limit
                        )
                    );
            }

            const snapshot =
                await query.get();

            const riders = [];

            snapshot.forEach(
                function (doc) {

                    riders.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            );

            ADMIN.state.riders =
                riders;

            ADMIN.renderRiders(
                riders
            );

            return riders;

        } catch (error) {

            console.error(
                "Rider loading failed:",
                error
            );

            return [];
        }
    };


    /* ========================================================
       RENDER RIDERS
       ======================================================== */

    ADMIN.renderRiders = function (
        riders
    ) {

        document
            .querySelectorAll(
                "[data-riders-list]"
            )
            .forEach(
                function (container) {

                    container.innerHTML = "";

                    if (
                        !riders.length
                    ) {

                        container.innerHTML =
                            ADMIN.emptyState(
                                "No riders found."
                            );

                        return;
                    }

                    riders.forEach(
                        function (rider) {

                            container.appendChild(
                                ADMIN.riderElement(
                                    rider
                                )
                            );
                        }
                    );
                }
            );
    };


    /* ========================================================
       RIDER ELEMENT
       ======================================================== */

    ADMIN.riderElement = function (
        rider
    ) {

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "rx-list-item";

        const name =
            rider.name ||
            rider.displayName ||
            "Rider";

        const phone =
            rider.phone ||
            rider.phoneNumber ||
            "";

        const status =
            rider.status ||
            (
                rider.online
                    ? "online"
                    : "offline"
            );

        element.innerHTML = `
            <div class="rx-avatar">
                ${
                    rider.photoURL
                    ?
                    `<img src="${RX.escapeHTML(rider.photoURL)}"
                          alt="Rider">`
                    :
                    RX.escapeHTML(
                        name
                            .charAt(0)
                            .toUpperCase()
                    )
                }
            </div>

            <div style="flex:1;min-width:0;">

                <div style="font-weight:800;">
                    ${RX.escapeHTML(name)}
                </div>

                <div class="rx-text-muted"
                     style="font-size:10px;">
                    ${RX.escapeHTML(phone)}
                </div>

            </div>

            <span class="rx-badge ${
                status === "online"
                    ? "success"
                    : status === "busy"
                        ? "warning"
                        : "danger"
            }">
                ${RX.escapeHTML(status)}
            </span>
        `;

        element.dataset.riderId =
            rider.id;

        return element;
    };


    /* ========================================================
       LOAD RIDES
       ======================================================== */

    ADMIN.loadRides = async function (
        options
    ) {

        options = options || {};

        const db =
            ADMIN.db();

        if (!db) {
            return [];
        }

        try {

            let query =
                db.collection(
                    ADMIN.collections.rides
                );

            if (
                options.status
            ) {

                query =
                    query.where(
                        "status",
                        "==",
                        options.status
                    );
            }

            if (
                options.limit
            ) {

                query =
                    query.limit(
                        Number(
                            options.limit
                        )
                    );
            }

            const snapshot =
                await query.get();

            const rides = [];

            snapshot.forEach(
                function (doc) {

                    rides.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            );

            ADMIN.state.rides =
                rides;

            ADMIN.renderRides(
                rides
            );

            return rides;

        } catch (error) {

            console.error(
                "Ride loading failed:",
                error
            );

            return [];
        }
    };


    /* ========================================================
       RENDER RIDES
       ======================================================== */

    ADMIN.renderRides = function (
        rides
    ) {

        document
            .querySelectorAll(
                "[data-rides-list]"
            )
            .forEach(
                function (container) {

                    container.innerHTML = "";

                    if (
                        !rides.length
                    ) {

                        container.innerHTML =
                            ADMIN.emptyState(
                                "No rides found."
                            );

                        return;
                    }

                    rides.forEach(
                        function (ride) {

                            container.appendChild(
                                ADMIN.rideElement(
                                    ride
                                )
                            );
                        }
                    );
                }
            );
    };


    /* ========================================================
       RIDE ELEMENT
       ======================================================== */

    ADMIN.rideElement = function (
        ride
    ) {

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "rx-list-item";

        const rideId =
            ride.rideId ||
            ride.id ||
            "Ride";

        const status =
            String(
                ride.status ||
                "requested"
            ).toLowerCase();

        const fare =
            ride.fare ||
            ride.amount ||
            ride.totalFare ||
            0;

        const pickup =
            ride.pickupAddress ||
            ride.pickup ||
            "Pickup";

        const destination =
            ride.destinationAddress ||
            ride.destination ||
            ride.dropoffAddress ||
            "Destination";

        let badge =
            "yellow";

        if (
            [
                "completed",
                "complete"
            ].includes(status)
        ) {

            badge = "success";

        } else if (
            [
                "cancelled",
                "canceled"
            ].includes(status)
        ) {

            badge = "danger";

        } else if (
            [
                "accepted",
                "arriving",
                "arrived",
                "started",
                "ongoing"
            ].includes(status)
        ) {

            badge = "info";
        }

        element.innerHTML = `
            <div class="rx-icon-box yellow">
                🚕
            </div>

            <div style="flex:1;min-width:0;">

                <div style="font-weight:850;">
                    ${RX.escapeHTML(rideId)}
                </div>

                <div class="rx-text-muted"
                     style="font-size:10px;
                            white-space:nowrap;
                            overflow:hidden;
                            text-overflow:ellipsis;">
                    ${RX.escapeHTML(pickup)}
                    →
                    ${RX.escapeHTML(destination)}
                </div>

            </div>

            <div style="text-align:right;">

                <div class="rx-price">
                    ${RX.formatCurrency(fare)}
                </div>

                <span class="rx-badge ${badge}">
                    ${RX.escapeHTML(status)}
                </span>

            </div>
        `;

        element.dataset.rideId =
            ride.id;

        return element;
    };


    /* ========================================================
       SEARCH CUSTOMERS
       ======================================================== */

    ADMIN.searchCustomers = function (
        query
    ) {

        const term =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();

        if (!term) {

            ADMIN.renderCustomers(
                ADMIN.state.customers
            );

            return ADMIN.state.customers;
        }

        const results =
            ADMIN.state.customers.filter(
                function (customer) {

                    const text =
                        [
                            customer.name,
                            customer.displayName,
                            customer.email,
                            customer.phone,
                            customer.phoneNumber
                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return text.includes(
                        term
                    );
                }
            );

        ADMIN.renderCustomers(
            results
        );

        return results;
    };


    /* ========================================================
       SEARCH RIDERS
       ======================================================== */

    ADMIN.searchRiders = function (
        query
    ) {

        const term =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();

        if (!term) {

            ADMIN.renderRiders(
                ADMIN.state.riders
            );

            return ADMIN.state.riders;
        }

        const results =
            ADMIN.state.riders.filter(
                function (rider) {

                    const text =
                        [
                            rider.name,
                            rider.displayName,
                            rider.email,
                            rider.phone,
                            rider.phoneNumber,
                            rider.vehicleNumber
                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return text.includes(
                        term
                    );
                }
            );

        ADMIN.renderRiders(
            results
        );

        return results;
    };


    /* ========================================================
       SEARCH RIDES
       ======================================================== */

    ADMIN.searchRides = function (
        query
    ) {

        const term =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();

        if (!term) {

            ADMIN.renderRides(
                ADMIN.state.rides
            );

            return ADMIN.state.rides;
        }

        const results =
            ADMIN.state.rides.filter(
                function (ride) {

                    const text =
                        [
                            ride.id,
                            ride.rideId,
                            ride.customerName,
                            ride.riderName,
                            ride.pickupAddress,
                            ride.destinationAddress,
                            ride.pickup,
                            ride.destination,
                            ride.status
                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return text.includes(
                        term
                    );
                }
            );

        ADMIN.renderRides(
            results
        );

        return results;
    };


    /* ========================================================
       UPDATE USER STATUS
       ======================================================== */

    ADMIN.updateUserStatus = async function (
        uid,
        status
    ) {

        if (
            !ADMIN.state.authorized
        ) {
            return false;
        }

        if (!uid) {
            return false;
        }

        const db =
            ADMIN.db();

        if (!db) {
            return false;
        }

        try {

            await db
                .collection(
                    ADMIN.collections.users
                )
                .doc(uid)
                .update({
                    status:
                        status,
                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

            RX.showToast(
                "User updated",
                "User status changed successfully.",
                "success"
            );

            return true;

        } catch (error) {

            console.error(
                error
            );

            RX.showToast(
                "Update failed",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return false;
        }
    };


    /* ========================================================
       UPDATE RIDER STATUS
       ======================================================== */

    ADMIN.updateRiderStatus = async function (
        riderId,
        status
    ) {

        if (
            !ADMIN.state.authorized
        ) {
            return false;
        }

        if (!riderId) {
            return false;
        }

        const db =
            ADMIN.db();

        if (!db) {
            return false;
        }

        try {

            await db
                .collection(
                    ADMIN.collections.riders
                )
                .doc(riderId)
                .update({
                    status:
                        status,

                    online:
                        status === "online",

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

            RX.showToast(
                "Rider updated",
                "Rider status changed successfully.",
                "success"
            );

            return true;

        } catch (error) {

            console.error(
                error
            );

            RX.showToast(
                "Update failed",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return false;
        }
    };


    /* ========================================================
       UPDATE RIDE STATUS
       ======================================================== */

    ADMIN.updateRideStatus = async function (
        rideId,
        status
    ) {

        if (
            !ADMIN.state.authorized
        ) {
            return false;
        }

        if (!rideId) {
            return false;
        }

        const db =
            ADMIN.db();

        if (!db) {
            return false;
        }

        try {

            await db
                .collection(
                    ADMIN.collections.rides
                )
                .doc(rideId)
                .update({
                    status:
                        status,

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

            RX.showToast(
                "Ride updated",
                "Ride status changed successfully.",
                "success"
            );

            return true;

        } catch (error) {

            console.error(
                error
            );

            RX.showToast(
                "Ride update failed",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return false;
        }
    };


    /* ========================================================
       SUPPORT
       ======================================================== */

    ADMIN.loadSupport = async function () {

        const db =
            ADMIN.db();

        if (!db) {
            return [];
        }

        try {

            const snapshot =
                await db
                    .collection(
                        ADMIN.collections.support
                    )
                    .orderBy(
                        "createdAt",
                        "desc"
                    )
                    .limit(100)
                    .get();

            const tickets = [];

            snapshot.forEach(
                function (doc) {

                    tickets.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            );

            ADMIN.state.support =
                tickets;

            ADMIN.renderSupport(
                tickets
            );

            return tickets;

        } catch (error) {

            console.error(
                "Support loading failed:",
                error
            );

            return [];
        }
    };


    /* ========================================================
       RENDER SUPPORT
       ======================================================== */

    ADMIN.renderSupport = function (
        tickets
    ) {

        document
            .querySelectorAll(
                "[data-support-list]"
            )
            .forEach(
                function (container) {

                    container.innerHTML = "";

                    if (!tickets.length) {

                        container.innerHTML =
                            ADMIN.emptyState(
                                "No support tickets."
                            );

                        return;
                    }

                    tickets.forEach(
                        function (ticket) {

                            const item =
                                document.createElement(
                                    "div"
                                );

                            item.className =
                                "rx-list-item";

                            item.innerHTML = `
                                <div class="rx-icon-box">
                                    ?
                                </div>

                                <div style="flex:1;">
                                    <div style="font-weight:800;">
                                        ${
                                            RX.escapeHTML(
                                                ticket.subject ||
                                                ticket.title ||
                                                "Support request"
                                            )
                                        }
                                    </div>

                                    <div class="rx-text-muted"
                                         style="font-size:10px;">
                                        ${
                                            RX.escapeHTML(
                                                ticket.message ||
                                                ""
                                            )
                                        }
                                    </div>
                                </div>

                                <span class="rx-badge ${
                                    ticket.status === "resolved"
                                        ? "success"
                                        : "warning"
                                }">
                                    ${
                                        RX.escapeHTML(
                                            ticket.status ||
                                            "open"
                                        )
                                    }
                                </span>
                            `;

                            container.appendChild(
                                item
                            );
                        }
                    );
                }
            );
    };


    /* ========================================================
       EMPTY STATE
       ======================================================== */

    ADMIN.emptyState = function (
        message
    ) {

        return `
            <div class="rx-empty">
                <div class="rx-empty-icon">
                    —
                </div>

                <div class="rx-empty-title">
                    ${RX.escapeHTML(message)}
                </div>
            </div>
        `;
    };


    /* ========================================================
       REALTIME RIDES
       ======================================================== */

    ADMIN.listenToRides = function () {

        const db =
            ADMIN.db();

        if (!db) {
            return null;
        }

        const unsubscribe =
            db
                .collection(
                    ADMIN.collections.rides
                )
                .orderBy(
                    "createdAt",
                    "desc"
                )
                .limit(100)
                .onSnapshot(
                    function (snapshot) {

                        const rides = [];

                        snapshot.forEach(
                            function (doc) {

                                rides.push({
                                    id: doc.id,
                                    ...doc.data()
                                });
                            }
                        );

                        ADMIN.state.rides =
                            rides;

                        ADMIN.renderRides(
                            rides
                        );

                    },
                    function (error) {

                        console.warn(
                            "Realtime rides listener:",
                            error
                        );
                    }
                );

        ADMIN.state.listeners.push(
            unsubscribe
        );

        return unsubscribe;
    };


    /* ========================================================
       REALTIME RIDERS
       ======================================================== */

    ADMIN.listenToRiders = function () {

        const db =
            ADMIN.db();

        if (!db) {
            return null;
        }

        const unsubscribe =
            db
                .collection(
                    ADMIN.collections.riders
                )
                .onSnapshot(
                    function (snapshot) {

                        const riders = [];

                        snapshot.forEach(
                            function (doc) {

                                riders.push({
                                    id: doc.id,
                                    ...doc.data()
                                });
                            }
                        );

                        ADMIN.state.riders =
                            riders;

                        ADMIN.renderRiders(
                            riders
                        );

                    },
                    function (error) {

                        console.warn(
                            "Realtime riders listener:",
                            error
                        );
                    }
                );

        ADMIN.state.listeners.push(
            unsubscribe
        );

        return unsubscribe;
    };


    /* ========================================================
       STOP LISTENERS
       ======================================================== */

    ADMIN.stopListeners = function () {

        ADMIN.state.listeners
            .forEach(
                function (unsubscribe) {

                    try {

                        if (
                            typeof unsubscribe ===
                            "function"
                        ) {

                            unsubscribe();
                        }

                    } catch (error) {

                        console.warn(error);
                    }
                }
            );

        ADMIN.state.listeners = [];
    };


    /* ========================================================
       DASHBOARD INITIALIZATION
       ======================================================== */

    ADMIN.initDashboard = async function () {

        ADMIN.waitForAuth();

        if (
            !ADMIN.state.authorized
        ) {
            return;
        }

        await Promise.all([
            ADMIN.loadStats(),
            ADMIN.loadCustomers({
                limit: 50
            }),
            ADMIN.loadRiders({
                limit: 50
            }),
            ADMIN.loadRides({
                limit: 100
            })
        ];

        ADMIN.listenToRides();
        ADMIN.listenToRiders();

        ADMIN.bindSearchInputs();
        ADMIN.bindAdminActions();
    };


    /* ========================================================
       SEARCH INPUTS
       ======================================================== */

    ADMIN.bindSearchInputs = function () {

        document
            .querySelectorAll(
                "[data-admin-search]"
            )
            .forEach(
                function (input) {

                    if (
                        input.dataset.rxBound ===
                        "true"
                    ) {
                        return;
                    }

                    input.dataset.rxBound =
                        "true";

                    input.addEventListener(
                        "input",
                        RX.debounce(
                            function () {

                                const type =
                                    input.dataset
                                        .adminSearch;

                                if (
                                    type ===
                                    "customers"
                                ) {

                                    ADMIN.searchCustomers(
                                        input.value
                                    );

                                } else if (
                                    type ===
                                    "riders"
                                ) {

                                    ADMIN.searchRiders(
                                        input.value
                                    );

                                } else if (
                                    type ===
                                    "rides"
                                ) {

                                    ADMIN.searchRides(
                                        input.value
                                    );
                                }

                            },
                            250
                        )
                    );
                }
            );
    };


    /* ========================================================
       ADMIN ACTIONS
       ======================================================== */

    ADMIN.bindAdminActions = function () {

        document
            .querySelectorAll(
                "[data-admin-action]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset.rxBound =
                        "true";

                    button.addEventListener(
                        "click",
                        async function () {

                            const action =
                                button.dataset
                                    .adminAction;

                            const id =
                                button.dataset.id;

                            if (
                                action ===
                                "block-user"
                            ) {

                                await ADMIN.updateUserStatus(
                                    id,
                                    "blocked"
                                );

                            } else if (
                                action ===
                                "activate-user"
                            ) {

                                await ADMIN.updateUserStatus(
                                    id,
                                    "active"
                                );

                            } else if (
                                action ===
                                "block-rider"
                            ) {

                                await ADMIN.updateRiderStatus(
                                    id,
                                    "blocked"
                                );

                            } else if (
                                action ===
                                "activate-rider"
                            ) {

                                await ADMIN.updateRiderStatus(
                                    id,
                                    "active"
                                );
                            }
                        }
                    );
                }
            );
    };


    /* ========================================================
       ADMIN INITIALIZATION
       ======================================================== */

    ADMIN.init = function () {

        if (
            typeof RX === "undefined"
        ) {
            return;
        }

        ADMIN.waitForAuth();

        window.addEventListener(
            "riderx-auth-changed",
            function () {

                if (
                    ADMIN.state.authorized
                ) {

                    ADMIN.updateAdminUI();
                }
            }
        );

        console.log(
            "RiderX Admin module loaded."
        );
    };


    /* ========================================================
       PAGE AUTO INIT
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                ADMIN.init();
            }
        );

    } else {

        ADMIN.init();
    }


    /* ========================================================
       CLEANUP
       ======================================================== */

    window.addEventListener(
        "beforeunload",
        function () {

            ADMIN.stopListeners();
        }
    );

})();

Important: Is file me admin ko sirf frontend se trusted nahi maana gaya hai. Final project me Firestore Security Rules bhi admin role ke according lock karenge, taaki koi normal customer URL change karke admin data access na kar sake.

Ab next file "js/booking.js" hogi. Isme RiderX ka main Uber-style booking engine banega: pickup → destination → map route → fare estimate → service selection → rider matching → ride request → accept → live ride status.
