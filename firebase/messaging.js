/* ============================================================
   RIDERX - FIREBASE CLOUD MESSAGING
   File: firebase/messaging.js

   Handles:
   - Notification permission
   - FCM token generation
   - Token storage in Firestore
   - Foreground notifications
   - Notification click events
   - Rider / Customer notification support

   Requires:
   - firebase/firebase-config.js
   - Firebase Messaging SDK
   - Firebase Firestore SDK
   ============================================================ */

(function (window) {

    "use strict";


    /* ========================================================
       RIDERX NAMESPACE
       ======================================================== */

    window.RiderX =
        window.RiderX || {};

    window.RiderX.firebase =
        window.RiderX.firebase || {};


    /* ========================================================
       CONFIG CHECK
       ======================================================== */

    const RX = window.RiderX.firebase;


    if (!RX.ready) {

        console.error(
            "RiderX Messaging: Firebase is not ready."
        );

        return;
    }


    /* ========================================================
       FIREBASE SERVICES
       ======================================================== */

    const auth =
        RX.auth || null;

    const firestore =
        RX.firestore || null;


    /* ========================================================
       MESSAGING INSTANCE
       ======================================================== */

    let messaging = null;


    try {

        if (
            typeof firebase !== "undefined"
            &&
            typeof firebase.messaging === "function"
        ) {

            messaging =
                firebase.messaging();

        }

    } catch (error) {

        console.error(
            "RiderX Messaging initialization error:",
            error
        );
    }


    RX.messaging =
        messaging;


    /* ========================================================
       VAPID KEY
       ======================================================== */

    /*
     * This is the Web Push certificate key used by FCM.
     *
     * Keep this key consistent with the Firebase project
     * configured for RiderX.
     */

    const VAPID_KEY =
        "BL9_-5Z7YfbA9iJsPj5SYF1PUSpTo2sCIoyL5cjBHOUOoQeDulTTznkqL_N-87z2MAKCfcEdY0PYA9Bdv48kd3g";


    /* ========================================================
       CHECK NOTIFICATION SUPPORT
       ======================================================== */

    function isNotificationSupported() {

        return (
            typeof window !== "undefined"
            &&
            "Notification" in window
        );
    }


    /* ========================================================
       REQUEST NOTIFICATION PERMISSION
       ======================================================== */

    async function enableNotification() {

        try {

            if (
                !isNotificationSupported()
            ) {

                console.warn(
                    "RiderX: Browser notifications are not supported."
                );

                return {
                    success: false,
                    reason: "unsupported"
                };
            }


            if (!messaging) {

                console.error(
                    "RiderX: Firebase Messaging is unavailable."
                );

                return {
                    success: false,
                    reason: "messaging-unavailable"
                };
            }


            /* -----------------------------------------------
               Check current permission
               ----------------------------------------------- */

            let permission =
                Notification.permission;


            /* -----------------------------------------------
               Request permission if needed
               ----------------------------------------------- */

            if (
                permission !== "granted"
            ) {

                permission =
                    await Notification.requestPermission();
            }


            /* -----------------------------------------------
               Permission denied
               ----------------------------------------------- */

            if (
                permission !== "granted"
            ) {

                console.warn(
                    "RiderX: Notification permission denied."
                );

                return {
                    success: false,
                    reason: "permission-denied"
                };
            }


            /* -----------------------------------------------
               Get FCM token
               ----------------------------------------------- */

            const token =
                await getFCMToken();


            if (!token) {

                return {
                    success: false,
                    reason: "token-unavailable"
                };
            }


            /* -----------------------------------------------
               Save token
               ----------------------------------------------- */

            await saveToken(
                token
            );


            console.log(
                "RiderX FCM token registered."
            );


            return {
                success: true,
                token: token
            };

        } catch (error) {

            console.error(
                "RiderX Notification Error:",
                error
            );

            return {
                success: false,
                reason: "error",
                error: error
            };
        }
    }


    /* ========================================================
       GET FCM TOKEN
       ======================================================== */

    async function getFCMToken() {

        try {

            if (!messaging) {

                return null;
            }


            /*
             * Firebase compatibility SDK.
             *
             * If getToken is available through the loaded
             * messaging SDK, use it.
             */

            if (
                typeof messaging.getToken ===
                "function"
            ) {

                const token =
                    await messaging.getToken({
                        vapidKey: VAPID_KEY
                    });

                return token || null;
            }


            /*
             * Modular Firebase fallback.
             */

            if (
                typeof firebase !== "undefined"
                &&
                firebase.messaging
                &&
                typeof firebase.messaging
                    .isSupported === "function"
            ) {

                return null;
            }


            console.warn(
                "RiderX: FCM token method unavailable."
            );

            return null;

        } catch (error) {

            console.error(
                "RiderX FCM token error:",
                error
            );

            return null;
        }
    }


    /* ========================================================
       SAVE TOKEN
       ======================================================== */

    async function saveToken(token) {

        try {

            if (!token) {

                return false;
            }


            if (!auth) {

                console.warn(
                    "RiderX: Firebase Auth unavailable."
                );

                return false;
            }


            if (!firestore) {

                console.warn(
                    "RiderX: Firestore unavailable."
                );

                return false;
            }


            const user =
                auth.currentUser;


            if (!user) {

                console.warn(
                    "RiderX: User must be logged in before saving FCM token."
                );

                return false;
            }


            /* -----------------------------------------------
               Save token to users/{uid}
               ----------------------------------------------- */

            await firestore
                .collection("users")
                .doc(user.uid)
                .set(
                    {
                        notificationToken:
                            token,

                        notificationEnabled:
                            true,

                        notificationUpdatedAt:
                            firebase.firestore.FieldValue.serverTimestamp()
                    },
                    {
                        merge: true
                    }
                );


            /* -----------------------------------------------
               Also keep token history.
               This helps when a user changes device.
               ----------------------------------------------- */

            await firestore
                .collection("users")
                .doc(user.uid)
                .collection("notificationTokens")
                .doc(
                    token.substring(
                        0,
                        150
                    )
                )
                .set(
                    {
                        token: token,

                        platform:
                            "web",

                        enabled:
                            true,

                        updatedAt:
                            firebase.firestore.FieldValue.serverTimestamp()
                    },
                    {
                        merge: true
                    }
                );


            return true;

        } catch (error) {

            console.error(
                "RiderX: Unable to save FCM token:",
                error
            );

            return false;
        }
    }


    /* ========================================================
       DISABLE NOTIFICATIONS
       ======================================================== */

    async function disableNotification() {

        try {

            if (!auth || !firestore) {

                return false;
            }


            const user =
                auth.currentUser;


            if (!user) {

                return false;
            }


            await firestore
                .collection("users")
                .doc(user.uid)
                .set(
                    {
                        notificationEnabled:
                            false
                    },
                    {
                        merge: true
                    }
                );


            return true;

        } catch (error) {

            console.error(
                "RiderX: Disable notification error:",
                error
            );

            return false;
        }
    }


    /* ========================================================
       SHOW FOREGROUND NOTIFICATION
       ======================================================== */

    function showForegroundNotification(
        payload
    ) {

        try {

            const notification =
                payload &&
                payload.notification
                    ? payload.notification
                    : {};


            const data =
                payload &&
                payload.data
                    ? payload.data
                    : {};


            const title =
                notification.title
                ||
                data.title
                ||
                "RiderX";


            const body =
                notification.body
                ||
                data.body
                ||
                "You have a new RiderX notification.";


            /*
             * Use browser Notification API.
             */

            if (
                isNotificationSupported()
                &&
                Notification.permission ===
                "granted"
            ) {

                const browserNotification =
                    new Notification(
                        title,
                        {
                            body: body,

                            icon:
                                "/assets/logo.png",

                            badge:
                                "/assets/logo.png",

                            tag:
                                data.notificationId
                                ||
                                data.rideId
                                ||
                                "riderx-notification",

                            data: data
                        }
                    );


                browserNotification.onclick =
                    function () {

                        window.focus();

                        handleNotificationClick(
                            data
                        );

                        browserNotification.close();
                    };


                return;
            }


            /*
             * Fallback for pages where browser
             * Notification API is unavailable.
             */

            console.log(
                "RiderX Notification:",
                title,
                body
            );

        } catch (error) {

            console.error(
                "RiderX foreground notification error:",
                error
            );
        }
    }


    /* ========================================================
       HANDLE NOTIFICATION CLICK
       ======================================================== */

    function handleNotificationClick(
        data
    ) {

        try {

            if (!data) {

                return;
            }


            /* -----------------------------------------------
               Ride notification
               ----------------------------------------------- */

            if (
                data.rideId
            ) {

                const rideId =
                    encodeURIComponent(
                        data.rideId
                    );


                /*
                 * Rider request
                 */

                if (
                    data.type ===
                    "ride_request"
                    ||
                    data.type ===
                    "new_ride"
                ) {

                    window.location.href =
                        "/rider/request.html?rideId="
                        +
                        rideId;

                    return;
                }


                /*
                 * Customer ride tracking
                 */

                window.location.href =
                    "/customer/tracking.html?rideId="
                    +
                    rideId;

                return;
            }


            /* -----------------------------------------------
               Chat notification
               ----------------------------------------------- */

            if (
                data.chatId
            ) {

                const chatId =
                    encodeURIComponent(
                        data.chatId
                    );


                window.location.href =
                    "/customer/chat.html?chatId="
                    +
                    chatId;

                return;
            }


            /* -----------------------------------------------
               Generic URL
               ----------------------------------------------- */

            if (
                data.url
            ) {

                window.location.href =
                    data.url;

                return;
            }


        } catch (error) {

            console.error(
                "RiderX notification click error:",
                error
            );
        }
    }


    /* ========================================================
       FOREGROUND MESSAGE LISTENER
       ======================================================== */

    function setupForegroundListener() {

        try {

            if (!messaging) {

                return;
            }


            /*
             * Firebase compatibility SDK
             */

            if (
                typeof messaging.onMessage ===
                "function"
            ) {

                messaging.onMessage(
                    function (payload) {

                        console.log(
                            "RiderX notification received:",
                            payload
                        );


                        showForegroundNotification(
                            payload
                        );


                        /*
                         * Custom application event.
                         * Other RiderX JS files can listen
                         * for this event.
                         */

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx:notification",
                                {
                                    detail:
                                        payload
                                }
                            )
                        );
                    }
                );

                return;
            }


            console.warn(
                "RiderX: Foreground listener unavailable."
            );

        } catch (error) {

            console.error(
                "RiderX foreground listener error:",
                error
            );
        }
    }


    /* ========================================================
       AUTO REGISTER AFTER AUTH
       ======================================================== */

    function setupAuthListener() {

        if (
            !auth
            ||
            typeof auth.onAuthStateChanged !==
            "function"
        ) {

            return;
        }


        auth.onAuthStateChanged(
            async function (user) {

                if (!user) {

                    return;
                }


                /*
                 * Do not automatically force the browser
                 * permission popup.
                 *
                 * Only register automatically if permission
                 * was already granted previously.
                 */

                if (
                    isNotificationSupported()
                    &&
                    Notification.permission ===
                    "granted"
                ) {

                    try {

                        const token =
                            await getFCMToken();


                        if (token) {

                            await saveToken(
                                token
                            );
                        }

                    } catch (error) {

                        console.warn(
                            "RiderX automatic FCM registration failed:",
                            error
                        );
                    }
                }
            }
        );
    }


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.enableNotification =
        enableNotification;


    RX.disableNotification =
        disableNotification;


    RX.getFCMToken =
        getFCMToken;


    RX.saveNotificationToken =
        saveToken;


    RX.showNotification =
        showForegroundNotification;


    RX.handleNotificationClick =
        handleNotificationClick;


    /* ========================================================
       GLOBAL COMPATIBILITY
       ======================================================== */

    window.enableNotification =
        enableNotification;


    window.disableNotification =
        disableNotification;


    /* ========================================================
       INITIALIZE
       ======================================================== */

    setupForegroundListener();

    setupAuthListener();


    console.log(
        "RiderX Firebase Messaging initialized."
    );


})(window);
