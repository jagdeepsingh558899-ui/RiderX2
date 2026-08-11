/* ============================================================
   RIDERX 2.0
   SERVICE WORKER
   File: sw.js

   Handles:
   - PWA service worker
   - Offline caching
   - Runtime caching
   - Firebase Cloud Messaging background notifications
   - Notification click routing
   - Service worker update messages
   - Cache cleanup

   IMPORTANT:
   - This file runs in a separate Service Worker context.
   - It does NOT use firebase/firebase-config.js because
     normal browser module imports are not available here.
   - Firebase Messaging is initialized here only for the
     background push service-worker context.

   Firebase project:
   riderx-1

   ============================================================ */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const CACHE_NAME =
    "riderx-cache-v2.0.0";


/*
 * Firebase Messaging service worker SDK.
 *
 * Firebase Web Messaging requires Firebase Messaging to be
 * available inside the service-worker context.
 */

const FIREBASE_APP_COMPAT =
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";

const FIREBASE_MESSAGING_COMPAT =
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js";


/* ============================================================
   RIDERX FIREBASE CONFIG
============================================================ */

/*
 * Firebase web configuration is public client configuration.
 *
 * Real security is enforced by Firebase Authentication,
 * Firestore Rules, Realtime Database Rules and Storage Rules.
 */

const FIREBASE_CONFIG = {

    apiKey:
        "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",

    authDomain:
        "riderx-1.firebaseapp.com",

    databaseURL:
        "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId:
        "riderx-1",

    storageBucket:
        "riderx-1.firebasestorage.app",

    messagingSenderId:
        "261640190671",

    appId:
        "1:261640190671:web:701b3ce5dcb6135fd955ba",

    measurementId:
        "G-SM8KLBVPWN"
};


/* ============================================================
   INITIAL APP SHELL
   ------------------------------------------------------------
   Only files that are expected to exist universally should be
   pre-cached.

   Other RiderX files are cached automatically when successfully
   requested from the network.
============================================================ */

const APP_SHELL = [

    "./",

    "./index.html",

    "./manifest.json"

];


/* ============================================================
   FIREBASE MESSAGING INITIALIZATION
============================================================ */

let firebaseMessagingReady =
    false;


/*
 * Firebase Messaging is loaded only inside the service worker.
 *
 * This is intentionally separate from the normal page-side
 * firebase/firebase-config.js initialization.
 */

try {

    importScripts(
        FIREBASE_APP_COMPAT,
        FIREBASE_MESSAGING_COMPAT
    );


    if (
        typeof firebase !== "undefined"
        &&
        firebase.apps
        &&
        firebase.apps.length === 0
    ) {

        firebase.initializeApp(
            FIREBASE_CONFIG
        );
    }


    if (
        typeof firebase !== "undefined"
        &&
        typeof firebase.messaging === "function"
    ) {

        firebaseMessagingReady =
            true;
    }


} catch (error) {

    /*
     * A Firebase Messaging failure must never prevent the
     * PWA service worker itself from installing.
     */

    firebaseMessagingReady =
        false;

    console.warn(
        "RiderX Service Worker: Firebase Messaging initialization failed.",
        error
    );
}


/* ============================================================
   FIREBASE BACKGROUND MESSAGE HANDLER
============================================================ */

if (
    firebaseMessagingReady
) {

    try {

        const messaging =
            firebase.messaging();


        /*
         * Handle background FCM messages.
         *
         * When the application is not in the foreground,
         * this handler creates the browser notification.
         */

        messaging.onBackgroundMessage(
            function (payload) {

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


                    const icon =
                        notification.icon
                        ||
                        data.icon
                        ||
                        "/assets/logo.png";


                    const badge =
                        notification.badge
                        ||
                        data.badge
                        ||
                        "/assets/logo.png";


                    const rideId =
                        data.rideId
                        ||
                        data.bookingId
                        ||
                        "";


                    const notificationId =
                        data.notificationId
                        ||
                        rideId
                        ||
                        "riderx-notification";


                    const notificationOptions = {

                        body:
                            body,

                        icon:
                            icon,

                        badge:
                            badge,

                        tag:
                            String(
                                notificationId
                            ),

                        renotify:
                            true,

                        data:
                            data

                    };


                    /*
                     * Keep notification display under RiderX
                     * control.
                     */

                    return self.registration.showNotification(
                        title,
                        notificationOptions
                    );

                } catch (error) {

                    console.error(
                        "RiderX background notification error:",
                        error
                    );
                }

            }
        );

    } catch (error) {

        console.warn(
            "RiderX background messaging handler setup failed:",
            error
        );
    }
}


/* ============================================================
   INSTALL
============================================================ */

self.addEventListener(
    "install",
    function (event) {

        event.waitUntil(

            caches.open(
                CACHE_NAME
            )
            .then(
                function (cache) {

                    /*
                     * Cache only the guaranteed application shell.
                     *
                     * If a non-critical asset is missing, the entire
                     * service worker installation must not fail.
                     */

                    return Promise.all(
                        APP_SHELL.map(
                            function (url) {

                                return cache
                                    .add(url)
                                    .catch(
                                        function (error) {

                                            console.warn(
                                                "RiderX cache warning:",
                                                url,
                                                error
                                            );

                                            return null;
                                        }
                                    );

                            }
                        )
                    );

                }
            )
            .catch(
                function (error) {

                    console.warn(
                        "RiderX service worker cache installation warning:",
                        error
                    );

                }
            )

        );


        /*
         * Activate the new service worker as soon as possible.
         */

        self.skipWaiting();

    }
);


/* ============================================================
   ACTIVATE
============================================================ */

self.addEventListener(
    "activate",
    function (event) {

        event.waitUntil(

            caches.keys()
                .then(
                    function (cacheNames) {

                        return Promise.all(

                            cacheNames
                                .filter(
                                    function (cacheName) {

                                        return (
                                            cacheName !==
                                            CACHE_NAME
                                        );

                                    }
                                )
                                .map(
                                    function (cacheName) {

                                        return caches.delete(
                                            cacheName
                                        );

                                    }
                                )

                        );

                    }
                )
                .then(
                    function () {

                        /*
                         * Take control of currently open RiderX
                         * pages immediately.
                         */

                        return self.clients.claim();

                    }
                )

        );

    }
);


/* ============================================================
   FETCH
============================================================ */

self.addEventListener(
    "fetch",
    function (event) {

        const request =
            event.request;


        /*
         * Service worker caching should only process GET requests.
         */

        if (
            request.method !==
            "GET"
        ) {

            return;
        }


        const url =
            new URL(
                request.url
            );


        /*
         * Never interfere with external services.
         *
         * This includes:
         * - Firebase
         * - Google APIs
         * - OpenStreetMap
         * - Leaflet CDN
         * - other third-party APIs
         */

        if (
            url.origin !==
            self.location.origin
        ) {

            return;
        }


        /*
         * Never cache sensitive/authentication-style endpoints
         * merely because they happen to be same-origin.
         */

        const pathname =
            url.pathname.toLowerCase();


        if (
            pathname.includes(
                "/api/"
            )
        ) {

            return;
        }


        /*
         * Navigation requests:
         *
         * Network first.
         *
         * If offline, use cached page and finally index.html.
         */

        if (
            request.mode ===
            "navigate"
        ) {

            event.respondWith(

                fetch(
                    request
                )
                .then(
                    function (response) {

                        if (
                            response
                            &&
                            response.ok
                            &&
                            response.type ===
                            "basic"
                        ) {

                            const responseCopy =
                                response.clone();


                            caches.open(
                                CACHE_NAME
                            )
                            .then(
                                function (cache) {

                                    cache.put(
                                        request,
                                        responseCopy
                                    );

                                }
                            )
                            .catch(
                                function () {

                                    /* Ignore cache errors. */

                                }
                            );
                        }


                        return response;

                    }
                )
                .catch(
                    function () {

                        return caches.match(
                            request
                        )
                        .then(
                            function (cachedPage) {

                                if (
                                    cachedPage
                                ) {

                                    return cachedPage;
                                }


                                return caches.match(
                                    "./index.html"
                                )
                                .then(
                                    function (fallbackPage) {

                                        if (
                                            fallbackPage
                                        ) {

                                            return fallbackPage;
                                        }


                                        return new Response(
                                            "RiderX is offline.",
                                            {
                                                status:
                                                    503,

                                                statusText:
                                                    "RiderX Offline",

                                                headers:
                                                    {
                                                        "Content-Type":
                                                            "text/plain; charset=utf-8"
                                                    }
                                            }
                                        );

                                    }
                                );

                            }
                        );

                    }
                )

            );


            return;
        }


        /*
         * Static/runtime resources:
         *
         * Network first.
         * Successful same-origin resources are cached.
         * Offline requests use the cached version.
         */

        event.respondWith(

            fetch(
                request
            )
            .then(
                function (response) {

                    if (
                        response
                        &&
                        response.ok
                        &&
                        response.type ===
                        "basic"
                    ) {

                        const responseCopy =
                            response.clone();


                        caches.open(
                            CACHE_NAME
                        )
                        .then(
                            function (cache) {

                                cache.put(
                                    request,
                                    responseCopy
                                );

                            }
                        )
                        .catch(
                            function () {

                                /* Ignore cache errors. */

                            }
                        );

                    }


                    return response;

                }
            )
            .catch(
                function () {

                    return caches.match(
                        request
                    )
                    .then(
                        function (cachedResponse) {

                            if (
                                cachedResponse
                            ) {

                                return cachedResponse;
                            }


                            return new Response(
                                "",
                                {
                                    status:
                                        503,

                                    statusText:
                                        "RiderX Offline"
                                }
                            );

                        }
                    );

                }
            )

        );

    }
);


/* ============================================================
   NOTIFICATION CLICK
============================================================ */

self.addEventListener(
    "notificationclick",
    function (event) {

        event.notification.close();


        const data =
            event.notification &&
            event.notification.data
                ? event.notification.data
                : {};


        const rideId =
            data.rideId
            ||
            data.bookingId
            ||
            "";


        const chatId =
            data.chatId
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


        let targetPath =
            null;


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

            targetPath =
                "/rider/request.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

        }


        /*
         * Rider trip notification.
         */

        else if (
            rideId
            &&
            (
                role ===
                "rider"
                ||
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
            )
        ) {

            targetPath =
                "/rider/trip.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

        }


        /*
         * Customer ride notification.
         */

        else if (
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

            targetPath =
                "/customer/tracking.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

        }


        /*
         * Chat notification.
         */

        else if (
            chatId
        ) {

            if (
                role ===
                "rider"
            ) {

                targetPath =
                    "/rider/chat.html?chatId="
                    +
                    encodeURIComponent(
                        chatId
                    );

            } else {

                targetPath =
                    "/customer/chat.html?chatId="
                    +
                    encodeURIComponent(
                        chatId
                    );

            }

        }


        /*
         * Generic internal URL.
         *
         * External URLs are deliberately rejected.
         */

        else if (
            typeof data.url ===
            "string"
            &&
            data.url.startsWith("/")
            &&
            !data.url.startsWith("//")
        ) {

            targetPath =
                data.url;
        }


        /*
         * No valid target:
         * open the main RiderX application.
         */

        if (
            !targetPath
        ) {

            targetPath =
                "/index.html";
        }


        const targetUrl =
            new URL(
                targetPath,
                self.location.origin
            ).href;


        event.waitUntil(

            clients.matchAll(
                {
                    type:
                        "window",

                    includeUncontrolled:
                        true
                }
            )
            .then(
                function (clientList) {

                    /*
                     * If RiderX is already open, reuse the
                     * existing application window.
                     */

                    for (
                        const client of clientList
                    ) {

                        if (
                            "focus" in client
                        ) {

                            try {

                                const currentUrl =
                                    new URL(
                                        client.url
                                    );


                                if (
                                    currentUrl.origin ===
                                    self.location.origin
                                ) {

                                    if (
                                        "navigate" in client
                                    ) {

                                        return client
                                            .navigate(
                                                targetUrl
                                            )
                                            .then(
                                                function () {

                                                    return client.focus();

                                                }
                                            );

                                    }


                                    return client.focus();

                                }

                            } catch (error) {

                                /* Continue searching. */

                            }

                        }

                    }


                    /*
                     * Otherwise open RiderX in a new window.
                     */

                    if (
                        clients.openWindow
                    ) {

                        return clients.openWindow(
                            targetUrl
                        );

                    }


                    return null;

                }
            )

        );

    }
);


/* ============================================================
   NOTIFICATION CLOSE
============================================================ */

self.addEventListener(
    "notificationclose",
    function (event) {

        /*
         * Reserved for future analytics/notification
         * lifecycle tracking.
         *
         * No network request is made here.
         */

        event.waitUntil(
            Promise.resolve()
        );

    }
);


/* ============================================================
   MESSAGE
============================================================ */

self.addEventListener(
    "message",
    function (event) {

        if (
            !event.data
        ) {

            return;
        }


        /*
         * Force immediate activation.
         */

        if (
            event.data.type ===
            "SKIP_WAITING"
        ) {

            self.skipWaiting();

            return;
        }


        /*
         * Clear current RiderX cache.
         */

        if (
            event.data.type ===
            "CLEAR_CACHE"
        ) {

            event.waitUntil(

                caches.delete(
                    CACHE_NAME
                )

            );

            return;
        }


        /*
         * Clear all RiderX caches.
         */

        if (
            event.data.type ===
            "CLEAR_ALL_CACHES"
        ) {

            event.waitUntil(

                caches.keys()
                    .then(
                        function (cacheNames) {

                            return Promise.all(
                                cacheNames.map(
                                    function (cacheName) {

                                        return caches.delete(
                                            cacheName
                                        );

                                    }
                                )
                            );

                        }
                    )

            );

        }

    }
);


/* ============================================================
   SERVICE WORKER READY LOG
============================================================ */

console.info(
    "RiderX Service Worker loaded.",
    {
        cache:
            CACHE_NAME,

        firebaseMessaging:
            firebaseMessagingReady
    }
);
