/* ============================================================
   RIDERX 2.0
   CHAT SYSTEM
   File: js/chat.js

   Handles:
   - Ride-specific chat
   - Customer ↔ Rider messaging
   - Realtime Firestore messages
   - Unread message count
   - Read receipts
   - Message timestamps
   - Quick messages
   - Chat open / close
   - Call buttons
   ============================================================ */

(function () {
    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.chat = RX.chat || {};

    const CHAT = RX.chat;


    /* ========================================================
       CONFIG
       ======================================================== */

    CHAT.config = {

        collection: "messages",

        maxMessages: 100,

        quickMessages: [
            "I'm here",
            "I'm coming",
            "Please wait",
            "Where are you?",
            "I have arrived",
            "Thank you"
        ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    CHAT.state = {

        open: false,

        rideId: null,

        otherUserId: null,

        otherUserName: "",

        otherUserPhone: "",

        messages: [],

        unread: 0,

        listener: null,

        typingListener: null,

        sending: false
    };


    /* ========================================================
       FIRESTORE
       ======================================================== */

    CHAT.db = function () {

        if (
            RX.firebase &&
            RX.firebase.db
        ) {

            return RX.firebase.db;
        }

        return null;
    };


    /* ========================================================
       CURRENT USER
       ======================================================== */

    CHAT.currentUser = function () {

        if (
            typeof RX.getCurrentUser ===
            "function"
        ) {

            return RX.getCurrentUser();
        }

        return null;
    };


    /* ========================================================
       OPEN CHAT
       ======================================================== */

    CHAT.open = function (options) {

        options =
            options || {};

        const rideId =
            options.rideId ||
            (
                RX.booking &&
                RX.booking.getCurrentRideId
                    ? RX.booking.getCurrentRideId()
                    : null
            );

        if (!rideId) {

            RX.showToast(
                "Chat unavailable",
                "No active ride found.",
                "warning"
            );

            return false;
        }

        CHAT.state.open =
            true;

        CHAT.state.rideId =
            rideId;

        CHAT.state.otherUserId =
            options.otherUserId ||
            null;

        CHAT.state.otherUserName =
            options.otherUserName ||
            "RiderX";

        CHAT.state.otherUserPhone =
            options.otherUserPhone ||
            "";

        CHAT.renderHeader();

        CHAT.renderQuickMessages();

        CHAT.startListener();

        CHAT.markAllRead();

        document.body.classList.add(
            "rx-chat-open"
        );

        document
            .querySelectorAll(
                "[data-chat]"
            )
            .forEach(
                function (element) {

                    element.classList.add(
                        "active"
                    );
                }
            );

        window.dispatchEvent(
            new CustomEvent(
                "riderx-chat-opened",
                {
                    detail: {
                        rideId:
                            rideId
                    }
                }
            )
        );

        return true;
    };


    /* ========================================================
       CLOSE CHAT
       ======================================================== */

    CHAT.close = function () {

        CHAT.state.open =
            false;

        document.body.classList.remove(
            "rx-chat-open"
        );

        document
            .querySelectorAll(
                "[data-chat]"
            )
            .forEach(
                function (element) {

                    element.classList.remove(
                        "active"
                    );
                }
            );

        window.dispatchEvent(
            new CustomEvent(
                "riderx-chat-closed"
            )
        );
    };


    /* ========================================================
       SET RIDE
       ======================================================== */

    CHAT.setRide = function (
        rideId,
        otherUserId,
        otherUserName,
        otherUserPhone
    ) {

        CHAT.stopListener();

        CHAT.state.rideId =
            rideId || null;

        CHAT.state.otherUserId =
            otherUserId || null;

        CHAT.state.otherUserName =
            otherUserName || "RiderX";

        CHAT.state.otherUserPhone =
            otherUserPhone || "";

        if (
            CHAT.state.open &&
            rideId
        ) {

            CHAT.startListener();
        }

        CHAT.renderHeader();
    };


    /* ========================================================
       HEADER
       ======================================================== */

    CHAT.renderHeader = function () {

        document
            .querySelectorAll(
                "[data-chat-name]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        CHAT.state
                            .otherUserName ||
                        "RiderX";
                }
            );

        document
            .querySelectorAll(
                "[data-chat-phone]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        CHAT.state
                            .otherUserPhone ||
                        "";
                }
            );
    };


    /* ========================================================
       START REALTIME LISTENER
       ======================================================== */

    CHAT.startListener = function () {

        const db =
            CHAT.db();

        const user =
            CHAT.currentUser();

        const rideId =
            CHAT.state.rideId;

        if (
            !db ||
            !user ||
            !rideId
        ) {

            return null;
        }

        CHAT.stopListener();

        /*
         * We intentionally filter by rideId.
         * This keeps every conversation isolated
         * to its ride.
         */

        CHAT.state.listener =
            db
                .collection(
                    CHAT.config.collection
                )
                .where(
                    "rideId",
                    "==",
                    rideId
                )
                .orderBy(
                    "createdAt",
                    "asc"
                )
                .limit(
                    CHAT.config.maxMessages
                )
                .onSnapshot(
                    function (snapshot) {

                        const messages = [];

                        snapshot.forEach(
                            function (doc) {

                                messages.push({
                                    id:
                                        doc.id,
                                    ...doc.data()
                                });
                            }
                        );

                        CHAT.state.messages =
                            messages;

                        CHAT.renderMessages();

                        CHAT.calculateUnread();

                    },
                    function (error) {

                        console.error(
                            "RiderX chat listener error:",
                            error
                        );

                        /*
                         * Firestore may require a composite
                         * index for this query. We provide a
                         * fallback query below.
                         */

                        CHAT.startFallbackListener();
                    }
                );

        return CHAT.state.listener;
    };


    /* ========================================================
       FALLBACK LISTENER
       ======================================================== */

    CHAT.startFallbackListener = function () {

        const db =
            CHAT.db();

        const rideId =
            CHAT.state.rideId;

        if (
            !db ||
            !rideId
        ) {
            return;
        }

        CHAT.stopListener();

        CHAT.state.listener =
            db
                .collection(
                    CHAT.config.collection
                )
                .where(
                    "rideId",
                    "==",
                    rideId
                )
                .limit(
                    CHAT.config.maxMessages
                )
                .onSnapshot(
                    function (snapshot) {

                        const messages = [];

                        snapshot.forEach(
                            function (doc) {

                                messages.push({
                                    id:
                                        doc.id,
                                    ...doc.data()
                                });
                            }
                        );

                        messages.sort(
                            function (a, b) {

                                return CHAT
                                    .timestampValue(
                                        a.createdAt
                                    ) -
                                    CHAT.timestampValue(
                                        b.createdAt
                                    );
                            }
                        );

                        CHAT.state.messages =
                            messages;

                        CHAT.renderMessages();

                        CHAT.calculateUnread();
                    },
                    function (error) {

                        console.error(
                            "Chat fallback error:",
                            error
                        );
                    }
                );
    };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    CHAT.stopListener = function () {

        if (
            typeof CHAT.state.listener ===
            "function"
        ) {

            try {

                CHAT.state.listener();

            } catch (error) {

                console.warn(
                    error
                );
            }
        }

        CHAT.state.listener =
            null;
    };


    /* ========================================================
       SEND MESSAGE
       ======================================================== */

    CHAT.send = async function (
        message
    ) {

        message =
            String(
                message || ""
            ).trim();

        if (!message) {
            return false;
        }

        if (
            CHAT.state.sending
        ) {

            return false;
        }

        const db =
            CHAT.db();

        const user =
            CHAT.currentUser();

        if (
            !db ||
            !user
        ) {

            RX.showToast(
                "Chat unavailable",
                "Please login again.",
                "warning"
            );

            return false;
        }

        if (
            !CHAT.state.rideId
        ) {

            RX.showToast(
                "Chat unavailable",
                "No active ride found.",
                "warning"
            );

            return false;
        }

        CHAT.state.sending =
            true;

        try {

            const profile =
                RX.getCurrentProfile();

            const role =
                RX.getCurrentRole() ||
                "customer";

            await db
                .collection(
                    CHAT.config.collection
                )
                .add({

                    rideId:
                        CHAT.state.rideId,

                    senderId:
                        user.uid,

                    senderRole:
                        role,

                    senderName:
                        RX.getUserName() ||
                        user.displayName ||
                        "User",

                    receiverId:
                        CHAT.state.otherUserId ||
                        null,

                    message:
                        message,

                    type:
                        "text",

                    read:
                        false,

                    createdAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

            /*
             * Clear all message inputs.
             */

            document
                .querySelectorAll(
                    "[data-chat-input]"
                )
                .forEach(
                    function (input) {

                        input.value = "";
                    }
                );

            CHAT.scrollToBottom();

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-message-sent",
                    {
                        detail: {
                            message:
                                message
                        }
                    }
                )
            );

            return true;

        } catch (error) {

            console.error(
                "Message send failed:",
                error
            );

            RX.showToast(
                "Message failed",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return false;

        } finally {

            CHAT.state.sending =
                false;
        }
    };


    /* ========================================================
       SEND QUICK MESSAGE
       ======================================================== */

    CHAT.sendQuick = function (
        message
    ) {

        return CHAT.send(
            message
        );
    };


    /* ========================================================
       QUICK MESSAGES
       ======================================================== */

    CHAT.renderQuickMessages = function () {

        document
            .querySelectorAll(
                "[data-chat-quick]"
            )
            .forEach(
                function (container) {

                    container.innerHTML = "";

                    CHAT.config
                        .quickMessages
                        .forEach(
                            function (message) {

                                const button =
                                    document
                                        .createElement(
                                            "button"
                                        );

                                button.type =
                                    "button";

                                button.className =
                                    "rx-chat-quick";

                                button.textContent =
                                    message;

                                button.addEventListener(
                                    "click",
                                    function () {

                                        CHAT.sendQuick(
                                            message
                                        );
                                    }
                                );

                                container.appendChild(
                                    button
                                );
                            }
                        );
                }
            );
    };


    /* ========================================================
       RENDER MESSAGES
       ======================================================== */

    CHAT.renderMessages = function () {

        const user =
            CHAT.currentUser();

        if (!user) {
            return;
        }

        document
            .querySelectorAll(
                "[data-chat-messages]"
            )
            .forEach(
                function (container) {

                    const shouldScroll =
                        (
                            container.scrollHeight -
                            container.scrollTop -
                            container.clientHeight
                        ) < 100;

                    container.innerHTML = "";

                    if (
                        !CHAT.state.messages.length
                    ) {

                        container.innerHTML = `
                            <div class="rx-chat-empty">
                                <div class="rx-chat-empty-icon">
                                    💬
                                </div>

                                <div>
                                    Start a conversation
                                </div>

                                <small>
                                    Your messages are private to this ride.
                                </small>
                            </div>
                        `;

                        return;
                    }

                    CHAT.state.messages
                        .forEach(
                            function (message) {

                                container.appendChild(
                                    CHAT.messageElement(
                                        message,
                                        user.uid
                                    )
                                );
                            }
                        );

                    if (
                        shouldScroll ||
                        CHAT.state.open
                    ) {

                        CHAT.scrollToBottom(
                            container
                        );
                    }
                }
            );
    };


    /* ========================================================
       MESSAGE ELEMENT
       ======================================================== */

    CHAT.messageElement = function (
        message,
        currentUid
    ) {

        const wrapper =
            document.createElement(
                "div"
            );

        const mine =
            message.senderId ===
            currentUid;

        wrapper.className =
            mine
                ? "rx-chat-message mine"
                : "rx-chat-message theirs";

        const time =
            CHAT.formatTime(
                message.createdAt
            );

        const read =
            mine &&
            message.read === true;

        const tick =
            mine
                ? (
                    read
                        ? "✓✓"
                        : "✓"
                )
                : "";

        wrapper.innerHTML = `
            <div class="rx-chat-bubble">

                <div class="rx-chat-text">
                    ${RX.escapeHTML(
                        message.message ||
                        ""
                    )}
                </div>

                <div class="rx-chat-meta">

                    <span>
                        ${RX.escapeHTML(time)}
                    </span>

                    ${
                        tick
                        ?
                        `<span class="rx-chat-tick ${
                            read
                                ? "read"
                                : ""
                        }">
                            ${tick}
                        </span>`
                        :
                        ""
                    }

                </div>

            </div>
        `;

        return wrapper;
    };


    /* ========================================================
       MARK READ
       ======================================================== */

    CHAT.markAllRead = async function () {

        const db =
            CHAT.db();

        const user =
            CHAT.currentUser();

        const rideId =
            CHAT.state.rideId;

        if (
            !db ||
            !user ||
            !rideId
        ) {
            return;
        }

        const unread =
            CHAT.state.messages.filter(
                function (message) {

                    return (
                        message.receiverId ===
                        user.uid &&
                        message.read !== true
                    );
                }
            );

        if (!unread.length) {
            return;
        }

        const batch =
            db.batch();

        unread.forEach(
            function (message) {

                const ref =
                    db
                        .collection(
                            CHAT.config.collection
                        )
                        .doc(message.id);

                batch.update(
                    ref,
                    {
                        read:
                            true,

                        readAt:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp()
                    }
                );
            }
        );

        try {

            await batch.commit();

            CHAT.state.unread =
                0;

            CHAT.renderUnread();

        } catch (error) {

            console.warn(
                "Mark read failed:",
                error
            );
        }
    };


    /* ========================================================
       UNREAD COUNT
       ======================================================== */

    CHAT.calculateUnread = function () {

        const user =
            CHAT.currentUser();

        if (!user) {
            return 0;
        }

        const unread =
            CHAT.state.messages.filter(
                function (message) {

                    return (
                        message.receiverId ===
                        user.uid &&
                        message.read !== true
                    );
                }
            ).length;

        CHAT.state.unread =
            unread;

        CHAT.renderUnread();

        return unread;
    };


    /* ========================================================
       RENDER UNREAD
       ======================================================== */

    CHAT.renderUnread = function () {

        const count =
            CHAT.state.unread;

        document
            .querySelectorAll(
                "[data-chat-unread]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        count > 99
                            ? "99+"
                            : String(count);

                    element.style.display =
                        count > 0
                            ? ""
                            : "none";
                }
            );

        document
            .querySelectorAll(
                "[data-chat-badge]"
            )
            .forEach(
                function (element) {

                    element.classList.toggle(
                        "active",
                        count > 0
                    );
                }
            );
    };


    /* ========================================================
       SEND TYPING STATUS
       ======================================================== */

    CHAT.setTyping = async function (
        typing
    ) {

        const db =
            CHAT.db();

        const user =
            CHAT.currentUser();

        if (
            !db ||
            !user ||
            !CHAT.state.rideId
        ) {
            return;
        }

        try {

            await db
                .collection(
                    "typing"
                )
                .doc(
                    CHAT.state.rideId +
                    "_" +
                    user.uid
                )
                .set({

                    rideId:
                        CHAT.state.rideId,

                    userId:
                        user.uid,

                    typing:
                        Boolean(typing),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

        } catch (error) {

            console.warn(
                "Typing status failed:",
                error
            );
        }
    };


    /* ========================================================
       LISTEN TYPING
       ======================================================== */

    CHAT.listenTyping = function () {

        const db =
            CHAT.db();

        if (
            !db ||
            !CHAT.state.rideId
        ) {
            return;
        }

        CHAT.stopTypingListener();

        CHAT.state.typingListener =
            db
                .collection(
                    "typing"
                )
                .where(
                    "rideId",
                    "==",
                    CHAT.state.rideId
                )
                .onSnapshot(
                    function (snapshot) {

                        let someoneTyping =
                            false;

                        const user =
                            CHAT.currentUser();

                        snapshot.forEach(
                            function (doc) {

                                const data =
                                    doc.data();

                                if (
                                    data.userId !==
                                    (
                                        user &&
                                        user.uid
                                    ) &&
                                    data.typing ===
                                    true
                                ) {

                                    someoneTyping =
                                        true;
                                }
                            }
                        );

                        document
                            .querySelectorAll(
                                "[data-chat-typing]"
                            )
                            .forEach(
                                function (element) {

                                    element.textContent =
                                        someoneTyping
                                            ? "typing..."
                                            : "";

                                    element.style.display =
                                        someoneTyping
                                            ? ""
                                            : "none";
                                }
                            );
                    }
                );
    };


    /* ========================================================
       STOP TYPING LISTENER
       ======================================================== */

    CHAT.stopTypingListener = function () {

        if (
            typeof CHAT.state
                .typingListener ===
            "function"
        ) {

            try {

                CHAT.state
                    .typingListener();

            } catch (error) {

                console.warn(
                    error
                );
            }
        }

        CHAT.state.typingListener =
            null;
    };


    /* ========================================================
       CALL USER
       ======================================================== */

    CHAT.call = function () {

        const phone =
            CHAT.state.otherUserPhone;

        if (!phone) {

            RX.showToast(
                "Phone unavailable",
                "Phone number is not available.",
                "warning"
            );

            return false;
        }

        window.location.href =
            "tel:" +
            phone;

        return true;
    };


    /* ========================================================
       FORMAT TIME
       ======================================================== */

    CHAT.timestampValue = function (
        timestamp
    ) {

        if (!timestamp) {
            return 0;
        }

        if (
            typeof timestamp.toMillis ===
            "function"
        ) {

            return timestamp.toMillis();
        }

        if (
            timestamp.seconds
        ) {

            return (
                timestamp.seconds *
                1000
            );
        }

        if (
            timestamp instanceof Date
        ) {

            return timestamp.getTime();
        }

        return 0;
    };


    CHAT.formatTime = function (
        timestamp
    ) {

        const value =
            CHAT.timestampValue(
                timestamp
            );

        if (!value) {
            return "";
        }

        return new Date(
            value
        ).toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );
    };


    /* ========================================================
       SCROLL
       ======================================================== */

    CHAT.scrollToBottom = function (
        container
    ) {

        const target =
            container ||
            document.querySelector(
                "[data-chat-messages]"
            );

        if (!target) {
            return;
        }

        requestAnimationFrame(
            function () {

                target.scrollTop =
                    target.scrollHeight;
            }
        );
    };


    /* ========================================================
       INPUT EVENTS
       ======================================================== */

    CHAT.bindInputs = function () {

        document
            .querySelectorAll(
                "[data-chat-input]"
            )
            .forEach(
                function (input) {

                    if (
                        input.dataset
                            .chatBound ===
                        "true"
                    ) {
                        return;
                    }

                    input.dataset
                        .chatBound =
                        "true";


                    input.addEventListener(
                        "input",
                        function () {

                            CHAT.setTyping(
                                Boolean(
                                    input.value
                                        .trim()
                                )
                            );
                        }
                    );


                    input.addEventListener(
                        "keydown",
                        function (event) {

                            if (
                                event.key ===
                                "Enter" &&
                                !event.shiftKey
                            ) {

                                event.preventDefault();

                                CHAT.send(
                                    input.value
                                );

                                CHAT.setTyping(
                                    false
                                );
                            }
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-chat-send]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset
                            .chatBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset
                        .chatBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            const input =
                                document.querySelector(
                                    "[data-chat-input]"
                                );

                            if (!input) {
                                return;
                            }

                            CHAT.send(
                                input.value
                            );
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-chat-open]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset
                            .chatBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset
                        .chatBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            const ride =
                                RX.booking &&
                                RX.booking
                                    .getCurrentRide
                                    ? RX.booking
                                        .getCurrentRide()
                                    : null;

                            CHAT.open({

                                rideId:
                                    ride &&
                                    ride.id,

                                otherUserId:
                                    ride &&
                                    ride.riderId,

                                otherUserName:
                                    ride &&
                                    ride.riderName,

                                otherUserPhone:
                                    ride &&
                                    ride.riderPhone
                            });
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-chat-close]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset
                            .chatBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset
                        .chatBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            CHAT.close();
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-chat-call]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset
                            .chatBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset
                        .chatBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            CHAT.call();
                        }
                    );
                }
            );
    };


    /* ========================================================
       INIT
       ======================================================== */

    CHAT.init = function () {

        CHAT.bindInputs();

        CHAT.renderUnread();

        CHAT.renderQuickMessages();

        /*
         * If an active booking already exists,
         * automatically connect the chat system.
         */

        if (
            RX.booking &&
            RX.booking.state &&
            RX.booking.state.currentRide
        ) {

            const ride =
                RX.booking.state.currentRide;

            CHAT.setRide(
                ride.id,
                ride.riderId,
                ride.riderName,
                ride.riderPhone
            );
        }

        /*
         * Keep chat synced whenever ride changes.
         */

        window.addEventListener(
            "riderx-ride-updated",
            function (event) {

                const ride =
                    event.detail;

                if (
                    !ride ||
                    !ride.id
                ) {
                    return;
                }

                CHAT.setRide(
                    ride.id,
                    ride.riderId,
                    ride.riderName,
                    ride.riderPhone
                );

                if (
                    CHAT.state.open
                ) {

                    CHAT.startListener();

                    CHAT.markAllRead();
                }
            }
        );

        console.log(
            "RiderX Chat System loaded."
        );
    };


    /* ========================================================
       CLEANUP
       ======================================================== */

    window.addEventListener(
        "beforeunload",
        function () {

            CHAT.stopListener();

            CHAT.stopTypingListener();
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
            CHAT.init
        );

    } else {

        CHAT.init();
    }

})();
