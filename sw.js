"use strict";

const CACHE_NAME = "riderx-v1.0.0";

const APP_SHELL = [
"./",
"./index.html",
"./manifest.json",

"./assets/app.css",
"./assets/logo.png",
"./assets/logo.svg",

"./css/Style.css",
"./css/Auth.css",
"./css/Dashboard.css",
"./css/Responsive.css",
"./css/Animation.css"

];

/*
|--------------------------------------------------------------------------

INSTALL
*/

self.addEventListener(
"install",
function(event){

    event.waitUntil(

        caches.open(
            CACHE_NAME
        )
        .then(
            function(cache){

                return cache.addAll(
                    APP_SHELL
                );

            }
        )
        .catch(
            function(error){

                console.warn(
                    "RiderX cache install warning:",
                    error
                );

            }
        )

    );


    self.skipWaiting();

}

);

/*
|--------------------------------------------------------------------------

ACTIVATE
*/

self.addEventListener(
"activate",
function(event){

    event.waitUntil(

        caches.keys()
            .then(
                function(cacheNames){

                    return Promise.all(

                        cacheNames
                            .filter(
                                function(cacheName){

                                    return (
                                        cacheName !==
                                        CACHE_NAME
                                    );

                                }
                            )
                            .map(
                                function(cacheName){

                                    return caches.delete(
                                        cacheName
                                    );

                                }
                            )

                    );

                }
            )
            .then(
                function(){

                    return self.clients.claim();

                }
            )

    );

}

);

/*
|--------------------------------------------------------------------------

FETCH
*/

self.addEventListener(
"fetch",
function(event){

    const request =
        event.request;


    /*
     * Only handle GET requests.
     */

    if(
        request.method !==
        "GET"
    ){

        return;

    }


    const url =
        new URL(
            request.url
        );


    /*
     * Don't interfere with
     * Firebase / external APIs.
     */

    if(
        url.origin !==
        self.location.origin
    ){

        return;

    }


    event.respondWith(

        fetch(
            request
        )
        .then(
            function(response){

                /*
                 * Save successful responses
                 * for offline use.
                 */

                if(
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ){

                    const copy =
                        response.clone();


                    caches.open(
                        CACHE_NAME
                    )
                    .then(
                        function(cache){

                            cache.put(
                                request,
                                copy
                            );

                        }
                    );

                }


                return response;

            }
        )
        .catch(
            function(){

                /*
                 * If network fails,
                 * return cached version.
                 */

                return caches.match(
                    request
                )
                .then(
                    function(cached){

                        if(cached){

                            return cached;

                        }


                        /*
                         * HTML navigation fallback.
                         */

                        if(
                            request.mode ===
                            "navigate"
                        ){

                            return caches.match(
                                "./index.html"
                            );

                        }


                        return new Response(
                            "",
                            {
                                status: 503,
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

/*
|--------------------------------------------------------------------------

MESSAGE
*/

self.addEventListener(
"message",
function(event){

    if(
        !event.data
    ){

        return;

    }


    /*
     * Force service worker update.
     */

    if(
        event.data.type ===
        "SKIP_WAITING"
    ){

        self.skipWaiting();

    }


    /*
     * Clear RiderX cache.
     */

    if(
        event.data.type ===
        "CLEAR_CACHE"
    ){

        event.waitUntil(

            caches.delete(
                CACHE_NAME
            )

        );

    }

}

);
