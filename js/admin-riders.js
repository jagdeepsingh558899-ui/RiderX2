/* ============================================================
   RIDERX
   ADMIN RIDERS ENGINE
   File: js/admin-riders.js

   Handles:
   - All riders listing
   - Search and filters
   - Pending / approved / rejected riders
   - Online / offline status
   - Rider statistics
   - Approve / reject / suspend / activate
   - Rider details
   - Admin notifications
   - Firebase Realtime Database + Firestore
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AR =
        RX.adminRiders =
        RX.adminRiders || {};

    AR.state = {
        initialized: false,
        loading: false,
        riders: [],
        filtered: [],
        search: "",
        filter: "all",
        selected: null
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    AR.database = function () {

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
                "Admin riders database error:",
                error
            );
        }

        return null;
    };


    AR.firestore = function () {

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
                "Admin riders firestore error:",
                error
            );
        }

        return null;
    };


    AR.currentUser = function () {

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


    AR.adminId = function () {

        const user =
            AR.currentUser();

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


    AR.isAdmin = function () {

        const user =
            AR.currentUser();

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

    AR.number = function (
        value
    ) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    };


    AR.escape = function (
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


    AR.normalize = function (
        data,
        id
    ) {

        data =
            data || {};


        let approval =
            data.approvalStatus;


        if (!approval) {

            if (
                data.approved ===
                true
            ) {

                approval =
                    "approved";

            } else if (
                data.rejected ===
                true
            ) {

                approval =
                    "rejected";

            } else {

                approval =
                    "pending";
            }
        }


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
                data.fullName ||
                data.displayName ||
                "Rider",

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
                "rider",

            status:
                data.status ||
                "pending",

            approvalStatus:
                approval,

            approved:
                Boolean(
                    data.approved
                ),

            rejected:
                Boolean(
                    data.rejected
                ),

            suspended:
                Boolean(
                    data.suspended
                ),

            blocked:
                Boolean(
                    data.blocked
                ),

            online:
                Boolean(
                    data.online
                ),

            verified:
                Boolean(
                    data.verified ||
                    data.phoneVerified ||
                    data.emailVerified
                ),

            vehicleType:
                data.vehicleType ||
                data.vehicle ||
                "Bike",

            vehicleNumber:
                data.vehicleNumber ||
                data.numberPlate ||
                "",

            licenseNumber:
                data.licenseNumber ||
                data.license ||
                "",

            rating:
                AR.number(
                    data.rating
                ),

            totalRides:
                AR.number(
                    data.totalRides ||
                    data.rideCount
                ),

            completedRides:
                AR.number(
                    data.completedRides
                ),

            cancelledRides:
                AR.number(
                    data.cancelledRides
                ),

            earnings:
                AR.number(
                    data.earnings ||
                    data.totalEarnings
                ),

            walletBalance:
                AR.number(
                    data.walletBalance
                ),

            createdAt:
                data.createdAt ||
                data.created_at ||
                null,

            updatedAt:
                data.updatedAt ||
                data.updated_at ||
                null
        };
    };


    /* ========================================================
       LOAD RIDERS
       ======================================================== */

    AR.load = async function () {

        if (
            !AR.isAdmin()
        ) {

            AR.message(
                "Admin access required.",
                true
            );

            return [];
        }


        AR.state.loading =
            true;

        AR.renderLoading();


        let riders = [];


        /*
         * Realtime Database
         */

        const database =
            AR.database();


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
                                "rider" ||
                            user.rider ===
                                true
                        ) {

                            riders.push(
                                AR.normalize(
                                    user,
                                    id
                                )
                            );
                        }
                    }
                );

            } catch (error) {

                console.warn(
                    "RTDB rider list failed:",
                    error
                );
            }
        }


        /*
         * Firestore fallback
         */

        if (
            !riders.length
        ) {

            const firestore =
                AR.firestore();


            if (firestore) {

                try {

                    const snapshot =
                        await firestore
                            .collection(
                                "users"
                            )
                            .where(
                                "role",
                                "==",
                                "rider"
                            )
                            .get();


                    snapshot.forEach(
                        function (
                            document
                        ) {

                            riders.push(
                                AR.normalize(
                                    document.data(),
                                    document.id
                                )
                            );
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Firestore rider list failed:",
                        error
                    );
                }
            }
        }


        /*
         * Remove duplicate IDs.
         */

        const unique =
            new Map();


        riders.forEach(
            function (
                rider
            ) {

                if (
                    rider.id
                ) {

                    unique.set(
                        rider.id,
                        rider
                    );
                }
            }
        );


        AR.state.riders =
            Array.from(
                unique.values()
            );


        AR.state.loading =
            false;


        AR.applyFilters();

        AR.updateStats();


        return AR.state.riders;
    };


    /* ========================================================
       FILTER
       ======================================================== */

    AR.applyFilters = function () {

        const search =
            AR.state.search
                .trim()
                .toLowerCase();


        const filter =
            AR.state.filter;


        AR.state.filtered =
            AR.state.riders
                .filter(
                    function (
                        rider
                    ) {

                        let searchMatch =
                            true;


                        if (
                            search
                        ) {

                            const text =
                                [
                                    rider.name,
                                    rider.email,
                                    rider.phone,
                                    rider.vehicleNumber,
                                    rider.id
                                ]
                                    .join(" ")
                                    .toLowerCase();


                            searchMatch =
                                text.includes(
                                    search
                                );
                        }


                        let filterMatch =
                            true;


                        switch (
                            filter
                        ) {

                            case "pending":

                                filterMatch =
                                    rider.approvalStatus ===
                                    "pending";

                                break;


                            case "approved":

                                filterMatch =
                                    rider.approvalStatus ===
                                    "approved";

                                break;


                            case "rejected":

                                filterMatch =
                                    rider.approvalStatus ===
                                    "rejected";

                                break;


                            case "online":

                                filterMatch =
                                    rider.online ===
                                    true;

                                break;


                            case "offline":

                                filterMatch =
                                    rider.online ===
                                    false;

                                break;


                            case "blocked":

                                filterMatch =
                                    rider.blocked ===
                                    true;

                                break;


                            case "suspended":

                                filterMatch =
                                    rider.suspended ===
                                    true;

                                break;


                            case "all":

                            default:

                                filterMatch =
                                    true;
                        }


                        return (
                            searchMatch &&
                            filterMatch
                        );
                    }
                );


        AR.render();
    };


    AR.search = function (
        value
    ) {

        AR.state.search =
            String(
                value || ""
            );

        AR.applyFilters();
    };


    AR.filter = function (
        value
    ) {

        AR.state.filter =
            value ||
            "all";

        AR.applyFilters();
    };


    /* ========================================================
       SELECT RIDER
       ======================================================== */

    AR.get = function (
        riderId
    ) {

        return AR.state.riders
            .find(
                function (
                    rider
                ) {

                    return (
                        rider.id ===
                        riderId
                    );
                }
            ) || null;
    };


    AR.select = function (
        riderId
    ) {

        const rider =
            AR.get(
                riderId
            );


        if (!rider) {
            return null;
        }


        AR.state.selected =
            rider;


        AR.renderDetails(
            rider
        );


        return rider;
    };


    /* ========================================================
       UPDATE RIDER
       ======================================================== */

    AR.update = async function (
        riderId,
        changes
    ) {

        if (
            !AR.isAdmin()
        ) {

            throw new Error(
                "Admin access required."
            );
        }


        const payload = {

            ...changes,

            updatedAt:
                Date.now()
        };


        let updated =
            false;


        const database =
            AR.database();


        if (database) {

            try {

                await database
                    .ref(
                        "users/" +
                        riderId
                    )
                    .update(
                        payload
                    );

                updated =
                    true;

            } catch (error) {

                console.warn(
                    "RTDB rider update failed:",
                    error
                );
            }
        }


        const firestore =
            AR.firestore();


        if (firestore) {

            try {

                await firestore
                    .collection(
                        "users"
                    )
                    .doc(
                        riderId
                    )
                    .set(
                        payload,
                        {
                            merge:
                                true
                        }
                    );

                updated =
                    true;

            } catch (error) {

                console.warn(
                    "Firestore rider update failed:",
                    error
                );
            }
        }


        return updated;
    };


    /* ========================================================
       APPROVE
       ======================================================== */

    AR.approve = async function (
        riderId
    ) {

        const success =
            await AR.update(
                riderId,
                {

                    approved:
                        true,

                    rejected:
                        false,

                    suspended:
                        false,

                    blocked:
                        false,

                    approvalStatus:
                        "approved",

                    status:
                        "active",

                    approvedAt:
                        Date.now(),

                    approvedBy:
                        AR.adminId()
                }
            );


        if (success) {

            AR.updateLocal(
                riderId,
                {

                    approved:
                        true,

                    rejected:
                        false,

                    approvalStatus:
                        "approved",

                    status:
                        "active"
                }
            );


            await AR.notify(
                riderId,

                "Rider account approved",

                "Your RiderX rider account has been approved. You can now go online and accept rides."
            );


            AR.message(
                "Rider approved."
            );
        }


        return success;
    };


    /* ========================================================
       REJECT
       ======================================================== */

    AR.reject = async function (
        riderId,
        reason
    ) {

        reason =
            reason ||
            "Your rider application was rejected by administration.";


        const success =
            await AR.update(
                riderId,
                {

                    approved:
                        false,

                    rejected:
                        true,

                    approvalStatus:
                        "rejected",

                    status:
                        "rejected",

                    rejectionReason:
                        reason,

                    rejectedAt:
                        Date.now(),

                    rejectedBy:
                        AR.adminId()
                }
            );


        if (success) {

            AR.updateLocal(
                riderId,
                {

                    approved:
                        false,

                    rejected:
                        true,

                    approvalStatus:
                        "rejected",

                    status:
                        "rejected"
                }
            );


            await AR.notify(
                riderId,

                "Rider application rejected",

                reason
            );


            AR.message(
                "Rider rejected."
            );
        }


        return success;
    };


    /* ========================================================
       SUSPEND
       ======================================================== */

    AR.suspend = async function (
        riderId,
        reason
    ) {

        reason =
            reason ||
            "Account suspended by administration.";


        const success =
            await AR.update(
                riderId,
                {

                    suspended:
                        true,

                    online:
                        false,

                    status:
                        "suspended",

                    suspendedReason:
                        reason,

                    suspendedAt:
                        Date.now(),

                    suspendedBy:
                        AR.adminId()
                }
            );


        if (success) {

            AR.updateLocal(
                riderId,
                {

                    suspended:
                        true,

                    online:
                        false,

                    status:
                        "suspended"
                }
            );


            await AR.notify(
                riderId,

                "Rider account suspended",

                reason
            );


            AR.message(
                "Rider suspended."
            );
        }


        return success;
    };


    /* ========================================================
       ACTIVATE
       ======================================================== */

    AR.activate = async function (
        riderId
    ) {

        const success =
            await AR.update(
                riderId,
                {

                    approved:
                        true,

                    rejected:
                        false,

                    suspended:
                        false,

                    blocked:
                        false,

                    approvalStatus:
                        "approved",

                    status:
                        "active",

                    activatedAt:
                        Date.now(),

                    activatedBy:
                        AR.adminId()
                }
            );


        if (success) {

            AR.updateLocal(
                riderId,
                {

                    approved:
                        true,

                    rejected:
                        false,

                    suspended:
                        false,

                    blocked:
                        false,

                    approvalStatus:
                        "approved",

                    status:
                        "active"
                }
            );


            await AR.notify(
                riderId,

                "Rider account activated",

                "Your RiderX rider account has been activated."
            );


            AR.message(
                "Rider activated."
            );
        }


        return success;
    };


    /* ========================================================
       BLOCK
       ======================================================== */

    AR.block = async function (
        riderId,
        reason
    ) {

        reason =
            reason ||
            "Account blocked by administration.";


        const success =
            await AR.update(
                riderId,
                {

                    blocked:
                        true,

                    online:
                        false,

                    status:
                        "blocked",

                    blockedReason:
                        reason,

                    blockedAt:
                        Date.now(),

                    blockedBy:
                        AR.adminId()
                }
            );


        if (success) {

            AR.updateLocal(
                riderId,
                {

                    blocked:
                        true,

                    online:
                        false,

                    status:
                        "blocked"
                }
            );


            await AR.notify(
                riderId,

                "Rider account blocked",

                reason
            );


            AR.message(
                "Rider blocked."
            );
        }


        return success;
    };


    /* ========================================================
       UNBLOCK
       ======================================================== */

    AR.unblock = async function (
        riderId
    ) {

        const success =
            await AR.update(
                riderId,
                {

                    blocked:
                        false,

                    status:
                        "active",

                    unblockedAt:
                        Date.now(),

                    unblockedBy:
                        AR.adminId()
                }
            );


        if (success) {

            AR.updateLocal(
                riderId,
                {

                    blocked:
                        false,

                    status:
                        "active"
                }
            );


            await AR.notify(
                riderId,

                "Rider account restored",

                "Your RiderX rider account has been restored."
            );


            AR.message(
                "Rider unblocked."
            );
        }


        return success;
    };


    /* ========================================================
       UPDATE LOCAL RIDER
       ======================================================== */

    AR.updateLocal = function (
        riderId,
        changes
    ) {

        const rider =
            AR.get(
                riderId
            );


        if (!rider) {
            return;
        }


        Object.assign(
            rider,
            changes
        );


        AR.applyFilters();

        AR.updateStats();


        if (
            AR.state.selected &&
            AR.state.selected.id ===
                riderId
        ) {

            AR.state.selected =
                rider;

            AR.renderDetails(
                rider
            );
        }
    };


    /* ========================================================
       NOTIFICATION
       ======================================================== */

    AR.notify = async function (
        riderId,
        title,
        message
    ) {

        if (!riderId) {
            return false;
        }


        const notification = {

            id:
                "admin_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 9),

            userId:
                riderId,

            recipientId:
                riderId,

            recipientRole:
                "rider",

            senderId:
                AR.adminId(),

            senderRole:
                "admin",

            title:
                title ||
                "RiderX Admin",

            message:
                message ||
                "",

            type:
                "admin",

            read:
                false,

            createdAt:
                Date.now(),

            timestamp:
                Date.now()
        };


        const database =
            AR.database();


        if (database) {

            try {

                await database
                    .ref(
                        "notifications/" +
                        riderId +
                        "/" +
                        notification.id
                    )
                    .set(
                        notification
                    );


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

                console.warn(
                    "Rider notification failed:",
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
                    riderId,
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
       STATISTICS
       ======================================================== */

    AR.updateStats = function () {

        const riders =
            AR.state.riders;


        const total =
            riders.length;


        const pending =
            riders.filter(
                function (
                    rider
                ) {

                    return (
                        rider.approvalStatus ===
                        "pending"
                    );
                }
            ).length;


        const approved =
            riders.filter(
                function (
                    rider
                ) {

                    return (
                        rider.approvalStatus ===
                        "approved"
                    );
                }
            ).length;


        const rejected =
            riders.filter(
                function (
                    rider
                ) {

                    return (
                        rider.approvalStatus ===
                        "rejected"
                    );
                }
            ).length;


        const online =
            riders.filter(
                function (
                    rider
                ) {

                    return rider.online;
                }
            ).length;


        const blocked =
            riders.filter(
                function (
                    rider
                ) {

                    return rider.blocked;
                }
            ).length;


        document
            .querySelectorAll(
                "[data-rider-total]"
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
                "[data-rider-pending]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        pending;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-approved]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        approved;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-rejected]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rejected;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-online-count]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        online;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-blocked]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        blocked;
                }
            );
    };


    /* ========================================================
       RENDER LOADING
       ======================================================== */

    AR.renderLoading = function () {

        document
            .querySelectorAll(
                "[data-riders-list]"
            )
            .forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        `
                        <div class="admin-loading">
                            <div class="loading-spinner"></div>
                            <p>Loading riders...</p>
                        </div>
                        `;
                }
            );
    };


    /* ========================================================
       RENDER LIST
       ======================================================== */

    AR.render = function () {

        document
            .querySelectorAll(
                "[data-riders-list]"
            )
            .forEach(
                function (
                    container
                ) {

                    const riders =
                        AR.state.filtered;


                    if (
                        !riders.length
                    ) {

                        container.innerHTML =
                            `
                            <div class="admin-empty">
                                <div class="admin-empty-icon">
                                    🛵
                                </div>

                                <h3>
                                    No riders found
                                </h3>

                                <p>
                                    Try another search or filter.
                                </p>
                            </div>
                            `;

                        return;
                    }


                    container.innerHTML =
                        riders
                            .map(
                                function (
                                    rider
                                ) {

                                    const initial =
                                        (
                                            rider.name ||
                                            "R"
                                        )
                                            .charAt(0)
                                            .toUpperCase();


                                    return `
                                    <div
                                        class="admin-rider-row"
                                        data-rider-row="${AR.escape(rider.id)}"
                                    >

                                        <div class="rider-avatar">

                                            ${
                                                rider.photo
                                                    ? `
                                                    <img
                                                        src="${AR.escape(rider.photo)}"
                                                        alt=""
                                                    >
                                                    `
                                                    : `
                                                    <span>
                                                        ${initial}
                                                    </span>
                                                    `
                                            }

                                        </div>


                                        <div class="rider-info">

                                            <strong>
                                                ${AR.escape(
                                                    rider.name
                                                )}
                                            </strong>

                                            <span>
                                                ${AR.escape(
                                                    rider.phone ||
                                                    rider.email ||
                                                    "No contact"
                                                )}
                                            </span>

                                            <small>
                                                ${AR.escape(
                                                    rider.vehicleType
                                                )}
                                                ${
                                                    rider.vehicleNumber
                                                        ? " • " +
                                                          AR.escape(
                                                              rider.vehicleNumber
                                                          )
                                                        : ""
                                                }
                                            </small>

                                        </div>


                                        <div class="rider-status">

                                            <span class="
                                                status-badge
                                                ${AR.escape(
                                                    rider.approvalStatus
                                                )}
                                            ">
                                                ${AR.escape(
                                                    rider.approvalStatus
                                                )}
                                            </span>


                                            <span class="
                                                online-indicator
                                                ${
                                                    rider.online
                                                        ? "online"
                                                        : "offline"
                                                }
                                            ">
                                                ${
                                                    rider.online
                                                        ? "Online"
                                                        : "Offline"
                                                }
                                            </span>

                                        </div>


                                        <div class="rider-actions">

                                            <button
                                                type="button"
                                                data-view-rider="${AR.escape(rider.id)}"
                                            >
                                                View
                                            </button>

                                            ${
                                                rider.approvalStatus ===
                                                "pending"
                                                    ? `
                                                    <button
                                                        type="button"
                                                        data-approve-rider="${AR.escape(rider.id)}"
                                                    >
                                                        Approve
                                                    </button>

                                                    <button
                                                        type="button"
                                                        data-reject-rider="${AR.escape(rider.id)}"
                                                    >
                                                        Reject
                                                    </button>
                                                    `
                                                    : ""
                                            }

                                            ${
                                                rider.blocked
                                                    ? `
                                                    <button
                                                        type="button"
                                                        data-unblock-rider="${AR.escape(rider.id)}"
                                                    >
                                                        Unblock
                                                    </button>
                                                    `
                                                    : `
                                                    <button
                                                        type="button"
                                                        data-block-rider="${AR.escape(rider.id)}"
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


        AR.updateStats();
    };


    /* ========================================================
       RENDER DETAILS
       ======================================================== */

    AR.renderDetails = function (
        rider
    ) {

        document
            .querySelectorAll(
                "[data-rider-detail]"
            )
            .forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        `
                        <div class="admin-rider-detail">

                            <div class="rider-detail-avatar">

                                ${
                                    rider.photo
                                        ? `
                                        <img
                                            src="${AR.escape(rider.photo)}"
                                            alt=""
                                        >
                                        `
                                        : `
                                        <span>
                                            ${AR.escape(
                                                (
                                                    rider.name ||
                                                    "R"
                                                )
                                                    .charAt(0)
                                                    .toUpperCase()
                                            )}
                                        </span>
                                        `
                                }

                            </div>


                            <h2>
                                ${AR.escape(
                                    rider.name
                                )}
                            </h2>


                            <p>
                                ${AR.escape(
                                    rider.phone ||
                                    "No phone"
                                )}
                            </p>


                            <p>
                                ${AR.escape(
                                    rider.email ||
                                    "No email"
                                )}
                            </p>


                            <div class="rider-detail-grid">

                                <div>
                                    <strong>
                                        ${rider.totalRides}
                                    </strong>
                                    <span>
                                        Total Rides
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        ${rider.completedRides}
                                    </strong>
                                    <span>
                                        Completed
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        ${rider.rating
                                            ? rider.rating.toFixed(1)
                                            : "0.0"
                                        }
                                    </strong>
                                    <span>
                                        Rating
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        ₹${rider.earnings.toFixed(0)}
                                    </strong>
                                    <span>
                                        Earnings
                                    </span>
                                </div>

                            </div>


                            <div class="rider-detail-actions">

                                <button
                                    type="button"
                                    data-notify-rider="${AR.escape(rider.id)}"
                                >
                                    Notify
                                </button>


                                ${
                                    rider.approvalStatus ===
                                    "pending"
                                        ? `
                                        <button
                                            type="button"
                                            data-approve-rider="${AR.escape(rider.id)}"
                                        >
                                            Approve
                                        </button>

                                        <button
                                            type="button"
                                            data-reject-rider="${AR.escape(rider.id)}"
                                        >
                                            Reject
                                        </button>
                                        `
                                        : ""
                                }


                                ${
                                    rider.suspended
                                        ? `
                                        <button
                                            type="button"
                                            data-activate-rider="${AR.escape(rider.id)}"
                                        >
                                            Activate
                                        </button>
                                        `
                                        : `
                                        <button
                                            type="button"
                                            data-suspend-rider="${AR.escape(rider.id)}"
                                        >
                                            Suspend
                                        </button>
                                        `
                                }


                                ${
                                    rider.blocked
                                        ? `
                                        <button
                                            type="button"
                                            data-unblock-rider="${AR.escape(rider.id)}"
                                        >
                                            Unblock
                                        </button>
                                        `
                                        : `
                                        <button
                                            type="button"
                                            data-block-rider="${AR.escape(rider.id)}"
                                        >
                                            Block
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
       EVENTS
       ======================================================== */

    AR.bindEvents = function () {

        document.addEventListener(
            "input",
            function (
                event
            ) {

                const input =
                    event.target.closest(
                        "[data-rider-search]"
                    );


                if (!input) {
                    return;
                }


                AR.search(
                    input.value
                );
            }
        );


        document.addEventListener(
            "change",
            function (
                event
            ) {

                const select =
                    event.target.closest(
                        "[data-rider-filter]"
                    );


                if (!select) {
                    return;
                }


                AR.filter(
                    select.value
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
                        "[data-view-rider]"
                    );


                if (view) {

                    event.preventDefault();

                    AR.select(
                        view.dataset
                            .viewRider
                    );

                    return;
                }


                const approve =
                    event.target.closest(
                        "[data-approve-rider]"
                    );


                if (approve) {

                    event.preventDefault();

                    try {

                        await AR.approve(
                            approve.dataset
                                .approveRider
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const reject =
                    event.target.closest(
                        "[data-reject-rider]"
                    );


                if (reject) {

                    event.preventDefault();


                    const reason =
                        window.prompt(
                            "Rejection reason:",
                            "Please correct the required rider information."
                        );


                    if (
                        reason ===
                        null
                    ) {
                        return;
                    }


                    try {

                        await AR.reject(
                            reject.dataset
                                .rejectRider,

                            reason
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const block =
                    event.target.closest(
                        "[data-block-rider]"
                    );


                if (block) {

                    event.preventDefault();


                    const reason =
                        window.prompt(
                            "Block reason:",
                            "Account blocked by administration."
                        );


                    if (
                        reason ===
                        null
                    ) {
                        return;
                    }


                    try {

                        await AR.block(
                            block.dataset
                                .blockRider,

                            reason
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const unblock =
                    event.target.closest(
                        "[data-unblock-rider]"
                    );


                if (unblock) {

                    event.preventDefault();


                    try {

                        await AR.unblock(
                            unblock.dataset
                                .unblockRider
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const suspend =
                    event.target.closest(
                        "[data-suspend-rider]"
                    );


                if (suspend) {

                    event.preventDefault();


                    const reason =
                        window.prompt(
                            "Suspension reason:",
                            "Account suspended by administration."
                        );


                    if (
                        reason ===
                        null
                    ) {
                        return;
                    }


                    try {

                        await AR.suspend(
                            suspend.dataset
                                .suspendRider,

                            reason
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const activate =
                    event.target.closest(
                        "[data-activate-rider]"
                    );


                if (activate) {

                    event.preventDefault();


                    try {

                        await AR.activate(
                            activate.dataset
                                .activateRider
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const notify =
                    event.target.closest(
                        "[data-notify-rider]"
                    );


                if (notify) {

                    event.preventDefault();


                    const title =
                        window.prompt(
                            "Notification title:",
                            "RiderX Admin"
                        );


                    if (
                        title ===
                        null
                    ) {
                        return;
                    }


                    const message =
                        window.prompt(
                            "Notification message:"
                        );


                    if (
                        message ===
                        null ||
                        !message.trim()
                    ) {
                        return;
                    }


                    try {

                        await AR.notify(
                            notify.dataset
                                .notifyRider,

                            title,

                            message
                        );


                        AR.message(
                            "Notification sent."
                        );

                    } catch (error) {

                        AR.message(
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

    AR.message = function (
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

    AR.refresh = function () {

        return AR.load();
    };


    /* ========================================================
       INIT
       ======================================================== */

    AR.init = function () {

        if (
            AR.state.initialized
        ) {
            return;
        }


        AR.bindEvents();


        AR.state.initialized =
            true;


        if (
            document.querySelector(
                "[data-riders-list]"
            )
        ) {

            AR.load();
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-admin-riders-ready"
            )
        );


        console.log(
            "RiderX admin-riders.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.loadRiders =
        function () {

            return AR.load();
        };


    RX.approveRider =
        function (
            riderId
        ) {

            return AR.approve(
                riderId
            );
        };


    RX.rejectRider =
        function (
            riderId,
            reason
        ) {

            return AR.reject(
                riderId,
                reason
            );
        };


    RX.suspendRider =
        function (
            riderId,
            reason
        ) {

            return AR.suspend(
                riderId,
                reason
            );
        };


    RX.activateRider =
        function (
            riderId
        ) {

            return AR.activate(
                riderId
            );
        };


    RX.blockRider =
        function (
            riderId,
            reason
        ) {

            return AR.block(
                riderId,
                reason
            );
        };


    RX.unblockRider =
        function (
            riderId
        ) {

            return AR.unblock(
                riderId
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
            AR.init
        );

    } else {

        AR.init();
    }

})();
