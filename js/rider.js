/* ============================================================
   RIDERX - RIDER CORE CONTROLLER
   File: js/rider.js

   Central rider-side controller.

   Handles:
   - Rider initialization
   - Online / offline state
   - Rider profile
   - Location synchronization
   - Ride request events
   - Notifications
   - Navigation
   - Logout
   - Rider module coordination
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Rider =
        RX.rider ||
        (RX.rider = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Rider.config = {

        onlineKey:
            "riderx_rider_online",

        uidKey:
            "riderx_uid",

        roleKey:
            "riderx_role",

        profileKey:
            "riderx_rider_profile",

        locationInterval:
            10000,

        locationAccuracy:
            true
    };


    /* ========================================================
       STATE
       ======================================================== */

    Rider.state = {

        initialized:
            false,

        riderId:
            null,

        profile:
            null,

        online:
            false,

        location:
            null,

        locationWatchId:
            null,

        locationTimer:
            null,

        requestListener:
            null,

        notificationListener:
            null,

        loading:
            false
    };


    /* ========================================================
       GET FIREBASE DATABASE
       ======================================================== */

    Rider.getDatabase =
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
       GET RIDER ID
       ======================================================== */

    Rider.getRiderId =
        function () {

            if (
                Rider.state.riderId
            ) {

                return Rider.state.riderId;
            }


            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    const user =
                        firebase.auth()
                            .currentUser;


                    if (
                        user
                    ) {

                        Rider.state.riderId =
                            user.uid;

                        return user.uid;
                    }
                }

            } catch (error) {}


            try {

                const uid =
                    localStorage.getItem(
                        Rider.config.uidKey
                    );


                if (
                    uid
                ) {

                    Rider.state.riderId =
                        uid;

                    return uid;
                }

            } catch (error) {}


            try {

                const profile =
                    JSON.parse(
                        localStorage.getItem(
                            Rider.config.profileKey
                        ) ||
                        "null"
                    );


                if (
                    profile &&
                    (
                        profile.uid ||
                        profile.id
                    )
                ) {

                    Rider.state.riderId =
                        profile.uid ||
                        profile.id;

                    return Rider.state.riderId;
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       PROFILE
       ======================================================== */

    Rider.loadProfile =
        async function () {

            const riderId =
                Rider.getRiderId();


            if (
                !riderId
            ) {

                Rider.loadProfileCache();

                return Rider.state.profile;
            }


            const database =
                Rider.getDatabase();


            if (
                !database
            ) {

                Rider.loadProfileCache();

                return Rider.state.profile;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            "riders/" +
                            riderId
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val();


                if (
                    data
                ) {

                    Rider.state.profile =
                        {

                            ...data,

                            uid:
                                data.uid ||
                                riderId,

                            id:
                                data.id ||
                                riderId
                        };


                    Rider.saveProfileCache();


                    Rider.renderProfile();
                }


                return Rider.state.profile;

            } catch (error) {

                console.error(
                    "Rider profile load failed:",
                    error
                );


                Rider.loadProfileCache();

                return Rider.state.profile;
            }
        };


    Rider.loadProfileCache =
        function () {

            try {

                const data =
                    JSON.parse(
                        localStorage.getItem(
                            Rider.config.profileKey
                        ) ||
                        "null"
                    );


                if (
                    data
                ) {

                    Rider.state.profile =
                        data;

                    Rider.state.riderId =
                        data.uid ||
                        data.id ||
                        Rider.state.riderId;
                }

            } catch (error) {}
        };


    Rider.saveProfileCache =
        function () {

            try {

                if (
                    Rider.state.profile
                ) {

                    localStorage.setItem(
                        Rider.config.profileKey,
                        JSON.stringify(
                            Rider.state.profile
                        )
                    );
                }

            } catch (error) {}
        };


    /* ========================================================
       PROFILE RENDER
       ======================================================== */

    Rider.renderProfile =
        function () {

            const profile =
                Rider.state.profile ||
                {};


            const values =
                {

                    name:
                        profile.name ||
                        profile.displayName ||
                        "Rider",

                    phone:
                        profile.phone ||
                        profile.phoneNumber ||
                        "",

                    email:
                        profile.email ||
                        "",

                    photo:
                        profile.photoURL ||
                        profile.photo ||
                        profile.profileImage ||
                        "",

                    vehicle:
                        profile.vehicleModel ||
                        profile.vehicleName ||
                        profile.vehicle?.model ||
                        "",

                    vehicleNumber:
                        profile.vehicleNumber ||
                        profile.vehicle?.number ||
                        "",

                    rating:
                        profile.rating ??
                        5,

                    status:
                        profile.status ||
                        "active"
                };


            Object.entries(
                values
            )
            .forEach(
                function (
                    [
                        key,
                        value
                    ]
                ) {

                    document
                        .querySelectorAll(
                            `[data-rider-profile="${key}"]`
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                if (
                                    element.tagName ===
                                    "IMG"
                                ) {

                                    if (
                                        value
                                    ) {

                                        element.src =
                                            value;
                                    }

                                } else {

                                    element.textContent =
                                        value;
                                }
                            }
                        );
                }
            );
        };


    /* ========================================================
       ONLINE STATUS
       ======================================================== */

    Rider.setOnline =
        async function (
            online
        ) {

            online =
                Boolean(
                    online
                );


            const riderId =
                Rider.getRiderId();


            if (
                !riderId
            ) {

                Rider.showMessage(
                    "Please login as rider first.",
                    "error"
                );


                return false;
            }


            Rider.state.online =
                online;


            try {

                localStorage.setItem(
                    Rider.config.onlineKey,
                    online
                        ? "true"
                        : "false"
                );

            } catch (error) {}


            Rider.renderOnlineState();


            const database =
                Rider.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            "riders/" +
                            riderId
                        )
                        .update(
                            {

                                online:
                                    online,

                                isOnline:
                                    online,

                                availability:
                                    online
                                        ? "online"
                                        : "offline",

                                lastStatusUpdate:
                                    Date.now(),

                                updatedAt:
                                    Date.now()
                            }
                        );

                } catch (error) {

                    console.error(
                        "Online status update failed:",
                        error
                    );

                    /*
                     * Keep local UI usable even when
                     * Firebase update fails.
                     */
                }
            }


            if (
                online
            ) {

                Rider.startLocationUpdates();

                Rider.emit(
                    "online",
                    {

                        riderId:
                            riderId
                    }
                );

            } else {

                Rider.stopLocationUpdates();

                Rider.emit(
                    "offline",
                    {

                        riderId:
                            riderId
                    }
                );
            }


            return true;
        };


    Rider.toggleOnline =
        async function () {

            return Rider.setOnline(
                !Rider.state.online
            );
        };


    Rider.restoreOnlineState =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Rider.config.onlineKey
                    );


                if (
                    saved ===
                    "true"
                ) {

                    Rider.state.online =
                        true;

                    Rider.renderOnlineState();
                }

            } catch (error) {}
        };


    Rider.renderOnlineState =
        function () {

            const online =
                Rider.state.online;


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


                        element.dataset.online =
                            online
                                ? "true"
                                : "false";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-status]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            online
                                ? "You're online"
                                : "You're offline";


                        element.dataset.status =
                            online
                                ? "online"
                                : "offline";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-online-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                online;
                        }

                        element.setAttribute(
                            "aria-pressed",
                            online
                                ? "true"
                                : "false"
                        );
                    }
                );
        };


    /* ========================================================
       LOCATION
       ======================================================== */

    Rider.startLocationUpdates =
        function () {

            if (
                !navigator.geolocation
            ) {

                Rider.showMessage(
                    "Location is not supported on this device.",
                    "error"
                );

                return;
            }


            if (
                Rider.state.locationWatchId !==
                null
            ) {

                return;
            }


            Rider.getCurrentLocation();


            try {

                Rider.state.locationWatchId =
                    navigator.geolocation.watchPosition(
                        function (
                            position
                        ) {

                            Rider.handleLocation(
                                position
                            );
                        },

                        function (
                            error
                        ) {

                            console.warn(
                                "Rider location error:",
                                error
                            );
                        },

                        {

                            enableHighAccuracy:
                                Rider.config
                                    .locationAccuracy,

                            maximumAge:
                                5000,

                            timeout:
                                15000
                        }
                    );

            } catch (error) {

                console.error(
                    "Location watch failed:",
                    error
                );
            }
        };


    Rider.stopLocationUpdates =
        async function () {

            if (
                Rider.state.locationWatchId !==
                null
            ) {

                try {

                    navigator.geolocation
                        .clearWatch(
                            Rider.state
                                .locationWatchId
                        );

                } catch (error) {}

                Rider.state.locationWatchId =
                    null;
            }


            if (
                Rider.state.locationTimer
            ) {

                clearInterval(
                    Rider.state.locationTimer
                );

                Rider.state.locationTimer =
                    null;
            }


            const riderId =
                Rider.getRiderId();


            const database =
                Rider.getDatabase();


            if (
                riderId &&
                database
            ) {

                try {

                    await database
                        .ref(
                            "riders/" +
                            riderId
                        )
                        .update(
                            {

                                locationSharing:
                                    false,

                                updatedAt:
                                    Date.now()
                            }
                        );

                } catch (error) {}
            }
        };


    Rider.getCurrentLocation =
        function () {

            if (
                !navigator.geolocation
            ) {

                return;
            }


            navigator.geolocation
                .getCurrentPosition(
                    function (
                        position
                    ) {

                        Rider.handleLocation(
                            position
                        );
                    },

                    function (
                        error
                    ) {

                        console.warn(
                            "Current location failed:",
                            error
                        );
                    },

                    {

                        enableHighAccuracy:
                            true,

                        maximumAge:
                            3000,

                        timeout:
                            15000
                    }
                );
        };


    Rider.handleLocation =
        async function (
            position
        ) {

            if (
                !position ||
                !position.coords
            ) {

                return;
            }


            const coords =
                position.coords;


            Rider.state.location =
                {

                    lat:
                        Number(
                            coords.latitude
                        ),

                    lng:
                        Number(
                            coords.longitude
                        ),

                    accuracy:
                        Number(
                            coords.accuracy ||
                            0
                        ),

                    heading:
                        Number(
                            coords.heading ||
                            0
                        ),

                    speed:
                        Number(
                            coords.speed ||
                            0
                        ),

                    timestamp:
                        Date.now()
                };


            Rider.renderLocation();


            if (
                !Rider.state.online
            ) {

                return;
            }


            await Rider.syncLocation();
        };


    Rider.syncLocation =
        async function () {

            const riderId =
                Rider.getRiderId();


            const location =
                Rider.state.location;


            if (
                !riderId ||
                !location
            ) {

                return;
            }


            const database =
                Rider.getDatabase();


            if (
                !database
            ) {

                return;
            }


            try {

                await database
                    .ref(
                        "riders/" +
                        riderId +
                        "/location"
                    )
                    .set(
                        {

                            lat:
                                location.lat,

                            lng:
                                location.lng,

                            accuracy:
                                location.accuracy,

                            heading:
                                location.heading,

                            speed:
                                location.speed,

                            updatedAt:
                                location.timestamp
                        }
                    );


                await database
                    .ref(
                        "riderLocations/" +
                        riderId
                    )
                    .set(
                        {

                            riderId:
                                riderId,

                            lat:
                                location.lat,

                            lng:
                                location.lng,

                            accuracy:
                                location.accuracy,

                            heading:
                                location.heading,

                            speed:
                                location.speed,

                            online:
                                true,

                            updatedAt:
                                location.timestamp
                        }
                    );

            } catch (error) {

                console.error(
                    "Rider location sync failed:",
                    error
                );
            }
        };


    Rider.renderLocation =
        function () {

            const location =
                Rider.state.location;


            if (
                !location
            ) {

                return;
            }


            document
                .querySelectorAll(
                    "[data-rider-lat]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            location.lat.toFixed(
                                6
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-rider-lng]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            location.lng.toFixed(
                                6
                            );
                    }
                );
        };


    /* ========================================================
       RIDE REQUEST EVENTS
       ======================================================== */

    Rider.listenForRideRequests =
        function () {

            if (
                Rider.state.requestListener
            ) {

                return;
            }


            const riderId =
                Rider.getRiderId();


            const database =
                Rider.getDatabase();


            if (
                !riderId ||
                !database
            ) {

                return;
            }


            try {

                const ref =
                    database
                        .ref(
                            "rideRequests"
                        );


                const callback =
                    function (
                        snapshot
                    ) {

                        const request =
                            snapshot.val();


                        if (
                            !request
                        ) {

                            return;
                        }


                        if (
                            request.riderId &&
                            request.riderId !==
                            riderId
                        ) {

                            return;
                        }


                        if (
                            request.status &&
                            ![
                                "requested",
                                "searching",
                                "pending",
                                "offered"
                            ].includes(
                                String(
                                    request.status
                                ).toLowerCase()
                            )
                        ) {

                            return;
                        }


                        Rider.handleRideRequest(
                            {

                                ...request,

                                id:
                                    request.id ||
                                    snapshot.key
                            }
                        );
                    };


                ref.on(
                    "child_added",
                    callback
                );


                Rider.state.requestListener =
                    {

                        ref:
                            ref,

                        callback:
                            callback
                    };

            } catch (error) {

                console.error(
                    "Ride request listener failed:",
                    error
                );
            }
        };


    Rider.stopRideRequestListener =
        function () {

            const listener =
                Rider.state.requestListener;


            if (
                !listener
            ) {

                return;
            }


            try {

                listener.ref.off(
                    "child_added",
                    listener.callback
                );

            } catch (error) {}


            Rider.state.requestListener =
                null;
        };


    Rider.handleRideRequest =
        function (
            request
        ) {

            if (
                !request
            ) {

                return;
            }


            /*
             * Don't show ride requests while offline.
             */

            if (
                !Rider.state.online
            ) {

                return;
            }


            Rider.emit(
                "ride-request",
                {

                    request:
                        request
                }
            );


            /*
             * Existing ride request UI.
             */

            if (
                RX.showRideRequest
            ) {

                RX.showRideRequest(
                    request
                );
            }


            /*
             * Existing request module.
             */

            if (
                RX.handleRiderRequest
            ) {

                RX.handleRiderRequest(
                    request
                );
            }


            Rider.playRequestSound();
        };


    /* ========================================================
       REQUEST SOUND
       ======================================================== */

    Rider.playRequestSound =
        function () {

            try {

                if (
                    RX.playNotificationSound
                ) {

                    RX.playNotificationSound();

                    return;
                }

            } catch (error) {}


            try {

                const audio =
                    document.querySelector(
                        "[data-ride-request-sound]"
                    );


                if (
                    audio
                ) {

                    audio.currentTime =
                        0;

                    audio.play()
                        .catch(
                            function () {}
                        );
                }

            } catch (error) {}
        };


    /* ========================================================
       NOTIFICATIONS
       ======================================================== */

    Rider.listenNotifications =
        function () {

            if (
                Rider.state.notificationListener
            ) {

                return;
            }


            const riderId =
                Rider.getRiderId();


            const database =
                Rider.getDatabase();


            if (
                !riderId ||
                !database
            ) {

                return;
            }


            try {

                const ref =
                    database.ref(
                        "notifications/" +
                        riderId
                    );


                const callback =
                    function (
                        snapshot
                    ) {

                        const notification =
                            snapshot.val();


                        if (
                            !notification
                        ) {

                            return;
                        }


                        if (
                            notification.read ===
                            true
                        ) {

                            return;
                        }


                        Rider.handleNotification(
                            {

                                ...notification,

                                id:
                                    notification.id ||
                                    snapshot.key
                            }
                        );
                    };


                ref.on(
                    "child_added",
                    callback
                );


                Rider.state.notificationListener =
                    {

                        ref:
                            ref,

                        callback:
                            callback
                    };

            } catch (error) {

                console.error(
                    "Notification listener failed:",
                    error
                );
            }
        };


    Rider.stopNotificationListener =
        function () {

            const listener =
                Rider.state
                    .notificationListener;


            if (
                !listener
            ) {

                return;
            }


            try {

                listener.ref.off(
                    "child_added",
                    listener.callback
                );

            } catch (error) {}


            Rider.state.notificationListener =
                null;
        };


    Rider.handleNotification =
        function (
            notification
        ) {

            Rider.emit(
                "notification",
                {

                    notification:
                        notification
                }
            );


            if (
                RX.showNotification
            ) {

                RX.showNotification(
                    notification
                );

                return;
            }


            Rider.showMessage(
                notification.title ||
                notification.message ||
                "New notification",
                "info"
            );
        };


    /* ========================================================
       NAVIGATION
       ======================================================== */

    Rider.navigate =
        function (
            page,
            params
        ) {

            if (
                !page
            ) {

                return;
            }


            let url =
                page;


            if (
                params &&
                typeof params ===
                "object"
            ) {

                const query =
                    new URLSearchParams();


                Object.entries(
                    params
                )
                .forEach(
                    function (
                        [
                            key,
                            value
                        ]
                    ) {

                        if (
                            value !==
                            undefined &&
                            value !==
                            null
                        ) {

                            query.set(
                                key,
                                value
                            );
                        }
                    }
                );


                const queryString =
                    query.toString();


                if (
                    queryString
                ) {

                    url +=
                        (
                            page.includes(
                                "?"
                            )
                                ? "&"
                                : "?"
                        ) +
                        queryString;
                }
            }


            window.location.href =
                url;
        };


    /* ========================================================
       LOGOUT
       ======================================================== */

    Rider.logout =
        async function () {

            /*
             * Go offline before logout.
             */

            try {

                await Rider.setOnline(
                    false
                );

            } catch (error) {}


            Rider.stopRideRequestListener();

            Rider.stopNotificationListener();

            Rider.stopLocationUpdates();


            try {

                if (
                    RX.logout
                ) {

                    await RX.logout();

                } else if (
                    window.firebase &&
                    firebase.auth
                ) {

                    await firebase.auth()
                        .signOut();
                }

            } catch (error) {

                console.error(
                    "Rider logout failed:",
                    error
                );
            }


            try {

                localStorage.removeItem(
                    Rider.config.onlineKey
                );

                localStorage.removeItem(
                    Rider.config.uidKey
                );

                localStorage.removeItem(
                    Rider.config.roleKey
                );

                localStorage.removeItem(
                    Rider.config.profileKey
                );

            } catch (error) {}


            Rider.state =
                {

                    initialized:
                        false,

                    riderId:
                        null,

                    profile:
                        null,

                    online:
                        false,

                    location:
                        null,

                    locationWatchId:
                        null,

                    locationTimer:
                        null,

                    requestListener:
                        null,

                    notificationListener:
                        null,

                    loading:
                        false
                };


            Rider.navigate(
                "../auth/login.html"
            );
        };


    /* ========================================================
       AUTH / ROLE CHECK
       ======================================================== */

    Rider.isRider =
        function () {

            const role =
                String(
                    localStorage.getItem(
                        Rider.config.roleKey
                    ) ||
                    ""
                ).toLowerCase();


            if (
                role ===
                "rider"
            ) {

                return true;
            }


            const profile =
                Rider.state.profile;


            if (
                profile &&
                (
                    profile.role ===
                    "rider" ||

                    profile.userType ===
                    "rider"
                )
            ) {

                return true;
            }


            return false;
        };


    /* ========================================================
       PROFILE UPDATE
       ======================================================== */

    Rider.updateProfile =
        async function (
            updates
        ) {

            if (
                !updates ||
                typeof updates !==
                "object"
            ) {

                return false;
            }


            const riderId =
                Rider.getRiderId();


            if (
                !riderId
            ) {

                return false;
            }


            Rider.state.profile =
                {

                    ...(Rider.state.profile ||
                    {}),

                    ...updates,

                    uid:
                        riderId,

                    updatedAt:
                        Date.now()
                };


            Rider.saveProfileCache();

            Rider.renderProfile();


            const database =
                Rider.getDatabase();


            if (
                !database
            ) {

                return true;
            }


            try {

                await database
                    .ref(
                        "riders/" +
                        riderId
                    )
                    .update(
                        {

                            ...updates,

                            updatedAt:
                                Date.now()
                        }
                    );


                Rider.emit(
                    "profile-updated",
                    {

                        profile:
                            Rider.state.profile
                    }
                );


                return true;

            } catch (error) {

                console.error(
                    "Rider profile update failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       MODULE INITIALIZATION
       ======================================================== */

    Rider.initializeModules =
        function () {

            /*
             * Dashboard.
             */

            try {

                if (
                    RX.riderDashboard &&
                    RX.riderDashboard.init
                ) {

                    RX.riderDashboard.init();
                }

            } catch (error) {}


            /*
             * Rider rides.
             */

            try {

                if (
                    RX.riderRides &&
                    RX.riderRides.init
                ) {

                    RX.riderRides.init();
                }

            } catch (error) {}


            /*
             * Rider wallet.
             */

            try {

                if (
                    RX.riderWallet &&
                    RX.riderWallet.init
                ) {

                    RX.riderWallet.init();
                }

            } catch (error) {}


            /*
             * Rider history.
             */

            try {

                if (
                    RX.riderHistory &&
                    RX.riderHistory.init
                ) {

                    RX.riderHistory.init();
                }

            } catch (error) {}


            /*
             * Rider profile.
             */

            try {

                if (
                    RX.riderProfile &&
                    RX.riderProfile.init
                ) {

                    RX.riderProfile.init();
                }

            } catch (error) {}
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Rider.showMessage =
        function (
            message,
            type
        ) {

            try {

                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        message,
                        type
                    );

                    return;
                }

            } catch (error) {}


            document
                .querySelectorAll(
                    "[data-rider-message]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            message;

                        element.dataset.type =
                            type ||
                            "info";

                        element.hidden =
                            false;
                    }
                );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Rider.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-rider-" +
                    name,
                    {

                        detail:
                            data ||
                            {}
                    }
                )
            );
        };


    /* ========================================================
       EVENT BINDING
       ======================================================== */

    Rider.bindEvents =
        function () {

            /*
             * Online toggle.
             */

            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const toggle =
                        event.target.closest(
                            "[data-rider-online-toggle]"
                        );


                    if (
                        toggle
                    ) {

                        Rider.setOnline(
                            toggle.checked
                        );
                    }
                }
            );


            /*
             * Online/offline button.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-toggle-rider-online]"
                        );


                    if (
                        button
                    ) {

                        event.preventDefault();

                        Rider.toggleOnline();
                    }
                }
            );


            /*
             * Logout buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-rider-logout]"
                        );


                    if (
                        button
                    ) {

                        event.preventDefault();

                        Rider.logout();
                    }
                }
            );


            /*
             * Navigation buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-rider-navigate]"
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    const page =
                        element.dataset
                            .riderNavigate;


                    if (
                        page
                    ) {

                        event.preventDefault();

                        Rider.navigate(
                            page
                        );
                    }
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.riderController =
        Rider;


    RX.getRider =
        function () {

            return Rider.state.profile;
        };


    RX.getRiderId =
        function () {

            return Rider.getRiderId();
        };


    RX.isRiderOnline =
        function () {

            return Rider.state.online;
        };


    RX.setRiderOnline =
        Rider.setOnline;


    RX.toggleRiderOnline =
        Rider.toggleOnline;


    RX.updateRiderProfile =
        Rider.updateProfile;


    RX.riderNavigate =
        Rider.navigate;


    RX.riderLogout =
        Rider.logout;


    /* ========================================================
       INIT
       ======================================================== */

    Rider.init =
        async function () {

            if (
                Rider.state.initialized
            ) {

                return;
            }


            Rider.state.initialized =
                true;

            Rider.state.loading =
                true;


            try {

                Rider.getRiderId();

                Rider.loadProfileCache();

                Rider.restoreOnlineState();

                Rider.bindEvents();


                await Rider.loadProfile();


                /*
                 * Only start live services when
                 * rider is logged in.
                 */

                if (
                    Rider.getRiderId()
                ) {

                    Rider.listenForRideRequests();

                    Rider.listenNotifications();


                    if (
                        Rider.state.online
                    ) {

                        Rider.startLocationUpdates();
                    }
                }


                Rider.renderProfile();

                Rider.renderOnlineState();


                Rider.emit(
                    "ready",
                    {

                        riderId:
                            Rider.state.riderId,

                        profile:
                            Rider.state.profile
                    }
                );


                console.log(
                    "RiderX rider.js loaded."
                );

            } finally {

                Rider.state.loading =
                    false;
            }
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Rider.init
        );

    } else {

        Rider.init();

    }

})();
