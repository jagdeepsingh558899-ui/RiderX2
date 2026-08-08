/* ============================================================
   RIDERX CUSTOMER CORE CONTROLLER
   File: js/customer.js

   Customer-side application controller
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Customer =
        RX.customer =
        RX.customer || {};


    /* ========================================================
       STATE
       ======================================================== */

    Customer.state = {

        initialized:
            false,

        user:
            null,

        uid:
            null,

        online:
            true,

        currentPage:
            "",

        activeRide:
            null,

        notifications:
            [],

        unreadNotifications:
            0,

        walletBalance:
            0,

        language:
            localStorage.getItem(
                "riderx_language"
            ) || "en"
    };


    /* ========================================================
       USER
       ======================================================== */

    Customer.getUser =
        function () {

            let user =
                null;


            if (
                RX.auth &&
                typeof RX.auth.getUser ===
                "function"
            ) {

                try {

                    user =
                        RX.auth.getUser();

                } catch (error) {

                    console.warn(
                        "Auth user read failed:",
                        error
                    );
                }
            }


            if (!user) {

                try {

                    user =
                        JSON.parse(
                            localStorage.getItem(
                                "riderx_user"
                            ) || "null"
                        );

                } catch (error) {

                    user =
                        null;
                }
            }


            Customer.state.user =
                user;


            Customer.state.uid =
                user?.uid ||
                user?.id ||
                user?.userId ||
                null;


            return user;
        };


    Customer.requireLogin =
        function () {

            const user =
                Customer.getUser();


            if (user) {
                return true;
            }


            Customer.redirectLogin();


            return false;
        };


    Customer.redirectLogin =
        function () {

            const current =
                window.location.href;


            const loginPages = [
                "/auth/login.html",
                "/auth/customer-login.html",
                "auth/login.html",
                "auth/customer-login.html"
            ];


            let login =
                "auth/customer-login.html";


            for (
                const page of
                loginPages
            ) {

                if (
                    window.location.pathname
                        .includes(
                            page.replace(
                                "/",
                                ""
                            )
                        )
                ) {

                    return;
                }
            }


            const base =
                Customer.getBasePath();


            login =
                base +
                "auth/customer-login.html";


            window.location.href =
                login +
                "?redirect=" +
                encodeURIComponent(
                    current
                );
        };


    /* ========================================================
       BASE PATH
       ======================================================== */

    Customer.getBasePath =
        function () {

            const path =
                window.location.pathname;


            if (
                path.includes(
                    "/customer/"
                )
            ) {

                return "../";
            }


            if (
                path.includes(
                    "/auth/"
                )
            ) {

                return "../";
            }


            if (
                path.includes(
                    "/admin/"
                ) ||
                path.includes(
                    "/rider/"
                )
            ) {

                return "../";
            }


            return "";
        };


    /* ========================================================
       NAVIGATION
       ======================================================== */

    Customer.go =
        function (
            page,
            options
        ) {

            options =
                options ||
                {};


            if (!page) {
                return;
            }


            const base =
                Customer.getBasePath();


            let target =
                String(
                    page
                );


            if (
                !target.includes(
                    ".html"
                )
            ) {

                target +=
                    ".html";
            }


            if (
                !target.includes(
                    "/"
                )
            ) {

                target =
                    base +
                    "customer/" +
                    target;
            }


            if (
                options.params
            ) {

                const params =
                    new URLSearchParams(
                        options.params
                    );


                target +=
                    "?" +
                    params.toString();
            }


            if (
                options.replace
            ) {

                window.location.replace(
                    target
                );

            } else {

                window.location.href =
                    target;
            }
        };


    Customer.back =
        function () {

            if (
                window.history.length >
                1
            ) {

                window.history.back();

            } else {

                Customer.go(
                    "home"
                );
            }
        };


    /* ========================================================
       PAGE DETECTION
       ======================================================== */

    Customer.getCurrentPage =
        function () {

            const file =
                window.location.pathname
                    .split("/")
                    .pop()
                    .toLowerCase();


            return (
                file
                    .replace(
                        ".html",
                        ""
                    ) ||
                "home"
            );
        };


    /* ========================================================
       RIDE
       ======================================================== */

    Customer.getActiveRide =
        function () {

            if (
                RX.customerRide &&
                typeof RX.customerRide
                    .getCurrentRide ===
                "function"
            ) {

                return RX.customerRide
                    .getCurrentRide();
            }


            return (
                Customer.state.activeRide ||
                null
            );
        };


    Customer.setActiveRide =
        function (
            ride
        ) {

            Customer.state.activeRide =
                ride ||
                null;


            if (ride) {

                try {

                    localStorage.setItem(
                        "riderx_active_ride",
                        JSON.stringify(
                            ride
                        )
                    );

                } catch (error) {}
            }


            Customer.emit(
                "active-ride-changed",
                {
                    ride:
                        ride
                }
            );
        };


    Customer.hasActiveRide =
        function () {

            const ride =
                Customer.getActiveRide();


            if (!ride) {
                return false;
            }


            const status =
                String(
                    ride.status ||
                    ""
                )
                .toLowerCase();


            return ![
                "completed",
                "cancelled",
                "canceled"
            ].includes(
                status
            );
        };


    Customer.openActiveRide =
        function () {

            const ride =
                Customer.getActiveRide();


            if (!ride) {
                return false;
            }


            Customer.go(
                "tracking",
                {
                    params: {
                        rideId:
                            ride.id ||
                            ride.rideId ||
                            ""
                    }
                }
            );


            return true;
        };


    /* ========================================================
       BOOKING
       ======================================================== */

    Customer.openBooking =
        function () {

            Customer.go(
                "booking"
            );
        };


    Customer.bookRide =
        function (
            options
        ) {

            if (
                !Customer.requireLogin()
            ) {

                return Promise.reject(
                    new Error(
                        "Please login first."
                    )
                );
            }


            if (
                RX.customerRide &&
                typeof RX.customerRide
                    .createBooking ===
                "function"
            ) {

                return RX.customerRide
                    .createBooking(
                        options
                    );
            }


            if (
                RX.booking &&
                typeof RX.booking
                    .createRide ===
                "function"
            ) {

                return RX.booking
                    .createRide(
                        options
                    );
            }


            return Promise.reject(
                new Error(
                    "Booking service is unavailable."
                )
            );
        };


    Customer.cancelRide =
        function (
            reason
        ) {

            if (
                RX.customerRide &&
                typeof RX.customerRide
                    .cancelRide ===
                "function"
            ) {

                return RX.customerRide
                    .cancelRide(
                        reason
                    );
            }


            return Promise.reject(
                new Error(
                    "Ride cancellation service is unavailable."
                )
            );
        };


    /* ========================================================
       LOCATION
       ======================================================== */

    Customer.getCurrentLocation =
        function () {

            return new Promise(
                function (
                    resolve,
                    reject
                ) {

                    if (
                        !navigator.geolocation
                    ) {

                        reject(
                            new Error(
                                "Location is not supported."
                            )
                        );

                        return;
                    }


                    navigator
                        .geolocation
                        .getCurrentPosition(
                            function (
                                position
                            ) {

                                resolve({

                                    lat:
                                        position
                                            .coords
                                            .latitude,

                                    lng:
                                        position
                                            .coords
                                            .longitude,

                                    accuracy:
                                        position
                                            .coords
                                            .accuracy
                                });
                            },

                            function (
                                error
                            ) {

                                reject(
                                    error
                                );
                            },

                            {
                                enableHighAccuracy:
                                    true,

                                timeout:
                                    15000,

                                maximumAge:
                                    10000
                            }
                        );
                }
            );
        };


    Customer.useCurrentLocation =
        async function () {

            try {

                const location =
                    await Customer
                        .getCurrentLocation();


                if (
                    RX.customerMap &&
                    typeof RX.customerMap
                        .setPickupLocation ===
                    "function"
                ) {

                    await RX.customerMap
                        .setPickupLocation(
                            location
                        );
                }


                Customer.emit(
                    "location-selected",
                    {
                        location:
                            location
                    }
                );


                return location;

            } catch (error) {

                Customer.showError(
                    "Unable to get your location."
                );


                throw error;
            }
        };


    /* ========================================================
       FARE
       ======================================================== */

    Customer.calculateFare =
        function (
            distance,
            service,
            options
        ) {

            if (
                RX.customerRide &&
                typeof RX.customerRide
                    .calculateFare ===
                "function"
            ) {

                return RX.customerRide
                    .calculateFare(
                        distance,
                        service,
                        options
                    );
            }


            if (
                RX.fareCalculator &&
                typeof RX.fareCalculator
                    .calculate ===
                "function"
            ) {

                return RX.fareCalculator
                    .calculate(
                        distance,
                        service,
                        options
                    );
            }


            return null;
        };


    /* ========================================================
       WALLET
       ======================================================== */

    Customer.getWalletBalance =
        async function () {

            const uid =
                Customer.state.uid ||
                Customer.getUser()?.uid;


            if (!uid) {
                return 0;
            }


            const database =
                Customer.getDatabase();


            if (!database) {
                return 0;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            "wallets/" +
                            uid +
                            "/balance"
                        )
                        .once(
                            "value"
                        );


                const balance =
                    Number(
                        snapshot.val()
                    ) ||
                    0;


                Customer.state.walletBalance =
                    balance;


                Customer.updateWalletUI(
                    balance
                );


                return balance;

            } catch (error) {

                console.warn(
                    "Wallet balance failed:",
                    error
                );


                return 0;
            }
        };


    Customer.updateWalletUI =
        function (
            balance
        ) {

            document
                .querySelectorAll(
                    "[data-wallet-balance]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            "₹" +
                            Number(
                                balance ||
                                0
                            )
                            .toLocaleString(
                                "en-IN"
                            );
                    }
                );
        };


    /* ========================================================
       NOTIFICATIONS
       ======================================================== */

    Customer.getNotifications =
        async function () {

            const uid =
                Customer.state.uid ||
                Customer.getUser()?.uid;


            if (!uid) {
                return [];
            }


            const database =
                Customer.getDatabase();


            if (!database) {
                return [];
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            "notifications/" +
                            uid
                        )
                        .limitToLast(
                            100
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                const notifications =
                    Object.keys(
                        data
                    )
                    .map(
                        function (
                            id
                        ) {

                            return {
                                id:
                                    id,

                                ...data[id]
                            };
                        }
                    )
                    .sort(
                        function (
                            a,
                            b
                        ) {

                            return (
                                Number(
                                    b.createdAt ||
                                    b.timestamp ||
                                    0
                                ) -
                                Number(
                                    a.createdAt ||
                                    a.timestamp ||
                                    0
                                )
                            );
                        }
                    );


                Customer.state.notifications =
                    notifications;


                Customer.state
                    .unreadNotifications =
                    notifications.filter(
                        function (
                            item
                        ) {

                            return (
                                item.read !==
                                true
                            );
                        }
                    ).length;


                Customer.updateNotificationBadge();


                Customer.emit(
                    "notifications-loaded",
                    {
                        notifications:
                            notifications
                    }
                );


                return notifications;

            } catch (error) {

                console.warn(
                    "Notifications failed:",
                    error
                );


                return [];
            }
        };


    Customer.updateNotificationBadge =
        function () {

            const count =
                Customer.state
                    .unreadNotifications;


            document
                .querySelectorAll(
                    "[data-notification-badge]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count >
                            99
                                ? "99+"
                                : String(
                                    count
                                );


                        element.hidden =
                            count <= 0;
                    }
                );
        };


    Customer.markNotificationRead =
        async function (
            notificationId
        ) {

            if (!notificationId) {
                return;
            }


            const uid =
                Customer.state.uid;


            const database =
                Customer.getDatabase();


            if (
                !uid ||
                !database
            ) {
                return;
            }


            try {

                await database
                    .ref(
                        "notifications/" +
                        uid +
                        "/" +
                        notificationId
                    )
                    .update({

                        read:
                            true,

                        readAt:
                            Date.now()
                    });


                await Customer
                    .getNotifications();

            } catch (error) {

                console.warn(
                    "Notification update failed:",
                    error
                );
            }
        };


    /* ========================================================
       CHAT
       ======================================================== */

    Customer.openChat =
        function (
            rideId
        ) {

            if (!rideId) {

                const ride =
                    Customer.getActiveRide();


                rideId =
                    ride?.id ||
                    ride?.rideId ||
                    "";
            }


            Customer.go(
                "chat",
                {
                    params: {
                        rideId:
                            rideId
                    }
                }
            );
        };


    /* ========================================================
       CALL RIDER
       ======================================================== */

    Customer.callRider =
        function () {

            const ride =
                Customer.getActiveRide();


            const phone =
                ride?.riderPhone ||
                ride?.driverPhone ||
                Customer.state.activeRide
                    ?.riderPhone;


            if (!phone) {

                Customer.showError(
                    "Rider phone number is not available."
                );


                return false;
            }


            window.location.href =
                "tel:" +
                phone;


            return true;
        };


    /* ========================================================
       PAYMENT
       ======================================================== */

    Customer.payRide =
        function (
            method
        ) {

            const ride =
                Customer.getActiveRide();


            if (
                RX.customerRide &&
                typeof RX.customerRide
                    .payFare ===
                "function"
            ) {

                return RX.customerRide
                    .payFare(
                        method ||
                        ride?.paymentMethod ||
                        "cash"
                    );
            }


            if (
                RX.payment &&
                typeof RX.payment
                    .payRide ===
                "function"
            ) {

                return RX.payment
                    .payRide(
                        ride,
                        method
                    );
            }


            return Promise.reject(
                new Error(
                    "Payment service is unavailable."
                )
            );
        };


    /* ========================================================
       RATING
       ======================================================== */

    Customer.rateRide =
        function (
            stars,
            comment
        ) {

            if (
                RX.customerRide &&
                typeof RX.customerRide
                    .submitRating ===
                "function"
            ) {

                return RX.customerRide
                    .submitRating(
                        stars,
                        comment
                    );
            }


            if (
                RX.rating &&
                typeof RX.rating
                    .submit ===
                "function"
            ) {

                return RX.rating
                    .submit(
                        stars,
                        comment
                    );
            }


            return Promise.reject(
                new Error(
                    "Rating service is unavailable."
                )
            );
        };


    /* ========================================================
       DATABASE
       ======================================================== */

    Customer.getDatabase =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {

                console.warn(
                    "Firebase database unavailable:",
                    error
                );
            }


            return null;
        };


    Customer.getFirestore =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {

                console.warn(
                    "Firestore unavailable:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       PROFILE
       ======================================================== */

    Customer.updateProfile =
        async function (
            data
        ) {

            if (
                !Customer.requireLogin()
            ) {

                return false;
            }


            data =
                data ||
                {};


            const uid =
                Customer.state.uid;


            const database =
                Customer.getDatabase();


            if (!database) {

                throw new Error(
                    "Database unavailable."
                );
            }


            const updates = {

                ...data,

                updatedAt:
                    Date.now()
            };


            await database
                .ref(
                    "users/" +
                    uid
                )
                .update(
                    updates
                );


            Customer.state.user =
                {
                    ...Customer.state.user,
                    ...updates
                };


            try {

                localStorage.setItem(
                    "riderx_user",
                    JSON.stringify(
                        Customer.state.user
                    )
                );

            } catch (error) {}


            Customer.updateUserUI();


            Customer.emit(
                "profile-updated",
                {
                    user:
                        Customer.state.user
                }
            );


            return Customer.state.user;
        };


    Customer.updateUserUI =
        function () {

            const user =
                Customer.state.user ||
                Customer.getUser();


            if (!user) {
                return;
            }


            const name =
                user.name ||
                user.displayName ||
                "Customer";


            const phone =
                user.phone ||
                user.phoneNumber ||
                "";


            const email =
                user.email ||
                "";


            const photo =
                user.photoURL ||
                user.photo ||
                "";


            document
                .querySelectorAll(
                    "[data-customer-name]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            name;
                    }
                );


            document
                .querySelectorAll(
                    "[data-customer-phone]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            phone;
                    }
                );


            document
                .querySelectorAll(
                    "[data-customer-email]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            email;
                    }
                );


            document
                .querySelectorAll(
                    "[data-customer-photo]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.tagName ===
                            "IMG"
                        ) {

                            element.src =
                                photo ||
                                "../assest/logo.png";

                        } else {

                            element.style
                                .backgroundImage =
                                photo
                                    ? `url("${photo}")`
                                    : "";
                        }
                    }
                );
        };


    /* ========================================================
       LANGUAGE
       ======================================================== */

    Customer.setLanguage =
        function (
            language
        ) {

            language =
                String(
                    language ||
                    "en"
                )
                .toLowerCase();


            if (
                ![
                    "en",
                    "hi"
                ].includes(
                    language
                )
            ) {

                language =
                    "en";
            }


            Customer.state.language =
                language;


            localStorage.setItem(
                "riderx_language",
                language
            );


            if (
                RX.language &&
                typeof RX.language
                    .setLanguage ===
                "function"
            ) {

                RX.language
                    .setLanguage(
                        language
                    );
            }


            Customer.emit(
                "language-changed",
                {
                    language:
                        language
                }
            );
        };


    /* ========================================================
       MENU
       ======================================================== */

    Customer.openMenu =
        function () {

            const menu =
                document.querySelector(
                    "[data-customer-menu]"
                ) ||
                document.querySelector(
                    ".customer-menu"
                ) ||
                document.querySelector(
                    ".side-menu"
                );


            if (!menu) {

                Customer.go(
                    "menu"
                );

                return;
            }


            menu.classList.toggle(
                "open"
            );


            document.body.classList.toggle(
                "menu-open"
            );
        };


    Customer.closeMenu =
        function () {

            document
                .querySelectorAll(
                    "[data-customer-menu].open, .customer-menu.open, .side-menu.open"
                )
                .forEach(
                    function (
                        menu
                    ) {

                        menu.classList.remove(
                            "open"
                        );
                    }
                );


            document.body.classList.remove(
                "menu-open"
            );
        };


    /* ========================================================
       UI HELPERS
       ======================================================== */

    Customer.showLoading =
        function (
            text
        ) {

            const loader =
                document.querySelector(
                    "[data-customer-loader]"
                );


            if (!loader) {
                return;
            }


            const label =
                loader.querySelector(
                    "[data-loader-text]"
                );


            if (label) {

                label.textContent =
                    text ||
                    "Please wait...";
            }


            loader.hidden =
                false;
        };


    Customer.hideLoading =
        function () {

            document
                .querySelectorAll(
                    "[data-customer-loader]"
                )
                .forEach(
                    function (
                        loader
                    ) {

                        loader.hidden =
                            true;
                    }
                );
        };


    Customer.showError =
        function (
            message
        ) {

            if (
                RX.toast &&
                typeof RX.toast ===
                "function"
            ) {

                RX.toast(
                    message,
                    "error"
                );

                return;
            }


            const event =
                new CustomEvent(
                    "riderx-customer-error",
                    {
                        detail: {
                            message:
                                message
                        }
                    }
                );


            window.dispatchEvent(
                event
            );
        };


    Customer.showSuccess =
        function (
            message
        ) {

            if (
                RX.toast &&
                typeof RX.toast ===
                "function"
            ) {

                RX.toast(
                    message,
                    "success"
                );

                return;
            }


            window.dispatchEvent(
                new CustomEvent(
                    "riderx-customer-success",
                    {
                        detail: {
                            message:
                                message
                        }
                    }
                )
            );
        };


    /* ========================================================
       EVENT BUS
       ======================================================== */

    Customer.emit =
        function (
            name,
            detail
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-customer-" +
                    name,
                    {
                        detail:
                            detail ||
                            {}
                    }
                )
            );
        };


    Customer.on =
        function (
            name,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {
                return;
            }


            window.addEventListener(
                "riderx-customer-" +
                name,
                function (
                    event
                ) {

                    callback(
                        event.detail ||
                        {}
                    );
                }
            );
        };


    /* ========================================================
       BUTTON BINDINGS
       ======================================================== */

    Customer.bindUI =
        function () {

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const target =
                        event.target.closest(
                            "[data-customer-action]"
                        );


                    if (!target) {
                        return;
                    }


                    const action =
                        target.dataset
                            .customerAction;


                    switch (
                        action
                    ) {

                        case "home":
                            Customer.go(
                                "home"
                            );
                            break;


                        case "booking":
                            Customer.openBooking();
                            break;


                        case "history":
                            Customer.go(
                                "history"
                            );
                            break;


                        case "wallet":
                            Customer.go(
                                "wallet"
                            );
                            break;


                        case "profile":
                            Customer.go(
                                "profile"
                            );
                            break;


                        case "settings":
                            Customer.go(
                                "settings"
                            );
                            break;


                        case "notifications":
                            Customer.go(
                                "notifications"
                            );
                            break;


                        case "menu":
                            Customer.openMenu();
                            break;


                        case "close-menu":
                            Customer.closeMenu();
                            break;


                        case "active-ride":
                            Customer.openActiveRide();
                            break;


                        case "chat":
                            Customer.openChat();
                            break;


                        case "call-rider":
                            Customer.callRider();
                            break;


                        case "use-location":
                            Customer
                                .useCurrentLocation()
                                .catch(
                                    function () {}
                                );
                            break;


                        case "back":
                            Customer.back();
                            break;
                    }
                }
            );


            /*
             * Language buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-language]"
                        );


                    if (!button) {
                        return;
                    }


                    Customer.setLanguage(
                        button.dataset
                            .language
                    );
                }
            );


            /*
             * Close menu when clicking outside.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const menu =
                        document.querySelector(
                            "[data-customer-menu]"
                        );


                    if (
                        !menu ||
                        !menu.classList.contains(
                            "open"
                        )
                    ) {

                        return;
                    }


                    if (
                        !event.target.closest(
                            "[data-customer-menu]"
                        ) &&
                        !event.target.closest(
                            "[data-customer-action='menu']"
                        )
                    ) {

                        Customer.closeMenu();
                    }
                }
            );
        };


    /* ========================================================
       ACTIVE RIDE LISTENER
       ======================================================== */

    Customer.bindRideEvents =
        function () {

            window.addEventListener(
                "riderx-ride-ride-updated",
                function (
                    event
                ) {

                    const ride =
                        event.detail?.ride;


                    if (!ride) {
                        return;
                    }


                    Customer.setActiveRide(
                        ride
                    );
                }
            );


            window.addEventListener(
                "riderx-ride-ride-created",
                function (
                    event
                ) {

                    const ride =
                        event.detail?.ride;


                    Customer.setActiveRide(
                        ride
                    );
                }
            );


            window.addEventListener(
                "riderx-ride-trip-completed",
                function (
                    event
                ) {

                    const ride =
                        event.detail?.ride;


                    Customer.setActiveRide(
                        ride
                    );
                }
            );


            window.addEventListener(
                "riderx-ride-cancelled",
                function () {

                    Customer.state.activeRide =
                        null;
                }
            );
        };


    /* ========================================================
       BOOT
       ======================================================== */

    Customer.init =
        async function () {

            if (
                Customer.state.initialized
            ) {
                return;
            }


            Customer.state.currentPage =
                Customer.getCurrentPage();


            Customer.getUser();


            /*
             * Customer pages require authentication.
             */

            const protectedPages = [
                "home",
                "dashboard",
                "booking",
                "chat",
                "history",
                "live-tracking",
                "map",
                "menu",
                "notifications",
                "payment",
                "profile",
                "rating",
                "receipt",
                "ride-status",
                "searching",
                "settings",
                "tracking",
                "trip",
                "wallet"
            ];


            if (
                protectedPages.includes(
                    Customer.state.currentPage
                ) &&
                !Customer.state.uid
            ) {

                Customer.redirectLogin();

                return;
            }


            Customer.bindUI();


            Customer.bindRideEvents();


            Customer.updateUserUI();


            /*
             * Load wallet and notifications
             * without blocking the page.
             */

            if (
                Customer.state.uid
            ) {

                Customer.getWalletBalance()
                    .catch(
                        function () {}
                    );


                Customer.getNotifications()
                    .catch(
                        function () {}
                    );
            }


            /*
             * Active ride.
             */

            const activeRide =
                Customer.getActiveRide();


            if (activeRide) {

                Customer.state.activeRide =
                    activeRide;
            }


            Customer.state.initialized =
                true;


            Customer.emit(
                "ready",
                {
                    page:
                        Customer.state.currentPage
                }
            );


            console.log(
                "RiderX customer.js loaded."
            );
        };


    /* ========================================================
       PUBLIC HELPERS
       ======================================================== */

    RX.customerGo =
        Customer.go;


    RX.customerBookRide =
        Customer.bookRide;


    RX.customerCancelRide =
        Customer.cancelRide;


    RX.customerOpenChat =
        Customer.openChat;


    RX.customerCallRider =
        Customer.callRider;


    RX.customerUseLocation =
        Customer.useCurrentLocation;


    /* ========================================================
       AUTO INIT
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                Customer.init();

            },
            {
                once:
                    true
            }
        );

    } else {

        Customer.init();
    }

})();
