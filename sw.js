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
   Service workers run in a separate context.
   firebase/firebase-config.js is NOT imported here.

   Firebase project:
   riderx-1
============================================================ */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const CACHE_NAME = "riderx-cache-v2.1.0";

const RUNTIME_CACHE_NAME =
    "riderx-runtime-v2.1.0";


/* ============================================================
   FIREBASE MESSAGING
   ------------------------------------------------------------
   Service-worker context uses Firebase compat SDK because
   importScripts() is used here.
============================================================ */

const FIREBASE_SDK_VERSION = "12.2.1";

const FIREBASE_APP_COMPAT =
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`;

const FIREBASE_MESSAGING_COMPAT =
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`;


/* ============================================================
   FIREBASE CONFIG
============================================================ */

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
   APPLICATION SHELL
============================================================ */

const APP_SHELL = [

    "./",

    "./index.html",

    "./manifest.json"

];


/* ============================================================
   FIREBASE MESSAGING INITIALIZATION
============================================================ */

let firebaseMessagingReady = false;

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

        firebaseMessagingReady = true;

    }

} catch (error) {

    firebaseMessagingReady = false;

    console.warn(
        "RiderX SW: Firebase Messaging unavailable.",
        error
    );

}


/* ============================================================
   BACKGROUND FCM MESSAGE
============================================================ */

if (firebaseMessagingReady) {

    try {

        const messaging =
            firebase.messaging();


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
                        `riderx-${Date.now()}`;


                    const options = {

                        body,

                        icon,

                        badge,

                        tag:
                            String(
                                notificationId
                            ),

                        renotify:
                            true,

                        data: {

                            ...data,

                            rideId,

                            notificationId

                        }

                    };


                    return self.registration
                        .showNotification(
                            title,
                            options
                        );

                } catch (error) {

                    console.error(
                        "RiderX SW: background notification failed.",
                        error
                    );

                    return null;

                }

            }
        );

    } catch (error) {

        console.warn(
            "RiderX SW: messaging handler setup failed.",
            error
        );

    }

}


/* ============================================================
   CACHE HELPERS
============================================================ */

function isSameOrigin(url) {

    return (
        url.origin ===
        self.location.origin
    );

}


function isCacheableRequest(request, url) {

    if (
        request.method !== "GET"
    ) {

        return false;

    }


    if (
        !isSameOrigin(url)
    ) {

        return false;

    }


    const pathname =
        url.pathname.toLowerCase();


    /*
     * Do not cache API/backend endpoints.
     */

    if (
        pathname.startsWith("/api/")
        ||
        pathname.includes("/api/")
    ) {

        return false;

    }


    /*
     * Do not cache Firebase endpoints.
     */

    if (
        url.hostname.includes(
            "firebaseio.com"
        )
        ||
        url.hostname.includes(
            "googleapis.com"
        )
        ||
        url.hostname.includes(
            "firebaseapp.com"
        )
    ) {

        return false;

    }


    return true;

}


/* ============================================================
   SAFE CACHE PUT
============================================================ */

async function cacheResponse(
    cacheName,
    request,
    response
) {

    try {

        if (
            !response
            ||
            !response.ok
            ||
            response.type !== "basic"
        ) {

            return;

        }


        const cache =
            await caches.open(
                cacheName
            );


        await cache.put(
            request,
            response.clone()
        );

    } catch (error) {

        console.warn(
            "RiderX SW: cache write skipped.",
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
                async function (cache) {

                    for (
                        const url of APP_SHELL
                    ) {

                        try {

                            await cache.add(
                                url
                            );

                        } catch (error) {

                            console.warn(
                                "RiderX SW: shell cache failed:",
                                url,
                                error
                            );

                        }

                    }

                }
            )
            .catch(
                function (error) {

                    console.warn(
                        "RiderX SW: install cache failed.",
                        error
                    );

                }
            )

        );


        /*
         * New worker can activate immediately.
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

                            cacheNames.map(
                                function (cacheName) {

                                    if (
                                        cacheName !== CACHE_NAME
                                        &&
                                        cacheName !== RUNTIME_CACHE_NAME
                                    ) {

                                        return caches.delete(
                                            cacheName
                                        );

                                    }

                                    return null;

                                }
                            )

                        );

                    }
                )
                .then(
                    function () {

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


        if (
            request.method !== "GET"
        ) {

            return;

        }


        const url =
            new URL(
                request.url
            );


        if (
            !isSameOrigin(url)
        ) {

            return;

        }


        const pathname =
            url.pathname.toLowerCase();


        /*
         * Never intercept API-style requests.
         */

        if (
            pathname.startsWith("/api/")
        ) {

            return;

        }


        /* =====================================================
           NAVIGATION
           Network first → cached page → index fallback
        ===================================================== */

        if (
            request.mode === "navigate"
        ) {

            event.respondWith(

                fetch(
                    request
                )
                .then(
                    async function (response) {

                        await cacheResponse(
                            RUNTIME_CACHE_NAME,
                            request,
                            response
                        );


                        return response;

                    }
                )
                .catch(
                    async function () {

                        const cachedPage =
                            await caches.match(
                                request
                            );


                        if (
                            cachedPage
                        ) {

                            return cachedPage;

                        }


                        const indexPage =
                            await caches.match(
                                "./index.html"
                            );


                        if (
                            indexPage
                        ) {

                            return indexPage;

                        }


                        return new Response(
                            `
                            <!doctype html>
                            <html>
                            <head>
                                <meta charset="utf-8">
                                <meta name="viewport"
                                      content="width=device-width,initial-scale=1">
                                <title>RiderX Offline</title>
                            </head>
                            <body>
                                <h2>RiderX is offline</h2>
                                <p>Please reconnect to the internet and try again.</p>
                            </body>
                            </html>
                            `,
                            {
                                status: 503,

                                statusText:
                                    "RiderX Offline",

                                headers: {
                                    "Content-Type":
                                        "text/html; charset=utf-8"
                                }
                            }
                        );

                    }
                )

            );


            return;

        }


        /* =====================================================
           STATIC/RUNTIME RESOURCES
           Network first → cache fallback
        ===================================================== */

        if (
            !isCacheableRequest(
                request,
                url
            )
        ) {

            return;

        }


        event.respondWith(

            fetch(
                request
            )
            .then(
                async function (response) {

                    await cacheResponse(
                        RUNTIME_CACHE_NAME,
                        request,
                        response
                    );


                    return response;

                }
            )
            .catch(
                async function () {

                    const cached =
                        await caches.match(
                            request
                        );


                    if (
                        cached
                    ) {

                        return cached;

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
            "/index.html";


        /*
         * Rider request.
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

            targetPath =
                "/rider/request.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

        }


        /*
         * Rider active ride.
         */

        else if (
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

            targetPath =
                "/rider/trip.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

        }


        /*
         * Customer active ride.
         */

        else if (
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

            targetPath =
                "/customer/tracking.html?rideId="
                +
                encodeURIComponent(
                    rideId
                );

        }


        /*
         * Chat.
         */

        else if (
            chatId
        ) {

            targetPath =
                (
                    role === "rider"
                        ? "/rider/chat.html"
                        : "/customer/chat.html"
                )
                +
                "?chatId="
                +
                encodeURIComponent(
                    chatId
                );

        }


        /*
         * Explicit internal URL.
         *
         * External URLs are rejected.
         */

        else if (
            typeof data.url === "string"
            &&
            data.url.startsWith("/")
            &&
            !data.url.startsWith("//")
        ) {

            targetPath =
                data.url;

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
                async function (clientList) {

                    /*
                     * Prefer an already-open RiderX window.
                     */

                    for (
                        const client of clientList
                    ) {

                        try {

                            const clientUrl =
                                new URL(
                                    client.url
                                );


                            if (
                                clientUrl.origin !==
                                self.location.origin
                            ) {

                                continue;

                            }


                            if (
                                "navigate" in client
                            ) {

                                await client.navigate(
                                    targetUrl
                                );

                            }


                            if (
                                "focus" in client
                            ) {

                                await client.focus();

                            }


                            return;

                        } catch (error) {

                            /*
                             * Try next client.
                             */

                        }

                    }


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
    function () {

        /*
         * Reserved for future analytics.
         * No network request is performed.
         */

    }
);


/* ============================================================
   MESSAGE
============================================================ */

self.addEventListener(
    "message",
    function (event) {

        const data =
            event.data;


        if (
            !data
        ) {

            return;

        }


        /*
         * Immediately activate this worker.
         */

        if (
            data.type === "SKIP_WAITING"
        ) {

            self.skipWaiting();

            return;

        }


        /*
         * Delete current RiderX caches.
         */

        if (
            data.type === "CLEAR_CACHE"
        ) {

            event.waitUntil(

                Promise.all([
                    caches.delete(
                        CACHE_NAME
                    ),
                    caches.delete(
                        RUNTIME_CACHE_NAME
                    )
                ])

            );

            return;

        }


        /*
         * Delete every cache.
         */

        if (
            data.type === "CLEAR_ALL_CACHES"
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
   READY
============================================================ */

console.info(
    "RiderX Service Worker loaded.",
    {
        cache:
            CACHE_NAME,

        runtimeCache:
            RUNTIME_CACHE_NAME,

        firebaseMessaging:
            firebaseMessagingReady,

        firebaseSdk:
            FIREBASE_SDK_VERSION
    }
);
