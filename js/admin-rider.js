/* ============================================================
   RIDERX
   ADMIN RIDER ENGINE
   File: js/admin-rider.js

   Purpose:
   - Individual rider management
   - Rider details
   - Rider approval / rejection
   - Document verification
   - Online/offline status
   - Suspend / activate rider
   - Rider notification
   - Rider profile updates
   - Firebase Realtime Database + Firestore support
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const AR =
        RX.adminRider =
        RX.adminRider || {};

    AR.state = {
        initialized: false,
        riderId: null,
        rider: null,
        loading: false
    };


    /* ========================================================
       FIREBASE HELPERS
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
                "RiderX database error:",
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
                "RiderX firestore error:",
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


    AR.currentAdminId = function () {

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

        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
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
                data.approvalStatus ||
                data.approved === true
                    ? "approved"
                    : (
                        data.rejected === true
                            ? "rejected"
                            : "pending"
                    ),

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

            profileCompleted:
                Boolean(
                    data.profileCompleted
                ),

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
                null,

            documents:
                data.documents ||
                {}

        };
    };


    /* ========================================================
       LOAD RIDER
       ======================================================== */

    AR.load = async function (
        riderId
    ) {

        if (
            !AR.isAdmin()
        ) {

            AR.message(
                "Admin access required.",
                true
            );

            return null;
        }


        riderId =
            riderId ||
            AR.state.riderId ||
            new URLSearchParams(
                window.location.search
            ).get(
                "id"
            );


        if (!riderId) {

            AR.message(
                "Rider ID not found.",
                true
            );

            return null;
        }


        AR.state.riderId =
            riderId;

        AR.state.loading =
            true;


        let rider = null;


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
                            "users/" +
                            riderId
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val();


                if (
                    data &&
                    (
                        data.role ===
                            "rider" ||
                        data.userRole ===
                            "rider" ||
                        data.rider ===
                            true
                    )
                ) {

                    rider =
                        AR.normalize(
                            data,
                            riderId
                        );
                }

            } catch (error) {

                console.warn(
                    "RTDB rider load failed:",
                    error
                );
            }
        }


        /*
         * Firestore fallback
         */

        if (!rider) {

            const firestore =
                AR.firestore();


            if (firestore) {

                try {

                    const snapshot =
                        await firestore
                            .collection(
                                "users"
                            )
                            .doc(
                                riderId
                            )
                            .get();


                    if (
                        snapshot.exists
                    ) {

                        rider =
                            AR.normalize(
                                snapshot.data(),
                                riderId
                            );
                    }

                } catch (error) {

                    console.warn(
                        "Firestore rider load failed:",
                        error
                    );
                }
            }
        }


        AR.state.loading =
            false;

        AR.state.rider =
            rider;


        if (rider) {

            AR.render(
                rider
            );

        } else {

            AR.message(
                "Rider not found.",
                true
            );
        }


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


        if (
            !riderId ||
            !changes
        ) {

            throw new Error(
                "Rider information missing."
            );
        }


        const payload = {

            ...changes,

            updatedAt:
                Date.now()
        };


        let updated = false;


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

                updated = true;

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

                updated = true;

            } catch (error) {

                console.warn(
                    "Firestore rider update failed:",
                    error
                );
            }
        }


        if (
            AR.state.rider &&
            AR.state.rider.id ===
                riderId
        ) {

            Object.assign(
                AR.state.rider,
                changes
            );
        }


        AR.render(
            AR.state.rider
        );


        return updated;
    };


    /* ========================================================
       APPROVE RIDER
       ======================================================== */

    AR.approve = async function (
        riderId
    ) {

        riderId =
            riderId ||
            AR.state.riderId;


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
                        AR.currentAdminId()
                }
            );


        if (success) {

            await AR.notify(
                riderId,

                "Rider account approved",

                "Your RiderX rider account has been approved. You can now go online and accept rides."
            );


            AR.message(
                "Rider approved successfully."
            );
        }


        return success;
    };


    /* ========================================================
       REJECT RIDER
       ======================================================== */

    AR.reject = async function (
        riderId,
        reason
    ) {

        riderId =
            riderId ||
            AR.state.riderId;


        reason =
            reason ||
            "Your rider application did not meet the current requirements.";


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
                        AR.currentAdminId()
                }
            );


        if (success) {

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
       SUSPEND RIDER
       ======================================================== */

    AR.suspend = async function (
        riderId,
        reason
    ) {

        riderId =
            riderId ||
            AR.state.riderId;


        const success =
            await AR.update(
                riderId,
                {

                    suspended:
                        true,

                    status:
                        "suspended",

                    suspendedReason:
                        reason ||
                        "Account suspended by administration.",

                    suspendedAt:
                        Date.now(),

                    suspendedBy:
                        AR.currentAdminId()
                }
            );


        if (success) {

            await AR.notify(
                riderId,

                "Rider account suspended",

                reason ||
                "Your RiderX rider account has been suspended by administration."
            );


            AR.message(
                "Rider suspended."
            );
        }


        return success;
    };


    /* ========================================================
       ACTIVATE RIDER
       ======================================================== */

    AR.activate = async function (
        riderId
    ) {

        riderId =
            riderId ||
            AR.state.riderId;


        const success =
            await AR.update(
                riderId,
                {

                    suspended:
                        false,

                    blocked:
                        false,

                    rejected:
                        false,

                    approved:
                        true,

                    approvalStatus:
                        "approved",

                    status:
                        "active",

                    activatedAt:
                        Date.now(),

                    activatedBy:
                        AR.currentAdminId()
                }
            );


        if (success) {

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
       BLOCK RIDER
       ======================================================== */

    AR.block = async function (
        riderId,
        reason
    ) {

        riderId =
            riderId ||
            AR.state.riderId;


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
                        reason ||
                        "Account blocked by administration.",

                    blockedAt:
                        Date.now(),

                    blockedBy:
                        AR.currentAdminId()
                }
            );


        if (success) {

            await AR.notify(
                riderId,

                "Rider account blocked",

                reason ||
                "Your RiderX account has been blocked by administration."
            );


            AR.message(
                "Rider blocked."
            );
        }


        return success;
    };


    /* ========================================================
       VERIFY DOCUMENT
       ======================================================== */

    AR.verifyDocument = async function (
        riderId,
        documentType
    ) {

        riderId =
            riderId ||
            AR.state.riderId;


        if (!documentType) {

            throw new Error(
                "Document type is required."
            );
        }


        const rider =
            AR.state.rider;


        const documents =
            rider &&
            rider.documents
                ? {
                    ...rider.documents
                }
                : {};


        documents[
            documentType
        ] = {

            status:
                "verified",

            verified:
                true,

            verifiedAt:
                Date.now(),

            verifiedBy:
                AR.currentAdminId()
        };


        const success =
            await AR.update(
                riderId,
                {
                    documents:
                        documents
                }
            );


        if (success) {

            await AR.notify(
                riderId,

                "Document verified",

                "Your " +
                documentType +
                " has been verified by RiderX administration."
            );


            AR.message(
                documentType +
                " verified."
            );
        }


        return success;
    };


    /* ========================================================
       REJECT DOCUMENT
       ======================================================== */

    AR.rejectDocument =
        async function (
            riderId,
            documentType,
            reason
        ) {

            riderId =
                riderId ||
                AR.state.riderId;


            const rider =
                AR.state.rider;


            const documents =
                rider &&
                rider.documents
                    ? {
                        ...rider.documents
                    }
                    : {};


            documents[
                documentType
            ] = {

                status:
                    "rejected",

                verified:
                    false,

                reason:
                    reason ||
                    "Document rejected by administration.",

                rejectedAt:
                    Date.now(),

                rejectedBy:
                    AR.currentAdminId()
            };


            const success =
                await AR.update(
                    riderId,
                    {
                        documents:
                            documents
                    }
                );


            if (success) {

                await AR.notify(
                    riderId,

                    "Document rejected",

                    reason ||
                    "Your " +
                    documentType +
                    " was rejected. Please upload a valid document."
                );


                AR.message(
                    documentType +
                    " rejected."
                );
            }


            return success;
        };


    /* ========================================================
       SEND RIDER NOTIFICATION
       ======================================================== */

    AR.notify = async function (
        riderId,
        title,
        message,
        options = {}
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
                AR.currentAdminId(),

            senderRole:
                "admin",

            title:
                title ||
                "RiderX Admin",

            message:
                message ||
                "",

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
       CUSTOM NOTIFICATION
       ======================================================== */

    AR.sendNotification =
        function (
            riderId,
            title,
            message
        ) {

            return AR.notify(
                riderId,
                title,
                message
            );
        };


    /* ========================================================
       RENDER
       ======================================================== */

    AR.render = function (
        rider
    ) {

        if (!rider) {
            return;
        }


        document
            .querySelectorAll(
                "[data-rider-id]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.id ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-name]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.name ||
                        "Rider";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-email]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.email ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-phone]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.phone ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-status]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.status ||
                        "pending";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-rating]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.rating
                            ? rider.rating
                                .toFixed(1)
                            : "0.0";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-total-rides]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.totalRides;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-earnings]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        "₹" +
                        rider.earnings
                            .toFixed(0);
                }
            );


        document
            .querySelectorAll(
                "[data-rider-vehicle]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.vehicleType;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-number]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.vehicleNumber;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-approval]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.approvalStatus;
                }
            );


        document
            .querySelectorAll(
                "[data-rider-online]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        rider.online
                            ? "Online"
                            : "Offline";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-photo]"
            )
            .forEach(
                function (
                    element
                ) {

                    if (
                        rider.photo
                    ) {

                        if (
                            element.tagName
                                .toLowerCase() ===
                            "img"
                        ) {

                            element.src =
                                rider.photo;
                        }
                    }
                }
            );


        /*
         * Action buttons
         */

        document
            .querySelectorAll(
                "[data-approve-rider]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.disabled =
                        rider.approved ===
                        true;
                }
            );


        document
            .querySelectorAll(
                "[data-block-rider]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.disabled =
                        rider.blocked ===
                        true;
                }
            );


        document
            .querySelectorAll(
                "[data-suspend-rider]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.disabled =
                        rider.suspended ===
                        true;
                }
            );
    };


    /* ========================================================
       EVENT HANDLERS
       ======================================================== */

    AR.bindEvents = function () {

        document.addEventListener(
            "click",
            async function (
                event
            ) {

                const approve =
                    event.target.closest(
                        "[data-approve-rider]"
                    );


                if (approve) {

                    event.preventDefault();


                    try {

                        await AR.approve(
                            approve.dataset
                                .riderId ||
                            AR.state.riderId
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
                            "Please provide the required documents or correct information."
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
                                .riderId ||
                            AR.state.riderId,
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
                                .riderId ||
                            AR.state.riderId,
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
                                .riderId ||
                            AR.state.riderId
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
                                .riderId ||
                            AR.state.riderId,
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


                const verifyDocument =
                    event.target.closest(
                        "[data-verify-document]"
                    );


                if (verifyDocument) {

                    event.preventDefault();


                    try {

                        await AR.verifyDocument(
                            verifyDocument.dataset
                                .riderId ||
                            AR.state.riderId,

                            verifyDocument.dataset
                                .documentType
                        );

                    } catch (error) {

                        AR.message(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const rejectDocument =
                    event.target.closest(
                        "[data-reject-document]"
                    );


                if (rejectDocument) {

                    event.preventDefault();


                    const reason =
                        window.prompt(
                            "Document rejection reason:"
                        );


                    if (
                        reason ===
                        null
                    ) {
                        return;
                    }


                    try {

                        await AR.rejectDocument(
                            rejectDocument.dataset
                                .riderId ||
                            AR.state.riderId,

                            rejectDocument.dataset
                                .documentType,

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

                        await AR.sendNotification(
                            notify.dataset
                                .riderId ||
                            AR.state.riderId,

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

        const existing =
            document.querySelector(
                ".riderx-admin-message"
            );


        if (existing) {
            existing.remove();
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


        const params =
            new URLSearchParams(
                window.location.search
            );


        const riderId =
            params.get(
                "id"
            );


        if (
            riderId
        ) {

            AR.load(
                riderId
            );
        }


        window.dispatchEvent(
            new CustomEvent(
                "riderx-admin-rider-ready"
            )
        );


        console.log(
            "RiderX admin-rider.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.loadRider =
        function (
            riderId
        ) {

            return AR.load(
                riderId
            );
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


    RX.notifyRider =
        function (
            riderId,
            title,
            message
        ) {

            return AR.sendNotification(
                riderId,
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
            AR.init
        );

    } else {

        AR.init();
    }

})();
