/* ============================================================
   RIDERX 2.0
   NOTIFICATION ENGINE
   File: js/notification.js

   Features:
   - Customer notifications
   - Rider notifications
   - Ride request alerts
   - Ride accepted / arrived / started / completed
   - Browser notifications
   - In-app notification center
   - Unread badge
   - Notification sound
   - Firebase Realtime Database support
   - Firestore support when available
   - Local fallback
   - Mark read / mark all read
   - Notification history
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.notification = RX.notification || {};

    const NOTIFY = RX.notification;


    /* ========================================================
       CONFIG
       ======================================================== */

    NOTIFY.config = {

        maxNotifications:
            100,

        storageKey:
            "riderx_notifications",

        soundStorageKey:
            "riderx_notification_sound",

        permissionStorageKey:
            "riderx_notification_permission",

        defaultTitle:
            "RiderX",

        defaultIcon:
            "/assets/logo/logo.png",

        soundUrl:
            "/assets/sounds/notification.mp3",

        rideRequestSoundUrl:
            "/assets/sounds/ride-request.mp3"
    };


    /* ========================================================
       STATE
       ======================================================== */

    NOTIFY.state = {

        notifications:
            [],

        unreadCount:
            0,

        permission:
            "default",

        currentUser:
            null,

        listening:
            false,

        initialized:
            false,

        audio:
            null,

        rideRequestAudio:
            null,

        firebaseListeners:
            []
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    NOTIFY.generateId =
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
                    value ?? ""
                );

            return div.innerHTML;
        };


    NOTIFY.timeAgo =
        function (
            timestamp
        ) {

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


            const seconds =
                Math.floor(
                    (
                        Date.now() -
                        date.getTime()
                    ) / 1000
                );


            if (
                seconds < 10
            ) {

                return "Just now";
            }


            if (
                seconds < 60
            ) {

                return (
                    seconds +
                    " sec ago"
                );
            }


            const minutes =
                Math.floor(
                    seconds / 60
                );


            if (
                minutes < 60
            ) {

                return (
                    minutes +
                    " min ago"
                );
            }


            const hours =
                Math.floor(
                    minutes / 60
                );


            if (
                hours < 24
            ) {

                return (
                    hours +
                    " hr ago"
                );
            }


            const days =
                Math.floor(
                    hours / 24
                );


            if (
                days < 7
            ) {

                return (
                    days +
                    " day" +
                    (
                        days > 1
                            ? "s"
                            : ""
                    ) +
                    " ago"
                );
            }


            return date.toLocaleDateString(
                "en-IN",
                {

                    day:
                        "numeric",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );
        };


    NOTIFY.getUser =
        function () {

            if (
                NOTIFY.state.currentUser
            ) {

                return NOTIFY.state
                    .currentUser;
            }


            /*
             * Firebase Auth.
             */

            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    const user =
                        firebase.auth()
                            .currentUser;


                    if (user) {

                        NOTIFY.state
                            .currentUser =
                            user;

                        return user;
                    }
                }

            } catch (error) {

                console.warn(
                    "Firebase auth unavailable:",
                    error
                );
            }


            /*
             * Local session fallback.
             */

            try {

                const session =
                    JSON.parse(
                        localStorage.getItem(
                            "riderx_user"
                        ) ||
                        "null"
                    );


                if (session) {

                    NOTIFY.state
                        .currentUser =
                        session;

                    return session;
                }

            } catch (error) {

                console.warn(
                    "Session read error:",
                    error
                );
            }


            return null;
        };


    NOTIFY.getUserId =
        function () {

            const user =
                NOTIFY.getUser();


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


    NOTIFY.getRole =
        function () {

            const user =
                NOTIFY.getUser();


            if (!user) {
                return null;
            }


            return (
                user.role ||
                user.userRole ||
                localStorage.getItem(
                    "riderx_role"
                ) ||
                null
            );
        };


    /* ========================================================
       STORAGE
       ======================================================== */

    NOTIFY.load =
        function () {

            try {

                const saved =
                    JSON.parse(
                        localStorage.getItem(
                            NOTIFY.config
                                .storageKey
                        ) ||
                        "[]"
                    );


                if (
                    Array.isArray(
                        saved
                    )
                ) {

                    NOTIFY.state
                        .notifications =
                        saved;
                }

            } catch (error) {

                console.warn(
                    "Notification storage error:",
                    error
                );


                NOTIFY.state
                    .notifications =
                    [];
            }


            NOTIFY.recalculateUnread();

            return NOTIFY.state
                .notifications;
        };


    NOTIFY.save =
        function () {

            try {

                const notifications =
                    NOTIFY.state
                        .notifications
                        .slice(
                            0,
                            NOTIFY.config
                                .maxNotifications
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
                    "Notification save error:",
                    error
                );
            }
        };


    NOTIFY.recalculateUnread =
        function () {

            NOTIFY.state
                .unreadCount =
                NOTIFY.state
                    .notifications
                    .filter(
                        function (
                            notification
                        ) {

                            return (
                                !notification
                                    .read
                            );
                        }
                    )
                    .length;


            NOTIFY.updateBadges();
        };


    /* ========================================================
       PERMISSION
       ======================================================== */

    NOTIFY.requestPermission =
        async function () {

            if (
                typeof Notification ===
                "undefined"
            ) {

                return "unsupported";
            }


            if (
                Notification.permission ===
                "granted"
            ) {

                NOTIFY.state.permission =
                    "granted";

                return "granted";
            }


            if (
                Notification.permission ===
                "denied"
            ) {

                NOTIFY.state.permission =
                    "denied";

                return "denied";
            }


            try {

                const permission =
                    await Notification
                        .requestPermission();


                NOTIFY.state.permission =
                    permission;


                localStorage.setItem(
                    NOTIFY.config
                        .permissionStorageKey,
                    permission
                );


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
        async function (
            notification
        ) {

            if (
                typeof Notification ===
                "undefined"
            ) {

                return false;
            }


            if (
                Notification.permission !==
                "granted"
            ) {

                return false;
            }


            try {

                const options = {

                    body:
                        notification.body ||
                        notification.message ||
                        "",

                    icon:
                        notification.icon ||
                        NOTIFY.config
                            .defaultIcon,

                    badge:
                        notification.icon ||
                        NOTIFY.config
                            .defaultIcon,

                    tag:
                        notification.type ||
                        notification.id,

                    renotify:
                        true,

                    data:
                        notification.data ||
                        {},

                    requireInteraction:
                        notification
                            .requireInteraction ||
                        false
                };


                const browserNotification =
                    new Notification(
                        notification.title ||
                        NOTIFY.config
                            .defaultTitle,
                        options
                    );


                browserNotification
                    .onclick =
                    function () {

                        window.focus();


                        if (
                            notification
                                .data &&
                            notification
                                .data.url
                        ) {

                            window.location.href =
                                notification
                                    .data
                                    .url;
                        }


                        browserNotification
                            .close();
                    };


                return true;

            } catch (error) {

                console.warn(
                    "Browser notification error:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       SOUND
       ======================================================== */

    NOTIFY.createAudio =
        function (
            type
        ) {

            let source =
                NOTIFY.config
                    .soundUrl;


            if (
                type ===
                "ride_request"
            ) {

                source =
                    NOTIFY.config
                        .rideRequestSoundUrl;
            }


            try {

                const audio =
                    new Audio(
                        source
                    );


                audio.preload =
                    "auto";


                audio.volume =
                    type ===
                    "ride_request"
                        ? 1
                        : 0.75;


                return audio;

            } catch (error) {

                return null;
            }
        };


    NOTIFY.playSound =
        function (
            type = "default"
        ) {

            try {

                let audio;


                if (
                    type ===
                    "ride_request"
                ) {

                    if (
                        !NOTIFY.state
                            .rideRequestAudio
                    ) {

                        NOTIFY.state
                            .rideRequestAudio =
                            NOTIFY.createAudio(
                                "ride_request"
                            );
                    }


                    audio =
                        NOTIFY.state
                            .rideRequestAudio;

                } else {

                    if (
                        !NOTIFY.state
                            .audio
                    ) {

                        NOTIFY.state
                            .audio =
                            NOTIFY.createAudio(
                                "default"
                            );
                    }


                    audio =
                        NOTIFY.state.audio;
                }


                if (!audio) {
                    return false;
                }


                audio.currentTime =
                    0;


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
                             * audio until user
                             * interaction.
                             */
                        }
                    );
                }


                return true;

            } catch (error) {

                console.warn(
                    "Notification sound error:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       VIBRATION
       ======================================================== */

    NOTIFY.vibrate =
        function (
            pattern
        ) {

            if (
                navigator.vibrate
            ) {

                try {

                    navigator.vibrate(
                        pattern ||
                        [200, 100, 200]
                    );

                } catch (error) {
                    /* Ignore */
                }
            }
        };


    /* ========================================================
       ADD NOTIFICATION
       ======================================================== */

    NOTIFY.add =
        async function (
            data = {}
        ) {

            const notification = {

                id:
                    data.id ||
                    NOTIFY.generateId(),

                type:
                    data.type ||
                    "general",

                title:
                    data.title ||
                    NOTIFY.config
                        .defaultTitle,

                body:
                    data.body ||
                    data.message ||
                    "",

                message:
                    data.message ||
                    data.body ||
                    "",

                icon:
                    data.icon ||
                    NOTIFY.config
                        .defaultIcon,

                read:
                    Boolean(
                        data.read
                    ),

                timestamp:
                    data.timestamp ||
                    Date.now(),

                createdAt:
                    data.createdAt ||
                    Date.now(),

                requireInteraction:
                    Boolean(
                        data.requireInteraction
                    ),

                data:
                    data.data ||
                    {},

                rideId:
                    data.rideId ||
                    null,

                bookingId:
                    data.bookingId ||
                    null,

                userId:
                    data.userId ||
                    null
            };


            /*
             * Avoid duplicate notification.
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
                            .maxNotifications
                    );


            NOTIFY.save();

            NOTIFY.recalculateUnread();

            NOTIFY.render();

            /*
             * Sound.
             */

            if (
                data.sound !== false
            ) {

                NOTIFY.playSound(
                    data.soundType ||
                    (
                        data.type ===
                        "ride_request"
                            ? "ride_request"
                            : "default"
                    )
                );
            }


            /*
             * Vibration.
             */

            if (
                data.vibrate !== false
            ) {

                NOTIFY.vibrate(
                    data.vibration
                );
            }


            /*
             * Browser notification.
             */

            if (
                data.browser !== false
            ) {

                NOTIFY.showBrowser(
                    notification
                );
            }


            /*
             * Dispatch event.
             */

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
       MARK READ
       ======================================================== */

    NOTIFY.markRead =
        function (
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


            NOTIFY.save();

            NOTIFY.recalculateUnread();

            NOTIFY.render();

            return true;
        };


    /* ========================================================
       MARK ALL READ
       ======================================================== */

    NOTIFY.markAllRead =
        function () {

            NOTIFY.state
                .notifications
                .forEach(
                    function (
                        notification
                    ) {

                        notification.read =
                            true;
                    }
                );


            NOTIFY.save();

            NOTIFY.recalculateUnread();

            NOTIFY.render();


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-notifications-read"
                )
            );
        };


    /* ========================================================
       DELETE
       ======================================================== */

    NOTIFY.remove =
        function (
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


            NOTIFY.save();

            NOTIFY.recalculateUnread();

            NOTIFY.render();
        };


    /* ========================================================
       CLEAR ALL
       ======================================================== */

    NOTIFY.clear =
        function () {

            NOTIFY.state
                .notifications =
                [];


            NOTIFY.save();

            NOTIFY.recalculateUnread();

            NOTIFY.render();
        };


    /* ========================================================
       GET NOTIFICATIONS
       ======================================================== */

    NOTIFY.getAll =
        function () {

            return [
                ...NOTIFY.state
                    .notifications
            ];
        };


    NOTIFY.getUnread =
        function () {

            return NOTIFY.state
                .notifications
                .filter(
                    function (
                        notification
                    ) {

                        return !notification
                            .read;
                    }
                );
        };


    /* ========================================================
       BADGES
       ======================================================== */

    NOTIFY.updateBadges =
        function () {

            const count =
                NOTIFY.state
                    .unreadCount;


            document
                .querySelectorAll(
                    "[data-notification-badge]"
                )
                .forEach(
                    function (
                        badge
                    ) {

                        badge.textContent =
                            count > 99
                                ? "99+"
                                : String(
                                    count
                                );


                        badge.hidden =
                            count === 0;
                    }
                );


            document
                .querySelectorAll(
                    ".notification-badge"
                )
                .forEach(
                    function (
                        badge
                    ) {

                        badge.textContent =
                            count > 99
                                ? "99+"
                                : String(
                                    count
                                );


                        badge.style.display =
                            count === 0
                                ? "none"
                                : "";
                    }
                );


            /*
             * Browser tab title.
             */

            const baseTitle =
                document
                    .title
                    .replace(
                        /^\(\d+\)\s*/,
                        ""
                    );


            document.title =
                count > 0
                    ? "(" +
                      count +
                      ") " +
                      baseTitle
                    : baseTitle;
        };


    /* ========================================================
       RENDER NOTIFICATION CENTER
       ======================================================== */

    NOTIFY.render =
        function () {

            const containers =
                document.querySelectorAll(
                    "[data-notification-list]"
                );


            if (
                !containers.length
            ) {

                NOTIFY.updateBadges();

                return;
            }


            const notifications =
                NOTIFY.state
                    .notifications;


            containers.forEach(
                function (
                    container
                ) {

                    if (
                        !notifications.length
                    ) {

                        container.innerHTML =
                            `
                            <div class="notification-empty">
                                <div class="notification-empty-icon">
                                    🔔
                                </div>

                                <h3>No notifications</h3>

                                <p>
                                    You're all caught up.
                                </p>
                            </div>
                            `;

                        return;
                    }


                    container.innerHTML =
                        notifications
                            .map(
                                function (
                                    notification
                                ) {

                                    return `
                                    <div
                                        class="notification-item ${
                                            notification.read
                                                ? "is-read"
                                                : "is-unread"
                                        }"
                                        data-notification-id="${NOTIFY.escape(notification.id)}"
                                    >

                                        <div class="notification-icon">
                                            ${
                                                notification.type ===
                                                "ride_request"
                                                    ? "🏍️"
                                                    : notification.type ===
                                                      "ride_accepted"
                                                        ? "✓"
                                                        : notification.type ===
                                                          "ride_completed"
                                                            ? "★"
                                                            : "🔔"
                                            }
                                        </div>

                                        <div class="notification-content">

                                            <div class="notification-title">
                                                ${NOTIFY.escape(
                                                    notification.title
                                                )}
                                            </div>

                                            <div class="notification-message">
                                                ${NOTIFY.escape(
                                                    notification.body
                                                )}
                                            </div>

                                            <div class="notification-time">
                                                ${NOTIFY.timeAgo(
                                                    notification.timestamp
                                                )}
                                            </div>

                                        </div>

                                        ${
                                            !notification.read
                                                ? `
                                                <span class="notification-dot"></span>
                                                `
                                                : ""
                                        }

                                    </div>
                                    `;
                                }
                            )
                            .join("");
                }
            );


            NOTIFY.updateBadges();
        };


    /* ========================================================
       CLICK EVENTS
       ======================================================== */

    NOTIFY.bindEvents =
        function () {

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target
                            .closest(
                                "[data-notifications]"
                            );


                    if (button) {

                        event.preventDefault();

                        NOTIFY.togglePanel();

                        return;
                    }


                    const markAll =
                        event.target
                            .closest(
                                "[data-notifications-mark-all]"
                            );


                    if (markAll) {

                        event.preventDefault();

                        NOTIFY.markAllRead();

                        return;
                    }


                    const clear =
                        event.target
                            .closest(
                                "[data-notifications-clear]"
                            );


                    if (clear) {

                        event.preventDefault();

                        NOTIFY.clear();

                        return;
                    }


                    const item =
                        event.target
                            .closest(
                                "[data-notification-id]"
                            );


                    if (item) {

                        const id =
                            item.dataset
                                .notificationId;


                        NOTIFY.markRead(
                            id
                        );


                        const notification =
                            NOTIFY.state
                                .notifications
                                .find(
                                    function (
                                        entry
                                    ) {

                                        return (
                                            entry.id ===
                                            id
                                        );
                                    }
                                );


                        if (
                            notification &&
                            notification.data &&
                            notification.data.url
                        ) {

                            window.location.href =
                                notification
                                    .data
                                    .url;
                        }
                    }
                }
            );
        };


    /* ========================================================
       PANEL
       ======================================================== */

    NOTIFY.togglePanel =
        function () {

            const panel =
                document.querySelector(
                    "[data-notification-panel]"
                );


            if (!panel) {

                /*
                 * If no custom panel exists,
                 * create one.
                 */

                NOTIFY.createPanel();

                return;
            }


            panel.classList.toggle(
                "active"
            );


            panel.classList.toggle(
                "open"
            );
        };


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
                "active"
            );


            panel.classList.remove(
                "open"
            );
        };


    /* ========================================================
       CREATE PANEL
       ======================================================== */

    NOTIFY.createPanel =
        function () {

            if (
                document.querySelector(
                    "[data-notification-panel]"
                )
            ) {

                NOTIFY.render();

                return;
            }


            const panel =
                document.createElement(
                    "div"
                );


            panel.className =
                "riderx-notification-panel";


            panel.setAttribute(
                "data-notification-panel",
                ""
            );


            panel.innerHTML =
                `
                <div class="notification-panel-backdrop"
                     data-notification-close></div>

                <section class="notification-panel-card">

                    <header class="notification-panel-header">

                        <div>
                            <h2>Notifications</h2>
                            <p>RiderX updates</p>
                        </div>

                        <button
                            type="button"
                            class="notification-close"
                            data-notification-close
                            aria-label="Close notifications"
                        >
                            ×
                        </button>

                    </header>


                    <div class="notification-actions">

                        <button
                            type="button"
                            data-notifications-mark-all
                        >
                            Mark all read
                        </button>

                        <button
                            type="button"
                            data-notifications-clear
                        >
                            Clear
                        </button>

                    </div>


                    <div
                        class="notification-list"
                        data-notification-list
                    ></div>

                </section>
                `;


            document.body.appendChild(
                panel
            );


            panel
                .querySelectorAll(
                    "[data-notification-close]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.addEventListener(
                            "click",
                            function () {

                                NOTIFY
                                    .closePanel();
                            }
                        );
                    }
                );


            panel.classList.add(
                "active"
            );


            NOTIFY.render();
        };


    /* ========================================================
       FIREBASE DATABASE
       ======================================================== */

    NOTIFY.getDatabase =
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
                    "Firebase RTDB unavailable:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       FIREBASE LISTENER
       ======================================================== */

    NOTIFY.startFirebaseListener =
        function () {

            if (
                NOTIFY.state.listening
            ) {

                return;
            }


            const userId =
                NOTIFY.getUserId();


            if (!userId) {

                return;
            }


            const database =
                NOTIFY.getDatabase();


            if (!database) {

                return;
            }


            const role =
                NOTIFY.getRole() ||
                "customer";


            const paths = [

                "notifications/" +
                userId,

                "notifications/" +
                role +
                "/" +
                userId
            ];


            paths.forEach(
                function (
                    path
                ) {

                    try {

                        const reference =
                            database.ref(
                                path
                            );


                        const handler =
                            function (
                                snapshot
                            ) {

                                const value =
                                    snapshot.val();


                                if (
                                    !value
                                ) {

                                    return;
                                }


                                const data = {

                                    ...value,

                                    id:
                                        value.id ||
                                        snapshot.key,

                                    userId:
                                        value.userId ||
                                        userId
                                };


                                NOTIFY.add(
                                    data
                                );
                            };


                        reference.on(
                            "child_added",
                            handler
                        );


                        NOTIFY.state
                            .firebaseListeners
                            .push(
                                {
                                    reference:
                                        reference,

                                    event:
                                        "child_added",

                                    handler:
                                        handler
                                }
                            );

                    } catch (error) {

                        console.warn(
                            "Firebase notification listener error:",
                            error
                        );
                    }
                }
            );


            NOTIFY.state.listening =
                true;
        };


    /* ========================================================
       STOP FIREBASE LISTENER
       ======================================================== */

    NOTIFY.stopFirebaseListener =
        function () {

            NOTIFY.state
                .firebaseListeners
                .forEach(
                    function (
                        listener
                    ) {

                        try {

                            listener.reference
                                .off(
                                    listener.event,
                                    listener.handler
                                );

                        } catch (error) {
                            /* Ignore */
                        }
                    }
                );


            NOTIFY.state
                .firebaseListeners =
                [];


            NOTIFY.state.listening =
                false;
        };


    /* ========================================================
       FIREBASE SEND
       ======================================================== */

    NOTIFY.sendToUser =
        async function (
            userId,
            data
        ) {

            const database =
                NOTIFY.getDatabase();


            if (
                !database ||
                !userId
            ) {

                return false;
            }


            try {

                const id =
                    data.id ||
                    NOTIFY.generateId();


                await database
                    .ref(
                        "notifications/" +
                        userId +
                        "/" +
                        id
                    )
                    .set(
                        {

                            ...data,

                            id:
                                id,

                            userId:
                                userId,

                            timestamp:
                                data.timestamp ||
                                Date.now()
                        }
                    );


                return true;

            } catch (error) {

                console.error(
                    "Notification send failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       RIDE NOTIFICATIONS
       ======================================================== */

    NOTIFY.rideRequest =
        function (
            ride
        ) {

            return NOTIFY.add({

                type:
                    "ride_request",

                title:
                    "New Ride Request",

                body:
                    ride &&
                    ride.pickupAddress
                        ? "New ride request from " +
                          ride.pickupAddress
                        : "You have a new ride request.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    ),

                bookingId:
                    ride &&
                    ride.bookingId,

                requireInteraction:
                    true,

                soundType:
                    "ride_request",

                vibration:
                    [300, 150, 300, 150, 500],

                data: {

                    rideId:
                        ride &&
                        (
                            ride.rideId ||
                            ride.id
                        ),

                    url:
                        "/rider/rides.html"
                }
            });
        };


    NOTIFY.rideAccepted =
        function (
            ride
        ) {

            return NOTIFY.add({

                type:
                    "ride_accepted",

                title:
                    "Ride Accepted",

                body:
                    "Your RiderX ride has been accepted.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    ),

                data: {

                    rideId:
                        ride &&
                        (
                            ride.rideId ||
                            ride.id
                        ),

                    url:
                        "/customer/booking.html"
                }
            });
        };


    NOTIFY.riderArriving =
        function (
            ride
        ) {

            return NOTIFY.add({

                type:
                    "rider_arriving",

                title:
                    "Rider Is On The Way",

                body:
                    "Your Rider is coming to your pickup location.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    ),

                data: {

                    rideId:
                        ride &&
                        (
                            ride.rideId ||
                            ride.id
                        ),

                    url:
                        "/customer/booking.html"
                }
            });
        };


    NOTIFY.riderArrived =
        function (
            ride
        ) {

            return NOTIFY.add({

                type:
                    "rider_arrived",

                title:
                    "Rider Has Arrived",

                body:
                    "Your Rider has arrived at the pickup location.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    ),

                requireInteraction:
                    true,

                data: {

                    rideId:
                        ride &&
                        (
                            ride.rideId ||
                            ride.id
                        ),

                    url:
                        "/customer/booking.html"
                }
            });
        };


    NOTIFY.rideStarted =
        function (
            ride
        ) {

            return NOTIFY.add({

                type:
                    "ride_started",

                title:
                    "Ride Started",

                body:
                    "Your RiderX trip has started.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    ),

                data: {

                    rideId:
                        ride &&
                        (
                            ride.rideId ||
                            ride.id
                        ),

                    url:
                        "/customer/booking.html"
                }
            });
        };


    NOTIFY.rideCompleted =
        function (
            ride
        ) {

            return NOTIFY.add({

                type:
                    "ride_completed",

                title:
                    "Ride Completed",

                body:
                    "Your RiderX trip has been completed.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    ),

                data: {

                    rideId:
                        ride &&
                        (
                            ride.rideId ||
                            ride.id
                        ),

                    url:
                        "/customer/history.html"
                }
            });
        };


    NOTIFY.rideCancelled =
        function (
            ride,
            reason
        ) {

            return NOTIFY.add({

                type:
                    "ride_cancelled",

                title:
                    "Ride Cancelled",

                body:
                    reason ||
                    "This ride has been cancelled.",

                rideId:
                    ride &&
                    (
                        ride.rideId ||
                        ride.id
                    )
            });
        };


    /* ========================================================
       PAYMENT NOTIFICATIONS
       ======================================================== */

    NOTIFY.paymentSuccess =
        function (
            amount
        ) {

            return NOTIFY.add({

                type:
                    "payment_success",

                title:
                    "Payment Successful",

                body:
                    amount
                        ? "Payment of ₹" +
                          amount +
                          " was successful."
                        : "Your payment was successful."
            });
        };


    NOTIFY.paymentFailed =
        function (
            message
        ) {

            return NOTIFY.add({

                type:
                    "payment_failed",

                title:
                    "Payment Failed",

                body:
                    message ||
                    "We could not process your payment."
            });
        };


    /* ========================================================
       WALLET NOTIFICATIONS
       ======================================================== */

    NOTIFY.walletCredit =
        function (
            amount
        ) {

            return NOTIFY.add({

                type:
                    "wallet_credit",

                title:
                    "Wallet Credited",

                body:
                    "₹" +
                    amount +
                    " has been added to your RiderX wallet."
            });
        };


    NOTIFY.walletDebit =
        function (
            amount
        ) {

            return NOTIFY.add({

                type:
                    "wallet_debit",

                title:
                    "Wallet Used",

                body:
                    "₹" +
                    amount +
                    " was deducted from your RiderX wallet."
            });
        };


    /* ========================================================
       SUPPORT NOTIFICATION
       ======================================================== */

    NOTIFY.support =
        function (
            message
        ) {

            return NOTIFY.add({

                type:
                    "support",

                title:
                    "RiderX Support",

                body:
                    message ||
                    "You have a new support update."
            });
        };


    /* ========================================================
       SYSTEM NOTIFICATION
       ======================================================== */

    NOTIFY.system =
        function (
            title,
            message
        ) {

            return NOTIFY.add({

                type:
                    "system",

                title:
                    title ||
                    "RiderX",

                body:
                    message ||
                    ""
            });
        };


    /* ========================================================
       AUTH LISTENER
       ======================================================== */

    NOTIFY.bindAuth =
        function () {

            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    firebase.auth()
                        .onAuthStateChanged(
                            function (
                                user
                            ) {

                                NOTIFY.stopFirebaseListener();


                                NOTIFY.state
                                    .currentUser =
                                    user;


                                if (user) {

                                    NOTIFY
                                        .startFirebaseListener();
                                }
                            }
                        );
                }

            } catch (error) {

                console.warn(
                    "Auth notification binding failed:",
                    error
                );
            }
        };


    /* ========================================================
       INITIALIZE
       ======================================================== */

    NOTIFY.init =
        async function () {

            if (
                NOTIFY.state.initialized
            ) {

                return;
            }


            NOTIFY.load();

            NOTIFY.bindEvents();

            NOTIFY.render();

            NOTIFY.bindAuth();


            /*
             * Don't automatically ask
             * permission immediately on
             * every page load.
             */

            if (
                typeof Notification !==
                "undefined"
            ) {

                NOTIFY.state.permission =
                    Notification.permission;
            }


            NOTIFY.state.initialized =
                true;


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-notification-ready"
                )
            );
        };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.notify =
        NOTIFY.add;


    RX.notifications =
        NOTIFY;


    RX.requestNotificationPermission =
        NOTIFY.requestPermission;


    RX.markNotificationRead =
        NOTIFY.markRead;


    RX.markAllNotificationsRead =
        NOTIFY.markAllRead;


    RX.playNotificationSound =
        NOTIFY.playSound;


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

                NOTIFY.init();
            }
        );

    } else {

        NOTIFY.init();
    }


    console.log(
        "RiderX Notification Engine loaded."
    );

})();
