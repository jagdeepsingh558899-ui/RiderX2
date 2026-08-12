/* ============================================================
   RIDERX 2.0
   FIREBASE CLOUD MESSAGING
   File: firebase/messaging.js

   Firebase SDK: 12.2.1

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
   - Uses Firebase modular SDK.
   - Does NOT initialize Firebase.
   - Firebase initialization is handled only by:
       firebase/firebase-config.js
   - Background notification handling is handled by:
       /sw.js

   ============================================================ */

"use strict";


/* ============================================================
   FIREBASE IMPORTS
============================================================ */

import {
    app,
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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";


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
 * This is a PUBLIC browser key.
 * It is not a private server credential.
 */

const VAPID_KEY =
    "BL9_-5Z7YfbA9iJsPj5SYF1PUSpTo2sCIoyL5cjBHOUOoQeDulTTznkqL_N-87z2MAKCfcEdY0PYA9Bdv48kd3g";


/*
 * Root RiderX service worker.
 *
 * The same root service worker is used by the PWA
 * and Firebase Cloud Messaging.
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
   EVENT HELPER
============================================================ */

function dispatchNotificationEvent(
    eventName,
    payload
) {

    try {

        if (
            typeof window === "undefined"
        ) {

            return;
        }


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
   SUPPORT CHECK
============================================================ */

async function checkMessagingSupport() {

    try {

        if (
            typeof window === "undefined"
        ) {

            messagingSupported =
                false;

            return false;
        }


        if (
            !("Notification" in window)
        ) {

            messagingSupported =
                false;

            return false;
        }


        if (
            !("serviceWorker" in navigator)
        ) {

            messagingSupported =
                false;

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

            return null;
        }


        /*
         * First check existing RiderX root registration.
         */

        const registrations =
            await navigator.serviceWorker
                .getRegistrations();


        serviceWorkerRegistration =
            registrations.find(
                function (
                    registration
                ) {

                    if (
                        !registration
                    ) {

                        return false;
                    }


                    const scope =
                        String(
                            registration.scope ||
                            ""
                        );


                    return (
                        scope ===
                        new URL(
                            "/",
                            window.location.origin
                        ).href
                    );
                }
            )
            ||
            null;


        /*
         * Register the root service worker if it does
         * not already exist.
         */

        if (
            !serviceWorkerRegistration
        ) {

            serviceWorkerRegistration =
                await navigator.serviceWorker.register(
                    SERVICE_WORKER_PATH,
                    {
                        scope:
                            "/"
                    }
                );
        }


        /*
         * Wait for the registration to become usable.
         */

        if (
            !serviceWorkerRegistration.active
        ) {

            await navigator.serviceWorker.ready;

            const readyRegistration =
                await navigator.serviceWorker
                    .getRegistration(
                        "/"
                    );


            if (
                readyRegistration
            ) {

                serviceWorkerRegistration =
                    readyRegistration;
            }
        }


        return (
            serviceWorkerRegistration ||
            null
        );

    } catch (error) {

        console.error(
            "RiderX FCM service worker registration failed:",
            error
        );

        serviceWorkerRegistration =
            null;

        return null;
    }
}


/* ============================================================
   INITIALIZE MESSAGING
============================================================ */

async function initializeMessaging() {

    try {

        if (
            messaging
        ) {

            return messaging;
        }


        const supported =
            await checkMessagingSupport();


        if (
            !supported
        ) {

            return null;
        }


        /*
         * firebase-config.js already initialized the
         * default Firebase application.
         */

        if (
            !app
        ) {

            console.error(
                "RiderX FCM: Firebase app is unavailable."
            );

            return null;
        }


        messaging =
            getMessaging(
                app
            );


        window.RiderX.firebase.messaging =
            messaging;


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
                success:
                    false,

                reason:
                    "unsupported"
            };
        }


        const currentPermission =
            Notification.permission;


        if (
            currentPermission ===
            "granted"
        ) {

            return {
                success:
                    true,

                permission:
                    "granted"
            };
        }


        if (
            currentPermission ===
            "denied"
        ) {

            return {
                success:
                    false,

                reason:
                    "permission-denied",

                permission:
                    "denied"
            };
        }


        /*
         * Permission is requested only when the application
         * explicitly calls enableNotification().
         */

        const permission =
            await Notification.requestPermission();


        if (
            permission !==
            "granted"
        ) {

            return {
                success:
                    false,

                reason:
                    "permission-denied",

                permission:
                    permission
            };
        }


        return {
            success:
                true,

            permission:
                "granted"
        };

    } catch (error) {

        console.error(
            "RiderX notification permission error:",
            error
        );

        return {
            success:
                false,

            reason:
                "permission-error",

            error:
                error
        };
    }
}


/* ============================================================
   GET FCM TOKEN
============================================================ */

async function getFCMToken() {

    try {

        const user =
            auth.currentUser;


        if (
            !user
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
                "RiderX FCM: Service worker unavailable."
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
                "RiderX FCM: Cannot save token without login."
            );

            return false;
        }


        /*
         * Store only the current active web token.
         *
         * Financial/security-sensitive fields are not changed.
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
                merge:
                    true
            }
        );


        currentToken =
            token;


        dispatchNotificationEvent(
            "riderx:fcm-token-updated",
            {
                token:
                    token
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

        const user =
            auth.currentUser;


        if (
            !user
        ) {

            return {
                success:
                    false,

                reason:
                    "not-authenticated"
            };
        }


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
                success:
                    false,

                reason:
                    "token-unavailable"
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
                success:
                    false,

                reason:
                    "token-save-failed"
            };
        }


        return {
            success:
                true,

            permission:
                "granted",

            token:
                token
        };

    } catch (error) {

        console.error(
            "RiderX notification enable failed:",
            error
        );

        return {
            success:
                false,

            reason:
                "error",

            error:
                error
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
         * Disable application-level notifications.
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
                merge:
                    true
            }
        );


        /*
         * Delete the browser's current FCM token.
         */

        if (
            messaging
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


        dispatchNotificationEvent(
            "riderx:fcm-token-disabled",
            {
                uid:
                    user.uid
            }
        );


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
   GET CURRENT USER ROLE
============================================================ */

function getCurrentUserRole() {

    try {

        const user =
            auth.currentUser;


        if (
            !user
        ) {

            return "";
        }


        /*
         * Prefer the current RiderX session if available.
         */

        const riderXUser =
            window.RiderX &&
            window.RiderX.user
                ? window.RiderX.user
                : null;


        if (
            riderXUser
        ) {

            const role =
                String(
                    riderXUser.role ||
                    riderXUser.userRole ||
                    riderXUser.accountType ||
                    ""
                ).toLowerCase();


            if (
                role
            ) {

                return role;
            }
        }


        /*
         * Local storage is only a routing hint.
         * It is never used for security authorization.
         */

        try {

            const stored =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_user"
                    ) ||
                    "null"
                );


            if (
                stored &&
                stored.uid === user.uid
            ) {

                return String(
                    stored.role ||
                    stored.userRole ||
                    stored.accountType ||
                    ""
                ).toLowerCase();
            }

        } catch (error) {

            /* Ignore malformed local session. */
        }


        return "";

    } catch (error) {

        return "";
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
            typeof data !==
            "object"
        ) {

            return;
        }


        const rideId =
            data.rideId ||
            data.bookingId ||
            "";


        const type =
            String(
                data.type ||
                ""
            ).toLowerCase();


        const suppliedRole =
            String(
                data.role ||
                ""
            ).toLowerCase();


        const role =
            suppliedRole ||
            getCurrentUserRole();


        /*
         * Rider ride request.
         */

        if (
            rideId
            &&
            (
                type ===
                    "ride_request"
                ||
                type ===
                    "new_ride"
                ||
                type ===
                    "booking_request"
            )
        ) {

            window.location.href =
                "/rider/request.html?rideId=" +
                encodeURIComponent(
                    rideId
                );

            return;
        }


        /*
         * Rider trip notification.
         */

        if (
            rideId
            &&
            role ===
                "rider"
            &&
            (
                type ===
                    "rider_ride"
                ||
                type ===
                    "ride_accepted"
                ||
                type ===
                    "ride_started"
                ||
                type ===
                    "ride_completed"
                ||
                type ===
                    "ride_cancelled"
            )
        ) {

            window.location.href =
                "/rider/trip.html?rideId=" +
                encodeURIComponent(
                    rideId
                );

            return;
        }


        /*
         * Customer ride notification.
         */

        if (
            rideId
            &&
            (
                role ===
                    "customer"
                ||
                type ===
                    "customer_ride"
                ||
                type ===
                    "driver_assigned"
                ||
                type ===
                    "rider_assigned"
            )
        ) {

            window.location.href =
                "/customer/tracking.html?rideId=" +
                encodeURIComponent(
                    rideId
                );

            return;
        }


        /*
         * Chat notification.
         */

        if (
            data.chatId
        ) {

            const chatId =
                encodeURIComponent(
                    String(
                        data.chatId
                    )
                );


            if (
                role ===
                    "rider"
            ) {

                window.location.href =
                    "/rider/chat.html?chatId=" +
                    chatId;

            } else {

                window.location.href =
                    "/customer/chat.html?chatId=" +
                    chatId;
            }


            return;
        }


        /*
         * Explicit safe internal URL.
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
            notification.title ||
            data.title ||
            "RiderX";


        const body =
            notification.body ||
            data.body ||
            "You have a new RiderX notification.";


        const tag =
            data.notificationId ||
            data.rideId ||
            data.bookingId ||
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
                            String(
                                tag
                            ),

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
            function (
                payload
            ) {

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
   AUTH-AWARE TOKEN REGISTRATION
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
        async function (
            user
        ) {

            /*
             * User signed out.
             */

            if (
                !user
            ) {

                currentToken =
                    null;

                return;
            }


            /*
             * Never open the browser permission prompt
             * automatically.
             */

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
            messagingSupported ===
            true
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
 * Compatibility aliases.
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
                "RiderX FCM: Web push messaging is unavailable."
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
         * FCM must never stop the main RiderX application.
         */

        setupAuthListener();
    }

})();
