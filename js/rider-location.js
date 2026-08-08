/* ============================================================
   RIDERX - RIDER LOCATION
   File: js/rider-location.js

   Handles:
   - Rider live GPS
   - Firebase location sync
   - Accuracy
   - Heading
   - Speed
   - Location watch
   - Online/offline location status
   - Customer live tracking support
   - Map integration
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Location = RX.riderLocation =
        RX.riderLocation || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Location.config = {

        ridersPath:
            "riders",

        locationsPath:
            "riderLocations",

        updateInterval:
            5000,

        minimumDistance:
            5,

        highAccuracy:
            true,

        timeout:
            15000,

        maximumAge:
            3000
    };


    /* ========================================================
       STATE
       ======================================================== */

    Location.state = {

        initialized:
            false,

        watching:
            false,

        online:
            false,

        riderId:
            null,

        watchId:
            null,

        lastPosition:
            null,

        lastSentPosition:
            null,

        lastSentAt:
            0,

        error:
            null,

        permission:
            "unknown"
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Location.getDatabase =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.database
                ) {

                    return RX.firebase.database;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       USER
       ======================================================== */

    Location.getUser =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth.currentUser;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth().currentUser;
                }

            } catch (error) {}


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       RIDER ID
       ======================================================== */

    Location.getRiderId =
        function () {

            if (
                Location.state.riderId
            ) {

                return Location.state.riderId;
            }


            const user =
                Location.getUser() ||
                {};


            const riderId =
                user.uid ||
                user.id ||
                user.riderId ||
                user.driverId ||
                localStorage.getItem(
                    "riderx_uid"
                );


            if (
                riderId
            ) {

                Location.state.riderId =
                    riderId;
            }


            return riderId || null;
        };


    /* ========================================================
       GEOLOCATION SUPPORT
       ======================================================== */

    Location.isSupported =
        function () {

            return (
                "geolocation" in
                navigator
            );
        };


    /* ========================================================
       REQUEST PERMISSION
       ======================================================== */

    Location.requestPermission =
        async function () {

            if (
                !Location.isSupported()
            ) {

                Location.state.permission =
                    "unsupported";

                return false;
            }


            /*
             * Browser does not expose a
             * universal permission request.
             *
             * getCurrentPosition triggers it.
             */

            return new Promise(
                function (
                    resolve
                ) {

                    navigator
                        .geolocation
                        .getCurrentPosition(
                            function (
                                position
                            ) {

                                Location.state.permission =
                                    "granted";


                                Location.state
                                    .lastPosition =
                                    Location
                                        .normalizePosition(
                                            position
                                        );


                                resolve(
                                    true
                                );
                            },

                            function (
                                error
                            ) {

                                Location.handleError(
                                    error
                                );


                                resolve(
                                    false
                                );
                            },

                            Location.getOptions()
                        );
                }
            );
        };


    /* ========================================================
       OPTIONS
       ======================================================== */

    Location.getOptions =
        function () {

            return {

                enableHighAccuracy:
                    Location.config
                        .highAccuracy,

                timeout:
                    Location.config
                        .timeout,

                maximumAge:
                    Location.config
                        .maximumAge
            };
        };


    /* ========================================================
       GET CURRENT LOCATION
       ======================================================== */

    Location.getCurrent =
        function () {

            if (
                !Location.isSupported()
            ) {

                return Promise.reject(
                    new Error(
                        "Geolocation is not supported."
                    )
                );
            }


            return new Promise(
                function (
                    resolve,
                    reject
                ) {

                    navigator
                        .geolocation
                        .getCurrentPosition(
                            function (
                                position
                            ) {

                                const normalized =
                                    Location
                                        .normalizePosition(
                                            position
                                        );


                                Location.state
                                    .lastPosition =
                                    normalized;


                                Location.state.permission =
                                    "granted";


                                Location.emit(
                                    "updated",
                                    normalized
                                );


                                resolve(
                                    normalized
                                );
                            },

                            function (
                                error
                            ) {

                                Location.handleError(
                                    error
                                );


                                reject(
                                    error
                                );
                            },

                            Location.getOptions()
                        );
                }
            );
        };


    /* ========================================================
       START WATCHING
       ======================================================== */

    Location.start =
        async function (
            options
        ) {

            if (
                !Location.isSupported()
            ) {

                Location.showError(
                    "Location is not supported on this device."
                );


                return {

                    success:
                        false,

                    error:
                        "unsupported"
                };
            }


            const riderId =
                Location.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rider login required."
                };
            }


            /*
             * Stop an existing watcher first.
             */

            if (
                Location.state.watching
            ) {

                Location.stop();
            }


            const settings =
                {

                    ...Location.getOptions(),

                    ...(options || {})
                };


            try {

                await Location
                    .requestPermission();

            } catch (error) {}


            Location.state.watching =
                true;


            Location.state.error =
                null;


            Location.state.online =
                true;


            Location.state.watchId =
                navigator
                    .geolocation
                    .watchPosition(
                        function (
                            position
                        ) {

                            Location
                                .handlePosition(
                                    position
                                );
                        },

                        function (
                            error
                        ) {

                            Location
                                .handleError(
                                    error
                                );
                        },

                        settings
                    );


            Location.emit(
                "started",
                {

                    riderId:
                        riderId
                }
            );


            return {

                success:
                    true,

                watchId:
                    Location.state.watchId
            };
        };


    /* ========================================================
       STOP WATCHING
       ======================================================== */

    Location.stop =
        async function () {

            if (
                Location.state.watchId !==
                null
            ) {

                try {

                    navigator
                        .geolocation
                        .clearWatch(
                            Location.state
                                .watchId
                        );

                } catch (error) {}
            }


            Location.state.watchId =
                null;


            Location.state.watching =
                false;


            Location.state.online =
                false;


            await Location.setOffline();


            Location.emit(
                "stopped"
            );


            return true;
        };


    /* ========================================================
       HANDLE POSITION
       ======================================================== */

    Location.handlePosition =
        async function (
            position
        ) {

            const normalized =
                Location.normalizePosition(
                    position
                );


            Location.state.lastPosition =
                normalized;


            Location.state.permission =
                "granted";


            Location.state.error =
                null;


            Location.emit(
                "updated",
                normalized
            );


            /*
             * Update local UI immediately.
             */

            Location.updateUI(
                normalized
            );


            /*
             * Don't send every GPS event.
             * Use distance + time throttling.
             */

            if (
                !Location.shouldSend(
                    normalized
                )
            ) {

                return normalized;
            }


            try {

                await Location
                    .syncToFirebase(
                        normalized
                    );

            } catch (error) {

                console.warn(
                    "Rider location sync failed:",
                    error
                );
            }


            return normalized;
        };


    /* ========================================================
       NORMALIZE POSITION
       ======================================================== */

    Location.normalizePosition =
        function (
            position
        ) {

            const coords =
                position.coords;


            return {

                latitude:
                    Number(
                        coords.latitude
                    ),

                longitude:
                    Number(
                        coords.longitude
                    ),

                accuracy:
                    Number(
                        coords.accuracy ||
                        0
                    ),

                altitude:
                    coords.altitude ===
                    null
                        ? null
                        : Number(
                            coords.altitude
                        ),

                heading:
                    coords.heading ===
                    null
                        ? null
                        : Number(
                            coords.heading
                        ),

                speed:
                    coords.speed ===
                    null
                        ? null
                        : Number(
                            coords.speed
                        ),

                timestamp:
                    position.timestamp ||
                    Date.now()
            };
        };


    /* ========================================================
       SHOULD SEND
       ======================================================== */

    Location.shouldSend =
        function (
            position
        ) {

            const now =
                Date.now();


            if (
                !Location.state
                    .lastSentPosition
            ) {

                return true;
            }


            const elapsed =
                now -
                Location.state.lastSentAt;


            if (
                elapsed >=
                Location.config
                    .updateInterval
            ) {

                return true;
            }


            const distance =
                Location.distanceBetween(
                    Location.state
                        .lastSentPosition
                        .latitude,

                    Location.state
                        .lastSentPosition
                        .longitude,

                    position.latitude,

                    position.longitude
                );


            return (
                distance >=
                Location.config
                    .minimumDistance
            );
        };


    /* ========================================================
       SYNC FIREBASE
       ======================================================== */

    Location.syncToFirebase =
        async function (
            position
        ) {

            const database =
                Location.getDatabase();


            const riderId =
                Location.getRiderId();


            if (
                !database ||
                !riderId
            ) {

                Location.cacheLocation(
                    position
                );


                return false;
            }


            const locationData =
                {

                    latitude:
                        position.latitude,

                    longitude:
                        position.longitude,

                    accuracy:
                        position.accuracy,

                    altitude:
                        position.altitude,

                    heading:
                        position.heading,

                    speed:
                        position.speed,

                    updatedAt:
                        Date.now(),

                    online:
                        Location.state.online,

                    isOnline:
                        Location.state.online
                };


            /*
             * Main rider profile.
             */

            await database
                .ref(
                    Location.config
                        .ridersPath +
                    "/" +
                    riderId
                )
                .update(
                    {

                        latitude:
                            position.latitude,

                        longitude:
                            position.longitude,

                        location:
                            {

                                latitude:
                                    position.latitude,

                                longitude:
                                    position.longitude
                            },

                        accuracy:
                            position.accuracy,

                        heading:
                            position.heading,

                        speed:
                            position.speed,

                        online:
                            Location.state.online,

                        isOnline:
                            Location.state.online,

                        lastLocationAt:
                            Date.now(),

                        updatedAt:
                            Date.now()
                    }
                );


            /*
             * Dedicated live-location node.
             */

            await database
                .ref(
                    Location.config
                        .locationsPath +
                    "/" +
                    riderId
                )
                .set(
                    locationData
                );


            Location.state
                .lastSentPosition =
                position;


            Location.state.lastSentAt =
                Date.now();


            Location.cacheLocation(
                position
            );


            Location.emit(
                "synced",
                locationData
            );


            return true;
        };


    /* ========================================================
       CACHE LOCATION
       ======================================================== */

    Location.cacheLocation =
        function (
            position
        ) {

            try {

                localStorage.setItem(
                    "riderx_last_location",
                    JSON.stringify(
                        position
                    )
                );

            } catch (error) {}
        };


    /* ========================================================
       READ CACHED LOCATION
       ======================================================== */

    Location.getCachedLocation =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        "riderx_last_location"
                    );


                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       SET OFFLINE
       ======================================================== */

    Location.setOffline =
        async function () {

            const riderId =
                Location.getRiderId();


            const database =
                Location.getDatabase();


            if (
                !riderId
            ) {

                return false;
            }


            Location.state.online =
                false;


            try {

                localStorage.setItem(
                    "riderx_online",
                    "false"
                );

            } catch (error) {}


            if (
                !database
            ) {

                Location.updateOnlineUI(
                    false
                );


                return false;
            }


            try {

                await database
                    .ref(
                        Location.config
                            .ridersPath +
                        "/" +
                        riderId
                    )
                    .update(
                        {

                            online:
                                false,

                            isOnline:
                                false,

                            availability:
                                "offline",

                            updatedAt:
                                Date.now()
                        }
                    );


                await database
                    .ref(
                        Location.config
                            .locationsPath +
                        "/" +
                        riderId
                    )
                    .update(
                        {

                            online:
                                false,

                            isOnline:
                                false,

                            updatedAt:
                                Date.now()
                        }
                    );


                Location.updateOnlineUI(
                    false
                );


                return true;

            } catch (error) {

                console.warn(
                    "Failed to set rider offline:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       ONLINE
       ======================================================== */

    Location.setOnline =
        async function () {

            const riderId =
                Location.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rider login required."
                };
            }


            const position =
                await Location
                    .getCurrent();


            Location.state.online =
                true;


            try {

                localStorage.setItem(
                    "riderx_online",
                    "true"
                );

            } catch (error) {}


            await Location.syncToFirebase(
                position
            );


            if (
                !Location.state.watching
            ) {

                await Location.start();
            }


            Location.updateOnlineUI(
                true
            );


            return {

                success:
                    true,

                location:
                    position
            };
        };


    /* ========================================================
       DISTANCE
       ======================================================== */

    Location.distanceBetween =
        function (
            lat1,
            lon1,
            lat2,
            lon2
        ) {

            const earthRadius =
                6371000;


            const dLat =
                (
                    lat2 -
                    lat1
                ) *
                Math.PI /
                180;


            const dLon =
                (
                    lon2 -
                    lon1
                ) *
                Math.PI /
                180;


            const a =
                Math.sin(
                    dLat / 2
                ) ** 2 +

                Math.cos(
                    lat1 *
                    Math.PI /
                    180
                ) *

                Math.cos(
                    lat2 *
                    Math.PI /
                    180
                ) *

                Math.sin(
                    dLon / 2
                ) ** 2;


            const c =
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(
                        1 - a
                    )
                );


            return (
                earthRadius *
                c
            );
        };


    /* ========================================================
       UPDATE UI
       ======================================================== */

    Location.updateUI =
        function (
            position
        ) {

            if (
                !position
            ) {

                return;
            }


            document
                .querySelectorAll(
                    "[data-rider-latitude]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            position.latitude
                                .toFixed(
                                    6
                                );

                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-longitude]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            position.longitude
                                .toFixed(
                                    6
                                );

                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-accuracy]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Math.round(
                                position.accuracy ||
                                0
                            ) +
                            " m";

                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-speed]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const speed =
                            position.speed;


                        element.textContent =
                            speed === null ||
                            speed === undefined
                                ? "—"
                                :
                                (
                                    speed *
                                    3.6
                                ).toFixed(
                                    1
                                ) +
                                " km/h";

                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-heading]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            position.heading ===
                            null
                                ? "—"
                                :
                                Math.round(
                                    position.heading
                                ) +
                                "°";

                    }
                );
        };


    /* ========================================================
       ONLINE UI
       ======================================================== */

    Location.updateOnlineUI =
        function (
            online
        ) {

            document
                .querySelectorAll(
                    "[data-rider-online]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            online
                                ? "Online"
                                : "Offline";

                    }
                );


            document
                .querySelectorAll(
                    "[data-online-indicator]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.classList.toggle(
                            "online",
                            online
                        );

                        element.classList.toggle(
                            "offline",
                            !online
                        );

                    }
                );
        };


    /* ========================================================
       ERROR HANDLER
       ======================================================== */

    Location.handleError =
        function (
            error
        ) {

            Location.state.error =
                error;


            if (
                error &&
                error.code ===
                1
            ) {

                Location.state.permission =
                    "denied";

            } else if (
                error &&
                error.code ===
                2
            ) {

                Location.state.permission =
                    "unavailable";

            } else if (
                error &&
                error.code ===
                3
            ) {

                Location.state.permission =
                    "timeout";
            }


            Location.emit(
                "error",
                {

                    error:
                        error,

                    permission:
                        Location.state.permission
                }
            );


            Location.showError(
                Location.errorMessage(
                    error
                )
            );
        };


    /* ========================================================
       ERROR MESSAGE
       ======================================================== */

    Location.errorMessage =
        function (
            error
        ) {

            if (
                !error
            ) {

                return "Unable to get your location.";
            }


            switch (
                error.code
            ) {

                case 1:

                    return "Location permission is required. Please allow location access.";

                case 2:

                    return "Your current location could not be determined.";

                case 3:

                    return "Location request timed out. Please try again.";

                default:

                    return (
                        error.message ||
                        "Unable to get your location."
                    );
            }
        };


    /* ========================================================
       SHOW ERROR
       ======================================================== */

    Location.showError =
        function (
            message
        ) {

            try {

                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        message
                    );

                    return;
                }

            } catch (error) {}


            document
                .querySelectorAll(
                    "[data-location-error]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            message;

                        element.hidden =
                            false;
                    }
                );
        };


    /* ========================================================
       MAP INTEGRATION
       ======================================================== */

    Location.updateMap =
        function (
            position
        ) {

            if (
                !position
            ) {

                return;
            }


            try {

                if (
                    RX.map &&
                    typeof RX.map
                        .setRiderLocation ===
                    "function"
                ) {

                    RX.map
                        .setRiderLocation(
                            position.latitude,
                            position.longitude,
                            position.heading
                        );

                    return;
                }

            } catch (error) {}


            try {

                if (
                    RX.riderMap &&
                    typeof RX.riderMap
                        .updateLocation ===
                    "function"
                ) {

                    RX.riderMap
                        .updateLocation(
                            position
                        );
                }

            } catch (error) {}
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Location.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-location-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    Location.bindEvents =
        function () {

            window.addEventListener(
                "riderx-dashboard-online",
                function (
                    event
                ) {

                    const online =
                        event.detail?.online;


                    if (
                        online
                    ) {

                        Location.setOnline()
                            .catch(
                                console.warn
                            );

                    } else {

                        Location.stop();
                    }
                }
            );


            window.addEventListener(
                "beforeunload",
                function () {

                    /*
                     * Best-effort only.
                     * Browser may terminate the page
                     * before async Firebase completes.
                     */

                    try {

                        const riderId =
                            Location
                                .getRiderId();


                        const database =
                            Location
                                .getDatabase();


                        if (
                            riderId &&
                            database
                        ) {

                            database
                                .ref(
                                    Location.config
                                        .ridersPath +
                                    "/" +
                                    riderId
                                )
                                .update(
                                    {

                                        online:
                                            false,

                                        isOnline:
                                            false,

                                        updatedAt:
                                            Date.now()
                                    }
                                );
                        }

                    } catch (error) {}
                }
            );


            /*
             * Page visibility.
             */

            document.addEventListener(
                "visibilitychange",
                function () {

                    if (
                        document.visibilityState ===
                        "visible" &&
                        Location.state.online &&
                        !Location.state.watching
                    ) {

                        Location.start();

                    }

                }
            );


            /*
             * GPS update -> map.
             */

            window.addEventListener(
                "riderx-location-updated",
                function (
                    event
                ) {

                    Location.updateMap(
                        event.detail
                    );
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.getRiderLocation =
        function () {

            return Location.state
                .lastPosition;
        };


    RX.startRiderLocation =
        Location.start;


    RX.stopRiderLocation =
        Location.stop;


    RX.syncRiderLocation =
        Location.syncToFirebase;


    RX.setRiderOnlineLocation =
        Location.setOnline;


    RX.setRiderOfflineLocation =
        Location.setOffline;


    /* ========================================================
       INIT
       ======================================================== */

    Location.init =
        function () {

            if (
                Location.state.initialized
            ) {

                return;
            }


            Location.state.initialized =
                true;


            Location.bindEvents();


            /*
             * Restore online state only.
             * Do not automatically request GPS
             * permission on page load.
             */

            try {

                Location.state.online =
                    localStorage.getItem(
                        "riderx_online"
                    ) === "true";

            } catch (error) {

                Location.state.online =
                    false;
            }


            const cached =
                Location.getCachedLocation();


            if (
                cached
            ) {

                Location.state
                    .lastPosition =
                    cached;


                Location.updateUI(
                    cached
                );
            }


            console.log(
                "RiderX rider-location.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Location.init
        );

    } else {

        Location.init();

    }

})();
