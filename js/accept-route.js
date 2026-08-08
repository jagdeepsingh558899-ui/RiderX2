/* ============================================================
   RIDERX
   ACCEPT ROUTE ENGINE
   File: js/accept-route.js

   Handles:
   - Rider accepted ride
   - Pickup route
   - Navigation state
   - Customer pickup arrival
   - Start ride handoff
   - Route/map integration
   - Firebase Realtime Database
   - Live ride state
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;
    const AR = RX.acceptRoute = RX.acceptRoute || {};

    AR.state = {
        initialized: false,
        rideId: null,
        requestId: null,
        customerId: null,
        riderId: null,
        pickup: null,
        destination: null,
        route: null,
        distance: 0,
        duration: 0,
        status: null,
        reference: null,
        listener: null
    };


    /* ========================================================
       HELPERS
       ======================================================== */

    AR.getUser = function () {

        try {

            if (
                window.firebase &&
                firebase.auth
            ) {

                const user =
                    firebase.auth()
                        .currentUser;

                if (user) {
                    return user;
                }
            }

        } catch (error) {
            console.warn(
                "Accept route auth error:",
                error
            );
        }


        try {

            return JSON.parse(
                localStorage.getItem(
                    "riderx_user"
                ) || "null"
            );

        } catch (error) {

            return null;
        }
    };


    AR.getUserId = function () {

        const user = AR.getUser();

        if (!user) {
            return null;
        }

        return (
            user.uid ||
            user.userId ||
            user.id ||
            null
        );
    };


    AR.getDatabase = function () {

        try {

            if (
                window.firebase &&
                firebase.database
            ) {

                return firebase.database();
            }

        } catch (error) {

            console.warn(
                "Accept route database error:",
                error
            );
        }

        return null;
    };


    AR.toNumber = function (value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    };


    AR.normalizeLocation = function (
        location
    ) {

        if (!location) {
            return null;
        }


        const lat =
            AR.toNumber(
                location.lat ??
                location.latitude
            );

        const lng =
            AR.toNumber(
                location.lng ??
                location.lon ??
                location.longitude
            );


        if (
            !lat &&
            !lng
        ) {
            return null;
        }


        return {
            lat: lat,
            lng: lng,

            address:
                location.address ||
                location.name ||
                ""
        };
    };


    AR.escape = function (
        value
    ) {

        const div =
            document.createElement(
                "div"
            );

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    };


    /* ========================================================
       OPEN ACCEPTED RIDE
       ======================================================== */

    AR.open = async function (
        options = {}
    ) {

        const userId =
            AR.getUserId();


        AR.state.riderId =
            options.riderId ||
            userId;


        AR.state.rideId =
            options.rideId ||
            options.id ||
            options.requestId ||
            null;


        AR.state.requestId =
            options.requestId ||
            AR.state.rideId ||
            null;


        AR.state.customerId =
            options.customerId ||
            options.userId ||
            null;


        AR.state.pickup =
            AR.normalizeLocation(
                options.pickup ||
                options.pickupLocation
            );


        AR.state.destination =
            AR.normalizeLocation(
                options.destination ||
                options.dropoff ||
                options.dropoffLocation
            );


        AR.state.status =
            options.status ||
            "accepted";


        if (
            !AR.state.rideId
        ) {

            throw new Error(
                "Ride ID is required."
            );
        }


        await AR.updateRideState(
            "accepted"
        );


        AR.saveLocal();

        AR.render();

        AR.bindRideListener();

        AR.buildPickupRoute();

        AR.dispatch(
            "riderx-ride-accepted",
            {
                rideId:
                    AR.state.rideId,

                customerId:
                    AR.state.customerId,

                pickup:
                    AR.state.pickup,

                destination:
                    AR.state.destination
            }
        );


        return {
            success: true,
            rideId:
                AR.state.rideId
        };
    };


    /* ========================================================
       LOAD RIDE
       ======================================================== */

    AR.loadRide = async function (
        rideId
    ) {

        if (!rideId) {
            return null;
        }


        const database =
            AR.getDatabase();


        if (!database) {

            return null;
        }


        try {

            const snapshot =
                await database
                    .ref(
                        "rides/" +
                        rideId
                    )
                    .once(
                        "value"
                    );


            const ride =
                snapshot.val();


            if (!ride) {
                return null;
            }


            AR.state.rideId =
                rideId;

            AR.state.requestId =
                ride.requestId ||
                rideId;

            AR.state.customerId =
                ride.customerId ||
                ride.userId ||
                null;

            AR.state.riderId =
                ride.riderId ||
                AR.getUserId();

            AR.state.pickup =
                AR.normalizeLocation(
                    ride.pickup ||
                    ride.pickupLocation
                );

            AR.state.destination =
                AR.normalizeLocation(
                    ride.destination ||
                    ride.dropoff ||
                    ride.dropoffLocation
                );

            AR.state.status =
                ride.status ||
                "accepted";


            AR.saveLocal();

            AR.render();


            return ride;

        } catch (error) {

            console.error(
                "Ride load failed:",
                error
            );

            return null;
        }
    };


    /* ========================================================
       FIREBASE RIDE REFERENCE
       ======================================================== */

    AR.getRideReference =
        function () {

            const database =
                AR.getDatabase();

            if (
                !database ||
                !AR.state.rideId
            ) {

                return null;
            }


            return database.ref(
                "rides/" +
                AR.state.rideId
            );
        };


    /* ========================================================
       UPDATE RIDE STATUS
       ======================================================== */

    AR.updateRideState = async function (
        status,
        extra = {}
    ) {

        if (!status) {
            return false;
        }


        AR.state.status =
            status;


        const payload = {

            status:
                status,

            updatedAt:
                Date.now(),

            ...extra
        };


        const reference =
            AR.getRideReference();


        if (!reference) {

            AR.saveLocal();

            AR.render();

            AR.dispatch(
                "riderx-ride-status",
                payload
            );

            return true;
        }


        try {

            await reference.update(
                payload
            );


            AR.dispatch(
                "riderx-ride-status",
                payload
            );


            AR.render();


            return true;

        } catch (error) {

            console.error(
                "Ride status update failed:",
                error
            );

            return false;
        }
    };


    /* ========================================================
       BUILD PICKUP ROUTE
       ======================================================== */

    AR.buildPickupRoute = async function () {

        const riderLocation =
            await AR.getCurrentRiderLocation();


        if (
            !riderLocation ||
            !AR.state.pickup
        ) {

            /*
             * If current rider location is not
             * available, still render pickup.
             */

            AR.dispatch(
                "riderx-route-ready",
                {
                    type:
                        "pickup",

                    pickup:
                        AR.state.pickup
                }
            );

            return;
        }


        AR.state.route = {

            type:
                "pickup",

            from:
                riderLocation,

            to:
                AR.state.pickup
        };


        AR.dispatch(
            "riderx-route-request",
            {

                type:
                    "pickup",

                from:
                    riderLocation,

                to:
                    AR.state.pickup,

                rideId:
                    AR.state.rideId
            }
        );


        /*
         * Try existing route engine.
         */

        try {

            if (
                RX.route &&
                typeof RX.route
                    .getRoute ===
                "function"
            ) {

                const route =
                    await RX.route
                        .getRoute(
                            riderLocation,
                            AR.state.pickup
                        );


                if (route) {

                    AR.applyRoute(
                        route
                    );
                }

                return;
            }

        } catch (error) {

            console.warn(
                "Route engine unavailable:",
                error
            );
        }


        /*
         * Try existing map engine.
         */

        try {

            if (
                RX.map &&
                typeof RX.map
                    .drawRoute ===
                "function"
            ) {

                await RX.map
                    .drawRoute(
                        riderLocation,
                        AR.state.pickup
                    );
            }

        } catch (error) {

            console.warn(
                "Map route error:",
                error
            );
        }
    };


    /* ========================================================
       BUILD DESTINATION ROUTE
       ======================================================== */

    AR.buildDestinationRoute = async function () {

        if (
            !AR.state.pickup ||
            !AR.state.destination
        ) {

            return false;
        }


        AR.state.route = {

            type:
                "destination",

            from:
                AR.state.pickup,

            to:
                AR.state.destination
        };


        AR.dispatch(
            "riderx-route-request",
            {

                type:
                    "destination",

                from:
                    AR.state.pickup,

                to:
                    AR.state.destination,

                rideId:
                    AR.state.rideId
            }
        );


        try {

            if (
                RX.route &&
                typeof RX.route
                    .getRoute ===
                "function"
            ) {

                const route =
                    await RX.route
                        .getRoute(
                            AR.state.pickup,
                            AR.state.destination
                        );


                if (route) {

                    AR.applyRoute(
                        route
                    );
                }

                return true;
            }

        } catch (error) {

            console.warn(
                "Destination route error:",
                error
            );
        }


        try {

            if (
                RX.map &&
                typeof RX.map
                    .drawRoute ===
                "function"
            ) {

                await RX.map
                    .drawRoute(
                        AR.state.pickup,
                        AR.state.destination
                    );
            }

        } catch (error) {

            console.warn(
                "Destination map error:",
                error
            );
        }


        return true;
    };


    /* ========================================================
       APPLY ROUTE
       ======================================================== */

    AR.applyRoute = function (
        route
    ) {

        if (!route) {
            return;
        }


        AR.state.route =
            route;


        AR.state.distance =
            AR.toNumber(
                route.distance
            );


        AR.state.duration =
            AR.toNumber(
                route.duration
            );


        AR.dispatch(
            "riderx-route-ready",
            {

                route:
                    route,

                distance:
                    AR.state.distance,

                duration:
                    AR.state.duration,

                rideId:
                    AR.state.rideId
            }
        );


        AR.render();
    };


    /* ========================================================
       RIDER CURRENT LOCATION
       ======================================================== */

    AR.getCurrentRiderLocation =
        function () {

            return new Promise(
                function (
                    resolve
                ) {

                    if (
                        navigator
                            .geolocation
                    ) {

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
                                                .longitude
                                    });

                                },

                                function () {

                                    resolve(
                                        null
                                    );

                                },

                                {

                                    enableHighAccuracy:
                                        true,

                                    timeout:
                                        8000,

                                    maximumAge:
                                        3000
                                }
                            );

                        return;
                    }


                    resolve(
                        null
                    );
                }
            );
        };


    /* ========================================================
       RIDER ARRIVED
       ======================================================== */

    AR.arrivedAtPickup =
        async function () {

            if (
                !AR.state.rideId
            ) {

                return false;
            }


            const result =
                await AR.updateRideState(
                    "arrived",
                    {

                        arrivedAt:
                            Date.now()
                    }
                );


            if (result) {

                AR.dispatch(
                    "riderx-rider-arrived",
                    {

                        rideId:
                            AR.state.rideId,

                        customerId:
                            AR.state.customerId
                    }
                );
            }


            return result;
        };


    /* ========================================================
       START RIDE
       ======================================================== */

    AR.startRide = async function (
        otp = null
    ) {

        if (
            !AR.state.rideId
        ) {

            throw new Error(
                "Ride not found."
            );
        }


        /*
         * OTP verification is delegated to
         * the OTP module when available.
         */

        if (
            otp &&
            RX.otp &&
            typeof RX.otp
                .verifyRideOtp ===
            "function"
        ) {

            const valid =
                await RX.otp
                    .verifyRideOtp(
                        AR.state.rideId,
                        otp
                    );


            if (!valid) {

                throw new Error(
                    "Invalid ride OTP."
                );
            }
        }


        const result =
            await AR.updateRideState(
                "started",
                {

                    startedAt:
                        Date.now(),

                    otpVerified:
                        Boolean(otp)
                }
            );


        if (result) {

            AR.dispatch(
                "riderx-ride-started",
                {

                    rideId:
                        AR.state.rideId
                }
            );


            await AR.buildDestinationRoute();
        }


        return result;
    };


    /* ========================================================
       COMPLETE HANDOFF
       ======================================================== */

    AR.completeRoute =
        async function () {

            const result =
                await AR.updateRideState(
                    "completed",
                    {

                        completedAt:
                            Date.now()
                    }
                );


            if (result) {

                AR.dispatch(
                    "riderx-ride-completed",
                    {

                        rideId:
                            AR.state.rideId
                    }
                );
            }


            return result;
        };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    AR.cancel = async function (
        reason = "Cancelled by rider"
    ) {

        const result =
            await AR.updateRideState(
                "cancelled",
                {

                    cancelledAt:
                        Date.now(),

                    cancelledBy:
                        "rider",

                    cancellationReason:
                        reason
                }
            );


        if (result) {

            AR.dispatch(
                "riderx-ride-cancelled",
                {

                    rideId:
                        AR.state.rideId,

                    reason:
                        reason
                }
            );
        }


        return result;
    };


    /* ========================================================
       REALTIME RIDE LISTENER
       ======================================================== */

    AR.bindRideListener =
        function () {

            AR.stopRideListener();


            const reference =
                AR.getRideReference();


            if (!reference) {
                return false;
            }


            const listener =
                function (
                    snapshot
                ) {

                    const ride =
                        snapshot.val();


                    if (!ride) {
                        return;
                    }


                    AR.state.status =
                        ride.status ||
                        AR.state.status;


                    if (
                        ride.pickup
                    ) {

                        AR.state.pickup =
                            AR.normalizeLocation(
                                ride.pickup
                            );
                    }


                    if (
                        ride.destination ||
                        ride.dropoff
                    ) {

                        AR.state.destination =
                            AR.normalizeLocation(
                                ride.destination ||
                                ride.dropoff
                            );
                    }


                    if (
                        ride.customerId
                    ) {

                        AR.state.customerId =
                            ride.customerId;
                    }


                    if (
                        ride.riderId
                    ) {

                        AR.state.riderId =
                            ride.riderId;
                    }


                    AR.saveLocal();

                    AR.render();


                    AR.dispatch(
                        "riderx-ride-updated",
                        {
                            ride:
                                ride
                        }
                    );
                };


            reference.on(
                "value",
                listener
            );


            AR.state.reference =
                reference;

            AR.state.listener =
                listener;


            return true;
        };


    /* ========================================================
       STOP RIDE LISTENER
       ======================================================== */

    AR.stopRideListener =
        function () {

            if (
                AR.state.reference &&
                AR.state.listener
            ) {

                try {

                    AR.state.reference.off(
                        "value",
                        AR.state.listener
                    );

                } catch (error) {

                    console.warn(
                        "Ride listener stop error:",
                        error
                    );
                }
            }


            AR.state.reference =
                null;

            AR.state.listener =
                null;
        };


    /* ========================================================
       SAVE LOCAL
       ======================================================== */

    AR.saveLocal = function () {

        try {

            localStorage.setItem(
                "riderx_active_ride",

                JSON.stringify({

                    rideId:
                        AR.state.rideId,

                    requestId:
                        AR.state.requestId,

                    customerId:
                        AR.state.customerId,

                    riderId:
                        AR.state.riderId,

                    pickup:
                        AR.state.pickup,

                    destination:
                        AR.state.destination,

                    status:
                        AR.state.status,

                    distance:
                        AR.state.distance,

                    duration:
                        AR.state.duration,

                    updatedAt:
                        Date.now()
                })
            );

        } catch (error) {

            console.warn(
                "Accept route local save error:",
                error
            );
        }
    };


    /* ========================================================
       LOAD LOCAL
       ======================================================== */

    AR.loadLocal = function () {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        "riderx_active_ride"
                    ) || "null"
                );


            if (!data) {
                return null;
            }


            AR.state.rideId =
                data.rideId ||
                null;

            AR.state.requestId =
                data.requestId ||
                null;

            AR.state.customerId =
                data.customerId ||
                null;

            AR.state.riderId =
                data.riderId ||
                null;

            AR.state.pickup =
                data.pickup ||
                null;

            AR.state.destination =
                data.destination ||
                null;

            AR.state.status =
                data.status ||
                null;

            AR.state.distance =
                AR.toNumber(
                    data.distance
                );

            AR.state.duration =
                AR.toNumber(
                    data.duration
                );


            return data;

        } catch (error) {

            return null;
        }
    };


    /* ========================================================
       CLEAR
       ======================================================== */

    AR.clear = function () {

        AR.stopRideListener();


        AR.state.rideId =
            null;

        AR.state.requestId =
            null;

        AR.state.customerId =
            null;

        AR.state.pickup =
            null;

        AR.state.destination =
            null;

        AR.state.route =
            null;

        AR.state.distance =
            0;

        AR.state.duration =
            0;

        AR.state.status =
            null;


        try {

            localStorage.removeItem(
                "riderx_active_ride"
            );

        } catch (error) {
            /* Ignore */
        }


        AR.render();
    };


    /* ========================================================
       RENDER
       ======================================================== */

    AR.render = function () {

        document
            .querySelectorAll(
                "[data-ride-id]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        AR.state.rideId ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-ride-status]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        AR.state.status ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-pickup-address]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        AR.state.pickup &&
                        AR.state.pickup.address
                            ? AR.state.pickup.address
                            : "";
                }
            );


        document
            .querySelectorAll(
                "[data-destination-address]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.textContent =
                        AR.state.destination &&
                        AR.state.destination.address
                            ? AR.state.destination.address
                            : "";
                }
            );


        document
            .querySelectorAll(
                "[data-route-distance]"
            )
            .forEach(
                function (
                    element
                ) {

                    const distance =
                        AR.state.distance;


                    element.textContent =
                        distance
                            ? (
                                distance >= 1000
                                    ? (
                                        distance /
                                        1000
                                      ).toFixed(
                                        1
                                      ) +
                                      " km"
                                    : Math.round(
                                        distance
                                      ) +
                                      " m"
                              )
                            : "";
                }
            );


        document
            .querySelectorAll(
                "[data-route-duration]"
            )
            .forEach(
                function (
                    element
                ) {

                    const seconds =
                        AR.state.duration;


                    if (!seconds) {

                        element.textContent =
                            "";

                        return;
                    }


                    const minutes =
                        Math.ceil(
                            seconds / 60
                        );


                    element.textContent =
                        minutes +
                        " min";
                }
            );


        document
            .querySelectorAll(
                "[data-arrived-button]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.disabled =
                        !(
                            AR.state.status ===
                            "accepted"
                        );
                }
            );


        document
            .querySelectorAll(
                "[data-start-ride-button]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.disabled =
                        !(
                            AR.state.status ===
                            "arrived"
                        );
                }
            );
    };


    /* ========================================================
       EVENTS
       ======================================================== */

    AR.dispatch = function (
        name,
        detail = {}
    ) {

        window.dispatchEvent(
            new CustomEvent(
                name,
                {
                    detail:
                        detail
                }
            )
        );
    };


    AR.bindEvents = function () {

        document.addEventListener(
            "click",
            async function (
                event
            ) {

                const arrived =
                    event.target.closest(
                        "[data-arrived-button]"
                    );


                if (arrived) {

                    event.preventDefault();

                    try {

                        await AR.arrivedAtPickup();

                    } catch (error) {

                        AR.showMessage(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const start =
                    event.target.closest(
                        "[data-start-ride-button]"
                    );


                if (start) {

                    event.preventDefault();


                    const otpInput =
                        document.querySelector(
                            "[data-ride-otp]"
                        );


                    const otp =
                        otpInput
                            ? otpInput.value
                                .trim()
                            : null;


                    try {

                        await AR.startRide(
                            otp
                        );

                    } catch (error) {

                        AR.showMessage(
                            error.message,
                            true
                        );
                    }

                    return;
                }


                const cancel =
                    event.target.closest(
                        "[data-cancel-ride]"
                    );


                if (cancel) {

                    event.preventDefault();


                    const reason =
                        cancel.dataset
                            .cancelReason ||
                        "Cancelled by rider";


                    try {

                        await AR.cancel(
                            reason
                        );

                    } catch (error) {

                        AR.showMessage(
                            error.message,
                            true
                        );
                    }
                }
            }
        );
    };


    /* ========================================================
       MESSAGE
       ======================================================== */

    AR.showMessage = function (
        message,
        error = false
    ) {

        const old =
            document.querySelector(
                ".riderx-route-message"
            );


        if (old) {
            old.remove();
        }


        const element =
            document.createElement(
                "div"
            );


        element.className =
            "riderx-route-message " +
            (
                error
                    ? "error"
                    : "success"
            );


        element.textContent =
            message;


        document.body.appendChild(
            element
        );


        setTimeout(
            function () {

                element.remove();

            },
            2500
        );
    };


    /* ========================================================
       INITIALIZE
       ======================================================== */

    AR.init = function () {

        if (
            AR.state.initialized
        ) {
            return;
        }


        AR.loadLocal();

        AR.bindEvents();

        AR.render();


        AR.state.initialized =
            true;


        AR.dispatch(
            "riderx-accept-route-ready"
        );


        console.log(
            "RiderX accept-route.js loaded."
        );
    };


    /* ========================================================
       PUBLIC API
       ======================================================== */

    RX.acceptRideRoute =
        function (
            options
        ) {

            return AR.open(
                options
            );
        };


    RX.arrivedAtPickup =
        function () {

            return AR
                .arrivedAtPickup();
        };


    RX.startAcceptedRide =
        function (
            otp
        ) {

            return AR.startRide(
                otp
            );
        };


    RX.cancelAcceptedRide =
        function (
            reason
        ) {

            return AR.cancel(
                reason
            );
        };


    /* ========================================================
       AUTO INIT
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            AR.init
        );

    } else {

        AR.init();
    }

})();
