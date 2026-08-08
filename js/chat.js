/* ============================================================
   RIDERX 2.0
   CHAT ENGINE
   File: js/chat.js

   Supports:
   - Customer ↔ Rider chat
   - Ride based conversations
   - Realtime Firebase messages
   - Unread count
   - Sent / delivered / read status
   - Typing indicator
   - Online status
   - Message timestamps
   - Text messages
   - Quick replies
   - Local fallback
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;
    RX.chat = RX.chat || {};

    const CHAT = RX.chat;

    CHAT.config = {

        maxMessages: 300,

        storagePrefix:
            "riderx_chat_",

        typingTimeout:
            2500,

        onlineTimeout:
            15000
    };

    CHAT.state = {

        user: null,

        userId: null,

        role: null,

        rideId: null,

        conversationId: null,

        otherUserId: null,

        otherUserName: null,

        messages: [],

        unread: 0,

        listening: false,

        typing: false,

        typingTimer: null,

        messageReference: null,

        messageListener: null,

        typingReference: null,

        typingListener: null,

        onlineReference: null,

        onlineListener: null,

        initialized: false
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    CHAT.getUser = function () {

        if (CHAT.state.user) {
            return CHAT.state.user;
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

                    CHAT.state.user = user;

                    return user;
                }
            }

        } catch (error) {

            console.warn(
                "Chat auth error:",
                error
            );
        }

        try {

            const user =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_user"
                    ) || "null"
                );

            if (user) {

                CHAT.state.user = user;

                return user;
            }

        } catch (error) {

            console.warn(
                "Chat local user error:",
                error
            );
        }

        return null;
    };


    CHAT.getUserId = function () {

        const user = CHAT.getUser();

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


    CHAT.getRole = function () {

        const user = CHAT.getUser();

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


    CHAT.getDatabase = function () {

        try {

            if (
                window.firebase &&
                firebase.database
            ) {

                return firebase.database();
            }

        } catch (error) {

            console.warn(
                "Firebase database error:",
                error
            );
        }

        return null;
    };


    CHAT.generateId = function () {

        return (
            "msg_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    };


    CHAT.escape = function (value) {

        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    };


    CHAT.formatTime = function (timestamp) {

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }

        return date.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    };


    CHAT.formatDate = function (timestamp) {

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    };


    CHAT.getConversationId = function (
        rideId,
        userA,
        userB
    ) {

        if (rideId) {

            return "ride_" + rideId;
        }

        const ids = [
            userA,
            userB
        ]
            .filter(Boolean)
            .sort();

        return (
            "chat_" +
            ids.join("_")
        );
    };


    /* ========================================================
       INITIALIZE CONVERSATION
       ======================================================== */

    CHAT.open = async function (
        options = {}
    ) {

        const currentUser =
            CHAT.getUser();

        const currentUserId =
            CHAT.getUserId();

        const rideId =
            options.rideId ||
            options.bookingId ||
            null;

        const otherUserId =
            options.otherUserId ||
            options.riderId ||
            options.customerId ||
            null;

        CHAT.state.user =
            currentUser;

        CHAT.state.userId =
            currentUserId;

        CHAT.state.role =
            options.role ||
            CHAT.getRole();

        CHAT.state.rideId =
            rideId;

        CHAT.state.otherUserId =
            otherUserId;

        CHAT.state.otherUserName =
            options.otherUserName ||
            options.name ||
            (
                CHAT.state.role === "customer"
                    ? "Rider"
                    : "Customer"
            );

        CHAT.state.conversationId =
            options.conversationId ||
            CHAT.getConversationId(
                rideId,
                currentUserId,
                otherUserId
            );


        CHAT.loadLocal();

        CHAT.renderHeader();

        CHAT.render();

        CHAT.stopListeners();

        CHAT.startListeners();

        CHAT.setOnline(true);

        return CHAT.state
            .conversationId;
    };


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    CHAT.getStorageKey = function () {

        return (
            CHAT.config.storagePrefix +
            (
                CHAT.state
                    .conversationId ||
                "default"
            )
        );
    };


    CHAT.loadLocal = function () {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        CHAT.getStorageKey()
                    ) || "null"
                );

            if (
                Array.isArray(data)
            ) {

                CHAT.state.messages =
                    data.slice(
                        0,
                        CHAT.config.maxMessages
                    );
            }

        } catch (error) {

            console.warn(
                "Chat local load error:",
                error
            );

            CHAT.state.messages = [];
        }

        CHAT.calculateUnread();
    };


    CHAT.saveLocal = function () {

        try {

            localStorage.setItem(
                CHAT.getStorageKey(),

                JSON.stringify(
                    CHAT.state.messages
                        .slice(
                            0,
                            CHAT.config.maxMessages
                        )
                )
            );

        } catch (error) {

            console.warn(
                "Chat local save error:",
                error
            );
        }
    };


    /* ========================================================
       FIREBASE REFERENCES
       ======================================================== */

    CHAT.getConversationReference =
        function () {

            const database =
                CHAT.getDatabase();

            const conversationId =
                CHAT.state
                    .conversationId;

            if (
                !database ||
                !conversationId
            ) {

                return null;
            }

            return database.ref(
                "chats/" +
                conversationId
            );
        };


    CHAT.getMessagesReference =
        function () {

            const reference =
                CHAT.getConversationReference();

            if (!reference) {
                return null;
            }

            return reference.child(
                "messages"
            );
        };


    CHAT.getTypingReference =
        function () {

            const reference =
                CHAT.getConversationReference();

            if (!reference) {
                return null;
            }

            return reference.child(
                "typing"
            );
        };


    CHAT.getOnlineReference =
        function () {

            const reference =
                CHAT.getConversationReference();

            if (!reference) {
                return null;
            }

            return reference.child(
                "online"
            );
        };


    /* ========================================================
       SEND MESSAGE
       ======================================================== */

    CHAT.send = async function (
        text,
        options = {}
    ) {

        text =
            String(
                text || ""
            ).trim();

        if (!text) {
            return false;
        }

        const userId =
            CHAT.getUserId();

        if (!userId) {

            throw new Error(
                "Please login before sending messages."
            );
        }

        if (
            !CHAT.state
                .conversationId
        ) {

            throw new Error(
                "Chat conversation is not open."
            );
        }


        const message = {

            id:
                options.id ||
                CHAT.generateId(),

            senderId:
                userId,

            senderRole:
                CHAT.state.role ||
                CHAT.getRole() ||
                "user",

            receiverId:
                CHAT.state
                    .otherUserId ||
                null,

            text:
                text,

            type:
                options.type ||
                "text",

            rideId:
                CHAT.state.rideId ||
                options.rideId ||
                null,

            timestamp:
                Date.now(),

            createdAt:
                Date.now(),

            status:
                "sent",

            read:
                false
        };


        /*
         * Local immediate render.
         */

        CHAT.addLocalMessage(
            message
        );


        const reference =
            CHAT.getMessagesReference();


        if (!reference) {

            CHAT.saveLocal();

            CHAT.stopTyping();

            return message;
        }


        try {

            await reference
                .child(
                    message.id
                )
                .set(
                    message
                );


            /*
             * Update conversation metadata.
             */

            const conversation =
                CHAT.getConversationReference();

            if (conversation) {

                await conversation
                    .update({

                        lastMessage:
                            text,

                        lastMessageAt:
                            message.timestamp,

                        lastMessageSender:
                            userId,

                        rideId:
                            message.rideId ||
                            null
                    });
            }


            CHAT.stopTyping();

            return message;

        } catch (error) {

            console.error(
                "Chat send failed:",
                error
            );

            return message;
        }
    };


    /* ========================================================
       LOCAL MESSAGE
       ======================================================== */

    CHAT.addLocalMessage = function (
        message
    ) {

        const exists =
            CHAT.state.messages.some(
                function (item) {

                    return (
                        item.id ===
                        message.id
                    );
                }
            );

        if (!exists) {

            CHAT.state.messages.push(
                message
            );
        }

        CHAT.state.messages =
            CHAT.state.messages
                .sort(
                    function (a, b) {

                        return (
                            Number(
                                a.timestamp
                            ) -
                            Number(
                                b.timestamp
                            )
                        );
                    }
                )
                .slice(
                    -CHAT.config
                        .maxMessages
                );

        CHAT.saveLocal();

        CHAT.render();

        CHAT.calculateUnread();
    };


    /* ========================================================
       LISTENERS
       ======================================================== */

    CHAT.startListeners = function () {

        const messages =
            CHAT.getMessagesReference();

        if (!messages) {
            return false;
        }


        const messageListener =
            function (snapshot) {

                const data =
                    snapshot.val();

                if (!data) {
                    return;
                }

                const message = {

                    ...data,

                    id:
                        data.id ||
                        snapshot.key
                };


                const alreadyExists =
                    CHAT.state.messages
                        .some(
                            function (
                                item
                            ) {

                                return (
                                    item.id ===
                                    message.id
                                );
                            }
                        );


                if (!alreadyExists) {

                    CHAT.state.messages
                        .push(
                            message
                        );

                    CHAT.state.messages =
                        CHAT.state.messages
                            .sort(
                                function (
                                    a,
                                    b
                                ) {

                                    return (
                                        Number(
                                            a.timestamp
                                        ) -
                                        Number(
                                            b.timestamp
                                        )
                                    );
                                }
                            )
                            .slice(
                                -CHAT.config
                                    .maxMessages
                            );

                    CHAT.saveLocal();

                    CHAT.render();

                    /*
                     * Mark received message
                     * as delivered.
                     */

                    if (
                        message.senderId !==
                        CHAT.state.userId
                    ) {

                        CHAT.markDelivered(
                            message.id
                        );

                        CHAT.playMessageNotification(
                            message
                        );
                    }
                }
            };


        messages.on(
            "child_added",
            messageListener
        );


        CHAT.state.messageReference =
            messages;

        CHAT.state.messageListener =
            messageListener;


        CHAT.startTypingListener();

        CHAT.startOnlineListener();

        CHAT.state.listening =
            true;

        return true;
    };


    /* ========================================================
       STOP LISTENERS
       ======================================================== */

    CHAT.stopListeners = function () {

        if (
            CHAT.state
                .messageReference &&
            CHAT.state
                .messageListener
        ) {

            try {

                CHAT.state
                    .messageReference
                    .off(
                        "child_added",
                        CHAT.state
                            .messageListener
                    );

            } catch (error) {
                /* Ignore */
            }
        }


        if (
            CHAT.state
                .typingReference &&
            CHAT.state
                .typingListener
        ) {

            try {

                CHAT.state
                    .typingReference
                    .off(
                        "value",
                        CHAT.state
                            .typingListener
                    );

            } catch (error) {
                /* Ignore */
            }
        }


        if (
            CHAT.state
                .onlineReference &&
            CHAT.state
                .onlineListener
        ) {

            try {

                CHAT.state
                    .onlineReference
                    .off(
                        "value",
                        CHAT.state
                            .onlineListener
                    );

            } catch (error) {
                /* Ignore */
            }
        }


        CHAT.state.messageReference =
            null;

        CHAT.state.messageListener =
            null;

        CHAT.state.typingReference =
            null;

        CHAT.state.typingListener =
            null;

        CHAT.state.onlineReference =
            null;

        CHAT.state.onlineListener =
            null;

        CHAT.state.listening =
            false;
    };


    /* ========================================================
       DELIVERY STATUS
       ======================================================== */

    CHAT.markDelivered = async function (
        messageId
    ) {

        const reference =
            CHAT.getMessagesReference();

        if (!reference) {
            return;
        }

        try {

            await reference
                .child(
                    messageId
                )
                .update({

                    status:
                        "delivered"
                });

        } catch (error) {

            console.warn(
                "Mark delivered failed:",
                error
            );
        }
    };


    /* ========================================================
       READ MESSAGE
       ======================================================== */

    CHAT.markRead = async function (
        messageId
    ) {

        const message =
            CHAT.state.messages
                .find(
                    function (
                        item
                    ) {

                        return (
                            item.id ===
                            messageId
                        );
                    }
                );

        if (message) {

            message.read = true;

            message.status =
                "read";
        }

        CHAT.saveLocal();

        const reference =
            CHAT.getMessagesReference();

        if (!reference) {
            return;
        }

        try {

            await reference
                .child(
                    messageId
                )
                .update({

                    read:
                        true,

                    status:
                        "read"
                });

        } catch (error) {

            console.warn(
                "Mark read failed:",
                error
            );
        }

        CHAT.calculateUnread();
        CHAT.render();
    };


    CHAT.markAllRead = async function () {

        const incoming =
            CHAT.state.messages
                .filter(
                    function (
                        message
                    ) {

                        return (
                            message.senderId !==
                            CHAT.state.userId &&
                            !message.read
                        );
                    }
                );

        for (
            const message
            of incoming
        ) {

            await CHAT.markRead(
                message.id
            );
        }
    };


    /* ========================================================
       UNREAD
       ======================================================== */

    CHAT.calculateUnread = function () {

        CHAT.state.unread =
            CHAT.state.messages
                .filter(
                    function (
                        message
                    ) {

                        return (
                            message.senderId !==
                            CHAT.state.userId &&
                            !message.read
                        );
                    }
                )
                .length;


        CHAT.updateUnreadBadge();
    };


    CHAT.updateUnreadBadge = function () {

        document
            .querySelectorAll(
                "[data-chat-unread]"
            )
            .forEach(
                function (
                    element
                ) {

                    const count =
                        CHAT.state.unread;

                    element.textContent =
                        count > 99
                            ? "99+"
                            : String(
                                count
                            );

                    element.hidden =
                        count === 0;
                }
            );


        document
            .querySelectorAll(
                ".chat-unread-badge"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        CHAT.state.unread;

                    element.style.display =
                        CHAT.state.unread === 0
                            ? "none"
                            : "";
                }
            );
    };


    /* ========================================================
       TYPING
       ======================================================== */

    CHAT.startTyping = function () {

        if (
            CHAT.state.typing
        ) {
            return;
        }

        CHAT.state.typing =
            true;

        CHAT.updateTyping(true);

        clearTimeout(
            CHAT.state.typingTimer
        );

        CHAT.state.typingTimer =
            setTimeout(
                function () {

                    CHAT.stopTyping();

                },
                CHAT.config
                    .typingTimeout
            );
    };


    CHAT.stopTyping = function () {

        CHAT.state.typing =
            false;

        clearTimeout(
            CHAT.state.typingTimer
        );

        CHAT.updateTyping(false);
    };


    CHAT.updateTyping = function (
        value
    ) {

        const reference =
            CHAT.getTypingReference();

        const userId =
            CHAT.getUserId();

        if (
            !reference ||
            !userId
        ) {
            return;
        }

        reference
            .child(
                userId
            )
            .set({
                typing:
                    Boolean(value),

                name:
                    CHAT.getUserName(),

                timestamp:
                    Date.now()
            });
    };


    CHAT.startTypingListener =
        function () {

            const reference =
                CHAT.getTypingReference();

            const currentUser =
                CHAT.getUserId();

            if (!reference) {
                return;
            }

            const listener =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val() ||
                        {};

                    let someoneTyping =
                        false;

                    Object.keys(
                        data
                    ).forEach(
                        function (
                            userId
                        ) {

                            if (
                                userId ===
                                currentUser
                            ) {
                                return;
                            }

                            if (
                                data[userId] &&
                                data[userId]
                                    .typing
                            ) {

                                someoneTyping =
                                    true;
                            }
                        }
                    );


                    CHAT.renderTyping(
                        someoneTyping
                    );
                };


            reference.on(
                "value",
                listener
            );


            CHAT.state.typingReference =
                reference;

            CHAT.state.typingListener =
                listener;
        };


    /* ========================================================
       ONLINE STATUS
       ======================================================== */

    CHAT.setOnline = function (
        online
    ) {

        const reference =
            CHAT.getOnlineReference();

        const userId =
            CHAT.getUserId();

        if (
            !reference ||
            !userId
        ) {
            return;
        }

        reference
            .child(
                userId
            )
            .set({

                online:
                    Boolean(online),

                timestamp:
                    Date.now()
            });
    };


    CHAT.startOnlineListener =
        function () {

            const reference =
                CHAT.getOnlineReference();

            if (!reference) {
                return;
            }

            const listener =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val() ||
                        {};

                    const otherId =
                        CHAT.state
                            .otherUserId;

                    if (
                        !otherId
                    ) {
                        return;
                    }

                    const other =
                        data[otherId];


                    if (
                        !other
                    ) {

                        CHAT.renderOnline(
                            false
                        );

                        return;
                    }


                    const isOnline =
                        other.online &&
                        (
                            Date.now() -
                            Number(
                                other.timestamp
                            )
                        ) <
                        CHAT.config
                            .onlineTimeout;


                    CHAT.renderOnline(
                        isOnline
                    );
                };


            reference.on(
                "value",
                listener
            );


            CHAT.state.onlineReference =
                reference;

            CHAT.state.onlineListener =
                listener;
        };


    /* ========================================================
       USER NAME
       ======================================================== */

    CHAT.getUserName = function () {

        const user =
            CHAT.getUser();

        if (!user) {
            return "User";
        }

        return (
            user.displayName ||
            user.name ||
            user.fullName ||
            user.email ||
            "User"
        );
    };


    /* ========================================================
       MESSAGE NOTIFICATION
       ======================================================== */

    CHAT.playMessageNotification =
        function (
            message
        ) {

            /*
             * Don't notify when chat is currently
             * open/focused.
             */

            if (
                document.visibilityState ===
                "visible"
            ) {

                const chat =
                    document.querySelector(
                        "[data-chat-window]"
                    );

                if (chat) {
                    return;
                }
            }


            try {

                if (
                    RX.notify
                ) {

                    RX.notify({

                        type:
                            "chat_message",

                        title:
                            CHAT.state
                                .otherUserName ||
                            "New message",

                        body:
                            message.text,

                        sound:
                            true,

                        data: {

                            rideId:
                                message.rideId ||
                                CHAT.state.rideId
                        }
                    });
                }

            } catch (error) {

                console.warn(
                    "Chat notification error:",
                    error
                );
            }
        };


    /* ========================================================
       QUICK REPLIES
       ======================================================== */

    CHAT.quickReplies = function () {

        const role =
            CHAT.state.role ||
            CHAT.getRole();


        if (
            role === "rider"
        ) {

            return [

                "I'm on my way.",
                "I have arrived.",
                "Please wait a moment.",
                "Where are you?",
                "I'm coming."
            ];
        }


        return [

            "I'm waiting here.",
            "Where are you?",
            "I'm coming.",
            "Please call me.",
            "Thank you."
        ];
    };


    /* ========================================================
       RENDER HEADER
       ======================================================== */

    CHAT.renderHeader = function () {

        document
            .querySelectorAll(
                "[data-chat-name]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        CHAT.state
                            .otherUserName ||
                        (
                            CHAT.state.role ===
                            "customer"
                                ? "Rider"
                                : "Customer"
                        );
                }
            );


        document
            .querySelectorAll(
                "[data-chat-ride-id]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        CHAT.state
                            .rideId
                            ? "Ride #" +
                              CHAT.state.rideId
                            : "";
                }
            );
    };


    /* ========================================================
       RENDER ONLINE
       ======================================================== */

    CHAT.renderOnline = function (
        online
    ) {

        document
            .querySelectorAll(
                "[data-chat-online]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        online
                            ? "Online"
                            : "Offline";

                    element.classList.toggle(
                        "online",
                        online
                    );
                }
            );
    };


    /* ========================================================
       RENDER TYPING
       ======================================================== */

    CHAT.renderTyping = function (
        typing
    ) {

        document
            .querySelectorAll(
                "[data-chat-typing]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        typing
                            ? (
                                CHAT.state
                                    .otherUserName ||
                                "User"
                              ) +
                              " is typing..."
                            : "";

                    element.style.display =
                        typing
                            ? ""
                            : "none";
                }
            );
    };


    /* ========================================================
       RENDER MESSAGES
       ======================================================== */

    CHAT.render = function () {

        const containers =
            document.querySelectorAll(
                "[data-chat-messages]"
            );


        containers.forEach(
            function (
                container
            ) {

                if (
                    !CHAT.state.messages
                        .length
                ) {

                    container.innerHTML =
                        `
                        <div class="chat-empty">
                            <div class="chat-empty-icon">
                                💬
                            </div>

                            <h3>Start a conversation</h3>

                            <p>
                                Send a message to ${
                                    CHAT.escape(
                                        CHAT.state
                                            .otherUserName ||
                                        "the other person"
                                    )
                                }.
                            </p>
                        </div>
                        `;

                    return;
                }


                let previousDate = "";


                container.innerHTML =
                    CHAT.state.messages
                        .map(
                            function (
                                message
                            ) {

                                const date =
                                    CHAT.formatDate(
                                        message.timestamp
                                    );

                                let dateSeparator =
                                    "";


                                if (
                                    date !==
                                    previousDate
                                ) {

                                    dateSeparator =
                                        `
                                        <div class="chat-date">
                                            ${CHAT.escape(
                                                date
                                            )}
                                        </div>
                                        `;

                                    previousDate =
                                        date;
                                }


                                const own =
                                    message
                                        .senderId ===
                                    CHAT.state
                                        .userId;


                                let status =
                                    "";


                                if (
                                    own
                                ) {

                                    if (
                                        message.status ===
                                        "read"
                                    ) {

                                        status =
                                            "✓✓";

                                    } else if (
                                        message.status ===
                                        "delivered"
                                    ) {

                                        status =
                                            "✓✓";

                                    } else {

                                        status =
                                            "✓";
                                    }
                                }


                                return `
                                ${dateSeparator}

                                <div
                                    class="chat-message ${
                                        own
                                            ? "chat-message-own"
                                            : "chat-message-other"
                                    }"
                                    data-message-id="${CHAT.escape(message.id)}"
                                >

                                    <div class="chat-bubble">

                                        ${
                                            message.type ===
                                            "image"
                                                ? `
                                                <img
                                                    src="${CHAT.escape(message.text)}"
                                                    class="chat-image"
                                                    alt="Image"
                                                >
                                                `
                                                : `
                                                <div class="chat-text">
                                                    ${CHAT.escape(
                                                        message.text
                                                    )}
                                                </div>
                                                `
                                        }

                                        <div class="chat-message-meta">

                                            <span>
                                                ${CHAT.formatTime(
                                                    message.timestamp
                                                )}
                                            </span>

                                            ${
                                                own
                                                    ? `
                                                    <span class="chat-status">
                                                        ${status}
                                                    </span>
                                                    `
                                                    : ""
                                            }

                                        </div>

                                    </div>

                                </div>
                                `;
                            }
                        )
                        .join("");


                /*
                 * Scroll to bottom.
                 */

                requestAnimationFrame(
                    function () {

                        container.scrollTop =
                            container.scrollHeight;
                    }
                );
            }
        );


        CHAT.updateUnreadBadge();
    };


    /* ========================================================
       CHAT UI EVENTS
       ======================================================== */

    CHAT.bindEvents = function () {

        document.addEventListener(
            "submit",
            async function (
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
                    );


                if (!input) {
                    return;
                }


                const text =
                    input.value.trim();


                if (!text) {
                    return;
                }


                try {

                    await CHAT.send(
                        text
                    );

                    input.value = "";

                } catch (error) {

                    CHAT.showMessage(
                        error.message,
                        true
                    );
                }
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
            async function (
                event
            ) {

                const quick =
                    event.target.closest(
                        "[data-chat-quick]"
                    );

                if (quick) {

                    event.preventDefault();

                    const text =
                        quick.dataset
                            .chatQuick;

                    if (text) {

                        await CHAT.send(
                            text
                        );
                    }

                    return;
                }


                const read =
                    event.target.closest(
                        "[data-chat-mark-read]"
                    );

                if (read) {

                    event.preventDefault();

                    await CHAT.markAllRead();

                    return;
                }


                const close =
                    event.target.closest(
                        "[data-chat-close]"
                    );

                if (close) {

                    event.preventDefault();

                    CHAT.close();

                    return;
                }
            }
        );
    };


    /* ========================================================
       CLOSE
       ======================================================== */

    CHAT.close = function () {

        CHAT.stopTyping();

        CHAT.setOnline(false);

        CHAT.stopListeners();

        CHAT.state.conversationId =
            null;

        CHAT.state.rideId =
            null;

        CHAT.state.otherUserId =
            null;

        CHAT.state.messages =
            [];

        const windows =
            document.querySelectorAll(
                "[data-chat-window]"
            );

        windows.forEach(
            function (
                element
            ) {

                element.classList.remove(
                    "active"
                );

                element.classList.remove(
                    "open"
                );
            }
        );
    };


    /* ========================================================
       SHOW MESSAGE
       ======================================================== */

    CHAT.showMessage = function (
        message,
        error = false
    ) {

        const existing =
            document.querySelector(
                ".riderx-chat-message"
            );

        if (existing) {
            existing.remove();
        }


        const element =
            document.createElement(
                "div"
            );

        element.className =
            "riderx-chat-message " +
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
            2500
        );
    };


    /* ========================================================
       AUTH
       ======================================================== */

    CHAT.bindAuth = function () {

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

                            CHAT.state.user =
                                user;

                            CHAT.state.userId =
                                user
                                    ? user.uid
                                    : null;
                        }
                    );
            }

        } catch (error) {

            console.warn(
                "Chat auth binding error:",
                error
            );
        }
    };


    /* ========================================================
       PAGE VISIBILITY
       ======================================================== */

    CHAT.bindVisibility = function () {

        document.addEventListener(
            "visibilitychange",
            function () {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    CHAT.markAllRead();

                }
            }
        );


        window.addEventListener(
            "beforeunload",
            function () {

                CHAT.setOnline(false);
            }
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.openChat = function (
        options
    ) {

        return CHAT.open(
            options
        );
    };


    RX.sendChatMessage = function (
        text,
        options
    ) {

        return CHAT.send(
            text,
            options
        );
    };


    RX.closeChat = function () {

        CHAT.close();
    };


    RX.getChatUnread =
        function () {

            return CHAT.state
                .unread;
        };


    /* ========================================================
       INITIALIZE
       ======================================================== */

    CHAT.init = function () {

        if (
            CHAT.state.initialized
        ) {
            return;
        }

        CHAT.bindEvents();

        CHAT.bindAuth();

        CHAT.bindVisibility();

        CHAT.state.initialized =
            true;

        window.dispatchEvent(
            new CustomEvent(
                "riderx-chat-ready"
            )
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
            }
        );

    } else {

        CHAT.init();
    }


    console.log(
        "RiderX Chat Engine loaded."
    );

})();
