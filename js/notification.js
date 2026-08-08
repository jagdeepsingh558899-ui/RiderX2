/* ============================================================
   RIDERX 2.0
   NOTIFICATION ENGINE
   File: js/notification.js

   Features:
   - Firebase Realtime Database notifications
   - Firestore fallback
   - Browser notifications
   - Notification permission
   - Unread count
   - Notification center
   - Ride notifications
   - Rider notifications
   - Payment notifications
   - Chat notifications
   - Cancellation notifications
   - Mark read
   - Mark all read
   - Delete notification
   - Notification sound
   - Cross-page events
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       GLOBAL
       ======================================================== */

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    RX.notification =
        RX.notification || {};

    const NOTIFY =
        RX.notification;


    /* ========================================================
       CONFIG
       ======================================================== */

    NOTIFY.config = {

        storageKey:
            "riderx_notifications",

        maxLocalNotifications:
            100,

        maxVisibleNotifications:
            50,

        soundEnabledKey:
            "riderx_notification_sound",

        browserNotificationKey:
            "riderx_browser_notifications",

        rtdbPath:
            "notifications",

        firestoreCollection:
            "notifications",

        soundUrl:
            "../assets/sounds/notification.mp3"
    };


    /* ========================================================
       STATE
       ======================================================== */

    NOTIFY.state = {

        userId:
            null,

        role:
            null,

        notifications:
            [],

        unread:
            0,

        initialized:
            false,

        listener:
            null,

        firestoreUnsubscribe:
            null,

        permission:
            "default",

        soundEnabled:
            true,

        browserEnabled:
            true
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    NOTIFY.createId =
        function () {

            return (
                "rx_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 9)
            );
        };


    NOTIFY.escape =
        function (value) {

            const div =
                document.createElement(
                    "div"
                );

            div.textContent =
                String(
                    value ??
                    ""
                );

            return div.innerHTML;
        };


    NOTIFY.now =
        function () {

            return Date.now();
        };


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    NOTIFY.loadLocal =
        function () {

            try {

                const raw =
                    localStorage.getItem(
                        NOTIFY.config
                            .storageKey
                    );


                if (!raw) {

                    NOTIFY.state
                        .notifications =
                        [];

                    return [];
                }


                const data =
                    JSON.parse(
                        raw
                    );


                if (
                    Array.isArray(data)
                ) {

                    NOTIFY.state
                        .notifications =
                        data;
                }

            } catch (error) {

                console.warn(
                    "Unable to load notifications:",
                    error
                );

                NOTIFY.state
                    .notifications =
                    [];
            }


            NOTIFY.calculateUnread();

            return NOTIFY.state
                .notifications;
        };


    NOTIFY.saveLocal =
        function () {

            try {

                const notifications =
                    NOTIFY.state
                        .notifications
                        .slice(
                            0,
                            NOTIFY.config
                                .maxLocalNotifications
                        );


                localStorage.setItem(
                    NOTIFY.config
                        .storageKey,
                    JSON.stringify(
                        notifications
                    )
                );

            } catch (error) {

                console.warn(
                    "Unable to save notifications:",
                    error
                );
            }
        };


    /* ========================================================
       SOUND SETTINGS
       ======================================================== */

    NOTIFY.loadSettings =
        function () {

            try {

                const sound =
                    localStorage.getItem(
                        NOTIFY.config
                            .soundEnabledKey
                    );


                if (
                    sound ===
                    "false"
                ) {

                    NOTIFY.state
                        .soundEnabled =
                        false;

                } else {

                    NOTIFY.state
                        .soundEnabled =
                        true;
                }


                const browser =
                    localStorage.getItem(
                        NOTIFY.config
                            .browserNotificationKey
                    );


                if (
                    browser ===
                    "false"
                ) {

                    NOTIFY.state
                        .browserEnabled =
                        false;

                } else {

                    NOTIFY.state
                        .browserEnabled =
                        true;
                }

            } catch (error) {

                console.warn(
                    error
                );
            }
        };


    NOTIFY.setSoundEnabled =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            NOTIFY.state
                .soundEnabled =
                enabled;


            try {

                localStorage.setItem(
                    NOTIFY.config
                        .soundEnabledKey,
                    String(
                        enabled
                    )
                );

            } catch (error) {

                console.warn(
                    error
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-notification-settings",
                    {
                        detail: {
                            sound:
                                enabled
                        }
                    }
                )
            );
        };


    NOTIFY.setBrowserEnabled =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            NOTIFY.state
                .browserEnabled =
                enabled;


            try {

                localStorage.setItem(
                    NOTIFY.config
                        .browserNotificationKey,
                    String(
                        enabled
                    )
                );

            } catch (error) {

                console.warn(
                    error
                );
            }
        };


    /* ========================================================
       SOUND
       ======================================================== */

    NOTIFY.playSound =
        function () {

            if (
                !NOTIFY.state
                    .soundEnabled
            ) {

                return;
            }


            try {

                const audio =
                    new Audio(
                        NOTIFY.config
                            .soundUrl
                    );


                audio.volume =
                    0.7;


                const promise =
                    audio.play();


                if (
                    promise &&
                    typeof promise.catch ===
                    "function"
                ) {

                    promise.catch(
                        function () {
                            /*
                             * Browser may block
                             * autoplay.
                             */
                        }
                    );
                }

            } catch (error) {

                console.warn(
                    "Notification sound failed:",
                    error
                );
            }
        };


    /* ========================================================
       BROWSER PERMISSION
       ======================================================== */

    NOTIFY.requestPermission =
        async function () {

            if (
                !("Notification" in window)
            ) {

                return "unsupported";
            }


            try {

                const permission =
                    await Notification
                        .requestPermission();


                NOTIFY.state.permission =
                    permission;


                return permission;

            } catch (error) {

                console.warn(
                    "Notification permission error:",
                    error
                );

                return "default";
            }
        };


    /* ========================================================
       BROWSER NOTIFICATION
       ======================================================== */

    NOTIFY.showBrowser =
        function (
            notification
        ) {

            if (
                !NOTIFY.state
                    .browserEnabled
            ) {

                return;
            }


            if (
                !("Notification" in window)
            ) {

                return;
            }


            if (
                Notification.permission !==
                "granted"
            ) {

                return;
            }


            try {

                const browserNotification =
                    new Notification(
                        notification.title ||
                        "RiderX",
                        {

                            body:
                                notification.body ||
                                "",

                            tag:
                                notification.id ||
                                "riderx",

                            icon:
                                "/assets/images/icon-192.png",

                            badge:
                                "/assets/images/icon-192.png"
                        }
                    );


                browserNotification.onclick =
                    function () {

                        window.focus();


                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx-notification-click",
                                {
                                    detail:
                                        notification
                                }
                            )
                        );


                        browserNotification
                            .close();
                    };


            } catch (error) {

                console.warn(
                    "Browser notification failed:",
                    error
                );
            }
        };


    /* ========================================================
       CALCULATE UNREAD
       ======================================================== */

    NOTIFY.calculateUnread =
        function () {

            NOTIFY.state.unread =
                NOTIFY.state
                    .notifications
                    .filter(
                        function (
                            item
                        ) {

                            return (
                                item.read !==
                                true
                            );
                        }
                    )
                    .length;


            NOTIFY.updateBadges();


            return NOTIFY.state
                .unread;
        };


    /* ========================================================
       UPDATE BADGES
       ======================================================== */

    NOTIFY.updateBadges =
        function () {

            const count =
                NOTIFY.state.unread;


            document
                .querySelectorAll(
                    "[data-notification-count]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count > 99
                                ? "99+"
                                : String(
                                    count
                                );


                        element.style.display =
                            count > 0
                                ? ""
                                : "none";
                    }
                );


            document
                .querySelectorAll(
                    ".notification-badge"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count > 99
                                ? "99+"
                                : String(
                                    count
                                );


                        element.classList.toggle(
                            "show",
                            count > 0
                        );
                    }
                );


            document.title =
                count > 0
                    ? "(" +
                      (
                          count > 99
                              ? "99+"
                              : count
                      ) +
                      ") RiderX"
                    : "RiderX";
        };


    /* ========================================================
       ADD NOTIFICATION
       ======================================================== */

    NOTIFY.add =
        async function (
            data,
            options
        ) {

            data =
                data || {};

            options =
                options || {};


            const notification = {

                id:
                    data.id ||
                    NOTIFY.createId(),

                type:
                    data.type ||
                    "general",

                title:
                    data.title ||
                    "RiderX",

                body:
                    data.body ||
                    "",

                message:
                    data.message ||
                    data.body ||
                    "",

                read:
                    data.read === true,

                timestamp:
                    data.timestamp ||
                    NOTIFY.now(),

                createdAt:
                    data.createdAt ||
                    NOTIFY.now(),

                rideId:
                    data.rideId ||
                    null,

                userId:
                    data.userId ||
                    NOTIFY.state.userId ||
                    null,

                role:
                    data.role ||
                    NOTIFY.state.role ||
                    null,

                data:
                    data.data ||
                    {}
            };


            /*
             * Avoid duplicates.
             */

            const exists =
                NOTIFY.state
                    .notifications
                    .some(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                notification.id
                            );
                        }
                    );


            if (exists) {

                return notification;
            }


            NOTIFY.state
                .notifications
                .unshift(
                    notification
                );


            NOTIFY.state
                .notifications =
                NOTIFY.state
                    .notifications
                    .slice(
                        0,
                        NOTIFY.config
                            .maxLocalNotifications
                    );


            NOTIFY.calculateUnread();

            NOTIFY.saveLocal();

            NOTIFY.render();


            if (
                options.sound !==
                false
            ) {

                NOTIFY.playSound();
            }


            if (
                options.browser !==
                false
            ) {

                NOTIFY.showBrowser(
                    notification
                );
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-notification",
                    {
                        detail:
                            notification
                    }
                )
            );


            return notification;
        };


    /* ========================================================
       SAVE TO FIREBASE
       ======================================================== */

    NOTIFY.saveToFirebase =
        async function (
            data
        ) {

            if (
                !data
            ) {
                return false;
            }


            /*
             * Realtime Database
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    const ref =
                        RX.firebase
                            .rtdb
                            .ref(
                                NOTIFY.config
                                    .rtdbPath
                            )
                            .push();


                    const id =
                        data.id ||
                        ref.key;


                    await ref.set(
                        {
                            ...data,
                            id:
                                id
                        }
                    );


                    return id;

                } catch (error) {

                    console.warn(
                        "RTDB notification write failed:",
                        error
                    );
                }
            }


            /*
             * Firestore fallback.
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    const collection =
                        RX.firebase
                            .db
                            .collection(
                                NOTIFY.config
                                    .firestoreCollection
                            );


                    const doc =
                        data.id
                            ? collection.doc(
                                data.id
                            )
                            : collection.doc();


                    const id =
                        data.id ||
                        doc.id;


                    await doc.set(
                        {
                            ...data,
                            id:
                                id
                        },
                        {
                            merge:
                                true
                        }
                    );


                    return id;

                } catch (error) {

                    console.warn(
                        "Firestore notification write failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       SEND NOTIFICATION
       ======================================================== */

    NOTIFY.send =
        async function (
            userId,
            data
        ) {

            if (
                !userId
            ) {

                return false;
            }


            const notification = {

                ...data,

                userId:
                    userId,

                timestamp:
                    data.timestamp ||
                    NOTIFY.now(),

                createdAt:
                    data.createdAt ||
                    NOTIFY.now(),

                read:
                    false
            };


            return NOTIFY.saveToFirebase(
                notification
            );
        };


    /* ========================================================
       RIDE NOTIFICATION HELPERS
       ======================================================== */

    NOTIFY.rideRequested =
        function (
            rideId,
            options
        ) {

            options =
                options || {};


            return NOTIFY.add(
                {

                    id:
                        "ride_requested_" +
                        rideId,

                    type:
                        "ride_requested",

                    title:
                        options.title ||
                        "New Ride Request",

                    body:
                        options.body ||
                        "A new ride request is available.",

                    rideId:
                        rideId,

                    data:
                        options.data ||
                        {}
                }
            );
        };


    NOTIFY.rideAccepted =
        function (
            rideId,
            riderName
        ) {

            return NOTIFY.add(
                {

                    id:
                        "ride_accepted_" +
                        rideId,

                    type:
                        "ride_accepted",

                    title:
                        "Rider Accepted",

                    body:
                        riderName
                            ? riderName +
                              " accepted your ride."
                            : "Your ride has been accepted.",

                    rideId:
                        rideId
                }
            );
        };


    NOTIFY.riderArriving =
        function (
            rideId
        ) {

            return NOTIFY.add(
                {

                    id:
                        "rider_arriving_" +
                        rideId,

                    type:
                        "rider_arriving",

                    title:
                        "Rider Is Arriving",

                    body:
                        "Your rider is on the way.",

                    rideId:
                        rideId
                }
            );
        };


    NOTIFY.riderArrived =
        function (
            rideId
        ) {

            return NOTIFY.add(
                {

                    id:
                        "rider_arrived_" +
                        rideId,

                    type:
                        "rider_arrived",

                    title:
                        "Rider Arrived",

                    body:
                        "Your rider has reached the pickup location.",

                    rideId:
                        rideId
                }
            );
        };


    NOTIFY.rideStarted =
        function (
            rideId
        ) {

            return NOTIFY.add(
                {

                    id:
                        "ride_started_" +
                        rideId,

                    type:
                        "ride_started",

                    title:
                        "Ride Started",

                    body:
                        "Your ride has started.",

                    rideId:
                        rideId
                }
            );
        };


    NOTIFY.rideCompleted =
        function (
            rideId,
            fare
        ) {

            const body =
                fare !==
                undefined
                    ? "Ride completed. Total fare: ₹" +
                      Number(
                          fare
                      ).toFixed(0)
                    : "Your ride has been completed.";


            return NOTIFY.add(
                {

                    id:
                        "ride_completed_" +
                        rideId,

                    type:
                        "ride_completed",

                    title:
                        "Ride Completed",

                    body:
                        body,

                    rideId:
                        rideId,

                    data: {
                        fare:
                            fare
                    }
                }
            );
        };


    NOTIFY.rideCancelled =
        function (
            rideId,
            reason
        ) {

            return NOTIFY.add(
                {

                    id:
                        "ride_cancelled_" +
                        rideId,

                    type:
                        "ride_cancelled",

                    title:
                        "Ride Cancelled",

                    body:
                        reason
                            ? "Ride cancelled: " +
                              reason
                            : "Your ride has been cancelled.",

                    rideId:
                        rideId,

                    data: {
                        reason:
                            reason || ""
                    }
                }
            );
        };


    NOTIFY.otp =
        function (
            rideId,
            otp
        ) {

            return NOTIFY.add(
                {

                    id:
                        "ride_otp_" +
                        rideId,

                    type:
                        "otp",

                    title:
                        "Ride OTP",

                    body:
                        "Your ride OTP is " +
                        String(
                            otp
                        ),

                    rideId:
                        rideId,

                    data: {
                        otp:
                            String(
                                otp
                            )
                    }
                }
            );
        };


    NOTIFY.paymentSuccess =
        function (
            rideId,
            amount
        ) {

            return NOTIFY.add(
                {

                    id:
                        "payment_success_" +
                        rideId,

                    type:
                        "payment_success",

                    title:
                        "Payment Successful",

                    body:
                        "Payment of ₹" +
                        Number(
                            amount
                        ).toFixed(0) +
                        " was successful.",

                    rideId:
                        rideId,

                    data: {
                        amount:
                            amount
                    }
                }
            );
        };


    NOTIFY.paymentFailed =
        function (
            rideId
        ) {

            return NOTIFY.add(
                {

                    id:
                        "payment_failed_" +
                        rideId,

                    type:
                        "payment_failed",

                    title:
                        "Payment Failed",

                    body:
                        "Your payment could not be completed.",

                    rideId:
                        rideId
                }
            );
        };


    NOTIFY.chat =
        function (
            rideId,
            senderName,
            message
        ) {

            return NOTIFY.add(
                {

                    id:
                        NOTIFY.createId(),

                    type:
                        "chat",

                    title:
                        senderName ||
                        "New Message",

                    body:
                        message ||
                        "You have a new message.",

                    rideId:
                        rideId,

                    data: {
                        sender:
                            senderName || ""
                    }
                }
            );
        };


    NOTIFY.support =
        function (
            title,
            body
        ) {

            return NOTIFY.add(
                {

                    id:
                        NOTIFY.createId(),

                    type:
                        "support",

                    title:
                        title ||
                        "Support",

                    body:
                        body ||
                        "You have a new support update."
                }
            );
        };


    /* ========================================================
       MARK READ
       ======================================================== */

    NOTIFY.markRead =
        async function (
            id
        ) {

            const notification =
                NOTIFY.state
                    .notifications
                    .find(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                id
                            );
                        }
                    );


            if (
                !notification
            ) {

                return false;
            }


            notification.read =
                true;


            NOTIFY.calculateUnread();

            NOTIFY.saveLocal();

            NOTIFY.render();


            /*
             * Firebase update.
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                try {

                    await RX.firebase
                        .rtdb
                        .ref(
                            NOTIFY.config
                                .rtdbPath +
                            "/" +
                            id +
                            "/read"
                        )
                        .set(
                            true
                        );

                } catch (error) {

                    console.warn(
                        error
                    );
                }
            }


            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            NOTIFY.config
                                .firestoreCollection
                        )
                        .doc(
                            id
                        )
                        .set(
                            {
                                read:
                                    true
                            },
                            {
                                merge:
                                    true
                            }
                        );

                } catch (error) {

                    console.warn(
                        error
                    );
                }
            }


            return true;
        };


    /* ========================================================
       MARK ALL READ
       ======================================================== */

    NOTIFY.markAllRead =
        async function () {

            const notifications =
                NOTIFY.state
                    .notifications;


            notifications.forEach(
                function (
                    notification
                ) {

                    notification.read =
                        true;
                }
            );


            NOTIFY.calculateUnread();

            NOTIFY.saveLocal();

            NOTIFY.render();


            /*
             * Firestore batch.
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    const batch =
                        RX.firebase
                            .db
                            .batch();


                    notifications
                        .forEach(
                            function (
                                notification
                            ) {

                                const ref =
                                    RX.firebase
                                        .db
                                        .collection(
                                            NOTIFY.config
                                                .firestoreCollection
                                        )
                                        .doc(
                                            notification.id
                                        );


                                batch.update(
                                    ref,
                                    {
                                        read:
                                            true
                                    }
                                );
                            }
                        );


                    await batch.commit();

                } catch (error) {

                    console.warn(
                        "Unable to mark all read:",
                        error
                    );
                }
            }


            return true;
        };


    /* ========================================================
       DELETE NOTIFICATION
       ======================================================== */

    NOTIFY.remove =
        async function (
            id
        ) {

            NOTIFY.state
                .notifications =
                NOTIFY.state
                    .notifications
                    .filter(
                        function (
                            item
                        ) {

                            return (
                                item.id !==
                                id
                            );
                        }
                    );


            NOTIFY.calculateUnread();

            NOTIFY.saveLocal();

            NOTIFY.render();


            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    await RX.firebase
                        .db
                        .collection(
                            NOTIFY.config
                                .firestoreCollection
                        )
                        .doc(
                            id
                        )
                        .delete();

                } catch (error) {

                    console.warn(
                        "Delete notification failed:",
                        error
                    );
                }
            }


            return true;
        };


    /* ========================================================
       CLEAR ALL
       ======================================================== */

    NOTIFY.clear =
        async function () {

            NOTIFY.state
                .notifications =
                [];


            NOTIFY.state.unread =
                0;


            NOTIFY.saveLocal();

            NOTIFY.render();

            NOTIFY.updateBadges();

            return true;
        };


    /* ========================================================
       GET ALL
       ======================================================== */

    NOTIFY.getAll =
        function () {

            return [
                ...NOTIFY.state
                    .notifications
            ];
        };


    /* ========================================================
       GET UNREAD
       ======================================================== */

    NOTIFY.getUnread =
        function () {

            return NOTIFY.state
                .notifications
                .filter(
                    function (
                        item
                    ) {

                        return (
                            item.read !==
                            true
                        );
                    }
                );
        };


    /* ========================================================
       FIND BY RIDE
       ======================================================== */

    NOTIFY.getByRide =
        function (
            rideId
        ) {

            return NOTIFY.state
                .notifications
                .filter(
                    function (
                        item
                    ) {

                        return (
                            item.rideId ===
                            rideId
                        );
                    }
                );
        };


    /* ========================================================
       RENDER NOTIFICATION LIST
       ======================================================== */

    NOTIFY.render =
        function (
            container
        ) {

            if (!container) {

                container =
                    document.querySelector(
                        "[data-notification-list]"
                    );
            }


            if (!container) {
                return;
            }


            const notifications =
                NOTIFY.state
                    .notifications
                    .slice(
                        0,
                        NOTIFY.config
                            .maxVisibleNotifications
                    );


            if (
                !notifications.length
            ) {

                container.innerHTML =
                    '<div class="notification-empty">' +
                    '<div class="notification-empty-icon">🔔</div>' +
                    '<div class="notification-empty-title">' +
                    'No notifications' +
                    "</div>" +
                    '<div class="notification-empty-text">' +
                    "You're all caught up." +
                    "</div>" +
                    "</div>";

                return;
            }


            container.innerHTML =
                "";


            notifications.forEach(
                function (
                    notification
                ) {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "notification-item";


                    if (
                        !notification.read
                    ) {

                        item.classList.add(
                            "unread"
                        );
                    }


                    item.dataset
                        .notificationId =
                        notification.id;


                    const time =
                        NOTIFY.formatTime(
                            notification.timestamp
                        );


                    item.innerHTML =
                        '<div class="notification-icon">' +
                        NOTIFY.icon(
                            notification.type
                        ) +
                        "</div>" +

                        '<div class="notification-content">' +

                        '<div class="notification-title">' +
                        NOTIFY.escape(
                            notification.title
                        ) +
                        "</div>" +

                        '<div class="notification-body">' +
                        NOTIFY.escape(
                            notification.body ||
                            notification.message
                        ) +
                        "</div>" +

                        '<div class="notification-time">' +
                        NOTIFY.escape(
                            time
                        ) +
                        "</div>" +

                        "</div>" +

                        '<button type="button" class="notification-delete" aria-label="Delete">' +
                        "×" +
                        "</button>";


                    item.addEventListener(
                        "click",
                        function () {

                            NOTIFY.markRead(
                                notification.id
                            );


                            window.dispatchEvent(
                                new CustomEvent(
                                    "riderx-notification-click",
                                    {
                                        detail:
                                            notification
                                    }
                                )
                            );
                        }
                    );


                    const deleteButton =
                        item.querySelector(
                            ".notification-delete"
                        );


                    if (
                        deleteButton
                    ) {

                        deleteButton.addEventListener(
                            "click",
                            function (
                                event
                            ) {

                                event
                                    .stopPropagation();


                                NOTIFY.remove(
                                    notification.id
                                );
                            }
                        );
                    }


                    container.appendChild(
                        item
                    );
                }
            );
        };


    /* ========================================================
       ICON
       ======================================================== */

    NOTIFY.icon =
        function (
            type
        ) {

            const icons = {

                ride_requested:
                    "🚕",

                ride_accepted:
                    "✅",

                rider_arriving:
                    "🏍️",

                rider_arrived:
                    "📍",

                ride_started:
                    "🚀",

                ride_completed:
                    "🏁",

                ride_cancelled:
                    "❌",

                otp:
                    "🔐",

                payment_success:
                    "💳",

                payment_failed:
                    "⚠️",

                chat:
                    "💬",

                support:
                    "🎧",

                wallet:
                    "💰",

                referral:
                    "🎁",

                promotion:
                    "🎉",

                safety:
                    "🛡️",

                general:
                    "🔔"
            };


            return (
                icons[type] ||
                icons.general
            );
        };


    /* ========================================================
       FORMAT TIME
       ======================================================== */

    NOTIFY.formatTime =
        function (
            timestamp
        ) {

            if (
                !timestamp
            ) {

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


            const now =
                new Date();


            const diff =
                now.getTime() -
                date.getTime();


            const minute =
                60 * 1000;

            const hour =
                60 * minute;

            const day =
                24 * hour;


            if (
                diff < minute
            ) {

                return "Just now";
            }


            if (
                diff < hour
            ) {

                return (
                    Math.floor(
                        diff / minute
                    ) +
                    " min ago"
                );
            }


            if (
                diff < day
            ) {

                return (
                    Math.floor(
                        diff / hour
                    ) +
                    " hr ago"
                );
            }


            if (
                diff < 7 * day
            ) {

                return (
                    Math.floor(
                        diff / day
                    ) +
                    " days ago"
                );
            }


            return date.toLocaleDateString(
                "en-IN",
                {
                    day:
                        "2-digit",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );
        };


    /* ========================================================
       FIREBASE LISTENER
       ======================================================== */

    NOTIFY.startListener =
        function (
            userId,
            role
        ) {

            NOTIFY.stopListener();


            if (
                !userId
            ) {

                return false;
            }


            NOTIFY.state.userId =
                userId;


            NOTIFY.state.role =
                role ||
                null;


            /*
             * Realtime Database
             *
             * notifications/{notificationId}
             */

            if (
                RX.firebase &&
                RX.firebase.rtdb
            ) {

                const ref =
                    RX.firebase
                        .rtdb
                        .ref(
                            NOTIFY.config
                                .rtdbPath
                        );


                NOTIFY.state.listener =
                    function (
                        snapshot
                    ) {

                        const data =
                            snapshot.val();


                        if (
                            !data
                        ) {
                            return;
                        }


                        const notification = {

                            ...data,

                            id:
                                data.id ||
                                snapshot.key
                        };


                        /*
                         * Only receive
                         * notifications for
                         * this user or
                         * broadcast messages.
                         */

                        if (
                            notification.userId &&
                            notification.userId !==
                            userId
                        ) {

                            return;
                        }


                        if (
                            notification.role &&
                            role &&
                            notification.role !==
                            role
                        ) {

                            return;
                        }


                        NOTIFY.add(
                            notification
                        );
                    };


                ref.on(
                    "child_added",
                    NOTIFY.state.listener
                );


                return true;
            }


            /*
             * Firestore fallback.
             */

            if (
                RX.firebase &&
                RX.firebase.db
            ) {

                try {

                    let query =
                        RX.firebase
                            .db
                            .collection(
                                NOTIFY.config
                                    .firestoreCollection
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
                                NOTIFY.config
                                    .maxVisibleNotifications
                            );


                    NOTIFY.state
                        .firestoreUnsubscribe =
                        query.onSnapshot(
                            function (
                                snapshot
                            ) {

                                snapshot.docChanges()
                                    .forEach(
                                        function (
                                            change
                                        ) {

                                            if (
                                                change.type !==
                                                "added"
                                            ) {

                                                return;
                                            }


                                            const data =
                                                change.doc.data();


                                            NOTIFY.add(
                                                {
                                                    ...data,

                                                    id:
                                                        data.id ||
                                                        change.doc.id
                                                },
                                                {
                                                    sound:
                                                        false,

                                                    browser:
                                                        false
                                                }
                                            );
                                        }
                                    );
                            },
                            function (
                                error
                            ) {

                                console.warn(
                                    "Notification listener error:",
                                    error
                                );
                            }
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Unable to start notification listener:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    NOTIFY.stopListener =
        function () {

            if (
                RX.firebase &&
                RX.firebase.rtdb &&
                NOTIFY.state.listener
            ) {

                try {

                    RX.firebase
                        .rtdb
                        .ref(
                            NOTIFY.config
                                .rtdbPath
                        )
                        .off(
                            "child_added",
                            NOTIFY.state.listener
                        );

                } catch (error) {

                    console.warn(
                        error
                    );
                }
            }


            if (
                typeof NOTIFY.state
                    .firestoreUnsubscribe ===
                "function"
            ) {

                try {

                    NOTIFY.state
                        .firestoreUnsubscribe();

                } catch (error) {

                    console.warn(
                        error
                    );
                }
            }


            NOTIFY.state.listener =
                null;

            NOTIFY.state
                .firestoreUnsubscribe =
                null;
        };


    /* ========================================================
       AUTO AUTH LISTENER
       ======================================================== */

    NOTIFY.listenToAuth =
        function () {

            if (
                !RX.firebase ||
                !RX.firebase.auth
            ) {

                return;
            }


            RX.firebase.auth
                .onAuthStateChanged(
                    function (
                        user
                    ) {

                        if (
                            user
                        ) {

                            NOTIFY.startListener(
                                user.uid,
                                user.role ||
                                null
                            );

                        } else {

                            NOTIFY.stopListener();

                            NOTIFY.state
                                .userId =
                                null;

                            NOTIFY.state
                                .role =
                                null;
                        }
                    }
                );
        };


    /* ========================================================
       OPEN NOTIFICATION PANEL
       ======================================================== */

    NOTIFY.openPanel =
        function () {

            const panel =
                document.querySelector(
                    "[data-notification-panel]"
                );


            if (!panel) {
                return;
            }


            panel.classList.add(
                "open"
            );


            document.body.classList.add(
                "notification-panel-open"
            );


            NOTIFY.render();


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-notification-panel-open"
                )
            );
        };


    /* ========================================================
       CLOSE PANEL
       ======================================================== */

    NOTIFY.closePanel =
        function () {

            const panel =
                document.querySelector(
                    "[data-notification-panel]"
                );


            if (!panel) {
                return;
            }


            panel.classList.remove(
                "open"
            );


            document.body.classList.remove(
                "notification-panel-open"
            );
        };


    /* ========================================================
       BIND UI
       ======================================================== */

    NOTIFY.bind =
        function () {

            document
                .querySelectorAll(
                    "[data-open-notifications]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .notificationBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .notificationBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                NOTIFY.openPanel();
                            }
                        );
                    }
                );


            document
                .querySelectorAll(
                    "[data-close-notifications]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .notificationBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .notificationBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                NOTIFY.closePanel();
                            }
                        );
                    }
                );


            document
                .querySelectorAll(
                    "[data-mark-all-notifications]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .notificationBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .notificationBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                NOTIFY.markAllRead();
                            }
                        );
                    }
                );


            document
                .querySelectorAll(
                    "[data-clear-notifications]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        if (
                            button.dataset
                                .notificationBound ===
                            "true"
                        ) {

                            return;
                        }


                        button.dataset
                            .notificationBound =
                            "true";


                        button.addEventListener(
                            "click",
                            function () {

                                NOTIFY.clear();
                            }
                        );
                    }
                );


            document
                .querySelectorAll(
                    "[data-notification-sound]"
                )
                .forEach(
                    function (
                        control
                    ) {

                        control.checked =
                            NOTIFY.state
                                .soundEnabled;


                        control.addEventListener(
                            "change",
                            function () {

                                NOTIFY
                                    .setSoundEnabled(
                                        control
                                            .checked
                                    );
                            }
                        );
                    }
                );
        };


    /* ========================================================
       INIT
       ======================================================== */

    NOTIFY.init =
        function () {

            if (
                NOTIFY.state.initialized
            ) {

                return;
            }


            NOTIFY.state.initialized =
                true;


            NOTIFY.loadSettings();

            NOTIFY.loadLocal();

            NOTIFY.bind();

            NOTIFY.updateBadges();

            NOTIFY.render();

            NOTIFY.listenToAuth();


            /*
             * Browser permission is requested
             * only after user interaction in
             * supported browsers.
             */

            document.addEventListener(
                "click",
                function () {

                    if (
                        NOTIFY.state
                            .permission ===
                        "default"
                    ) {

                        if (
                            "Notification" in
                            window
                        ) {

                            NOTIFY.state
                                .permission =
                                Notification
                                    .permission;
                        }
                    }

                },
                {
                    once:
                        true
                }
            );


            console.log(
                "RiderX Notification Engine loaded."
            );
        };


    /* ========================================================
       GLOBAL EVENTS
       ======================================================== */

    window.addEventListener(
        "riderx-ride-accepted",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.rideAccepted(
                    data.rideId,
                    data.riderName
                );
            }
        }
    );


    window.addEventListener(
        "riderx-rider-arriving",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.riderArriving(
                    data.rideId
                );
            }
        }
    );


    window.addEventListener(
        "riderx-rider-arrived",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.riderArrived(
                    data.rideId
                );
            }
        }
    );


    window.addEventListener(
        "riderx-ride-started",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.rideStarted(
                    data.rideId
                );
            }
        }
    );


    window.addEventListener(
        "riderx-ride-completed",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.rideCompleted(
                    data.rideId,
                    data.fare
                );
            }
        }
    );


    window.addEventListener(
        "riderx-ride-cancelled",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.rideCancelled(
                    data.rideId,
                    data.reason
                );
            }
        }
    );


    window.addEventListener(
        "riderx-payment-success",
        function (
            event
        ) {

            const data =
                event.detail ||
                {};


            if (
                data.rideId
            ) {

                NOTIFY.paymentSuccess(
                    data.rideId,
                    data.amount
                );
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
            NOTIFY.init
        );

    } else {

        NOTIFY.init();
    }


})();
