/* ============================================================
   RIDERX 2.0
   SERVICE WORKER
   File: sw.js

   FINAL PRODUCTION SERVICE WORKER

   Handles:
   - PWA service worker
   - Application shell caching
   - Safe static asset runtime caching
   - Firebase Cloud Messaging background notifications
   - Notification click routing
   - Service worker update messages
   - Cache cleanup
   - Offline fallback

   IMPORTANT:
   - Firebase Auth is NOT handled here.
   - Firestore/Realtime Database requests are NOT cached.
   - Private/authenticated HTML pages are NOT runtime cached.
   - The service worker never decides authentication/authorization.
   - Firebase configuration here is used only by FCM.
============================================================ */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const SW_VERSION = "3.0.0";

const SHELL_CACHE =
    `riderx-shell-${SW_VERSION}`;

const RUNTIME_CACHE =
    `riderx-runtime-${SW_VERSION}`;


/* ============================================================
   FIREBASE SDK
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
   APPLICATION ROOT
============================================================ */

const APP_ROOT = "/";


/* ============================================================
   APPLICATION SHELL
   ------------------------------------------------------------
   Keep this intentionally small.

   IMPORTANT:
   Do not add authenticated dashboard pages here.
============================================================ */

const APP_SHELL = [

    "/",

    "/index.html",

    "/manifest.json"

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
   FCM BACKGROUND MESSAGE HANDLER
============================================================ */

if (
    firebaseMessagingReady
) {

    try {

        const messaging =
            firebase.messaging();


        messaging.onBackgroundMessage(
            function (
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


                    const notificationData = {

                        ...data,

                        rideId:
                            String(
                                rideId || ""
                            ),

                        notificationId:
                            String(
                                notificationId
                            )

                    };


                    return self.registration
                        .showNotification(
                            title,
                            {

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
                                    notificationData

                            }
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
            "RiderX SW: FCM handler setup failed.",
            error
        );

    }

}


/* ============================================================
   URL HELPERS
============================================================ */

function toAbsoluteUrl(
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


function normalizePath(
    pathname
) {

    const path =
        String(
            pathname || "/"
        );


    if (
        path.length > 1
        &&
        path.endsWith("/")
    ) {

        return path.slice(
            0,
            -1
        );

    }


    return path;

}


/* ============================================================
   FIREBASE / BACKEND URL DETECTION
============================================================ */

function isFirebaseOrBackendUrl(
    url
) {

    const hostname =
        String(
            url.hostname || ""
        ).toLowerCase();


    return (

        hostname.includes(
            "firebaseio.com"
        )

        ||

        hostname.includes(
            "firebasedatabase.app"
        )

        ||

        hostname.includes(
            "googleapis.com"
        )

        ||

        hostname.includes(
            "firebaseapp.com"
        )

        ||

        hostname.includes(
            "gstatic.com"
        )

    );

}


/* ============================================================
   PRIVATE / AUTH ROUTE DETECTION
============================================================ */

function isPrivatePage(
    pathname
) {

    const path =
        normalizePath(
            pathname
        ).toLowerCase();


    /*
     * Authentication pages should always be fetched
     * from the network.
     */

    if (
        path === "/auth"
        ||
        path.startsWith("/auth/")
    ) {

        return true;

    }


    /*
     * Customer and rider pages may contain
     * user-specific/private data.
     *
     * They are intentionally NOT runtime cached.
     */

    if (
        path === "/customer"
        ||
        path.startsWith("/customer/")
        ||
        path === "/rider"
        ||
        path.startsWith("/rider/")
        ||
        path === "/admin"
        ||
        path.startsWith("/admin/")
    ) {

        return true;

    }


    return false;

}


/* ============================================================
   CACHEABLE STATIC RESOURCE
============================================================ */

function isStaticResource(
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


    if (
        isFirebaseOrBackendUrl(
            url
        )
    ) {

        return false;

    }


    const pathname =
        normalizePath(
            url.pathname
        ).toLowerCase();


    /*
     * Never cache APIs.
     */

    if (
        pathname === "/api"
        ||
        pathname.startsWith("/api/")
    ) {

        return false;

    }


    /*
     * Never cache Firebase auth endpoints.
     */

    if (
        pathname.includes(
            "/__/auth/"
        )
    ) {

        return false;

    }


    /*
     * Never runtime-cache private HTML pages.
     */

    if (
        isPrivatePage(
            pathname
        )
    ) {

        return false;

    }


    /*
     * HTML pages other than the shell are not cached.
     */

    if (
        pathname.endsWith(
            ".html"
        )
    ) {

        return false;

    }


    /*
     * Root navigation is handled separately.
     */

    if (
        pathname === "/"
    ) {

        return false;

    }


    return true;

}


/* ============================================================
   SAFE CACHE WRITE
============================================================ */

async function putInCache(
    cacheName,
    request,
    response
) {

    try {

        if (
            !response
            ||
            !response.ok
        ) {

            return false;

        }


        if (
            response.type !==
            "basic"
        ) {

            return false;

        }


        const cache =
            await caches.open(
                cacheName
            );


        await cache.put(
            request,
            response.clone()
        );


        return true;

    } catch (error) {

        console.warn(
            "RiderX SW: cache write failed.",
            error
        );

        return false;

    }

}


/* ============================================================
   INSTALL
============================================================ */

self.addEventListener(
    "install",
    function (
        event
    ) {

        event.waitUntil(

            (async function () {

                try {

                    const cache =
                        await caches.open(
                            SHELL_CACHE
                        );


                    for (
                        const path of APP_SHELL
                    ) {

                        try {

                            const url =
                                toAbsoluteUrl(
                                    path
                                );


                            const request =
                                new Request(
                                    url,
                                    {
                                        method:
                                            "GET",

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
                                "RiderX SW: shell resource failed:",
                                path,
                                error
                            );

                        }

                    }

                } catch (error) {

                    console.error(
                        "RiderX SW: installation failed.",
                        error
                    );

                }


                /*
                 * Make the new service worker eligible
                 * immediately.
                 */

                await self.skipWaiting();

            })()

        );

    }
);


/* ============================================================
   ACTIVATE
============================================================ */

self.addEventListener(
    "activate",
    function (
        event
    ) {

        event.waitUntil(

            (async function () {

                try {

                    const cacheNames =
                        await caches.keys();


                    await Promise.all(

                        cacheNames.map(
                            function (
                                cacheName
                            ) {

                                /*
                                 * Delete every previous
                                 * RiderX cache.
                                 */

                                if (
                                    cacheName.startsWith(
                                        "riderx-"
                                    )
                                    &&
                                    cacheName !==
                                        SHELL_CACHE
                                    &&
                                    cacheName !==
                                        RUNTIME_CACHE
                                ) {

                                    return caches.delete(
                                        cacheName
                                    );

                                }


                                return Promise.resolve();

                            }
                        )

                    );


                    await self.clients.claim();

                } catch (error) {

                    console.error(
                        "RiderX SW: activation failed.",
                        error
                    );

                }

            })()

        );

    }
);


/* ============================================================
   OFFLINE FALLBACK
============================================================ */

function createOfflineResponse() {

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
        content="#FFD600"
    >

    <meta
        name="robots"
        content="noindex"
    >

    <title>RiderX - Offline</title>

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
        }

        .card {
            width: min(100%, 390px);
            padding: 32px 24px;
            text-align: center;
            border-radius: 24px;
            background: #101010;
            border: 1px solid
                rgba(255,214,0,.18);
            box-shadow:
                0 24px 80px
                rgba(0,0,0,.55);
        }

        .logo {
            width: 72px;
            height: 72px;
            display: block;
            margin: 0 auto 20px;
            border-radius: 18px;
            object-fit: contain;
        }

        h1 {
            margin: 0;
            font-size: 26px;
            line-height: 1.2;
        }

        h1 span {
            color: #FFD600;
        }

        p {
            margin: 14px 0 0;
            color: #999999;
            font-size: 14px;
            line-height: 1.65;
        }

        button {
            margin-top: 24px;
            padding: 13px 22px;
            border: 0;
            border-radius: 13px;
            background: #FFD600;
            color: #050505;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
        }

    </style>

</head>

<body>

    <main class="card">

        <img
            class="logo"
            src="/assets/logo.png"
            alt="RiderX"
        >

        <h1>
            Rider<span>X</span>
        </h1>

        <p>
            You are currently offline.
            Reconnect to the internet and
            try again.
        </p>

        <button
            type="button"
            onclick="window.location.reload()"
        >
            Try Again
        </button>

    </main>

</body>

</html>
        `,
        {
            status:
                503,

            statusText:
                "RiderX Offline",

            headers: {
                "Content-Type":
                    "text/html; charset=utf-8",

                "Cache-Control":
                    "no-store"
            }

        }
    );

}


/* ============================================================
   FETCH HANDLER
============================================================ */

self.addEventListener(
    "fetch",
    function (
        event
    ) {

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
            !isSameOrigin(
                url
            )
        ) {

            return;

        }


        const pathname =
            normalizePath(
                url.pathname
            );


        /*
         * Never intercept API routes.
         */

        if (
            pathname === "/api"
            ||
            pathname.startsWith("/api/")
        ) {

            return;

        }


        /*
         * Never intercept Firebase/backend traffic.
         */

        if (
            isFirebaseOrBackendUrl(
                url
            )
        ) {

            return;

        }


        /* =====================================================
           NAVIGATION
           -----------------------------------------------------
           Private pages:
             Network only -> offline fallback.

           Public shell:
             Network first -> shell cache -> offline.
        ===================================================== */

        if (
            request.mode === "navigate"
        ) {

            /*
             * Private authenticated pages are deliberately
             * never cached.
             */

            if (
                isPrivatePage(
                    pathname
                )
            ) {

                event.respondWith(

                    fetch(
                        request
                    )
                    .catch(
                        function () {

                            return createOfflineResponse();

                        }
                    )

                );

                return;

            }


            event.respondWith(

                (async function () {

                    try {

                        const response =
                            await fetch(
                                request
                            );


                        /*
                         * Cache only the public shell
                         * navigation.
                         */

                        if (
                            response.ok
                        ) {

                            const isRootPage =
                                pathname === "/"
                                ||
                                pathname ===
                                    "/index.html";


                            if (
                                isRootPage
                            ) {

                                await putInCache(
                                    SHELL_CACHE,
                                    request,
                                    response
                                );

                            }

                        }


                        return response;

                    } catch (error) {

                        /*
                         * Try exact cached request first.
                         */

                        const cached =
                            await caches.match(
                                request
                            );


                        if (
                            cached
                        ) {

                            return cached;

                        }


                        /*
                         * Then try index.html.
                         */

                        const indexRequest =
                            new Request(
                                toAbsoluteUrl(
                                    "/index.html"
                                ),
                                {
                                    method:
                                        "GET"
                                }
                            );


                        const indexPage =
                            await caches.match(
                                indexRequest
                            );


                        if (
                            indexPage
                        ) {

                            return indexPage;

                        }


                        return createOfflineResponse();

                    }

                })()

            );

            return;

        }


        /* =====================================================
           STATIC RESOURCES
           -----------------------------------------------------
           Network first.
           Runtime cache fallback.
        ===================================================== */

        if (
            !isStaticResource(
                request,
                url
            )
        ) {

            return;

        }


        event.respondWith(

            (async function () {

                try {

                    const response =
                        await fetch(
                            request
                        );


                    if (
                        response.ok
                    ) {

                        await putInCache(
                            RUNTIME_CACHE,
                            request,
                            response
                        );

                    }


                    return response;

                } catch (error) {

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
                                "RiderX Offline",

                            headers: {
                                "Cache-Control":
                                    "no-store"
                            }
                        }
                    );

                }

            })()

        );

    }
);


/* ============================================================
   NOTIFICATION DATA NORMALIZATION
============================================================ */

function normalizeNotificationData(
    data
) {

    if (
        !data
        ||
        typeof data !== "object"
    ) {

        return {};

    }


    return {
        ...data,

        rideId:
            data.rideId
            ||
            data.bookingId
            ||
            "",

        type:
            String(
                data.type
                ||
                ""
            )
            .trim()
            .toLowerCase(),

        role:
            String(
                data.role
                ||
                ""
            )
            .trim()
            .toLowerCase()

    };

}


/* ============================================================
   SAFE INTERNAL URL
============================================================ */

function getSafeInternalUrl(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return null;

    }


    const path =
        value.trim();


    /*
     * Must be an absolute-path internal URL.
     */

    if (
        !path.startsWith("/")
    ) {

        return null;

    }


    /*
     * Prevent protocol-relative URLs.
     */

    if (
        path.startsWith("//")
    ) {

        return null;

    }


    /*
     * Prevent javascript/data/http/etc.
     */

    if (
        path.includes("://")
    ) {

        return null;

    }


    return path;

}


/* ============================================================
   NOTIFICATION TARGET
============================================================ */

function getNotificationTarget(
    rawData
) {

    const data =
        normalizeNotificationData(
            rawData
        );


    const type =
        data.type;


    const role =
        data.role;


    const safeUrl =
        getSafeInternalUrl(
            data.url
        );


    /*
     * Explicit internal URL wins.
     */

    if (
        safeUrl
    ) {

        return safeUrl;

    }


    /* =========================================================
       ADMIN
    ========================================================= */

    if (
        role === "admin"
        ||
        role === "superadmin"
        ||
        type === "admin"
        ||
        type === "admin_notification"
    ) {

        return "/admin/dashboard.html";

    }


    /* =========================================================
       RIDER
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


        if (
            type === "ride_completed"
            ||
            type === "trip_completed"
        ) {

            return "/rider/history.html";

        }


        if (
            type === "payment"
            ||
            type === "wallet"
            ||
            type === "wallet_update"
        ) {

            return "/rider/wallet.html";

        }


        return "/rider/home.html";

    }


    /*
     * Explicit rider notification without role.
     */

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


    /*
     * Customer ride events when role is not supplied.
     */

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
       No standalone chat route is assumed.
    ========================================================= */

    if (
        data.chatId
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
    function (
        event
    ) {

        event.notification.close();


        const rawData =
            event.notification &&
            event.notification.data
                ? event.notification.data
                : {};


        const targetPath =
            getNotificationTarget(
                rawData
            );


        const targetUrl =
            toAbsoluteUrl(
                targetPath
            );


        event.waitUntil(

            (async function () {

                try {

                    const clientList =
                        await clients.matchAll(
                            {
                                type:
                                    "window",

                                includeUncontrolled:
                                    true
                            }
                        );


                    /*
                     * Prefer an existing RiderX tab/window.
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
                             * Navigate existing app window.
                             */

                            if (
                                typeof client.navigate ===
                                "function"
                            ) {

                                await client.navigate(
                                    targetUrl
                                );

                            }


                            if (
                                typeof client.focus ===
                                "function"
                            ) {

                                await client.focus();

                            }


                            return;

                        } catch (error) {

                            console.warn(
                                "RiderX SW: client navigation failed.",
                                error
                            );

                        }

                    }


                    /*
                     * Open RiderX if no existing window exists.
                     */

                    if (
                        typeof clients.openWindow ===
                        "function"
                    ) {

                        await clients.openWindow(
                            targetUrl
                        );

                    }

                } catch (error) {

                    console.error(
                        "RiderX SW: notification click failed.",
                        error
                    );

                }

            })()

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
         * Intentionally no network call.
         */

    }
);


/* ============================================================
   MESSAGE HANDLER
============================================================ */

self.addEventListener(
    "message",
    function (
        event
    ) {

        const data =
            event.data;


        if (
            !data
            ||
            typeof data !== "object"
        ) {

            return;

        }


        /* =====================================================
           SKIP WAITING
        ===================================================== */

        if (
            data.type ===
            "SKIP_WAITING"
        ) {

            event.waitUntil(
                self.skipWaiting()
            );

            return;

        }


        /* =====================================================
           CLEAR RIDERX CACHE
        ===================================================== */

        if (
            data.type ===
            "CLEAR_CACHE"
        ) {

            event.waitUntil(

                Promise.all([
                    caches.delete(
                        SHELL_CACHE
                    ),

                    caches.delete(
                        RUNTIME_CACHE
                    )
                ])

            );

            return;

        }


        /* =====================================================
           CLEAR ALL CACHE
        ===================================================== */

        if (
            data.type ===
            "CLEAR_ALL_CACHES"
        ) {

            event.waitUntil(

                caches.keys()
                    .then(
                        function (
                            cacheNames
                        ) {

                            return Promise.all(

                                cacheNames.map(
                                    function (
                                        cacheName
                                    ) {

                                        return caches.delete(
                                            cacheName
                                        );

                                    }
                                )

                            );

                        }
                    )

            );

            return;

        }


        /* =====================================================
           CLIENT VERSION REQUEST
        ===================================================== */

        if (
            data.type ===
            "GET_SW_VERSION"
        ) {

            if (
                event.source
                &&
                typeof event.source.postMessage ===
                    "function"
            ) {

                event.source.postMessage({

                    type:
                        "SW_VERSION",

                    version:
                        SW_VERSION

                });

            }

        }

    }
);


/* ============================================================
   READY LOG
============================================================ */

console.info(
    "RiderX Service Worker loaded.",
    {
        version:
            SW_VERSION,

        shellCache:
            SHELL_CACHE,

        runtimeCache:
            RUNTIME_CACHE,

        firebaseMessaging:
            firebaseMessagingReady,

        firebaseSdk:
            FIREBASE_SDK_VERSION
    }
);
