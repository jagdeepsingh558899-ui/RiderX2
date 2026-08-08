/* ============================================================
   RIDERX
   REAL-TIME CHAT ENGINE
   File: js/chat.js

   Supports:
   - Customer ↔ Rider chat
   - Firebase Realtime Database
   - Firestore mirror
   - Text messages
   - Read / unread state
   - Typing indicator
   - Message timestamps
   - Active ride chat
   - Chat history
   - Notification events
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const CHAT =
        RX.chat =
        RX.chat || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    CHAT.config = {

        maxMessageLength:
            1000,

        typingTimeout:
            2500,

        historyLimit:
            100,

        databasePath:
            "chats",

        messagesPath:
            "messages",

        unreadPath:
            "unread"
    };


    /* ========================================================
       STATE
       ======================================================== */

    CHAT.state = {

        initialized:
            false,

        active:
            false,

        rideId:
            null,

        currentUser:
            null,

        otherUser:
            null,

        messages:
            [],

        messageListener:
            null,

        typingListener:
            null,

        typingTimer:
            null,

        unreadListener:
            null,

        unreadCount:
            0
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    CHAT.database = function () {

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
                "RiderX chat database error:",
                error
            );
        }

        return null;
    };


    CHAT.firestore = function () {

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
                "RiderX chat firestore error:",
                error
            );
        }

        return null;
    };


    /* ========================================================
       USER
       ======================================================== */

    CHAT.getUser = function () {

        if (
            RX.auth &&
            typeof RX.auth.getUser ===
            "function"
        ) {

            return RX.auth.getUser();
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


    CHAT.getUid = function () {

        const user =
            CHAT.getUser();


        return (
            user?.uid ||
            user?.id ||
            user?.userId ||
            null
        );
    };


    CHAT.getRole = function () {

        const user =
            CHAT.getUser();


        return String(
            user?.role ||
            user?.userType ||
            user?.type ||
            "customer"
        )
        .toLowerCase();
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    CHAT.generateId = function () {

        return (
            "msg_" +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 10)
        );
    };


    CHAT.escape = function (
        value
    ) {

        const text =
            String(
                value ??
                ""
            );


        return text
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


    CHAT.formatTime = function (
        timestamp
    ) {

        const date =
            new Date(
                Number(
                    timestamp
                ) ||
                Date.now()
            );


        return date.toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );
    };


    CHAT.formatDate = function (
        timestamp
    ) {

        const date =
            new Date(
                Number(
                    timestamp
                ) ||
                Date.now()
            );


        return date.toLocaleDateString(
            [],
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


    /* ========================================================
       ACTIVE RIDE
       ======================================================== */

    CHAT.getActiveRide =
        function () {

            if (
                RX.booking &&
                RX.booking.state &&
                RX.booking.state.booking
            ) {

                return RX.booking.state.booking;
            }


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_active_ride"
                    );


                if (saved) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {

                console.warn(
                    "Active ride restore failed:",
                    error
                );
            }


            return null;
        };


    CHAT.getRideId =
        function () {

            const ride =
                CHAT.getActiveRide();


            return (
                CHAT.state.rideId ||
                ride?.id ||
                ride?.bookingId ||
                localStorage.getItem(
                    "riderx_active_ride_id"
                ) ||
                null
            );
        };


    /* ========================================================
       CHAT ID
       ======================================================== */

    CHAT.getChatId =
        function (
            rideId
        ) {

            return (
                String(
                    rideId ||
                    CHAT.getRideId() ||
                    ""
                )
            );
        };


    /* ========================================================
       OPEN CHAT
       ======================================================== */

    CHAT.open =
        async function (
            rideId,
            otherUser
        ) {

            rideId =
                rideId ||
                CHAT.getRideId();


            if (!rideId) {

                throw new Error(
                    "No active ride found for chat."
                );
            }


            const currentUser =
                CHAT.getUser();


            if (!currentUser) {

                throw new Error(
                    "Please login to use chat."
                );
            }


            CHAT.close();


            CHAT.state.rideId =
                rideId;


            CHAT.state.currentUser =
                currentUser;


            CHAT.state.otherUser =
                otherUser ||
                CHAT.getOtherUserFromRide();


            CHAT.state.active =
                true;


            CHAT.updateHeader();


            CHAT.attachMessageListener(
                rideId
            );


            CHAT.attachTypingListener(
                rideId
            );


            CHAT.attachUnreadListener(
                rideId
            );


            await CHAT.markAsRead(
                rideId
            );


            CHAT.emit(
                "opened",
                {
                    rideId:
                        rideId,

                    otherUser:
                        CHAT.state.otherUser
                }
            );


            return {
                rideId:
                    rideId,

                otherUser:
                    CHAT.state.otherUser
            };
        };


    /* ========================================================
       CLOSE CHAT
       ======================================================== */

    CHAT.close =
        function () {

            CHAT.removeMessageListener();

            CHAT.removeTypingListener();

            CHAT.removeUnreadListener();


            if (
                CHAT.state.typingTimer
            ) {

                clearTimeout(
                    CHAT.state.typingTimer
                );
            }


            CHAT.state.active =
                false;

            CHAT.state.rideId =
                null;

            CHAT.state.messages =
                [];

            CHAT.state.otherUser =
                null;

            CHAT.state.typingTimer =
                null;
        };


    /* ========================================================
       OTHER USER
       ======================================================== */

    CHAT.getOtherUserFromRide =
        function () {

            const ride =
                CHAT.getActiveRide();


            if (!ride) {
                return null;
            }


            const role =
                CHAT.getRole();


            if (
                role ===
                "rider" ||
                role ===
                "driver"
            ) {

                return {

                    uid:
                        ride.customerId ||
                        ride.customerUid ||
                        null,

                    id:
                        ride.customerId ||
                        ride.customerUid ||
                        null,

                    name:
                        ride.customerName ||
                        "Customer",

                    phone:
                        ride.customerPhone ||
                        "",

                    photo:
                        ride.customerPhoto ||
                        ""
                };
            }


            return {

                uid:
                    ride.riderId ||
                    ride.riderUid ||
                    null,

                id:
                    ride.riderId ||
                    ride.riderUid ||
                    null,

                name:
                    ride.riderName ||
                    "Rider",

                phone:
                    ride.riderPhone ||
                    "",

                photo:
                    ride.riderPhoto ||
                    ""
            };
        };


    /* ========================================================
       MESSAGE LISTENER
       ======================================================== */

    CHAT.attachMessageListener =
        function (
            rideId
        ) {

            const database =
                CHAT.database();


            if (!database) {

                console.warn(
                    "Firebase Realtime Database unavailable."
                );

                return;
            }


            CHAT.removeMessageListener();


            const reference =
                database
                    .ref(
                        CHAT.config.databasePath +
                        "/" +
                        rideId +
                        "/" +
                        CHAT.config.messagesPath
                    )
                    .limitToLast(
                        CHAT.config.historyLimit
                    );


            const callback =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val() ||
                        {};


                    const messages =
                        Object.keys(
                            data
                        )
                        .map(
                            function (
                                id
                            ) {

                                return {

                                    id:
                                        id,

                                    ...(
                                        data[id] ||
                                        {}
                                    )
                                };
                            }
                        )
                        .sort(
                            function (
                                a,
                                b
                            ) {

                                return (
                                    Number(
                                        a.createdAt ||
                                        0
                                    ) -
                                    Number(
                                        b.createdAt ||
                                        0
                                    )
                                );
                            }
                        );


                    CHAT.state.messages =
                        messages;


                    CHAT.renderMessages(
                        messages
                    );


                    CHAT.emit(
                        "messages-updated",
                        {
                            rideId:
                                rideId,

                            messages:
                                messages
                        }
                    );
                };


            reference.on(
                "value",
                callback
            );


            CHAT.state.messageListener =
                {
                    reference:
                        reference,

                    callback:
                        callback
                };
        };


    CHAT.removeMessageListener =
        function () {

            const listener =
                CHAT.state.messageListener;


            if (!listener) {
                return;
            }


            try {

                listener.reference.off(
                    "value",
                    listener.callback
                );

            } catch (error) {

                console.warn(
                    "Chat listener cleanup failed:",
                    error
                );
            }


            CHAT.state.messageListener =
                null;
        };


    /* ========================================================
       SEND MESSAGE
       ======================================================== */

    CHAT.send =
        async function (
            text,
            type,
            metadata
        ) {

            text =
                String(
                    text ??
                    ""
                )
                .trim();


            if (!text) {
                return null;
            }


            if (
                text.length >
                CHAT.config.maxMessageLength
            ) {

                throw new Error(
                    "Message is too long."
                );
            }


            const user =
                CHAT.getUser();


            if (!user) {

                throw new Error(
                    "Please login to send messages."
                );
            }


            const rideId =
                CHAT.getRideId();


            if (!rideId) {

                throw new Error(
                    "No active ride found."
                );
            }


            const database =
                CHAT.database();


            if (!database) {

                throw new Error(
                    "Chat service is unavailable."
                );
            }


            const uid =
                CHAT.getUid();


            const messageId =
                CHAT.generateId();


            const message = {

                id:
                    messageId,

                rideId:
                    rideId,

                senderId:
                    uid,

                senderUid:
                    uid,

                senderRole:
                    CHAT.getRole(),

                senderName:
                    user.name ||
                    user.displayName ||
                    (
                        CHAT.getRole() ===
                        "rider"
                            ? "Rider"
                            : "Customer"
                    ),

                senderPhoto:
                    user.photoURL ||
                    user.photo ||
                    user.profilePhoto ||
                    "",

                receiverId:
                    CHAT.state.otherUser
                        ?.uid ||
                    CHAT.state.otherUser
                        ?.id ||
                    null,

                text:
                    text,

                type:
                    type ||
                    "text",

                metadata:
                    metadata ||
                    null,

                createdAt:
                    Date.now(),

                timestamp:
                    Date.now(),

                read:
                    false
            };


            const path =
                CHAT.config.databasePath +
                "/" +
                rideId +
                "/" +
                CHAT.config.messagesPath +
                "/" +
                messageId;


            await database
                .ref(path)
                .set(
                    message
                );


            /*
             * Update last message.
             */

            await database
                .ref(
                    CHAT.config.databasePath +
                    "/" +
                    rideId
                )
                .update(
                    {

                        lastMessage:
                            text,

                        lastMessageType:
                            message.type,

                        lastMessageAt:
                            message.createdAt,

                        lastMessageSender:
                            uid
                    }
                );


            /*
             * Firestore mirror.
             */

            const firestore =
                CHAT.firestore();


            if (firestore) {

                try {

                    await firestore
                        .collection(
                            "chats"
                        )
                        .doc(
                            rideId
                        )
                        .collection(
                            "messages"
                        )
                        .doc(
                            messageId
                        )
                        .set(
                            message
                        );

                } catch (error) {

                    console.warn(
                        "Firestore chat mirror failed:",
                        error
                    );
                }
            }


            /*
             * Notification event.
             */

            CHAT.notifyReceiver(
                message
            );


            CHAT.stopTyping();


            CHAT.emit(
                "message-sent",
                {
                    message:
                        message
                }
            );


            return message;
        };


    /* ========================================================
       SEND QUICK MESSAGE
       ======================================================== */

    CHAT.sendQuick =
        function (
            text
        ) {

            return CHAT.send(
                text,
                "quick"
            );
        };


    /* ========================================================
       DELETE MESSAGE
       ======================================================== */

    CHAT.deleteMessage =
        async function (
            messageId
        ) {

            if (!messageId) {
                return false;
            }


            const database =
                CHAT.database();


            const rideId =
                CHAT.getRideId();


            if (
                !database ||
                !rideId
            ) {
                return false;
            }


            const uid =
                CHAT.getUid();


            const message =
                CHAT.state.messages.find(
                    function (
                        item
                    ) {

                        return (
                            item.id ===
                            messageId
                        );
                    }
                );


            if (
                !message ||
                message.senderId !==
                uid
            ) {

                return false;
            }


            await database
                .ref(
                    CHAT.config.databasePath +
                    "/" +
                    rideId +
                    "/" +
                    CHAT.config.messagesPath +
                    "/" +
                    messageId
                )
                .update(
                    {

                        deleted:
                            true,

                        deletedAt:
                            Date.now(),

                        text:
                            "Message deleted."
                    }
                );


            return true;
        };


    /* ========================================================
       READ STATE
       ======================================================== */

    CHAT.markAsRead =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                CHAT.getRideId();


            const database =
                CHAT.database();


            const uid =
                CHAT.getUid();


            if (
                !database ||
                !uid ||
                !rideId
            ) {

                return;
            }


            const unreadRef =
                database
                    .ref(
                        CHAT.config.databasePath +
                        "/" +
                        rideId +
                        "/" +
                        CHAT.config.unreadPath +
                        "/" +
                        uid
                    );


            await unreadRef.set(
                0
            );


            /*
             * Mark incoming messages as read.
             */

            const messagesRef =
                database
                    .ref(
                        CHAT.config.databasePath +
                        "/" +
                        rideId +
                        "/" +
                        CHAT.config.messagesPath
                    );


            const snapshot =
                await messagesRef
                    .once(
                        "value"
                    );


            const data =
                snapshot.val() ||
                {};


            const updates = {};


            Object.keys(
                data
            )
            .forEach(
                function (
                    messageId
                ) {

                    const message =
                        data[messageId];


                    if (
                        message &&
                        message.senderId !==
                        uid &&
                        message.read !==
                        true
                    ) {

                        updates[
                            messageId +
                            "/read"
                        ] =
                            true;

                        updates[
                            messageId +
                            "/readAt"
                        ] =
                            Date.now();
                    }
                }
            );


            if (
                Object.keys(
                    updates
                ).length
            ) {

                await messagesRef.update(
                    updates
                );
            }


            CHAT.state.unreadCount =
                0;


            CHAT.updateUnreadUI();


            CHAT.emit(
                "read",
                {
                    rideId:
                        rideId
                }
            );
        };


    /* ========================================================
       UNREAD LISTENER
       ======================================================== */

    CHAT.attachUnreadListener =
        function (
            rideId
        ) {

            const database =
                CHAT.database();


            const uid =
                CHAT.getUid();


            if (
                !database ||
                !uid ||
                !rideId
            ) {
                return;
            }


            CHAT.removeUnreadListener();


            const reference =
                database
                    .ref(
                        CHAT.config.databasePath +
                        "/" +
                        rideId +
                        "/" +
                        CHAT.config.unreadPath +
                        "/" +
                        uid
                    );


            const callback =
                function (
                    snapshot
                ) {

                    CHAT.state.unreadCount =
                        Number(
                            snapshot.val()
                        ) ||
                        0;


                    CHAT.updateUnreadUI();


                    CHAT.emit(
                        "unread-updated",
                        {
                            count:
                                CHAT.state
                                    .unreadCount
                        }
                    );
                };


            reference.on(
                "value",
                callback
            );


            CHAT.state.unreadListener =
                {
                    reference:
                        reference,

                    callback:
                        callback
                };
        };


    CHAT.removeUnreadListener =
        function () {

            const listener =
                CHAT.state
                    .unreadListener;


            if (!listener) {
                return;
            }


            try {

                listener.reference.off(
                    "value",
                    listener.callback
                );

            } catch (error) {

                console.warn(
                    "Unread listener cleanup failed:",
                    error
                );
            }


            CHAT.state.unreadListener =
                null;
        };


    /* ========================================================
       INCREMENT UNREAD
       ======================================================== */

    CHAT.incrementUnread =
        async function (
            receiverId,
            rideId
        ) {

            const database =
                CHAT.database();


            if (
                !database ||
                !receiverId ||
                !rideId
            ) {
                return;
            }


            const reference =
                database.ref(
                    CHAT.config.databasePath +
                    "/" +
                    rideId +
                    "/" +
                    CHAT.config.unreadPath +
                    "/" +
                    receiverId
                );


            const snapshot =
                await reference.once(
                    "value"
                );


            const current =
                Number(
                    snapshot.val()
                ) ||
                0;


            await reference.set(
                current + 1
            );
        };


    /* ========================================================
       NOTIFICATION
       ======================================================== */

    CHAT.notifyReceiver =
        async function (
            message
        ) {

            if (!message) {
                return;
            }


            if (
                !message.receiverId
            ) {
                return;
            }


            try {

                await CHAT.incrementUnread(
                    message.receiverId,
                    message.rideId
                );

            } catch (error) {

                console.warn(
                    "Unread count update failed:",
                    error
                );
            }


            /*
             * Existing notification module.
             */

            if (
                RX.notification &&
                typeof RX.notification
                    .send ===
                "function"
            ) {

                try {

                    await RX.notification.send(
                        {
                            recipientId:
                                message.receiverId,

                            title:
                                message.senderName,

                            body:
                                message.text,

                            type:
                                "chat",

                            rideId:
                                message.rideId
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Notification module failed:",
                        error
                    );
                }
            }


            CHAT.emit(
                "notification",
                {
                    message:
                        message
                }
            );
        };


    /* ========================================================
       TYPING
       ======================================================== */

    CHAT.startTyping =
        async function () {

            const database =
                CHAT.database();


            const rideId =
                CHAT.getRideId();


            const uid =
                CHAT.getUid();


            if (
                !database ||
                !rideId ||
                !uid
            ) {
                return;
            }


            await database
                .ref(
                    CHAT.config.databasePath +
                    "/" +
                    rideId +
                    "/typing/" +
                    uid
                )
                .set(
                    {
                        name:
                            CHAT.getUser()
                                ?.name ||
                            "User",

                        at:
                            Date.now(),

                        active:
                            true
                    }
                );


            if (
                CHAT.state.typingTimer
            ) {

                clearTimeout(
                    CHAT.state.typingTimer
                );
            }


            CHAT.state.typingTimer =
                setTimeout(
                    function () {

                        CHAT.stopTyping();

                    },
                    CHAT.config.typingTimeout
                );
        };


    CHAT.stopTyping =
        async function () {

            const database =
                CHAT.database();


            const rideId =
                CHAT.getRideId();


            const uid =
                CHAT.getUid();


            if (
                !database ||
                !rideId ||
                !uid
            ) {
                return;
            }


            try {

                await database
                    .ref(
                        CHAT.config.databasePath +
                        "/" +
                        rideId +
                        "/typing/" +
                        uid
                    )
                    .remove();

            } catch (error) {

                console.warn(
                    "Stop typing failed:",
                    error
                );
            }
        };


    /* ========================================================
       TYPING LISTENER
       ======================================================== */

    CHAT.attachTypingListener =
        function (
            rideId
        ) {

            const database =
                CHAT.database();


            if (
                !database ||
                !rideId
            ) {
                return;
            }


            CHAT.removeTypingListener();


            const reference =
                database.ref(
                    CHAT.config.databasePath +
                    "/" +
                    rideId +
                    "/typing"
                );


            const callback =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val() ||
                        {};


                    const uid =
                        CHAT.getUid();


                    let typingUser =
                        null;


                    Object.keys(
                        data
                    )
                    .forEach(
                        function (
                            key
                        ) {

                            if (
                                key !==
                                uid &&
                                data[key] &&
                                data[key].active
                            ) {

                                typingUser =
                                    data[key];
                            }
                        }
                    );


                    CHAT.updateTypingUI(
                        typingUser
                    );


                    CHAT.emit(
                        "typing",
                        {
                            typing:
                                Boolean(
                                    typingUser
                                ),

                            user:
                                typingUser
                        }
                    );
                };


            reference.on(
                "value",
                callback
            );


            CHAT.state.typingListener =
                {
                    reference:
                        reference,

                    callback:
                        callback
                };
        };


    CHAT.removeTypingListener =
        function () {

            const listener =
                CHAT.state
                    .typingListener;


            if (!listener) {
                return;
            }


            try {

                listener.reference.off(
                    "value",
                    listener.callback
                );

            } catch (error) {

                console.warn(
                    "Typing listener cleanup failed:",
                    error
                );
            }


            CHAT.state.typingListener =
                null;
        };


    /* ========================================================
       RENDER MESSAGES
       ======================================================== */

    CHAT.renderMessages =
        function (
            messages
        ) {

            const containers =
                document.querySelectorAll(
                    "[data-chat-messages]"
                );


            if (!containers.length) {
                return;
            }


            const uid =
                CHAT.getUid();


            containers.forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        "";


                    messages.forEach(
                        function (
                            message
                        ) {

                            const mine =
                                message.senderId ===
                                uid;


                            const wrapper =
                                document.createElement(
                                    "div"
                                );


                            wrapper.className =
                                "chat-message " +
                                (
                                    mine
                                        ? "sent"
                                        : "received"
                                );


                            wrapper.dataset
                                .messageId =
                                message.id;


                            const text =
                                message.deleted
                                    ? "Message deleted."
                                    : message.text;


                            wrapper.innerHTML =
                                `
                                <div class="chat-bubble">
                                    <div class="chat-text">
                                        ${CHAT.escape(text)}
                                    </div>

                                    <div class="chat-meta">
                                        <span>
                                            ${CHAT.escape(
                                                CHAT.formatTime(
                                                    message.createdAt
                                                )
                                            )}
                                        </span>

                                        ${
                                            mine
                                                ? `
                                                <span class="chat-read">
                                                    ${
                                                        message.read
                                                            ? "✓✓"
                                                            : "✓"
                                                    }
                                                </span>
                                                `
                                                : ""
                                        }
                                    </div>
                                </div>
                                `;


                            container.appendChild(
                                wrapper
                            );
                        }
                    );


                    container.scrollTop =
                        container.scrollHeight;
                }
            );
        };


    /* ========================================================
       HEADER
       ======================================================== */

    CHAT.updateHeader =
        function () {

            const other =
                CHAT.state.otherUser;


            document
                .querySelectorAll(
                    "[data-chat-user-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            other?.name ||
                            (
                                CHAT.getRole() ===
                                "rider"
                                    ? "Customer"
                                    : "Rider"
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-chat-user-phone]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            other?.phone ||
                            "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-chat-user-photo]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            other?.photo
                        ) {

                            element.src =
                                other.photo;
                        }
                    }
                );
        };


    /* ========================================================
       TYPING UI
       ======================================================== */

    CHAT.updateTypingUI =
        function (
            typingUser
        ) {

            document
                .querySelectorAll(
                    "[data-chat-typing]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            typingUser
                        ) {

                            element.textContent =
                                (
                                    typingUser.name ||
                                    "User"
                                ) +
                                " is typing...";

                            element.classList.add(
                                "active"
                            );

                        } else {

                            element.textContent =
                                "";

                            element.classList.remove(
                                "active"
                            );
                        }
                    }
                );
        };


    /* ========================================================
       UNREAD UI
       ======================================================== */

    CHAT.updateUnreadUI =
        function () {

            const count =
                CHAT.state.unreadCount;


            document
                .querySelectorAll(
                    "[data-chat-unread]"
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


                        element.hidden =
                            count <= 0;
                    }
                );


            document
                .querySelectorAll(
                    "[data-chat-badge]"
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
        };


    /* ========================================================
       UI EVENTS
       ======================================================== */

    CHAT.bindUI =
        function () {

            document.addEventListener(
                "submit",
                function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-chat-form]"
                        );


                    if (!form) {
                        return;
                    }


                    event.preventDefault();


                    const input =
                        form.querySelector(
                            "[data-chat-input]"
                        ) ||
                        form.querySelector(
                            "textarea"
                        ) ||
                        form.querySelector(
                            "input"
                        );


                    if (!input) {
                        return;
                    }


                    CHAT.send(
                        input.value
                    )
                    .then(
                        function () {

                            input.value =
                                "";

                            CHAT.stopTyping();

                        }
                    )
                    .catch(
                        function (
                            error
                        ) {

                            console.error(
                                "Chat send error:",
                                error
                            );


                            if (
                                RX.toast
                            ) {

                                RX.toast(
                                    error.message ||
                                    "Message could not be sent.",
                                    "error"
                                );
                            }
                        }
                    );
                }
            );


            document.addEventListener(
                "input",
                function (
                    event
                ) {

                    const input =
                        event.target.closest(
                            "[data-chat-input]"
                        );


                    if (!input) {
                        return;
                    }


                    if (
                        input.value.trim()
                    ) {

                        CHAT.startTyping();

                    } else {

                        CHAT.stopTyping();
                    }
                }
            );


            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const quick =
                        event.target.closest(
                            "[data-chat-quick]"
                        );


                    if (
                        quick
                    ) {

                        event.preventDefault();


                        CHAT.sendQuick(
                            quick.dataset
                                .chatQuick
                        );
                    }
                }
            );
        };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.openChat =
        function (
            rideId,
            otherUser
        ) {

            return CHAT.open(
                rideId,
                otherUser
            );
        };


    RX.closeChat =
        function () {

            return CHAT.close();
        };


    RX.sendChatMessage =
        function (
            text,
            type,
            metadata
        ) {

            return CHAT.send(
                text,
                type,
                metadata
            );
        };


    RX.markChatRead =
        function (
            rideId
        ) {

            return CHAT.markAsRead(
                rideId
            );
        };


    /* ========================================================
       EVENT BUS
       ======================================================== */

    CHAT.emit =
        function (
            eventName,
            detail
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-chat-" +
                        eventName,
                        {
                            detail:
                                detail ||
                                {}
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX chat event error:",
                    error
                );
            }
        };


    CHAT.on =
        function (
            eventName,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {
                return;
            }


            window.addEventListener(
                "riderx-chat-" +
                eventName,
                function (
                    event
                ) {

                    callback(
                        event.detail ||
                        {}
                    );
                }
            );
        };


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    CHAT.init =
        async function () {

            if (
                CHAT.state.initialized
            ) {
                return;
            }


            CHAT.bindUI();


            CHAT.updateUnreadUI();


            /*
             * Automatically open chat when an
             * active ride exists and page requests it.
             */

            const params =
                new URLSearchParams(
                    window.location.search
                );


            const rideId =
                params.get(
                    "rideId"
                ) ||
                params.get(
                    "bookingId"
                );


            if (
                rideId
            ) {

                try {

                    await CHAT.open(
                        rideId
                    );

                } catch (error) {

                    console.warn(
                        "Automatic chat open failed:",
                        error
                    );
                }
            }


            CHAT.state.initialized =
                true;


            CHAT.emit(
                "ready"
            );


            console.log(
                "RiderX chat.js loaded."
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

                CHAT.init();

            },
            {
                once:
                    true
            }
        );

    } else {

        CHAT.init();
    }

})();
