/* ============================================================
   RIDERX 2.0
   SERVICE WORKER
   File: sw.js

   FINAL ROOT SERVICE WORKER

   Handles:
   - PWA service worker
   - Application-shell caching
   - Runtime caching
   - Firebase Cloud Messaging background notifications
   - Notification click routing
   - Service worker update messages
   - Cache cleanup
   - Offline fallback

   IMPORTANT:
   - This file runs in a Service Worker context.
   - firebase/firebase-config.js is NOT imported here.
   - Firebase Auth is NOT handled here.
   - The service worker NEVER decides whether a user is
     authenticated.
   - Authentication and role resolution remain controlled
     by the application/Firebase Auth.

   CURRENT RIDERX2 STRUCTURE:
   - ./index.html
   - ./manifest.json
   - ./sw.js
   - ./auth/
   - ./customer/
   - ./rider/
   - ./admin/

   Firebase project:
   riderx-1
============================================================ */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const SW_VERSION = "2.2.0";

const CACHE_NAME =
    `riderx-shell-${SW_VERSION}`;

const RUNTIME_CACHE_NAME =
    `riderx-runtime-${SW_VERSION}`;


/* ============================================================
   FIREBASE MESSAGING
   ------------------------------------------------------------
   Service-worker context uses Firebase Compat SDK because
   importScripts() is used here.
============================================================ */

const FIREBASE_SDK_VERSION = "12.2.1";

const FIREBASE_APP_COMPAT =
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`;

const FIREBASE_MESSAGING_COMPAT =
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`;


/* ============================================================
   FIREBASE CONFIG
   ------------------------------------------------------------
   Firebase web configuration is not a secret credential.
   Firestore/Auth/Storage security must be enforced through
   Firebase Security Rules and authorized domains.
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
   ------------------------------------------------------------
   Keep this list small and reliable.

   Authentication/role routing remains inside index.html.
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

if (
    firebaseMessagingReady
) {

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
                        "./assets/logo.png";


                    const badge =
                        notification.badge
                        ||
                        data.badge
                        ||
                        "./assets/logo.png";


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


                    return self.registration.showNotification(
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
   URL HELPERS
============================================================ */

function getAbsoluteUrl(
    path
) {

    return new URL(
        path,
        self.location.origin
    ).href;

}


function isSameOrigin(
    url
) {

    return (
        url.origin ===
        self.location.origin
    );

}


/* ============================================================
   CACHEABILITY
============================================================ */

function isCacheableRequest(
    request,
    url
) {

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
     * Never cache API routes.
     */

    if (
        pathname === "/api"
        ||
        pathname.startsWith("/api/")
    ) {

        return false;

    }


    /*
     * Never cache Firebase/backend requests.
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


    /*
     * Do not cache authentication endpoints.
     */

    if (
        pathname.includes("/__/auth/")
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
                        const path of APP_SHELL
                    ) {

                        try {

                            const request =
                                new Request(
                                    path,
                                    {
                                        cache:
                                            "no-store"
                                    }
                                );


                            const response =
                                await fetch(
                                    request
                                );


                            if (
                                response.ok
                            ) {

                                await cache.put(
                                    request,
                                    response.clone()
                                );

                            }

                        } catch (error) {

                            console.warn(
                                "RiderX SW: shell cache failed:",
                                path,
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
         * Activate the new worker immediately.
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

                                    /*
                                     * Remove old RiderX caches.
                                     */

                                    if (
                                        cacheName.startsWith(
                                            "riderx-"
                                        )
                                        &&
                                        cacheName !==
                                            CACHE_NAME
                                        &&
                                        cacheName !==
                                            RUNTIME_CACHE_NAME
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
   OFFLINE RESPONSE
============================================================ */

function offlineResponse() {

    return new Response(
        `
        <!doctype html>

        <html lang="en">

        <head>

            <meta charset="utf-8">

            <meta
                name="viewport"
                content="width=device-width,initial-scale=1"
            >

            <meta
                name="theme-color"
                content="#f5c400"
            >

            <title>RiderX Offline</title>

            <style>

                * {
                    box-sizing: border-box;
                }

                html,
                body {
                    width: 100%;
                    min-height: 100%;
                    margin: 0;
                }

                body {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: #050505;
                    color: #ffffff;
                    font-family:
                        system-ui,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                    text-align: center;
                }

                .card {
                    width: min(100%, 380px);
                    padding: 32px 24px;
                    border: 1px solid
                        rgba(245,196,0,.2);
                    border-radius: 22px;
                    background: #101010;
                    box-shadow:
                        0 20px 70px
                        rgba(0,0,0,.5);
                }

                .logo {
                    width: 68px;
                    height: 68px;
                    margin: 0 auto 20px;
                    border-radius: 18px;
                    object-fit: contain;
                }

                h2 {
                    margin: 0;
                    font-size: 24px;
                }

                h2 span {
                    color: #f5c400;
                }

                p {
                    margin: 12px 0 0;
                    color: #999999;
                    line-height: 1.6;
                    font-size: 14px;
                }

                button {
                    margin-top: 24px;
                    padding: 12px 20px;
                    border: 0;
                    border-radius: 12px;
                    background: #f5c400;
                    color: #080808;
                    font-weight: 800;
                    cursor: pointer;
                }

            </style>

        </head>

        <body>

            <div class="card">

                <img
                    class="logo"
                    src="./assets/logo.png"
                    alt="RiderX"
                >

                <h2>
                    Rider<span>X</span>
                </h2>

                <p>
                    You are currently offline.
                    Please reconnect to the internet
                    and try again.
                </p>

                <button
                    onclick="location.reload()"
                >
                    Try Again
                </button>

            </div>

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
         * Never intercept API requests.
         */

        if (
            pathname === "/api"
            ||
            pathname.startsWith("/api/")
        ) {

            return;

        }


        /* =====================================================
           NAVIGATION REQUEST
           -----------------------------------------------------
           Network first.
           Cached page second.
           index.html third.
           Offline page last.
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

                        /*
                         * Only cache successful same-origin
                         * navigation responses.
                         */

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


                        return offlineResponse();

                    }
                )

            );


            return;

        }


        /* =====================================================
           STATIC / RUNTIME RESOURCES
           -----------------------------------------------------
           Network first.
           Cache fallback.
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
   NOTIFICATION CLICK ROUTING
   ------------------------------------------------------------
   IMPORTANT:
   Only routes that exist in the current RiderX2 project
   are used here.

   Existing known routes:
   - index.html
   - customer/home.html
   - customer/booking.html
   - customer/history.html
   - customer/profile.html
   - customer/wallet.html
   - rider/home.html
   - rider/rides.html
   - rider/history.html
   - rider/profile.html
   - rider/wallet.html
   - admin/dashboard.html
   - auth/role.html

   We intentionally do NOT route to:
   - rider/request.html
   - rider/trip.html
   - rider/chat.html
   - customer/tracking.html
   - customer/chat.html
============================================================ */

function getNotificationTarget(
    data
) {

    const notificationData =
        data || {};


    const rideId =
        notificationData.rideId
        ||
        notificationData.bookingId
        ||
        "";


    const type =
        String(
            notificationData.type
            ||
            ""
        )
        .trim()
        .toLowerCase();


    const role =
        String(
            notificationData.role
            ||
            ""
        )
        .trim()
        .toLowerCase();


    const url =
        notificationData.url;


    /* =========================================================
       Explicit safe internal URL
    ========================================================= */

    if (
        typeof url === "string"
        &&
        url.startsWith("/")
        &&
        !url.startsWith("//")
        &&
        !url.includes("://")
    ) {

        return url;

    }


    /* =========================================================
       ADMIN
    ========================================================= */

    if (
        role === "admin"
        ||
        type === "admin"
        ||
        type === "admin_notification"
    ) {

        return "/admin/dashboard.html";

    }


    /* =========================================================
       RIDER
       ---------------------------------------------------------
       Since dedicated request/trip/chat files do not exist,
       route rider notifications to rider/home.html or
       rider/rides.html.
    ========================================================= */

    if (
        role === "rider"
    ) {

        if (
            type === "ride_request"
            ||
            type === "new_ride"
            ||
            type === "booking_request"
            ||
            type === "ride_offer"
            ||
            type === "new_booking"
        ) {

            return "/rider/rides.html";

        }


        return "/rider/home.html";

    }


    if (
        type === "ride_request"
        ||
        type === "new_ride"
        ||
        type === "booking_request"
        ||
        type === "ride_offer"
        ||
        type === "new_booking"
    ) {

        return "/rider/rides.html";

    }


    /* =========================================================
       CUSTOMER
    ========================================================= */

    if (
        role === "customer"
    ) {

        if (
            type === "ride_completed"
            ||
            type === "trip_completed"
            ||
            type === "booking_completed"
        ) {

            return "/customer/history.html";

        }


        if (
            type === "payment"
            ||
            type === "wallet"
            ||
            type === "wallet_update"
        ) {

            return "/customer/wallet.html";

        }


        return "/customer/home.html";

    }


    if (
        type === "driver_assigned"
        ||
        type === "rider_assigned"
        ||
        type === "ride_accepted"
        ||
        type === "ride_started"
        ||
        type === "customer_ride"
        ||
        type === "trip_started"
    ) {

        return "/customer/home.html";

    }


    if (
        type === "ride_completed"
        ||
        type === "trip_completed"
        ||
        type === "booking_completed"
    ) {

        return "/customer/history.html";

    }


    if (
        type === "payment"
        ||
        type === "wallet"
        ||
        type === "wallet_update"
    ) {

        return "/customer/wallet.html";

    }


    /* =========================================================
       CHAT
       ---------------------------------------------------------
       No standalone chat pages currently exist.
       Return to the correct role home instead.
    ========================================================= */

    if (
        notificationData.chatId
    ) {

        if (
            role === "rider"
        ) {

            return "/rider/home.html";

        }


        if (
            role === "customer"
        ) {

            return "/customer/home.html";

        }


        return "/index.html";

    }


    /* =========================================================
       DEFAULT
    ========================================================= */

    return "/index.html";

}


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


        const targetPath =
            getNotificationTarget(
                data
            );


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
                     * Prefer an existing RiderX window.
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


                            /*
                             * Navigate the existing window
                             * to the notification destination.
                             */

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


                            return client;

                        } catch (error) {

                            console.warn(
                                "RiderX SW: existing client navigation failed.",
                                error
                            );

                        }

                    }


                    /*
                     * No existing RiderX window.
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
    function () {

        /*
         * Reserved for future analytics.
         * No network request is performed here.
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


        /* =====================================================
           ACTIVATE NEW WORKER
        ===================================================== */

        if (
            data.type ===
            "SKIP_WAITING"
        ) {

            self.skipWaiting();

            return;

        }


        /* =====================================================
           CLEAR RIDERX CACHES
        ===================================================== */

        if (
            data.type ===
            "CLEAR_CACHE"
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


        /* =====================================================
           CLEAR ALL CACHES
        ===================================================== */

        if (
            data.type ===
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
   READY
============================================================ */

console.info(
    "RiderX Service Worker loaded.",
    {
        version:
            SW_VERSION,

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
