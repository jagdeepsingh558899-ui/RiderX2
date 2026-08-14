/* ============================================================
   RIDERX 2.0
   FIREBASE CLOUD MESSAGING
   File: firebase/messaging.js

   FINAL PRODUCTION VERSION
   Firebase SDK: 12.2.1

   Handles:
   - FCM web messaging
   - Notification permission
   - FCM token generation
   - Firestore token registration
   - Foreground notifications
   - Background notification support through /sw.js
   - Notification click routing
   - Customer / Rider / Admin routing
   - Auth-aware registration
   - Token refresh / re-registration
   - Enable / disable notifications

   IMPORTANT:
   - Firebase is initialized ONLY by firebase-config.js.
   - This file does NOT initialize Firebase.
   - Authentication remains Firebase Auth's responsibility.
   - localStorage is NEVER used for authorization.
   - Service worker is /sw.js.
============================================================ */

"use strict";


/* ============================================================
   FIREBASE CONFIG IMPORTS
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


/* ============================================================
   FIREBASE MESSAGING SDK
============================================================ */

import {
    getMessaging,
    getToken,
    deleteToken,
    onMessage,
    isSupported
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";


/* ============================================================
   RIDERX NAMESPACE
============================================================ */

window.RiderX =
    window.RiderX || {};

window.RiderX.firebase =
    window.RiderX.firebase || {};


/* ============================================================
   CONSTANTS
============================================================ */

const FCM_VAPID_KEY =
    "BL9_-5Z7YfbA9iJsPj5SYF1PUSpTo2sCIoyL5cjBHOUOoQeDulTTznkqL_N-87z2MAKCfcEdY0PYA9Bdv48kd3g";


const SERVICE_WORKER_PATH =
    "/sw.js";


const SERVICE_WORKER_SCOPE =
    "/";


const NOTIFICATION_ICON =
    "/assets/logo.png";


const NOTIFICATION_BADGE =
    "/assets/logo.png";


const TOKEN_TIMEOUT_MS =
    20000;


/* ============================================================
   INTERNAL STATE
============================================================ */

let messagingInstance =
    null;

let messagingSupported =
    false;

let serviceWorkerRegistration =
    null;

let foregroundListenerStarted =
    false;

let authListenerStarted =
    false;

let initializationPromise =
    null;

let serviceWorkerPromise =
    null;

let tokenPromise =
    null;

let currentToken =
    null;

let currentUserUid =
    null;


/* ============================================================
   EVENT DISPATCH
============================================================ */

function dispatchNotificationEvent(
    eventName,
    detail = {}
) {

    try {

        window.dispatchEvent(
            new CustomEvent(
                eventName,
                {
                    detail
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
   ERROR HELPER
============================================================ */

function safeErrorMessage(
    error
) {

    try {

        if (
            error &&
            typeof error.message === "string"
        ) {

            return error.message;

        }

    } catch (_) {

        /* Ignore. */

    }


    return "Unknown RiderX notification error.";

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
   SERVICE WORKER REGISTRATION
============================================================ */

async function registerMessagingServiceWorker() {

    if (
        serviceWorkerRegistration
    ) {

        return serviceWorkerRegistration;

    }


    if (
        serviceWorkerPromise
    ) {

        return serviceWorkerPromise;

    }


    serviceWorkerPromise =
        (async function () {

            try {

                if (
                    typeof navigator === "undefined"
                    ||
                    !("serviceWorker" in navigator)
                ) {

                    return null;

                }


                /*
                 * Get the exact RiderX root registration first.
                 */

                let registration =
                    await navigator.serviceWorker
                        .getRegistration(
                            SERVICE_WORKER_SCOPE
                        );


                /*
                 * If no root registration exists,
                 * register /sw.js.
                 */

                if (
                    !registration
                ) {

                    registration =
                        await navigator.serviceWorker.register(
                            SERVICE_WORKER_PATH,
                            {
                                scope:
                                    SERVICE_WORKER_SCOPE
                            }
                        );

                }


                /*
                 * Wait until the browser has an active
                 * registration.
                 */

                if (
                    !registration.active
                ) {

                    try {

                        await navigator.serviceWorker.ready;

                    } catch (_) {

                        /* Continue with current registration. */

                    }


                    const readyRegistration =
                        await navigator.serviceWorker
                            .getRegistration(
                                SERVICE_WORKER_SCOPE
                            );


                    if (
                        readyRegistration
                    ) {

                        registration =
                            readyRegistration;

                    }

                }


                serviceWorkerRegistration =
                    registration ||
                    null;


                return serviceWorkerRegistration;

            } catch (error) {

                console.error(
                    "RiderX FCM service worker registration failed:",
                    error
                );

                serviceWorkerRegistration =
                    null;

                return null;

            } finally {

                serviceWorkerPromise =
                    null;

            }

        })();


    return serviceWorkerPromise;

}


/* ============================================================
   INITIALIZE MESSAGING
============================================================ */

async function initializeMessaging() {

    if (
        messagingInstance
    ) {

        return messagingInstance;

    }


    if (
        initializationPromise
    ) {

        return initializationPromise;

    }


    initializationPromise =
        (async function () {

            try {

                const supported =
                    await checkMessagingSupport();


                if (
                    !supported
                ) {

                    return null;

                }


                if (
                    !app
                ) {

                    console.error(
                        "RiderX FCM: Firebase app is unavailable."
                    );

                    return null;

                }


                messagingInstance =
                    getMessaging(
                        app
                    );


                window.RiderX.firebase.messaging =
                    messagingInstance;


                return messagingInstance;

            } catch (error) {

                console.error(
                    "RiderX FCM initialization failed:",
                    error
                );

                messagingInstance =
                    null;

                return null;

            } finally {

                initializationPromise =
                    null;

            }

        })();


    return initializationPromise;

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
   GET PERMISSION
============================================================ */

function getNotificationPermission() {

    if (
        !isNotificationSupported()
    ) {

        return "unsupported";

    }


    return Notification.permission;

}


/* ============================================================
   REQUEST PERMISSION
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
                    "unsupported",

                permission:
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

            permission:
                getNotificationPermission(),

            error
        };

    }

}


/* ============================================================
   TOKEN TIMEOUT
============================================================ */

function withTimeout(
    promise,
    timeoutMs
) {

    return Promise.race([

        promise,

        new Promise(
            function (
                _resolve,
                reject
            ) {

                setTimeout(
                    function () {

                        reject(
                            new Error(
                                "RiderX FCM operation timed out."
                            )
                        );

                    },
                    timeoutMs
                );

            }
        )

    ]);

}


/* ============================================================
   GET FCM TOKEN
============================================================ */

async function getFCMToken() {

    if (
        tokenPromise
    ) {

        return tokenPromise;

    }


    tokenPromise =
        (async function () {

            try {

                const user =
                    auth.currentUser;


                if (
                    !user
                ) {

                    return null;

                }


                const messaging =
                    await initializeMessaging();


                if (
                    !messaging
                ) {

                    return null;

                }


                const registration =
                    await registerMessagingServiceWorker();


                if (
                    !registration
                ) {

                    return null;

                }


                const token =
                    await withTimeout(
                        getToken(
                            messaging,
                            {
                                vapidKey:
                                    FCM_VAPID_KEY,

                                serviceWorkerRegistration:
                                    registration
                            }
                        ),
                        TOKEN_TIMEOUT_MS
                    );


                if (
                    !token
                ) {

                    return null;

                }


                currentToken =
                    token;

                currentUserUid =
                    user.uid;


                return token;

            } catch (error) {

                console.error(
                    "RiderX FCM token generation failed:",
                    error
                );

                return null;

            } finally {

                tokenPromise =
                    null;

            }

        })();


    return tokenPromise;

}


/* ============================================================
   SAVE TOKEN
============================================================ */

async function saveNotificationToken(
    token
) {

    try {

        if (
            typeof token !== "string"
            ||
            token.trim() === ""
        ) {

            return false;

        }


        const user =
            auth.currentUser;


        if (
            !user
        ) {

            return false;

        }


        /*
         * Only the authenticated user's own profile
         * is modified.
         *
         * These fields are explicitly permitted by the
         * Firestore /users/{uid} update rules.
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

        currentUserUid =
            user.uid;


        dispatchNotificationEvent(
            "riderx:fcm-token-updated",
            {
                token,
                uid:
                    user.uid
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


        const supported =
            await checkMessagingSupport();


        if (
            !supported
        ) {

            return {
                success:
                    false,

                reason:
                    "unsupported"
            };

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
            await saveNotificationToken(
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
                merge:
                    true
            }
        );


        /*
         * Delete the browser FCM token.
         */

        const messaging =
            messagingInstance ||
            await initializeMessaging();


        if (
            messaging
        ) {

            try {

                await deleteToken(
                    messaging
                );

            } catch (error) {

                /*
                 * Firestore notification state has already
                 * been disabled. Token deletion failure must
                 * not make the whole operation fail.
                 */

                console.warn(
                    "RiderX FCM token deletion warning:",
                    error
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
   ROLE RESOLUTION
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
         * Prefer the live RiderX application state.
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
                )
                .trim()
                .toLowerCase();


            if (
                role
            ) {

                return role;

            }

        }


        /*
         * localStorage is ONLY a routing hint.
         * It is NOT trusted for authorization.
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
                stored
                &&
                stored.uid === user.uid
            ) {

                return String(
                    stored.role ||
                    stored.userRole ||
                    stored.accountType ||
                    ""
                )
                .trim()
                .toLowerCase();

            }

        } catch (_) {

            /* Ignore malformed local state. */

        }


        return "";

    } catch (_) {

        return "";

    }

}


/* ============================================================
   SAFE INTERNAL URL
============================================================ */

function isSafeInternalUrl(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return false;

    }


    const trimmed =
        value.trim();


    return (
        trimmed.startsWith("/")
        &&
        !trimmed.startsWith("//")
        &&
        !trimmed.includes("://")
    );

}


/* ============================================================
   BUILD INTERNAL ROUTE
============================================================ */

function buildRoute(
    path,
    parameterName,
    parameterValue
) {

    if (
        !path
    ) {

        return "/index.html";

    }


    if (
        !parameterValue
    ) {

        return path;

    }


    const separator =
        path.includes("?")
            ? "&"
            : "?";


    return (
        path +
        separator +
        encodeURIComponent(
            parameterName
        ) +
        "=" +
        encodeURIComponent(
            String(
                parameterValue
            )
        )
    );

}


/* ============================================================
   NOTIFICATION CLICK ROUTER
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
            data.rideId ||
            data.bookingId ||
            "";


        const type =
            String(
                data.type ||
                ""
            )
            .trim()
            .toLowerCase();


        const suppliedRole =
            String(
                data.role ||
                ""
            )
            .trim()
            .toLowerCase();


        const role =
            suppliedRole ||
            getCurrentUserRole();


        /*
         * Explicit safe internal URL.
         */

        if (
            isSafeInternalUrl(
                data.url
            )
        ) {

            window.location.assign(
                data.url
            );

            return;

        }


        /*
         * Admin notification.
         */

        if (
            role === "admin"
            ||
            type === "admin"
            ||
            type === "admin_notification"
        ) {

            window.location.assign(
                "/admin/dashboard.html"
            );

            return;

        }


        /*
         * Rider ride request.
         *
         * Current project route:
         * rider/rides.html
         */

        if (
            role === "rider"
            &&
            (
                type === "ride_request"
                ||
                type === "new_ride"
                ||
                type === "booking_request"
                ||
                type === "ride_offer"
                ||
                type === "new_booking"
            )
        ) {

            window.location.assign(
                buildRoute(
                    "/rider/rides.html",
                    "rideId",
                    rideId
                )
            );

            return;

        }


        /*
         * Rider trip/ride event.
         */

        if (
            role === "rider"
            &&
            rideId
            &&
            (
                type === "ride_accepted"
                ||
                type === "rider_ride"
                ||
                type === "ride_started"
                ||
                type === "trip_started"
                ||
                type === "ride_completed"
                ||
                type === "ride_cancelled"
            )
        ) {

            window.location.assign(
                buildRoute(
                    "/rider/home.html",
                    "rideId",
                    rideId
                )
            );

            return;

        }


        /*
         * Customer active ride event.
         */

        if (
            (
                role === "customer"
                ||
                type === "customer_ride"
                ||
                type === "driver_assigned"
                ||
                type === "rider_assigned"
                ||
                type === "ride_accepted"
                ||
                type === "ride_started"
            )
            &&
            rideId
        ) {

            window.location.assign(
                buildRoute(
                    "/customer/home.html",
                    "rideId",
                    rideId
                )
            );

            return;

        }


        /*
         * Customer completed ride.
         */

        if (
            (
                role === "customer"
                ||
                type === "ride_completed"
                ||
                type === "trip_completed"
                ||
                type === "booking_completed"
            )
            &&
            (
                type === "ride_completed"
                ||
                type === "trip_completed"
                ||
                type === "booking_completed"
            )
        ) {

            window.location.assign(
                "/customer/history.html"
            );

            return;

        }


        /*
         * Wallet/payment notification.
         */

        if (
            type === "payment"
            ||
            type === "wallet"
            ||
            type === "wallet_update"
        ) {

            if (
                role === "rider"
            ) {

                window.location.assign(
                    "/rider/wallet.html"
                );

            } else {

                window.location.assign(
                    "/customer/wallet.html"
                );

            }

            return;

        }


        /*
         * Chat notification.
         *
         * Dedicated chat route is not assumed.
         */

        if (
            data.chatId
        ) {

            if (
                role === "rider"
            ) {

                window.location.assign(
                    "/rider/home.html"
                );

            } else {

                window.location.assign(
                    "/customer/home.html"
                );

            }

            return;

        }


        /*
         * Role-based fallback.
         */

        if (
            role === "rider"
        ) {

            window.location.assign(
                "/rider/home.html"
            );

            return;

        }


        if (
            role === "customer"
        ) {

            window.location.assign(
                "/customer/home.html"
            );

            return;

        }


        window.location.assign(
            "/index.html"
        );

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


        const icon =
            notification.icon ||
            data.icon ||
            NOTIFICATION_ICON;


        const badge =
            notification.badge ||
            data.badge ||
            NOTIFICATION_BADGE;


        const tag =
            data.notificationId ||
            data.rideId ||
            data.bookingId ||
            `riderx-${Date.now()}`;


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
                        body,

                        icon,

                        badge,

                        tag:
                            String(
                                tag
                            ),

                        data
                    }
                );


            browserNotification.onclick =
                function () {

                    try {

                        window.focus();

                    } catch (_) {

                        /* Ignore focus errors. */

                    }


                    handleNotificationClick(
                        data
                    );


                    browserNotification.close();

                };

        }


        dispatchNotificationEvent(
            "riderx:notification",
            payload
        );

    } catch (error) {

        console.error(
            "RiderX foreground notification failed:",
            error
        );

    }

}


/* ============================================================
   FOREGROUND LISTENER
============================================================ */

async function setupForegroundListener() {

    if (
        foregroundListenerStarted
    ) {

        return true;

    }


    try {

        const messaging =
            await initializeMessaging();


        if (
            !messaging
        ) {

            return false;

        }


        onMessage(
            messaging,
            function (
                payload
            ) {

                showForegroundNotification(
                    payload
                );

            }
        );


        foregroundListenerStarted =
            true;


        return true;

    } catch (error) {

        console.error(
            "RiderX foreground FCM listener failed:",
            error
        );

        return false;

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

            if (
                !user
            ) {

                currentToken =
                    null;

                currentUserUid =
                    null;

                return;

            }


            currentUserUid =
                user.uid;


            /*
             * Never automatically open permission prompt.
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

                    await saveNotificationToken(
                        token
                    );

                }

            } catch (error) {

                console.warn(
                    "RiderX automatic FCM registration failed:",
                    safeErrorMessage(error)
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


window.RiderX.firebase.getNotificationPermission =
    getNotificationPermission;


window.RiderX.firebase.enableNotification =
    enableNotification;


window.RiderX.firebase.disableNotification =
    disableNotification;


window.RiderX.firebase.getFCMToken =
    getFCMToken;


window.RiderX.firebase.saveNotificationToken =
    saveNotificationToken;


window.RiderX.firebase.showNotification =
    showForegroundNotification;


window.RiderX.firebase.handleNotificationClick =
    handleNotificationClick;


window.RiderX.firebase.registerMessagingServiceWorker =
    registerMessagingServiceWorker;


window.RiderX.firebase.initializeMessaging =
    initializeMessaging;


/* ============================================================
   COMPATIBILITY ALIASES
============================================================ */

window.RiderX.enableNotification =
    enableNotification;


window.RiderX.disableNotification =
    disableNotification;


window.RiderX.getFCMToken =
    getFCMToken;


window.RiderX.saveNotificationToken =
    saveNotificationToken;


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
                "RiderX FCM: Web Push is unavailable on this browser."
            );

            setupAuthListener();

            return;

        }


        const messaging =
            await initializeMessaging();


        if (
            messaging
        ) {

            window.RiderX.firebase.messaging =
                messaging;


            await setupForegroundListener();

        }


        /*
         * Auth listener is always started, even when FCM is
         * unavailable, so FCM never blocks the application.
         */

        setupAuthListener();


        console.info(
            "RiderX Firebase Messaging initialized.",
            {
                supported:
                    messagingSupported,

                sdk:
                    "12.2.1",

                serviceWorker:
                    SERVICE_WORKER_PATH
            }
        );

    } catch (error) {

        console.error(
            "RiderX Firebase Messaging startup failed:",
            error
        );


        /*
         * Notification failure must NEVER break RiderX.
         */

        setupAuthListener();

    }

})();
