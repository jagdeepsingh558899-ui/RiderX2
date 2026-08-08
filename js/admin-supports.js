/* ============================================================
   RIDERX
   ADMIN SUPPORT ENGINE
   File: js/admin-supports.js

   Handles:
   - Customer/Rider support tickets
   - Ticket listing
   - Search & filters
   - Open / pending / resolved / closed
   - Priority
   - Admin replies
   - Ticket assignment
   - Rider/customer notifications
   - Firebase RTDB + Firestore
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AS =
        RX.adminSupports =
        RX.adminSupports || {};

    AS.state = {
        initialized: false,
        loading: false,
        tickets: [],
        filtered: [],
        selected: null,
        search: "",
        filter: "all",
        priority: "all"
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    AS.database = function () {

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
                "Support RTDB error:",
                error
            );
        }

        return null;
    };


    AS.firestore = function () {

        try {

            if (
                window.firebase &&
                typeof firebase.firestore ===
                "function"
            ) {
                return firebase.firestore();
            }

        } catch (error) {
            console.warn(
                "Support Firestore error:",
                error
            );
        }

        return null;
    };


    AS.currentUser = function () {

        try {

            if (
                window.firebase &&
                firebase.auth
            ) {

                const user =
                    firebase.auth()
                        .currentUser;

                if (user) {
                    return user;
                }
            }

        } catch (error) {
            /* fallback */
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


    AS.adminId = function () {

        const user =
            AS.currentUser();

        if (!user) {
            return null;
        }

        return (
            user.uid ||
            user.id ||
            user.userId ||
            null
        );
    };


    AS.isAdmin = function () {

        const user =
            AS.currentUser();

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


    /* ========================================================
       HELPERS
       ======================================================== */

    AS.escape = function (
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


    AS.number = function (
        value
    ) {

        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
            : 0;
    };


    AS.normalize = function (
        data,
        id
    ) {

        data =
            data || {};


        return {

            id:
                data.id ||
                data.ticketId ||
                id,

            ticketId:
                data.ticketId ||
                data.id ||
                id,

            userId:
                data.userId ||
                data.customerId ||
                data.riderId ||
                "",

            userRole:
                String(
                    data.userRole ||
                    data.role ||
                    "customer"
                ).toLowerCase(),

            userName:
                data.userName ||
                data.name ||
                data.customerName ||
                data.riderName ||
                "User",

            userPhone:
                data.userPhone ||
                data.phone ||
                "",

            userEmail:
                data.userEmail ||
                data.email ||
                "",

            subject:
                data.subject ||
                "Support request",

            message:
                data.message ||
                data.description ||
                "",

            category:
                data.category ||
                "general",

            status:
                data.status ||
                "open",

            priority:
                data.priority ||
                "normal",

            assignedTo:
                data.assignedTo ||
                "",

            assignedName:
                data.assignedName ||
                "",

            rideId:
                data.rideId ||
                "",

            bookingId:
                data.bookingId ||
                "",

            createdAt:
                data.createdAt ||
                data.timestamp ||
                Date.now(),

            updatedAt:
                data.updatedAt ||
                data.timestamp ||
                Date.now(),

            messages:
                Array.isArray(
                    data.messages
                )
                    ? data.messages
                    : [],

            unread:
                Boolean(
                    data.unread
                )
        };
    };


    /* ========================================================
       LOAD TICKETS
       ======================================================== */

    AS.load = async function () {

        if (
            !AS.isAdmin()
        ) {

            AS.message(
                "Admin access required.",
                true
            );

            return [];
        }


        AS.state.loading =
            true;

        AS.renderLoading();


        let tickets = [];


        /*
         * Realtime Database
         */

        const database =
            AS.database();


        if (database) {

            try {

                const snapshot =
                    await database
                        .ref(
                            "supportTickets"
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

                        tickets.push(
                            AS.normalize(
                                data[id],
                                id
                            )
                        );
                    }
                );

            } catch (error) {

                console.warn(
                    "RTDB support load failed:",
                    error
                );
            }
        }


        /*
         * Firestore fallback
         */

        if (
            !tickets.length
        ) {

            const firestore =
                AS.firestore();


            if (firestore) {

                try {

                    const snapshot =
                        await firestore
                            .collection(
                                "supportTickets"
                            )
                            .get();


                    snapshot.forEach(
                        function (
                            doc
                        ) {

                            tickets.push(
                                AS.normalize(
                                    doc.data(),
                                    doc.id
                                )
                            );
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Firestore support load failed:",
                        error
                    );
                }
            }
        }


        /*
         * Remove duplicate tickets.
         */

        const unique =
            new Map();


        tickets.forEach(
            function (
                ticket
            ) {

                if (
                    ticket.id
                ) {

                    unique.set(
                        ticket.id,
                        ticket
                    );
                }
            }
        );


        AS.state.tickets =
            Array.from(
                unique.values()
            )
            .sort(
                function (
                    a,
                    b
                ) {

                    return (
                        AS.number(
                            b.updatedAt
                        ) -
                        AS.number(
                            a.updatedAt
                        )
                    );
                }
            );


        AS.state.loading =
            false;


        AS.applyFilters();


        return AS.state.tickets;
    };


    /* ========================================================
       FILTER
       ======================================================== */

    AS.applyFilters = function () {

        const search =
            AS.state.search
                .trim()
                .toLowerCase();


        const status =
            AS.state.filter;


        const priority =
            AS.state.priority;


        AS.state.filtered =
            AS.state.tickets
                .filter(
                    function (
                        ticket
                    ) {

                        let searchMatch =
                            true;


                        if (
                            search
                        ) {

                            const text =
                                [
                                    ticket.ticketId,
                                    ticket.userName,
                                    ticket.userPhone,
                                    ticket.userEmail,
                                    ticket.subject,
                                    ticket.category,
                                    ticket.rideId,
                                    ticket.bookingId
                                ]
                                    .join(" ")
                                    .toLowerCase();


                            searchMatch =
                                text.includes(
                                    search
                                );
                        }


                        let statusMatch =
                            true;


                        if (
                            status !==
                            "all"
                        ) {

                            statusMatch =
                                ticket.status ===
                                status;
                        }


                        let priorityMatch =
                            true;


                        if (
                            priority !==
                            "all"
                        ) {

                            priorityMatch =
                                ticket.priority ===
                                priority;
                        }


                        return (
                            searchMatch &&
                            statusMatch &&
                            priorityMatch
                        );
                    }
                );


        AS.render();

        AS.updateStats();
    };


    AS.search = function (
        value
    ) {

        AS.state.search =
            String(
                value || ""
            );

        AS.applyFilters();
    };


    AS.filter = function (
        value
    ) {

        AS.state.filter =
            value ||
            "all";

        AS.applyFilters();
    };


    AS.setPriorityFilter =
        function (
            value
        ) {

            AS.state.priority =
                value ||
                "all";

            AS.applyFilters();
        };


    /* ========================================================
       GET TICKET
       ======================================================== */

    AS.get = function (
        ticketId
    ) {

        return AS.state.tickets
            .find(
                function (
                    ticket
                ) {

                    return (
                        ticket.id ===
                        ticketId
                    );
                }
            ) || null;
    };


    AS.select = function (
        ticketId
    ) {

        const ticket =
            AS.get(
                ticketId
            );


        if (!ticket) {
            return null;
        }


        AS.state.selected =
            ticket;


        AS.renderDetails(
            ticket
        );


        return ticket;
    };


    /* ========================================================
       SAVE TICKET
       ======================================================== */

    AS.save = async function (
        ticketId,
        changes
    ) {

        if (
            !AS.isAdmin()
        ) {

            throw new Error(
                "Admin access required."
            );
        }


        const payload = {

            ...changes,

            updatedAt:
                Date.now(),

            updatedBy:
                AS.adminId()
        };


        let success =
            false;


        const database =
            AS.database();


        if (database) {

            try {

                await database
                    .ref(
                        "supportTickets/" +
                        ticketId
                    )
                    .update(
                        payload
                    );

                success =
                    true;

            } catch (error) {

                console.warn(
                    "RTDB support update failed:",
                    error
                );
            }
        }


        const firestore =
            AS.firestore();


        if (firestore) {

            try {

                await firestore
                    .collection(
                        "supportTickets"
                    )
                    .doc(
                        ticketId
                    )
                    .set(
                        payload,
                        {
                            merge:
                                true
                        }
                    );

                success =
                    true;

            } catch (error) {

                console.warn(
                    "Firestore support update failed:",
                    error
                );
            }
        }


        if (success) {

            const ticket =
                AS.get(
                    ticketId
                );


            if (ticket) {

                Object.assign(
                    ticket,
                    changes
                );

                ticket.updatedAt =
                    payload.updatedAt;
            }


            AS.applyFilters();
        }


        return success;
    };


    /* ========================================================
       STATUS
       ======================================================== */

    AS.setStatus = async function (
        ticketId,
        status
    ) {

        const allowed = [
            "open",
            "pending",
            "resolved",
            "closed"
        ];


        if (
            !allowed.includes(
                status
            )
        ) {

            throw new Error(
                "Invalid support status."
            );
        }


        const success =
            await AS.save(
                ticketId,
                {
                    status:
                        status
                }
            );


        if (success) {

            const ticket =
                AS.get(
                    ticketId
                );


            if (ticket) {

                await AS.notifyUser(
                    ticket,
                    "Support ticket updated",
                    "Your support ticket status is now: " +
                    status
                );
            }


            AS.message(
                "Ticket status updated."
            );
        }


        return success;
    };


    /* ========================================================
       PRIORITY
       ======================================================== */

    AS.setPriority = async function (
        ticketId,
        priority
    ) {

        const allowed = [
            "low",
            "normal",
            "high",
            "urgent"
        ];


        if (
            !allowed.includes(
                priority
            )
        ) {

            throw new Error(
                "Invalid priority."
            );
        }


        const success =
            await AS.save(
                ticketId,
                {
                    priority:
                        priority
                }
            );


        if (success) {

            AS.message(
                "Ticket priority updated."
            );
        }


        return success;
    };


    /* ========================================================
       ASSIGN TICKET
       ======================================================== */

    AS.assign = async function (
        ticketId,
        adminId,
        adminName
    ) {

        const success =
            await AS.save(
                ticketId,
                {

                    assignedTo:
                        adminId ||
                        AS.adminId(),

                    assignedName:
                        adminName ||
                        "Admin"
                }
            );


        if (success) {

            AS.message(
                "Ticket assigned."
            );
        }


        return success;
    };


    /* ========================================================
       ADMIN REPLY
       ======================================================== */

    AS.reply = async function (
        ticketId,
        message
    ) {

        message =
            String(
                message ||
                ""
            ).trim();


        if (!message) {

            throw new Error(
                "Reply message cannot be empty."
            );
        }


        const ticket =
            AS.get(
                ticketId
            );


        if (!ticket) {

            throw new Error(
                "Support ticket not found."
            );
        }


        const reply = {

            id:
                "msg_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8),

            senderId:
                AS.adminId(),

            senderRole:
                "admin",

            senderName:
                "RiderX Support",

            message:
                message,

            createdAt:
                Date.now()
        };


        const messages =
            Array.isArray(
                ticket.messages
            )
                ? [
                    ...ticket.messages,
                    reply
                ]
                : [
                    reply
                ];


        const success =
            await AS.save(
                ticketId,
                {

                    messages:
                        messages,

                    status:
                        "pending",

                    unread:
                        true
                }
            );


        if (success) {

            await AS.notifyUser(
                ticket,

                "RiderX Support",

                message
            );


            AS.message(
                "Reply sent."
            );
        }


        return success;
    };


    /* ========================================================
       NOTIFY USER
       ======================================================== */

    AS.notifyUser = async function (
        ticket,
        title,
        message
    ) {

        if (
            !ticket ||
            !ticket.userId
        ) {
            return false;
        }


        const notification = {

            id:
                "support_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8),

            userId:
                ticket.userId,

            recipientId:
                ticket.userId,

            recipientRole:
                ticket.userRole,

            senderRole:
                "admin",

            senderId:
                AS.adminId(),

            title:
                title,

            message:
                message,

            type:
                "support",

            ticketId:
                ticket.ticketId,

            read:
                false,

            createdAt:
                Date.now(),

            timestamp:
                Date.now()
        };


        const database =
            AS.database();


        if (database) {

            try {

                await database
                    .ref(
                        "notifications/" +
                        ticket.userId +
                        "/" +
                        notification.id
                    )
                    .set(
                        notification
                    );


                await database
                    .ref(
                        "supportNotifications/" +
                        notification.id
                    )
                    .set(
                        notification
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Support notification failed:",
                    error
                );
            }
        }


        try {

            if (
                RX.notify &&
                typeof RX.notify.send ===
                "function"
            ) {

                await RX.notify.send(
                    ticket.userId,
                    notification
                );

                return true;
            }

        } catch (error) {

            console.warn(
                "Notification engine error:",
                error
            );
        }


        return false;
    };


    /* ========================================================
       CLOSE TICKET
       ======================================================== */

    AS.close = function (
        ticketId
    ) {

        return AS.setStatus(
            ticketId,
            "closed"
        );
    };


    /* ========================================================
       RESOLVE TICKET
       ======================================================== */

    AS.resolve = function (
        ticketId
    ) {

        return AS.setStatus(
            ticketId,
            "resolved"
        );
    };


    /* ========================================================
       REOPEN TICKET
       ======================================================== */

    AS.reopen = function (
        ticketId
    ) {

        return AS.setStatus(
            ticketId,
            "open"
        );
    };


    /* ========================================================
       STATISTICS
       ======================================================== */

    AS.updateStats = function () {

        const tickets =
            AS.state.tickets;


        const total =
            tickets.length;


        const open =
            tickets.filter(
                function (
                    ticket
                ) {

                    return (
                        ticket.status ===
                        "open"
                    );
                }
            ).length;


        const pending =
            tickets.filter(
                function (
                    ticket
                ) {

                    return (
                        ticket.status ===
                        "pending"
                    );
                }
            ).length;


        const resolved =
            tickets.filter(
                function (
                    ticket
                ) {

                    return (
                        ticket.status ===
                        "resolved"
                    );
                }
            ).length;


        const urgent =
            tickets.filter(
                function (
                    ticket
                ) {

                    return (
                        ticket.priority ===
                        "urgent"
                    );
                }
            ).length;


        const riderTickets =
            tickets.filter(
                function (
                    ticket
                ) {

                    return (
                        ticket.userRole ===
                        "rider"
                    );
                }
            ).length;


        const customerTickets =
            tickets.filter(
                function (
                    ticket
                ) {

                    return (
                        ticket.userRole ===
                        "customer"
                    );
                }
            ).length;


        const values = {

            total:
                total,

            open:
                open,

            pending:
                pending,

            resolved:
                resolved,

            urgent:
                urgent,

            riders:
                riderTickets,

            customers:
                customerTickets
        };


        Object.keys(
            values
        ).forEach(
            function (
                key
            ) {

                document
                    .querySelectorAll(
                        "[data-support-" +
                        key +
                        "]"
                    )
                    .forEach(
                        function (
                            element
                        ) {

                            element.textContent =
                                values[key];
                        }
                    );
            }
        );
    };


    /* ========================================================
       LOADING
       ======================================================== */

    AS.renderLoading = function () {

        document
            .querySelectorAll(
                "[data-support-list]"
            )
            .forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        `
                        <div class="admin-loading">
                            <div class="loading-spinner"></div>
                            <p>
                                Loading support requests...
                            </p>
                        </div>
                        `;
                }
            );
    };


    /* ========================================================
       RENDER LIST
       ======================================================== */

    AS.render = function () {

        document
            .querySelectorAll(
                "[data-support-list]"
            )
            .forEach(
                function (
                    container
                ) {

                    const tickets =
                        AS.state.filtered;


                    if (
                        !tickets.length
                    ) {

                        container.innerHTML =
                            `
                            <div class="admin-empty">

                                <div class="admin-empty-icon">
                                    🎧
                                </div>

                                <h3>
                                    No support requests
                                </h3>

                                <p>
                                    Try another search or filter.
                                </p>

                            </div>
                            `;

                        return;
                    }


                    container.innerHTML =
                        tickets
                            .map(
                                function (
                                    ticket
                                ) {

                                    const role =
                                        ticket.userRole ===
                                        "rider"
                                            ? "Rider"
                                            : "Customer";


                                    return `
                                    <div
                                        class="support-ticket-row"
                                        data-ticket-row="${AS.escape(ticket.id)}"
                                    >

                                        <div class="support-ticket-main">

                                            <div class="support-ticket-user">

                                                <span class="support-user-role">
                                                    ${role}
                                                </span>

                                                <strong>
                                                    ${AS.escape(
                                                        ticket.userName
                                                    )}
                                                </strong>

                                            </div>


                                            <h3>
                                                ${AS.escape(
                                                    ticket.subject
                                                )}
                                            </h3>


                                            <p>
                                                ${AS.escape(
                                                    ticket.message
                                                )}
                                            </p>


                                            <small>
                                                Ticket #${AS.escape(
                                                    ticket.ticketId
                                                )}
                                            </small>

                                        </div>


                                        <div class="support-ticket-meta">

                                            <span class="
                                                support-status
                                                ${AS.escape(
                                                    ticket.status
                                                )}
                                            ">
                                                ${AS.escape(
                                                    ticket.status
                                                )}
                                            </span>


                                            <span class="
                                                support-priority
                                                ${AS.escape(
                                                    ticket.priority
                                                )}
                                            ">
                                                ${AS.escape(
                                                    ticket.priority
                                                )}
                                            </span>

                                        </div>


                                        <div class="support-ticket-actions">

                                            <button
                                                type="button"
                                                data-view-ticket="${AS.escape(ticket.id)}"
                                            >
                                                View
                                            </button>

                                            ${
                                                ticket.status !==
                                                "resolved"
                                                    ? `
                                                    <button
                                                        type="button"
                                                        data-resolve-ticket="${AS.escape(ticket.id)}"
                                                    >
                                                        Resolve
                                                    </button>
                                                    `
                                                    : `
                                                    <button
                                                        type="button"
                                                        data-reopen-ticket="${AS.escape(ticket.id)}"
                                                    >
                                                        Reopen
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


        AS.updateStats();
    };


    /* ========================================================
       RENDER DETAILS
       ======================================================== */

    AS.renderDetails = function (
        ticket
    ) {

        document
            .querySelectorAll(
                "[data-support-detail]"
            )
            .forEach(
                function (
                    container
                ) {

                    const messages =
                        Array.isArray(
                            ticket.messages
                        )
                            ? ticket.messages
                            : [];


                    container.innerHTML =
                        `
                        <div class="support-detail">

                            <div class="support-detail-header">

                                <div>

                                    <span class="
                                        support-user-role
                                    ">
                                        ${
                                            ticket.userRole ===
                                            "rider"
                                                ? "Rider"
                                                : "Customer"
                                        }
                                    </span>

                                    <h2>
                                        ${AS.escape(
                                            ticket.subject
                                        )}
                                    </h2>

                                    <p>
                                        Ticket #${AS.escape(
                                            ticket.ticketId
                                        )}
                                    </p>

                                </div>


                                <div>

                                    <span class="
                                        support-status
                                        ${AS.escape(
                                            ticket.status
                                        )}
                                    ">
                                        ${AS.escape(
                                            ticket.status
                                        )}
                                    </span>

                                    <span class="
                                        support-priority
                                        ${AS.escape(
                                            ticket.priority
                                        )}
                                    ">
                                        ${AS.escape(
                                            ticket.priority
                                        )}
                                    </span>

                                </div>

                            </div>


                            <div class="support-user-card">

                                <strong>
                                    ${AS.escape(
                                        ticket.userName
                                    )}
                                </strong>

                                <span>
                                    ${AS.escape(
                                        ticket.userPhone ||
                                        ticket.userEmail ||
                                        ""
                                    )}
                                </span>

                            </div>


                            <div class="support-conversation">

                                <div class="support-message user">

                                    <strong>
                                        ${AS.escape(
                                            ticket.userName
                                        )}
                                    </strong>

                                    <p>
                                        ${AS.escape(
                                            ticket.message
                                        )}
                                    </p>

                                </div>


                                ${
                                    messages
                                        .map(
                                            function (
                                                message
                                            ) {

                                                const isAdmin =
                                                    message.senderRole ===
                                                    "admin";


                                                return `
                                                <div class="
                                                    support-message
                                                    ${
                                                        isAdmin
                                                            ? "admin"
                                                            : "user"
                                                    }
                                                ">

                                                    <strong>
                                                        ${AS.escape(
                                                            message.senderName ||
                                                            (
                                                                isAdmin
                                                                    ? "RiderX Support"
                                                                    : ticket.userName
                                                            )
                                                        )}
                                                    </strong>

                                                    <p>
                                                        ${AS.escape(
                                                            message.message
                                                        )}
                                                    </p>

                                                </div>
                                                `;
                                            }
                                        )
                                        .join("")
                                }

                            </div>


                            <div class="support-reply-box">

                                <textarea
                                    data-support-reply-input
                                    placeholder="Write a reply..."
                                ></textarea>


                                <button
                                    type="button"
                                    data-send-support-reply="${AS.escape(ticket.id)}"
                                >
                                    Send Reply
                                </button>

                            </div>


                            <div class="support-detail-actions">

                                <button
                                    type="button"
                                    data-support-status-open="${AS.escape(ticket.id)}"
                                >
                                    Open
                                </button>

                                <button
                                    type="button"
                                    data-support-status-pending="${AS.escape(ticket.id)}"
                                >
                                    Pending
                                </button>

                                <button
                                    type="button"
                                    data-resolve-ticket="${AS.escape(ticket.id)}"
                                >
                                    Resolve
                                </button>

                                <button
                                    type="button"
                                    data-close-ticket="${AS.escape(ticket.id)}"
                                >
                                    Close
                                </button>

                            </div>

                        </div>
                        `;
                }
            );
    };


    /* ========================================================
       EVENTS
       ======================================================== */

    AS.bindEvents = function () {

        document.addEventListener(
            "input",
            function (
                event
            ) {

                const input =
                    event.target.closest(
                        "[data-support-search]"
                    );


                if (!input) {
                    return;
                }


                AS.search(
                    input.value
                );
            }
        );


        document.addEventListener(
            "change",
            function (
                event
            ) {

                const status =
                    event.target.closest(
                        "[data-support-filter]"
                    );


                if (status) {

                    AS.filter(
                        status.value
                    );

                    return;
                }


                const priority =
                    event.target.closest(
                        "[data-support-priority-filter]"
                    );


                if (priority) {

                    AS.setPriorityFilter(
                        priority.value
                    );
                }
            }
        );


        document.addEventListener(
            "click",
            async function (
                event
            ) {

                const view =
                    event.target.closest(
                        "[data-view-ticket]"
                    );


                if (view) {

                    event.preventDefault();

                    AS.select(
                        view.dataset
                            .viewTicket
                    );

                    return;
                }


                const resolve =
                    event.target.closest(
                        "[data-resolve-ticket]"
                    );


                if (resolve) {

                    event.preventDefault();

                    try {

                        await AS.resolve(
                            resolve.dataset
                                .resolveTicket
                        );

                    } catch (error) {

                        AS.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const reopen =
                    event.target.closest(
                        "[data-reopen-ticket]"
                    );


                if (reopen) {

                    event.preventDefault();

                    try {

                        await AS.reopen(
                            reopen.dataset
                                .reopenTicket
                        );

                    } catch (error) {

                        AS.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const close =
                    event.target.closest(
                        "[data-close-ticket]"
                    );


                if (close) {

                    event.preventDefault();

                    try {

                        await AS.close(
                            close.dataset
                                .closeTicket
                        );

                    } catch (error) {

                        AS.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const open =
                    event.target.closest(
                        "[data-support-status-open]"
                    );


                if (open) {

                    event.preventDefault();

                    try {

                        await AS.setStatus(
                            open.dataset
                                .supportStatusOpen,
                            "open"
                        );

                    } catch (error) {

                        AS.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const pending =
                    event.target.closest(
                        "[data-support-status-pending]"
                    );


                if (pending) {

                    event.preventDefault();

                    try {

                        await AS.setStatus(
                            pending.dataset
                                .supportStatusPending,
                            "pending"
                        );

                    } catch (error) {

                        AS.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const sendReply =
                    event.target.closest(
                        "[data-send-support-reply]"
                    );


                if (sendReply) {

                    event.preventDefault();


                    const input =
                        document.querySelector(
                            "[data-support-reply-input]"
                        );


                    const message =
                        input
                            ? input.value
                            : "";


                    if (
                        !message.trim()
                    ) {

                        AS.message(
                            "Write a reply first.",
                            true
                        );

                        return;
                    }


                    try {

                        await AS.reply(
                            sendReply.dataset
                                .sendSupportReply,

                            message
                        );


                        if (input) {
                            input.value = "";
                        }

                    } catch (error) {

                        AS.message(
                            error.message,
                            true
                        );
                    }
                }
            }
        );
    };


    /* ========================================================
       MESSAGE
       ======================================================== */

    AS.message = function (
        text,
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
            text;


        document.body.appendChild(
            element
        );


        setTimeout(
            function () {

                if (
                    element.parentNode
                ) {
                    element.remove();
                }

            },
            3000
        );
    };


    /* ========================================================
       REFRESH
       ======================================================== */

    AS.refresh = function () {

        return AS.load();
    };


    /* ========================================================
       INIT
       ======================================================== */

    AS.init = function () {

        if (
            AS.state.initialized
        ) {
            return;
        }


        AS.bindEvents();


        AS.state.initialized =
            true;


        if (
            document.querySelector(
                "[data-support-list]"
            )
        ) {

            AS.load();
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-admin-supports-ready"
            )
        );


        console.log(
            "RiderX admin-supports.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.loadSupportTickets =
        function () {

            return AS.load();
        };


    RX.replySupportTicket =
        function (
            ticketId,
            message
        ) {

            return AS.reply(
                ticketId,
                message
            );
        };


    RX.resolveSupportTicket =
        function (
            ticketId
        ) {

            return AS.resolve(
                ticketId
            );
        };


    RX.closeSupportTicket =
        function (
            ticketId
        ) {

            return AS.close(
                ticketId
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
            AS.init
        );

    } else {

        AS.init();
    }

})();
