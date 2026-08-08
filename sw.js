const CACHE_NAME = "riderx-v2";

const APP_SHELL = [
"/",
"/index.html",
"/manifest.json"
];

/* =========================================================
INSTALL
========================================================= */

self.addEventListener(
"install",
event => {

    event.waitUntil(

        caches
            .open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(
                    APP_SHELL
                );

            })

    );

    self.skipWaiting();

}

);

/* =========================================================
ACTIVATE
========================================================= */

self.addEventListener(
"activate",
event => {

    event.waitUntil(

        caches
            .keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(
                            name =>
                                name !== CACHE_NAME
                        )
                        .map(
                            name =>
                                caches.delete(name)
                        )

                );

            })

    );

    self.clients.claim();

}

);

/* =========================================================
FETCH
========================================================= */

self.addEventListener(
"fetch",
event => {

    const request =
        event.request;


    /*
    Only handle GET requests.
    */

    if(
        request.method !== "GET"
    ){

        return;

    }


    /*
    Firebase / Firestore / Auth requests
    should always go directly to network.
    */

    const url =
        new URL(
            request.url
        );


    if(
        url.hostname.includes(
            "googleapis.com"
        ) ||

        url.hostname.includes(
            "firebaseio.com"
        ) ||

        url.hostname.includes(
            "gstatic.com"
        )
    ){

        return;

    }


    /*
    CDN resources:
    Network first, then cache.
    */

    if(
        url.hostname !==
        self.location.hostname
    ){

        event.respondWith(

            fetch(request)
                .then(response => {

                    if(
                        response &&
                        response.status === 200
                    ){

                        const responseClone =
                            response.clone();


                        caches
                            .open(CACHE_NAME)
                            .then(cache => {

                                cache.put(
                                    request,
                                    responseClone
                                );

                            });

                    }


                    return response;

                })
                .catch(
                    () =>
                        caches.match(request)
                )

        );

        return;

    }


    /*
    RiderX local files:
    Network first.

    This is important because
    Firebase-powered pages must
    always receive the latest code.
    */

    event.respondWith(

        fetch(request)
            .then(response => {

                if(
                    response &&
                    response.status === 200
                ){

                    const responseClone =
                        response.clone();


                    caches
                        .open(CACHE_NAME)
                        .then(cache => {

                            cache.put(
                                request,
                                responseClone
                            );

                        });

                }


                return response;

            })
            .catch(
                () =>
                    caches.match(request)
            )

    );

}

);

/* =========================================================
MESSAGE
========================================================= */

self.addEventListener(
"message",
event => {

    if(
        event.data ===
        "SKIP_WAITING"
    ){

        self.skipWaiting();

    }

}

);
