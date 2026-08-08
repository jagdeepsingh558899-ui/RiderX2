// ============================================================
// RiderX Service Worker
// PWA / Offline Cache / App Installation
// ============================================================

const CACHE_NAME = "riderx-v2";

const CORE_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",

    // Main folders
    "/auth/login.html",

    "/customer/home.html",
    "/customer/index.html",

    "/rider/home.html",
    "/rider/index.html",
    "/rider/pending.html",

    "/admin/dashboard.html",

    // Assets
    "/assets/logo.png"
];


// ============================================================
// INSTALL
// ============================================================

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return Promise.allSettled(

                    CORE_ASSETS.map(file => {

                        return cache.add(file)
                            .catch(error => {

                                console.warn(
                                    "RiderX cache skipped:",
                                    file,
                                    error
                                );

                            });

                    })

                );

            })
            .then(() => {

                // Activate new service worker immediately
                return self.skipWaiting();

            })

    );

});


// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(
                            cacheName =>
                                cacheName.startsWith("riderx-") &&
                                cacheName !== CACHE_NAME
                        )
                        .map(
                            cacheName =>
                                caches.delete(cacheName)
                        )

                );

            })
            .then(() => {

                // Take control of all open RiderX pages
                return self.clients.claim();

            })

    );

});


// ============================================================
// FETCH
// ============================================================

self.addEventListener("fetch", event => {

    const request = event.request;

    // Only GET requests
    if (request.method !== "GET") {
        return;
    }


    const url = new URL(request.url);


    // ========================================================
    // FIREBASE / API / FIRESTORE
    // ========================================================
    // Never cache Firebase requests.
    // This keeps login, rides, online status and live data fresh.

    if (
        url.hostname.includes("firebaseio.com") ||
        url.hostname.includes("googleapis.com") ||
        url.hostname.includes("gstatic.com")
    ) {

        event.respondWith(

            fetch(request)
                .catch(() => caches.match(request))

        );

        return;
    }


    // ========================================================
    // NAVIGATION / HTML PAGES
    // ========================================================
    // Network first.
    // If internet fails, use cached page.

    if (request.mode === "navigate") {

        event.respondWith(

            fetch(request)
                .then(response => {

                    if (
                        response &&
                        response.status === 200 &&
                        response.type === "basic"
                    ) {

                        const copy =
                            response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {

                                cache.put(
                                    request,
                                    copy
                                );

                            });

                    }

                    return response;

                })
                .catch(() => {

                    return caches.match(request)
                        .then(cached => {

                            return cached ||
                                caches.match(
                                    "/index.html"
                                );

                        });

                })

        );

        return;
    }


    // ========================================================
    // STATIC FILES
    // ========================================================
    // Cache first for CSS / JS / images / fonts.

    event.respondWith(

        caches.match(request)
            .then(cachedResponse => {

                if (cachedResponse) {

                    return cachedResponse;

                }


                return fetch(request)
                    .then(response => {

                        if (
                            response &&
                            response.status === 200 &&
                            (
                                response.type === "basic" ||
                                response.type === "cors"
                            )
                        ) {

                            const copy =
                                response.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        request,
                                        copy
                                    );

                                });

                        }

                        return response;

                    });

            })
            .catch(() => {

                return new Response(
                    "RiderX is currently offline.",
                    {
                        status: 503,
                        headers: {
                            "Content-Type":
                                "text/plain; charset=utf-8"
                        }
                    }
                );

            })

    );

});


// ============================================================
// MESSAGE
// ============================================================

self.addEventListener("message", event => {

    if (!event.data) {
        return;
    }


    if (
        event.data.type ===
        "SKIP_WAITING"
    ) {

        self.skipWaiting();

    }

});
