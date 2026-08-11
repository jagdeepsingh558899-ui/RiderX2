/* ============================================================
   RIDERX 2.0
   FIREBASE CLOUD MESSAGING
   File: firebase/messaging.js

   Firebase SDK: 10.8.0

   Handles:
   - FCM web messaging
   - Notification permission
   - FCM token generation
   - Token storage in Firestore
   - Foreground notifications
   - Notification click routing
   - Customer notifications
   - Rider notifications
   - Auth-aware token registration

   IMPORTANT:
   - Uses the modular Firebase SDK.
   - Does NOT initialize Firebase.
   - Firebase initialization is handled only by:
       firebase/firebase-config.js

   Required:
   - firebase/firebase-config.js
   - root service worker:
       /sw.js

   ============================================================ */

"use strict";


/* ============================================================
   FIREBASE IMPORTS
============================================================ */

import {
    auth,
    db,
    onAuthStateChanged,
    doc,
    setDoc,
    serverTimestamp
} from "./firebase-config.js";

import {
    getMessaging,
    getToken,
    onMessage,
    deleteToken,
    isSupported
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";


/* ============================================================
   RIDERX NAMESPACE
============================================================ */

window.RiderX =
    window.RiderX ||
    {};

window.RiderX.firebase =
    window.RiderX.firebase ||
    {};


/* ============================================================
   CONSTANTS
============================================================ */

/*
 * Firebase Web Push VAPID public key.
 *
 * This is NOT a private server key.
 *
 * It must belong to the same Firebase project:
 * riderx-1
 */

const VAPID_KEY =
    "BL9_-5Z7YfbA9iJsPj5SYF1PUSpTo2sCIoyL5cjBHOUOoQeDulTTznkqL_N-87z2MAKCfcEdY0PYA9Bdv48kd3g";


/*
 * RiderX service worker.
 *
 * The service worker must remain at the site root
 * because Firebase Messaging web push requires the
 * service worker to control the relevant application scope.
 */

const SERVICE_WORKER_PATH =
    "/sw.js";


/*
 * Notification icon.
 */

const NOTIFICATION_ICON =
    "/assets/logo.png";


/* ============================================================
   INTERNAL STATE
============================================================ */

let messaging =
    null;

let messagingSupported =
    false;

let serviceWorkerRegistration =
    null;

let foregroundListenerStarted =
    false;

let authListenerStarted =
    false;

let currentToken =
    null;


/* ============================================================
   SUPPORT CHECK
============================================================ */

async function checkMessagingSupport() {

    try {

        if (
            typeof window === "undefined"
        ) {

            return false;
        }


        if (
            !("Notification" in window)
        ) {

            return false;
        }


        if (
            !("serviceWorker" in navigator)
        ) {

            return false;
        }


        messagingSupported =
            await isSupported();


        return (
            messagingSupported === true
        );

    } catch (error) {

        console.warn(
            "RiderX FCM support check failed:",
            error
        );

        messagingSupported =
            false;

        return false;
    }
}


/* ============================================================
   SERVICE WORKER
============================================================ */

async function registerMessagingServiceWorker() {

    try {

        if (
            typeof navigator === "undefined"
            ||
            !("serviceWorker" in navigator)
        ) {

            console.warn(
                "RiderX FCM: Service workers are not supported."
            );

            return null;
        }


        /*
         * Wait until the page is ready before registering
         * the service worker.
         */

        await navigator.serviceWorker.ready;


        /*
         * Check whether the RiderX service worker is already
         * registered.
         */

        const registrations =
            await navigator.serviceWorker.getRegistrations();


        serviceWorkerRegistration =
            registrations.find(
                function (registration) {

                    return (
                        registration.active
                        &&
                        registration.scope
                    );
                }
            )
            ||
            null;


        /*
         * If no active registration exists, register the
         * RiderX root service worker.
         */

        if (
            !serviceWorkerRegistration
        ) {

            serviceWorkerRegistration =
                await navigator.serviceWorker.register(
                    SERVICE_WORKER_PATH,
                    {
                        scope: "/"
                    }
                );
        }


        return serviceWorkerRegistration;

    } catch (error) {

        console.error(
            "RiderX FCM service worker registration failed:",
            error
        );

        return null;
    }
}


/* ============================================================
   INITIALIZE MESSAGING
============================================================ */

async function initializeMessaging() {

    try {

        const supported =
            await checkMessagingSupport();


        if (!supported) {

            console.warn(
                "RiderX FCM: Web messaging is not supported on this browser."
            );

            return null;
        }


        if (
            !messaging
        ) {

            /*
             * firebase-config.js already initialized the
             * Firebase application.
             *
             * getMessaging() therefore reuses that default
             * Firebase application.
             */

            messaging =
                getMessaging(
                    auth.app
                );
        }


        return messaging;

    } catch (error) {

        console.error(
            "RiderX FCM initialization failed:",
            error
        );

        messaging =
            null;

        return null;
    }
}


/* ============================================================
   NOTIFICATION SUPPORT
============================================================ */

function isNotificationSupported() {

    return (
        typeof window !== "undefined"
        &&
        "Notification" in window
    );
}


/* ============================================================
   NOTIFICATION PERMISSION
============================================================ */

async function requestNotificationPermission() {

    try {

        if (
            !isNotificationSupported()
        ) {

            return {
                success: false,
                reason: "unsupported"
            };
        }


        const currentPermission =
            Notification.permission;


        if (
            currentPermission === "granted"
        ) {

            return {
                success: true,
                permission: "granted"
            };
        }


        if (
            currentPermission === "denied"
        ) {

            return {
                success: false,
                reason: "permission-denied",
                permission: "denied"
            };
        }


        const permission =
            await Notification.requestPermission();


        if (
            permission !== "granted"
        ) {

            return {
                success: false,
                reason: "permission-denied",
                permission: permission
            };
        }


        return {
            success: true,
            permission: "granted"
        };

    } catch (error) {

        console.error(
            "RiderX notification permission error:",
            error
        );

        return {
            success: false,
            reason: "permission-error",
            error: error
        };
    }
}


/* ============================================================
   GET FCM TOKEN
============================================================ */

async function getFCMToken() {

    try {

        if (
            !auth.currentUser
        ) {

            console.warn(
                "RiderX FCM: User is not authenticated."
            );

            return null;
        }


        const messagingInstance =
            await initializeMessaging();


        if (
            !messagingInstance
        ) {

            return null;
        }


        const registration =
            await registerMessagingServiceWorker();


        if (
            !registration
        ) {

            console.warn(
                "RiderX FCM: Messaging service worker unavailable."
            );

            return null;
        }


        const token =
            await getToken(
                messagingInstance,
                {
                    vapidKey:
                        VAPID_KEY,

                    serviceWorkerRegistration:
                        registration
                }
            );


        if (
            !token
        ) {

            return null;
        }


        currentToken =
            token;


        return token;

    } catch (error) {

        console.error(
            "RiderX FCM token generation failed:",
            error
        );

        return null;
    }
}


/* ============================================================
   SAVE FCM TOKEN
============================================================ */

async function saveToken(
    token
) {

    try {

        if (
            !token
        ) {

            return false;
        }


        const user =
            auth.currentUser;


        if (
            !user
        ) {

            console.warn(
                "RiderX FCM: Cannot save token without authenticated user."
            );

            return false;
        }


        /*
         * Store the current device/browser token in the
         * user's own document.
         *
         * Firestore rules must explicitly allow the
         * notification fields used here.
         */

        await setDoc(
            doc(
                db,
                "users",
                user.uid
            ),
            {
                notificationToken:
                    token,

                notificationEnabled:
                    true,

                notificationPlatform:
                    "web",

                notificationUpdatedAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );


        currentToken =
            token;


        /*
         * Notify the rest of RiderX.
         */

        dispatchNotificationEvent(
            "riderx:fcm-token-updated",
            {
                token: token
            }
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX FCM token save failed:",
            error
        );

        return false;
    }
}


/* ============================================================
   ENABLE NOTIFICATIONS
============================================================ */

async function enableNotification() {

    try {

        const permissionResult =
            await requestNotificationPermission();


        if (
            !permissionResult.success
        ) {

            return permissionResult;
        }


        const token =
            await getFCMToken();


        if (
            !token
        ) {

            return {
                success: false,
                reason: "token-unavailable"
            };
        }


        const saved =
            await saveToken(
                token
            );


        if (
            !saved
        ) {

            return {
                success: false,
                reason: "token-save-failed"
            };
        }


        return {
            success: true,
            permission: "granted",
            token: token
        };

    } catch (error) {

        console.error(
            "RiderX notification enable failed:",
            error
        );

        return {
            success: false,
            reason: "error",
            error: error
        };
    }
}


/* ============================================================
   DISABLE NOTIFICATIONS
============================================================ */

async function disableNotification() {

    try {

        const user =
            auth.currentUser;


        if (
            !user
        ) {

            return false;
        }


        /*
         * Disable application-level notifications first.
         */

        await setDoc(
            doc(
                db,
                "users",
                user.uid
            ),
            {
                notificationEnabled:
                    false,

                notificationUpdatedAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );


        /*
         * Remove the current FCM registration token where
         * possible.
         *
         * This does not sign the user out.
         */

        if (
            messaging
            &&
            currentToken
        ) {

            try {

                await deleteToken(
                    messaging
                );

            } catch (tokenError) {

                console.warn(
                    "RiderX FCM token deletion warning:",
                    tokenError
                );
            }
        }


        currentToken =
            null;


        return true;

    } catch (error) {

        console.error(
            "RiderX notification disable failed:",
            error
        );

        return false;
    }
}


/* ============================================================
   NOTIFICATION EVENT
============================================================ */

function dispatchNotificationEvent(
    eventName,
    payload
) {

    try {

        window.dispatchEvent(
            new CustomEvent(
                eventName,
                {
                    detail:
                        payload
                }
            )
        );

    } catch (error) {

        console.warn(
            "RiderX notification event dispatch failed:",
            error
        );
    }
}


/* ============================================================
   GET USER ROLE
============================================================ */

async function getCurrentUserRole() {

    try {

        const user =
            auth.currentUser;


        if (
            !user
        ) {

            return null;
        }


        /*
         * The application may expose the role through the
         * RiderX namespace/local session.
         *
         * Notification routing should not depend on a
         * potentially stale localStorage value alone.
         */

        if (
            window.RiderX
            &&
            window.RiderX.user
            &&
            window.RiderX.user.role
        ) {

            return (
                window.RiderX.user.role
            );
        }


        return null;

    } catch (error) {

        return null;
    }
}


/* ============================================================
   NOTIFICATION ROUTER
============================================================ */

function handleNotificationClick(
    data
) {

    try {

        if (
            !data
            ||
            typeof data !== "object"
        ) {

            return;
        }


        const rideId =
            data.rideId
            ||
            data.bookingId
            ||
            "";


        const type =
            String(
                data.type
                ||
                ""
            ).toLowerCase();


        const role =
            String(
                data.role
                ||
                ""
            ).toLowerCase();


        /*
         * Ride request is primarily a rider notification.
         */

        if (
            rideId
            &&
            (
                type === "ride_request"
                ||
                type === "new_ride"
                ||
                type === "booking_request"
            )
        ) {

            window.location.href =
                "/rider/request.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

            return;
        }


        /*
         * Explicit rider notification.
         */

        if (
            rideId
            &&
            (
                role === "rider"
                ||
                type === "rider_ride"
                ||
                type === "ride_accepted"
                ||
                type === "ride_started"
                ||
                type === "ride_completed"
            )
        ) {

            window.location.href =
                "/rider/trip.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

            return;
        }


        /*
         * Explicit customer notification.
         */

        if (
            rideId
            &&
            (
                role === "customer"
                ||
                type === "customer_ride"
                ||
                type === "driver_assigned"
                ||
                type === "rider_assigned"
            )
        ) {

            window.location.href =
                "/customer/tracking.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

            return;
        }


        /*
         * Chat.
         *
         * Route according to the supplied role.
         */

        if (
            data.chatId
        ) {

            const chatId =
                encodeURIComponent(
                    data.chatId
                );


            if (
                role === "rider"
            ) {

                window.location.href =
                    "/rider/chat.html?chatId="
                    +
                    chatId;

            } else {

                window.location.href =
                    "/customer/chat.html?chatId="
                    +
                    chatId;
            }


            return;
        }


        /*
         * Safe internal URL handling.
         *
         * Only same-origin relative paths are accepted.
         */

        if (
            typeof data.url ===
            "string"
            &&
            data.url.startsWith("/")
            &&
            !data.url.startsWith("//")
        ) {

            window.location.href =
                data.url;

            return;
        }

    } catch (error) {

        console.error(
            "RiderX notification click routing failed:",
            error
        );
    }
}


/* ============================================================
   FOREGROUND NOTIFICATION
============================================================ */

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


        const tag =
            data.notificationId
            ||
            data.rideId
            ||
            data.bookingId
            ||
            "riderx-notification";


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
                        body:
                            body,

                        icon:
                            NOTIFICATION_ICON,

                        badge:
                            NOTIFICATION_ICON,

                        tag:
                            String(tag),

                        data:
                            data
                    }
                );


            browserNotification.onclick =
                function () {

                    try {

                        window.focus();

                    } catch (error) {

                        /* Ignore focus errors. */
                    }


                    handleNotificationClick(
                        data
                    );


                    browserNotification.close();
                };


        } else {

            console.log(
                "RiderX Notification:",
                title,
                body
            );
        }


        dispatchNotificationEvent(
            "riderx:notification",
            payload
        );

    } catch (error) {

        console.error(
            "RiderX foreground notification error:",
            error
        );
    }
}


/* ============================================================
   FOREGROUND MESSAGE LISTENER
============================================================ */

async function setupForegroundListener() {

    try {

        if (
            foregroundListenerStarted
        ) {

            return;
        }


        const messagingInstance =
            await initializeMessaging();


        if (
            !messagingInstance
        ) {

            return;
        }


        onMessage(
            messagingInstance,
            function (payload) {

                console.log(
                    "RiderX FCM foreground message received."
                );


                showForegroundNotification(
                    payload
                );
            }
        );


        foregroundListenerStarted =
            true;

    } catch (error) {

        console.error(
            "RiderX foreground FCM listener failed:",
            error
        );
    }
}


/* ============================================================
   AUTOMATIC TOKEN REFRESH / AUTH LISTENER
============================================================ */

function setupAuthListener() {

    if (
        authListenerStarted
    ) {

        return;
    }


    authListenerStarted =
        true;


    onAuthStateChanged(
        auth,
        async function (user) {

            /*
             * Never request permission automatically.
             *
             * If the user already granted permission,
             * silently refresh/register the token.
             */

            if (
                !user
            ) {

                currentToken =
                    null;

                return;
            }


            if (
                !isNotificationSupported()
                ||
                Notification.permission !==
                "granted"
            ) {

                return;
            }


            try {

                const token =
                    await getFCMToken();


                if (
                    token
                ) {

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
    );
}


/* ============================================================
   PUBLIC API
============================================================ */

window.RiderX.firebase.messaging =
    null;

window.RiderX.firebase.messagingSupported =
    function () {

        return (
            messagingSupported === true
        );
    };


window.RiderX.firebase.enableNotification =
    enableNotification;


window.RiderX.firebase.disableNotification =
    disableNotification;


window.RiderX.firebase.getFCMToken =
    getFCMToken;


window.RiderX.firebase.saveNotificationToken =
    saveToken;


window.RiderX.firebase.showNotification =
    showForegroundNotification;


window.RiderX.firebase.handleNotificationClick =
    handleNotificationClick;


/*
 * Compatibility aliases for existing RiderX code.
 */

window.RiderX.enableNotification =
    enableNotification;


window.RiderX.disableNotification =
    disableNotification;


window.RiderX.getFCMToken =
    getFCMToken;


window.RiderX.saveNotificationToken =
    saveToken;


window.RiderX.handleNotificationClick =
    handleNotificationClick;


window.enableNotification =
    enableNotification;


window.disableNotification =
    disableNotification;


/* ============================================================
   INITIALIZATION
============================================================ */

(async function initializeRiderXMessaging() {

    try {

        const supported =
            await checkMessagingSupport();


        if (
            !supported
        ) {

            console.info(
                "RiderX FCM: Web push messaging is unavailable on this device/browser."
            );

            setupAuthListener();

            return;
        }


        const initialized =
            await initializeMessaging();


        if (
            initialized
        ) {

            window.RiderX.firebase.messaging =
                initialized;


            await setupForegroundListener();
        }


        setupAuthListener();


        console.info(
            "RiderX Firebase Messaging initialized successfully."
        );

    } catch (error) {

        console.error(
            "RiderX Firebase Messaging startup failed:",
            error
        );

        /*
         * Notification failure must never prevent the
         * main RiderX application from loading.
         */

        setupAuthListener();
    }

})();
