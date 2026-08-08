/* ============================================================
   RIDERX
   ADMIN CUSTOMERS ENGINE
   File: js/admin-customers.js

   Handles:
   - Customer listing
   - Search
   - Filter
   - Customer details
   - Active / blocked status
   - Block / unblock
   - Customer statistics
   - Ride count
   - Admin notifications
   - Firebase Realtime Database / Firestore support
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AC =
        RX.adminCustomers =
        RX.adminCustomers || {};

    AC.state = {

        initialized: false,

        customers: [],

        filteredCustomers: [],

        selectedCustomer: null,

        search: "",

        filter: "all",

        loading: false
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    AC.getDatabase = function () {

        try {

            if (
                window.firebase &&
                firebase.database
            ) {

                return firebase.database();
            }

        } catch (error) {

            console.warn(
                "Admin customers database error:",
                error
            );
        }

        return null;
    };


    AC.getFirestore = function () {

        try {

            if (
                window.firebase &&
                firebase.firestore
            ) {

                return firebase.firestore();
            }

        } catch (error) {

            console.warn(
                "Firestore unavailable:",
                error
            );
        }

        return null;
    };


    AC.getUser = function () {

        try {

            if (
                window.firebase &&
                firebase.auth
            ) {

                return firebase.auth()
                    .currentUser;
            }

        } catch (error) {
            /* Continue */
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


    AC.getUserId = function () {

        const user =
            AC.getUser();

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


    AC.isAdmin = function () {

        const user =
            AC.getUser();


        if (!user) {
            return false;
        }


        const role =
            String(
                user.role ||
                user.userRole ||
                localStorage.getItem(
                    "riderx_role"
                ) ||
                ""
            ).toLowerCase();


        return (
            role === "admin" ||
            role === "superadmin" ||
            role === "super_admin"
        );
    };


    AC.escape = function (
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


    AC.normalizeCustomer = function (
        data,
        id
    ) {

        data =
            data || {};


        return {

            id:
                data.id ||
                data.uid ||
                id,

            uid:
                data.uid ||
                data.id ||
                id,

            name:
                data.name ||
                data.displayName ||
                data.fullName ||
                "Customer",

            email:
                data.email ||
                "",

            phone:
                data.phone ||
                data.mobile ||
                "",

            photo:
                data.photo ||
                data.photoURL ||
                data.profileImage ||
                "",

            role:
                "customer",

            status:
                data.status ||
                (
                    data.blocked
                        ? "blocked"
                        : "active"
                ),

            blocked:
                Boolean(
                    data.blocked
                ),

            verified:
                Boolean(
                    data.verified ||
                    data.emailVerified ||
                    data.phoneVerified
                ),

            createdAt:
                data.createdAt ||
                data.created_at ||
                null,

            updatedAt:
                data.updatedAt ||
                data.updated_at ||
                null,

            rideCount:
                Number(
                    data.rideCount ||
                    data.totalRides ||
                    0
                ),

            completedRides:
                Number(
                    data.completedRides ||
                    0
                ),

            cancelledRides:
                Number(
                    data.cancelledRides ||
                    0
                ),

            totalSpent:
                Number(
                    data.totalSpent ||
                    data.totalFare ||
                    0
                ),

            walletBalance:
                Number(
                    data.walletBalance ||
                    0
                ),

            rating:
                Number(
                    data.rating ||
                    0
                ),

            online:
                Boolean(
                    data.online
                )
        };
    };


    /* ========================================================
       LOAD CUSTOMERS
       ======================================================== */

    AC.load = async function () {

        if (
            !AC.isAdmin()
        ) {

            AC.showMessage(
                "Admin access required.",
                true
            );

            return [];
        }


        AC.state.loading =
            true;

        AC.renderLoading();


        let customers = [];


        /*
         * First try Realtime Database.
         */

        const database =
            AC.getDatabase();


        if (database) {

            try {

                const snapshot =
                    await database
                        .ref(
                            "users"
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                Object.keys(
                    data
                ).forEach(
                    function (
                        id
                    ) {

                        const user =
                            data[id];


                        const role =
                            String(
                                user.role ||
                                user.userRole ||
                                ""
                            ).toLowerCase();


                        if (
                            role ===
                            "customer" ||
                            role ===
                            "user"
                        ) {

                            customers.push(
                                AC.normalizeCustomer(
                                    user,
                                    id
                                )
                            );
                        }
                    }
                );

            } catch (error) {

                console.warn(
                    "Realtime customer load failed:",
                    error
                );
            }
        }


        /*
         * Firestore fallback.
         */

        if (
            !customers.length
        ) {

            const firestore =
                AC.getFirestore();


            if (firestore) {

                try {

                    const snapshot =
                        await firestore
                            .collection(
                                "users"
                            )
                            .where(
                                "role",
                                "in",
                                [
                                    "customer",
                                    "user"
                                ]
                            )
                            .get();


                    snapshot.forEach(
                        function (
                            document
                        ) {

                            customers.push(
                                AC.normalizeCustomer(
                                    document.data(),
                                    document.id
                                )
                            );
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Firestore customer load failed:",
                        error
                    );
                }
            }
        }


        /*
         * Remove duplicates.
         */

        const unique =
            new Map();


        customers.forEach(
            function (
                customer
            ) {

                if (
                    customer.id
                ) {

                    unique.set(
                        customer.id,
                        customer
                    );
                }
            }
        );


        AC.state.customers =
            Array.from(
                unique.values()
            );


        AC.state.loading =
            false;


        AC.applyFilters();

        AC.updateStats();


        return AC.state.customers;
    };


    /* ========================================================
       FILTER
       ======================================================== */

    AC.applyFilters = function () {

        const search =
            AC.state.search
                .trim()
                .toLowerCase();


        const filter =
            AC.state.filter;


        AC.state.filteredCustomers =
            AC.state.customers
                .filter(
                    function (
                        customer
                    ) {

                        let matchesSearch =
                            true;


                        if (
                            search
                        ) {

                            const text =
                                [
                                    customer.name,
                                    customer.email,
                                    customer.phone,
                                    customer.id
                                ]
                                    .join(" ")
                                    .toLowerCase();


                            matchesSearch =
                                text.includes(
                                    search
                                );
                        }


                        let matchesFilter =
                            true;


                        if (
                            filter ===
                            "active"
                        ) {

                            matchesFilter =
                                !customer.blocked;

                        } else if (
                            filter ===
                            "blocked"
                        ) {

                            matchesFilter =
                                customer.blocked;

                        } else if (
                            filter ===
                            "verified"
                        ) {

                            matchesFilter =
                                customer.verified;
                        }


                        return (
                            matchesSearch &&
                            matchesFilter
                        );
                    }
                );


        AC.render();
    };


    AC.setSearch = function (
        value
    ) {

        AC.state.search =
            String(
                value || ""
            );

        AC.applyFilters();
    };


    AC.setFilter = function (
        value
    ) {

        AC.state.filter =
            value ||
            "all";

        AC.applyFilters();
    };


    /* ========================================================
       CUSTOMER DETAILS
       ======================================================== */

    AC.getCustomer = function (
        customerId
    ) {

        return AC.state.customers
            .find(
                function (
                    customer
                ) {

                    return (
                        customer.id ===
                        customerId
                    );
                }
            ) || null;
    };


    AC.select = function (
        customerId
    ) {

        const customer =
            AC.getCustomer(
                customerId
            );


        if (!customer) {
            return null;
        }


        AC.state.selectedCustomer =
            customer;


        AC.renderDetails(
            customer
        );


        return customer;
    };


    /* ========================================================
       BLOCK / UNBLOCK
       ======================================================== */

    AC.setBlocked = async function (
        customerId,
        blocked
    ) {

        if (
            !AC.isAdmin()
        ) {

            throw new Error(
                "Admin access required."
            );
        }


        const customer =
            AC.getCustomer(
                customerId
            );


        if (!customer) {

            throw new Error(
                "Customer not found."
            );
        }


        const database =
            AC.getDatabase();


        const firestore =
            AC.getFirestore();


        /*
         * Realtime Database.
         */

        if (database) {

            try {

                await database
                    .ref(
                        "users/" +
                        customerId
                    )
                    .update({

                        blocked:
                            Boolean(
                                blocked
                            ),

                        status:
                            blocked
                                ? "blocked"
                                : "active",

                        updatedAt:
                            Date.now()
                    });

            } catch (error) {

                console.warn(
                    "RTDB block update failed:",
                    error
                );
            }
        }


        /*
         * Firestore.
         */

        if (firestore) {

            try {

                await firestore
                    .collection(
                        "users"
                    )
                    .doc(
                        customerId
                    )
                    .set(
                        {

                            blocked:
                                Boolean(
                                    blocked
                                ),

                            status:
                                blocked
                                    ? "blocked"
                                    : "active",

                            updatedAt:
                                Date.now()

                        },
                        {
                            merge:
                                true
                        }
                    );

            } catch (error) {

                console.warn(
                    "Firestore block update failed:",
                    error
                );
            }
        }


        customer.blocked =
            Boolean(
                blocked
            );


        customer.status =
            blocked
                ? "blocked"
                : "active";


        AC.applyFilters();


        /*
         * Notify customer.
         */

        await AC.notifyCustomer(
            customerId,
            blocked
                ? "Your RiderX account has been blocked by administration."
                : "Your RiderX account has been restored."
        );


        AC.showMessage(
            blocked
                ? "Customer blocked."
                : "Customer unblocked."
        );


        return true;
    };


    AC.block = function (
        customerId
    ) {

        return AC.setBlocked(
            customerId,
            true
        );
    };


    AC.unblock = function (
        customerId
    ) {

        return AC.setBlocked(
            customerId,
            false
        );
    };


    /* ========================================================
       DELETE CUSTOMER
       ======================================================== */

    AC.deleteCustomer = async function (
        customerId
    ) {

        if (
            !AC.isAdmin()
        ) {

            throw new Error(
                "Admin access required."
            );
        }


        const database =
            AC.getDatabase();


        const firestore =
            AC.getFirestore();


        if (database) {

            try {

                await database
                    .ref(
                        "users/" +
                        customerId
                    )
                    .remove();

            } catch (error) {

                console.warn(
                    "RTDB customer delete failed:",
                    error
                );
            }
        }


        if (firestore) {

            try {

                await firestore
                    .collection(
                        "users"
                    )
                    .doc(
                        customerId
                    )
                    .delete();

            } catch (error) {

                console.warn(
                    "Firestore customer delete failed:",
                    error
                );
            }
        }


        AC.state.customers =
            AC.state.customers
                .filter(
                    function (
                        customer
                    ) {

                        return (
                            customer.id !==
                            customerId
                        );
                    }
                );


        AC.applyFilters();

        AC.showMessage(
            "Customer removed."
        );


        return true;
    };


    /* ========================================================
       CUSTOMER NOTIFICATION
       ======================================================== */

    AC.notifyCustomer = async function (
        customerId,
        message,
        options = {}
    ) {

        if (!customerId) {
            return false;
        }


        const notification = {

            id:
                "admin_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8),

            userId:
                customerId,

            recipientId:
                customerId,

            recipientRole:
                "customer",

            senderId:
                AC.getUserId(),

            senderRole:
                "admin",

            title:
                options.title ||
                "RiderX Notification",

            message:
                message,

            type:
                options.type ||
                "admin",

            read:
                false,

            createdAt:
                Date.now(),

            timestamp:
                Date.now()
        };


        const database =
            AC.getDatabase();


        if (database) {

            try {

                await database
                    .ref(
                        "notifications/" +
                        customerId +
                        "/" +
                        notification.id
                    )
                    .set(
                        notification
                    );


                /*
                 * Also maintain global admin
                 * notification record.
                 */

                await database
                    .ref(
                        "adminNotifications/" +
                        notification.id
                    )
                    .set(
                        notification
                    );


                return true;

            } catch (error) {

                console.error(
                    "Customer notification failed:",
                    error
                );
            }
        }


        /*
         * Existing notification engine.
         */

        try {

            if (
                RX.notify &&
                typeof RX.notify.send ===
                "function"
            ) {

                await RX.notify.send(
                    customerId,
                    notification
                );

                return true;
            }

        } catch (error) {

            console.warn(
                "Notification engine failed:",
                error
            );
        }


        return false;
    };


    /* ========================================================
       SEND CUSTOM NOTIFICATION
       ======================================================== */

    AC.sendNotification = async function (
        customerId,
        title,
        message
    ) {

        return AC.notifyCustomer(
            customerId,
            message,
            {
                title:
                    title ||
                    "RiderX Admin"
            }
        );
    };


    /* ========================================================
       STATISTICS
       ======================================================== */

    AC.updateStats = function () {

        const customers =
            AC.state.customers;


        const total =
            customers.length;


        const active =
            customers.filter(
                function (
                    customer
                ) {

                    return !customer.blocked;
                }
            ).length;


        const blocked =
            customers.filter(
                function (
                    customer
                ) {

                    return customer.blocked;
                }
            ).length;


        const verified =
            customers.filter(
                function (
                    customer
                ) {

                    return customer.verified;
                }
            ).length;


        document
            .querySelectorAll(
                "[data-customer-total]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        total;
                }
            );


        document
            .querySelectorAll(
                "[data-customer-active]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        active;
                }
            );


        document
            .querySelectorAll(
                "[data-customer-blocked]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        blocked;
                }
            );


        document
            .querySelectorAll(
                "[data-customer-verified]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        verified;
                }
            );
    };


    /* ========================================================
       RENDER LOADING
       ======================================================== */

    AC.renderLoading = function () {

        document
            .querySelectorAll(
                "[data-customers-list]"
            )
            .forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        `
                        <div class="admin-loading">
                            <div class="loading-spinner"></div>
                            <p>Loading customers...</p>
                        </div>
                        `;
                }
            );
    };


    /* ========================================================
       RENDER CUSTOMER LIST
       ======================================================== */

    AC.render = function () {

        document
            .querySelectorAll(
                "[data-customers-list]"
            )
            .forEach(
                function (
                    container
                ) {


                    const customers =
                        AC.state
                            .filteredCustomers;


                    if (
                        !customers.length
                    ) {

                        container.innerHTML =
                            `
                            <div class="admin-empty">
                                <div class="admin-empty-icon">
                                    👤
                                </div>

                                <h3>
                                    No customers found
                                </h3>

                                <p>
                                    Try changing your search or filter.
                                </p>
                            </div>
                            `;

                        return;
                    }


                    container.innerHTML =
                        customers
                            .map(
                                function (
                                    customer
                                ) {

                                    const avatar =
                                        customer.photo ||
                                        "";


                                    return `
                                    <div
                                        class="admin-customer-row"
                                        data-customer-id="${AC.escape(customer.id)}"
                                    >

                                        <div class="customer-avatar">

                                            ${
                                                avatar
                                                    ? `
                                                    <img
                                                        src="${AC.escape(avatar)}"
                                                        alt=""
                                                    >
                                                    `
                                                    : `
                                                    <span>
                                                        ${AC.escape(
                                                            customer.name
                                                                .charAt(0)
                                                                .toUpperCase()
                                                        )}
                                                    </span>
                                                    `
                                            }

                                        </div>


                                        <div class="customer-info">

                                            <strong>
                                                ${AC.escape(
                                                    customer.name
                                                )}
                                            </strong>

                                            <span>
                                                ${AC.escape(
                                                    customer.phone ||
                                                    customer.email ||
                                                    "No contact"
                                                )}
                                            </span>

                                        </div>


                                        <div class="customer-status">

                                            <span class="
                                                status-badge
                                                ${
                                                    customer.blocked
                                                        ? "blocked"
                                                        : "active"
                                                }
                                            ">

                                                ${
                                                    customer.blocked
                                                        ? "Blocked"
                                                        : "Active"
                                                }

                                            </span>

                                        </div>


                                        <div class="customer-actions">

                                            <button
                                                type="button"
                                                data-customer-view="${AC.escape(customer.id)}"
                                            >
                                                View
                                            </button>

                                            <button
                                                type="button"
                                                data-customer-notify="${AC.escape(customer.id)}"
                                            >
                                                Notify
                                            </button>

                                            ${
                                                customer.blocked
                                                    ? `
                                                    <button
                                                        type="button"
                                                        data-customer-unblock="${AC.escape(customer.id)}"
                                                    >
                                                        Unblock
                                                    </button>
                                                    `
                                                    : `
                                                    <button
                                                        type="button"
                                                        data-customer-block="${AC.escape(customer.id)}"
                                                    >
                                                        Block
                                                    </button>
                                                    `
                                            }

                                        </div>

                                    </div>
                                    `;
                                }
                            )
                            .join("");
                }
            );


        AC.updateStats();
    };


    /* ========================================================
       RENDER DETAILS
       ======================================================== */

    AC.renderDetails = function (
        customer
    ) {

        document
            .querySelectorAll(
                "[data-customer-detail]"
            )
            .forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        `
                        <div class="customer-detail-card">

                            <div class="customer-detail-avatar">

                                ${
                                    customer.photo
                                        ? `
                                        <img
                                            src="${AC.escape(customer.photo)}"
                                            alt=""
                                        >
                                        `
                                        : `
                                        <span>
                                            ${AC.escape(
                                                customer.name
                                                    .charAt(0)
                                                    .toUpperCase()
                                            )}
                                        </span>
                                        `
                                }

                            </div>


                            <h2>
                                ${AC.escape(
                                    customer.name
                                )}
                            </h2>


                            <p>
                                ${AC.escape(
                                    customer.email ||
                                    "No email"
                                )}
                            </p>


                            <p>
                                ${AC.escape(
                                    customer.phone ||
                                    "No phone"
                                )}
                            </p>


                            <div class="customer-detail-stats">

                                <div>
                                    <strong>
                                        ${customer.rideCount}
                                    </strong>
                                    <span>Rides</span>
                                </div>

                                <div>
                                    <strong>
                                        ${customer.completedRides}
                                    </strong>
                                    <span>Completed</span>
                                </div>

                                <div>
                                    <strong>
                                        ${customer.cancelledRides}
                                    </strong>
                                    <span>Cancelled</span>
                                </div>

                                <div>
                                    <strong>
                                        ₹${customer.totalSpent.toFixed(0)}
                                    </strong>
                                    <span>Spent</span>
                                </div>

                            </div>


                            <div class="customer-detail-actions">

                                <button
                                    type="button"
                                    data-customer-notify="${AC.escape(customer.id)}"
                                >
                                    Send Notification
                                </button>


                                ${
                                    customer.blocked
                                        ? `
                                        <button
                                            type="button"
                                            data-customer-unblock="${AC.escape(customer.id)}"
                                        >
                                            Unblock Customer
                                        </button>
                                        `
                                        : `
                                        <button
                                            type="button"
                                            data-customer-block="${AC.escape(customer.id)}"
                                        >
                                            Block Customer
                                        </button>
                                        `
                                }

                            </div>

                        </div>
                        `;
                }
            );
    };


    /* ========================================================
       EVENT HANDLERS
       ======================================================== */

    AC.bindEvents = function () {

        document.addEventListener(
            "input",
            function (
                event
            ) {

                const input =
                    event.target.closest(
                        "[data-customer-search]"
                    );


                if (!input) {
                    return;
                }


                AC.setSearch(
                    input.value
                );
            }
        );


        document.addEventListener(
            "change",
            function (
                event
            ) {

                const filter =
                    event.target.closest(
                        "[data-customer-filter]"
                    );


                if (!filter) {
                    return;
                }


                AC.setFilter(
                    filter.value
                );
            }
        );


        document.addEventListener(
            "click",
            async function (
                event
            ) {

                const view =
                    event.target.closest(
                        "[data-customer-view]"
                    );


                if (view) {

                    event.preventDefault();

                    AC.select(
                        view.dataset
                            .customerView
                    );

                    return;
                }


                const block =
                    event.target.closest(
                        "[data-customer-block]"
                    );


                if (block) {

                    event.preventDefault();

                    const id =
                        block.dataset
                            .customerBlock;


                    try {

                        await AC.block(
                            id
                        );

                    } catch (error) {

                        AC.showMessage(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const unblock =
                    event.target.closest(
                        "[data-customer-unblock]"
                    );


                if (unblock) {

                    event.preventDefault();

                    const id =
                        unblock.dataset
                            .customerUnblock;


                    try {

                        await AC.unblock(
                            id
                        );

                    } catch (error) {

                        AC.showMessage(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const notify =
                    event.target.closest(
                        "[data-customer-notify]"
                    );


                if (notify) {

                    event.preventDefault();


                    const id =
                        notify.dataset
                            .customerNotify;


                    AC.openNotificationPrompt(
                        id
                    );
                }
            }
        );
    };


    /* ========================================================
       NOTIFICATION PROMPT
       ======================================================== */

    AC.openNotificationPrompt =
        function (
            customerId
        ) {

            const title =
                window.prompt(
                    "Notification title:",
                    "RiderX Admin"
                );


            if (
                title === null
            ) {
                return;
            }


            const message =
                window.prompt(
                    "Notification message:"
                );


            if (
                message === null ||
                !message.trim()
            ) {
                return;
            }


            AC.sendNotification(
                customerId,
                title,
                message
            )
                .then(
                    function () {

                        AC.showMessage(
                            "Notification sent."
                        );
                    }
                )
                .catch(
                    function (
                        error
                    ) {

                        AC.showMessage(
                            error.message,
                            true
                        );
                    }
                );
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    AC.showMessage = function (
        message,
        error = false
    ) {

        const old =
            document.querySelector(
                ".riderx-admin-message"
            );


        if (old) {
            old.remove();
        }


        const element =
            document.createElement(
                "div"
            );


        element.className =
            "riderx-admin-message " +
            (
                error
                    ? "error"
                    : "success"
            );


        element.textContent =
            message;


        document.body.appendChild(
            element
        );


        setTimeout(
            function () {

                element.remove();

            },
            3000
        );
    };


    /* ========================================================
       REFRESH
       ======================================================== */

    AC.refresh = function () {

        return AC.load();
    };


    /* ========================================================
       INIT
       ======================================================== */

    AC.init = function () {

        if (
            AC.state.initialized
        ) {
            return;
        }


        AC.bindEvents();


        AC.state.initialized =
            true;


        /*
         * Only load automatically on
         * admin customer pages.
         */

        const page =
            document.body
                ? document.body.dataset
                    .page
                : "";


        if (
            page ===
            "admin-customers" ||
            document.querySelector(
                "[data-customers-list]"
            )
        ) {

            AC.load();
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-admin-customers-ready"
            )
        );


        console.log(
            "RiderX admin-customers.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.loadCustomers =
        function () {

            return AC.load();
        };


    RX.blockCustomer =
        function (
            customerId
        ) {

            return AC.block(
                customerId
            );
        };


    RX.unblockCustomer =
        function (
            customerId
        ) {

            return AC.unblock(
                customerId
            );
        };


    RX.notifyCustomer =
        function (
            customerId,
            title,
            message
        ) {

            return AC.sendNotification(
                customerId,
                title,
                message
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
            AC.init
        );

    } else {

        AC.init();
    }

})();
