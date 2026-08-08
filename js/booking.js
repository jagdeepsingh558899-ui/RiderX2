/* ============================================================
   RIDERX 2.0
   BOOKING ENGINE
   File: js/booking.js

   Handles:
   - Pickup / destination
   - Service selection
   - Fare calculation
   - Ride creation
   - Rider matching
   - Ride status
   - Cancellation
   - Realtime ride updates
   - Customer ↔ Rider ride flow
   ============================================================ */

(function () {
    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.booking = RX.booking || {};

    const BOOKING = RX.booking;


    /* ========================================================
       CONFIG
       ======================================================== */

    BOOKING.config = {

        city: "Chandigarh",

        services: {

            bike: {
                id: "bike",
                name: "Bike Taxi",
                icon: "🏍️",
                baseFare: 30,
                perKmDay: 8,
                perKmLong: 9,
                perKmNight: 11,
                longDistanceKm: 10,
                minFare: 30
            },

            cab: {
                id: "cab",
                name: "Cab",
                icon: "🚕",
                baseFare: 60,
                perKmDay: 12,
                perKmLong: 14,
                perKmNight: 16,
                longDistanceKm: 10,
                minFare: 60
            },

            parcel: {
                id: "parcel",
                name: "Parcel",
                icon: "📦",
                baseFare: 40,
                perKmDay: 10,
                perKmLong: 11,
                perKmNight: 13,
                longDistanceKm: 10,
                minFare: 40
            },

            food: {
                id: "food",
                name: "Food Delivery",
                icon: "🍔",
                baseFare: 35,
                perKmDay: 9,
                perKmLong: 10,
                perKmNight: 12,
                longDistanceKm: 10,
                minFare: 35
            }
        },

        bookingTimeout: 120,

        statuses: {
            requested: "requested",
            searching: "searching",
            accepted: "accepted",
            arriving: "arriving",
            arrived: "arrived",
            started: "started",
            completed: "completed",
            cancelled: "cancelled"
        }
    };


    /* ========================================================
       STATE
       ======================================================== */

    BOOKING.state = {

        service: "bike",

        pickup: {
            lat: null,
            lng: null,
            address: ""
        },

        destination: {
            lat: null,
            lng: null,
            address: ""
        },

        distanceKm: 0,

        durationMin: 0,

        fare: 0,

        paymentMethod: "cash",

        status: null,

        currentRideId: null,

        currentRide: null,

        matching: false,

        submitting: false,

        rideListener: null,

        requestTimer: null
    };


    /* ========================================================
       FIRESTORE
       ======================================================== */

    BOOKING.db = function () {

        if (
            RX.firebase &&
            RX.firebase.db
        ) {

            return RX.firebase.db;
        }

        return null;
    };


    /* ========================================================
       SERVICE
       ======================================================== */

    BOOKING.setService = function (
        service
    ) {

        service =
            String(
                service || "bike"
            ).toLowerCase();

        if (
            !BOOKING.config.services[service]
        ) {

            service = "bike";
        }

        BOOKING.state.service =
            service;

        BOOKING.calculateFare();

        BOOKING.renderService();

        window.dispatchEvent(
            new CustomEvent(
                "riderx-service-changed",
                {
                    detail: {
                        service:
                            service
                    }
                }
            )
        );
    };


    BOOKING.getService = function () {

        return BOOKING
            .config
            .services[
                BOOKING.state.service
            ];
    };


    BOOKING.renderService = function () {

        const service =
            BOOKING.getService();

        document
            .querySelectorAll(
                "[data-selected-service]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        service.name;
                }
            );

        document
            .querySelectorAll(
                "[data-service-icon]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        service.icon;
                }
            );

        document
            .querySelectorAll(
                "[data-service-price]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.formatCurrency(
                            BOOKING.state.fare
                        );
                }
            );
    };


    /* ========================================================
       PICKUP
       ======================================================== */

    BOOKING.setPickup = function (
        latitude,
        longitude,
        address
    ) {

        BOOKING.state.pickup = {

            lat:
                Number(latitude),

            lng:
                Number(longitude),

            address:
                address || ""
        };

        document
            .querySelectorAll(
                "[data-pickup-address]"
            )
            .forEach(
                function (element) {

                    element.value =
                        BOOKING.state
                            .pickup
                            .address;

                    element.textContent =
                        BOOKING.state
                            .pickup
                            .address;
                }
            );

        BOOKING.calculateFare();

        window.dispatchEvent(
            new CustomEvent(
                "riderx-pickup-changed",
                {
                    detail:
                        BOOKING.state.pickup
                }
            )
        );
    };


    /* ========================================================
       DESTINATION
       ======================================================== */

    BOOKING.setDestination = function (
        latitude,
        longitude,
        address
    ) {

        BOOKING.state.destination = {

            lat:
                Number(latitude),

            lng:
                Number(longitude),

            address:
                address || ""
        };

        document
            .querySelectorAll(
                "[data-destination-address]"
            )
            .forEach(
                function (element) {

                    element.value =
                        BOOKING.state
                            .destination
                            .address;

                    element.textContent =
                        BOOKING.state
                            .destination
                            .address;
                }
            );

        BOOKING.calculateFare();

        window.dispatchEvent(
            new CustomEvent(
                "riderx-destination-changed",
                {
                    detail:
                        BOOKING.state.destination
                }
            )
        );
    };


    /* ========================================================
       PAYMENT METHOD
       ======================================================== */

    BOOKING.setPaymentMethod = function (
        method
    ) {

        method =
            String(
                method || "cash"
            ).toLowerCase();

        const allowed = [
            "cash",
            "online",
            "wallet"
        ];

        if (
            !allowed.includes(method)
        ) {

            method = "cash";
        }

        BOOKING.state.paymentMethod =
            method;

        document
            .querySelectorAll(
                "[data-payment-method]"
            )
            .forEach(
                function (element) {

                    element.classList.toggle(
                        "active",
                        element.dataset
                            .paymentMethod ===
                        method
                    );
                }
            );

        window.dispatchEvent(
            new CustomEvent(
                "riderx-payment-changed",
                {
                    detail: {
                        method:
                            method
                    }
                }
            )
        );
    };


    /* ========================================================
       DISTANCE
       ======================================================== */

    BOOKING.setDistance = function (
        distanceKm
    ) {

        BOOKING.state.distanceKm =
            Math.max(
                0,
                Number(distanceKm) || 0
            );

        BOOKING.calculateFare();
    };


    /* ========================================================
       DURATION
       ======================================================== */

    BOOKING.setDuration = function (
        minutes
    ) {

        BOOKING.state.durationMin =
            Math.max(
                0,
                Number(minutes) || 0
            );

        document
            .querySelectorAll(
                "[data-trip-duration]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        Math.round(
                            BOOKING.state
                                .durationMin
                        ) +
                        " min";
                }
            );
    };


    /* ========================================================
       DAY / NIGHT RATE
       ======================================================== */

    BOOKING.getRatePerKm = function (
        service,
        distanceKm,
        date
    ) {

        const now =
            date || new Date();

        const hour =
            now.getHours();

        if (
            hour >= 22 ||
            hour < 6
        ) {

            return service.perKmNight;
        }

        if (
            distanceKm > service.longDistanceKm
        ) {

            return service.perKmLong;
        }

        return service.perKmDay;
    };


    /* ========================================================
       FARE CALCULATION
       ======================================================== */

    BOOKING.calculateFare = function () {

        const service =
            BOOKING.getService();

        const distance =
            Number(
                BOOKING.state.distanceKm
            ) || 0;

        const rate =
            BOOKING.getRatePerKm(
                service,
                distance
            );

        let fare =
            service.baseFare +
            (
                distance *
                rate
            );

        fare =
            Math.max(
                fare,
                service.minFare
            );

        fare =
            Math.round(
                fare
            );

        BOOKING.state.fare =
            fare;

        BOOKING.renderFare();

        return fare;
    };


    /* ========================================================
       FARE BREAKDOWN
       ======================================================== */

    BOOKING.getFareBreakdown = function () {

        const service =
            BOOKING.getService();

        const distance =
            BOOKING.state.distanceKm;

        const rate =
            BOOKING.getRatePerKm(
                service,
                distance
            );

        const base =
            Number(
                service.baseFare
            );

        const distanceFare =
            distance * rate;

        const subtotal =
            base + distanceFare;

        const total =
            Math.max(
                subtotal,
                service.minFare
            );

        return {

            baseFare:
                base,

            distanceKm:
                distance,

            ratePerKm:
                rate,

            distanceFare:
                Math.round(
                    distanceFare
                ),

            subtotal:
                Math.round(
                    subtotal
                ),

            total:
                Math.round(
                    total
                )
        };
    };


    /* ========================================================
       RENDER FARE
       ======================================================== */

    BOOKING.renderFare = function () {

        const fare =
            BOOKING.state.fare;

        document
            .querySelectorAll(
                "[data-fare]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.formatCurrency(
                            fare
                        );
                }
            );

        document
            .querySelectorAll(
                "[data-total-fare]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.formatCurrency(
                            fare
                        );
                }
            );

        document
            .querySelectorAll(
                "[data-fare-base]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.formatCurrency(
                            BOOKING
                                .getFareBreakdown()
                                .baseFare
                        );
                }
            );

        document
            .querySelectorAll(
                "[data-fare-distance]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.formatCurrency(
                            BOOKING
                                .getFareBreakdown()
                                .distanceFare
                        );
                }
            );

        document
            .querySelectorAll(
                "[data-distance]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        BOOKING.state
                            .distanceKm
                            .toFixed(1) +
                        " km";
                }
            );
    };


    /* ========================================================
       VALIDATE BOOKING
       ======================================================== */

    BOOKING.validate = function () {

        if (
            !RX.isLoggedIn()
        ) {

            RX.showToast(
                "Login required",
                "Please login before booking a ride.",
                "warning"
            );

            RX.redirectToLogin();

            return false;
        }


        if (
            !BOOKING.state.pickup.lat ||
            !BOOKING.state.pickup.lng
        ) {

            RX.showToast(
                "Pickup missing",
                "Please select your pickup location.",
                "warning"
            );

            return false;
        }


        if (
            !BOOKING.state.destination.lat ||
            !BOOKING.state.destination.lng
        ) {

            RX.showToast(
                "Destination missing",
                "Please select your destination.",
                "warning"
            );

            return false;
        }


        if (
            BOOKING.state.distanceKm <= 0
        ) {

            RX.showToast(
                "Route missing",
                "Please select a valid route.",
                "warning"
            );

            return false;
        }


        if (
            !BOOKING.state.service
        ) {

            RX.showToast(
                "Service missing",
                "Please select a ride type.",
                "warning"
            );

            return false;
        }

        return true;
    };


    /* ========================================================
       BUILD RIDE DATA
       ======================================================== */

    BOOKING.buildRideData = function () {

        const user =
            RX.getCurrentUser();

        const profile =
            RX.getCurrentProfile();

        const service =
            BOOKING.getService();

        const rideId =
            RX.generateRideId();

        const pickup =
            BOOKING.state.pickup;

        const destination =
            BOOKING.state.destination;

        return {

            rideId:

                rideId,

            customerId:

                user
                    ? user.uid
                    : null,

            customerName:

                RX.getUserName(),

            customerPhone:

                RX.getUserPhone(),

            service:

                service.id,

            serviceName:

                service.name,

            paymentMethod:

                BOOKING.state
                    .paymentMethod,

            pickup: {

                lat:
                    pickup.lat,

                lng:
                    pickup.lng,

                address:
                    pickup.address
            },

            pickupLat:

                pickup.lat,

            pickupLng:

                pickup.lng,

            pickupAddress:

                pickup.address,

            destination: {

                lat:
                    destination.lat,

                lng:
                    destination.lng,

                address:
                    destination.address
            },

            destinationLat:

                destination.lat,

            destinationLng:

                destination.lng,

            destinationAddress:

                destination.address,

            distanceKm:

                Number(
                    BOOKING.state
                        .distanceKm
                ),

            durationMin:

                Number(
                    BOOKING.state
                        .durationMin
                ),

            fare:

                Number(
                    BOOKING.state.fare
                ),

            status:

                BOOKING.config
                    .statuses
                    .requested,

            riderId:

                null,

            riderName:

                null,

            riderPhone:

                null,

            riderPhoto:

                null,

            vehicleNumber:

                null,

            vehicleType:

                null,

            otp:

                BOOKING.generateRideOtp(),

            createdAt:

                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            updatedAt:

                firebase.firestore
                    .FieldValue
                    .serverTimestamp()
        };
    };


    /* ========================================================
       RIDE OTP
       ======================================================== */

    BOOKING.generateRideOtp = function () {

        return String(
            Math.floor(
                1000 +
                Math.random() *
                9000
            )
        );
    };


    /* ========================================================
       CREATE RIDE
       ======================================================== */

    BOOKING.createRide = async function () {

        if (
            BOOKING.state.submitting
        ) {

            return null;
        }

        if (
            !BOOKING.validate()
        ) {

            return null;
        }

        const db =
            BOOKING.db();

        if (!db) {

            RX.showToast(
                "Firebase unavailable",
                "Please try again.",
                "danger"
            );

            return null;
        }

        BOOKING.state.submitting =
            true;

        BOOKING.setStatus(
            "requested"
        );

        try {

            const ride =
                BOOKING.buildRideData();

            const docRef =
                await db
                    .collection("rides")
                    .add(ride);

            BOOKING.state.currentRideId =
                docRef.id;

            BOOKING.state.currentRide =
                {
                    id:
                        docRef.id,
                    ...ride
                };

            BOOKING.state.matching =
                true;

            BOOKING.setStatus(
                "searching"
            );

            BOOKING.listenToRide(
                docRef.id
            );

            BOOKING.startMatchingTimer();

            BOOKING.notifyRiders(
                docRef.id,
                ride
            );

            RX.showToast(
                "Finding a rider",
                "Searching for nearby RiderX partners.",
                "success"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-created",
                    {
                        detail:
                            BOOKING.state
                                .currentRide
                    }
                )
            );

            return docRef.id;

        } catch (error) {

            console.error(
                "Ride creation failed:",
                error
            );

            RX.showToast(
                "Booking failed",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return null;

        } finally {

            BOOKING.state.submitting =
                false;
        }
    };


    /* ========================================================
       NOTIFY RIDERS
       ======================================================== */

    BOOKING.notifyRiders = async function (
        rideId,
        ride
    ) {

        const db =
            BOOKING.db();

        if (!db) {
            return;
        }

        try {

            await db
                .collection(
                    "rideRequests"
                )
                .doc(rideId)
                .set({

                    rideId:
                        rideId,

                    customerId:
                        ride.customerId,

                    customerName:
                        ride.customerName,

                    service:
                        ride.service,

                    pickup:
                        ride.pickup,

                    destination:
                        ride.destination,

                    pickupAddress:
                        ride.pickupAddress,

                    destinationAddress:
                        ride.destinationAddress,

                    distanceKm:
                        ride.distanceKm,

                    durationMin:
                        ride.durationMin,

                    fare:
                        ride.fare,

                    status:
                        "searching",

                    createdAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

        } catch (error) {

            console.warn(
                "Rider notification creation failed:",
                error
            );
        }
    };


    /* ========================================================
       LISTEN TO RIDE
       ======================================================== */

    BOOKING.listenToRide = function (
        rideId
    ) {

        const db =
            BOOKING.db();

        if (
            !db ||
            !rideId
        ) {
            return null;
        }

        BOOKING.stopRideListener();

        BOOKING.state.rideListener =
            db
                .collection("rides")
                .doc(rideId)
                .onSnapshot(
                    function (doc) {

                        if (
                            !doc.exists
                        ) {

                            return;
                        }

                        const ride =
                            {
                                id:
                                    doc.id,
                                ...doc.data()
                            };

                        BOOKING.state.currentRide =
                            ride;

                        BOOKING.state.status =
                            ride.status ||
                            null;

                        BOOKING.renderRide(
                            ride
                        );

                        window.dispatchEvent(
                            new CustomEvent(
                                "riderx-ride-updated",
                                {
                                    detail:
                                        ride
                                }
                            )
                        );

                        if (
                            [
                                "accepted",
                                "arriving",
                                "arrived",
                                "started"
                            ].includes(
                                ride.status
                            )
                        ) {

                            BOOKING.state.matching =
                                false;

                            BOOKING.stopMatchingTimer();
                        }

                        if (
                            [
                                "completed",
                                "cancelled"
                            ].includes(
                                ride.status
                            )
                        ) {

                            BOOKING.state.matching =
                                false;

                            BOOKING.stopMatchingTimer();
                        }
                    },

                    function (error) {

                        console.error(
                            "Ride listener failed:",
                            error
                        );
                    }
                );

        return BOOKING.state
            .rideListener;
    };


    /* ========================================================
       STOP RIDE LISTENER
       ======================================================== */

    BOOKING.stopRideListener = function () {

        if (
            typeof BOOKING.state
                .rideListener ===
            "function"
        ) {

            BOOKING.state
                .rideListener();

            BOOKING.state
                .rideListener =
                null;
        }
    };


    /* ========================================================
       SET STATUS
       ======================================================== */

    BOOKING.setStatus = function (
        status
    ) {

        BOOKING.state.status =
            status;

        document
            .querySelectorAll(
                "[data-ride-status]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        BOOKING.getStatusLabel(
                            status
                        );
                }
            );

        document
            .querySelectorAll(
                "[data-ride-status-code]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        status || "";
                }
            );

        document.body.dataset.rideStatus =
            status || "";

        window.dispatchEvent(
            new CustomEvent(
                "riderx-status-changed",
                {
                    detail: {
                        status:
                            status
                    }
                }
            )
        );
    };


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    BOOKING.getStatusLabel = function (
        status
    ) {

        const labels = {

            requested:
                "Ride requested",

            searching:
                "Finding a rider",

            accepted:
                "Rider accepted",

            arriving:
                "Rider is arriving",

            arrived:
                "Rider has arrived",

            started:
                "Ride started",

            ongoing:
                "Ride in progress",

            completed:
                "Ride completed",

            cancelled:
                "Ride cancelled"
        };

        return (
            labels[status] ||
            "Ride"
        );
    };


    /* ========================================================
       RENDER RIDE
       ======================================================== */

    BOOKING.renderRide = function (
        ride
    ) {

        if (!ride) {
            return;
        }

        BOOKING.setStatus(
            ride.status
        );


        document
            .querySelectorAll(
                "[data-ride-id]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        ride.rideId ||
                        ride.id ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-name]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        ride.riderName ||
                        "Finding rider...";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-phone]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        ride.riderPhone ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-rider-vehicle]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        ride.vehicleNumber ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-ride-otp]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        ride.otp ||
                        "";
                }
            );


        document
            .querySelectorAll(
                "[data-ride-fare]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        RX.formatCurrency(
                            ride.fare ||
                            0
                        );
                }
            );


        if (
            ride.riderPhoto
        ) {

            document
                .querySelectorAll(
                    "[data-rider-photo]"
                )
                .forEach(
                    function (element) {

                        element.src =
                            ride.riderPhoto;

                        element.style.display =
                            "block";
                    }
                );
        }
    };


    /* ========================================================
       MATCHING TIMER
       ======================================================== */

    BOOKING.startMatchingTimer = function () {

        BOOKING.stopMatchingTimer();

        let remaining =
            BOOKING.config
                .bookingTimeout;

        document
            .querySelectorAll(
                "[data-matching-timer]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        remaining + "s";
                }
            );

        BOOKING.state.requestTimer =
            setInterval(
                function () {

                    remaining--;

                    document
                        .querySelectorAll(
                            "[data-matching-timer]"
                        )
                        .forEach(
                            function (element) {

                                element.textContent =
                                    remaining + "s";
                            }
                        );

                    if (
                        remaining <= 0
                    ) {

                        BOOKING.stopMatchingTimer();

                        if (
                            BOOKING.state
                                .matching
                        ) {

                            BOOKING.cancelRide(
                                "No rider available"
                            );
                        }
                    }

                },
                1000
            );
    };


    /* ========================================================
       STOP MATCHING TIMER
       ======================================================== */

    BOOKING.stopMatchingTimer = function () {

        if (
            BOOKING.state.requestTimer
        ) {

            clearInterval(
                BOOKING.state
                    .requestTimer
            );

            BOOKING.state.requestTimer =
                null;
        }
    };


    /* ========================================================
       CANCEL RIDE
       ======================================================== */

    BOOKING.cancelRide = async function (
        reason
    ) {

        const rideId =
            BOOKING.state.currentRideId;

        const db =
            BOOKING.db();

        if (
            !rideId ||
            !db
        ) {

            return false;
        }

        const confirmed =
            window.confirm(
                reason ||
                "Do you want to cancel this ride?"
            );

        if (!confirmed) {
            return false;
        }

        try {

            await db
                .collection("rides")
                .doc(rideId)
                .update({

                    status:
                        "cancelled",

                    cancellationReason:
                        reason ||
                        "Cancelled by customer",

                    cancelledBy:
                        "customer",

                    cancelledAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

            await BOOKING.closeRideRequest(
                rideId
            );

            BOOKING.stopMatchingTimer();

            BOOKING.state.matching =
                false;

            RX.showToast(
                "Ride cancelled",
                "Your ride has been cancelled.",
                "success"
            );

            return true;

        } catch (error) {

            console.error(
                error
            );

            RX.showToast(
                "Cancellation failed",
                RX.firebaseErrorMessage(error),
                "danger"
            );

            return false;
        }
    };


    /* ========================================================
       CLOSE RIDE REQUEST
       ======================================================== */

    BOOKING.closeRideRequest = async function (
        rideId
    ) {

        const db =
            BOOKING.db();

        if (
            !db ||
            !rideId
        ) {
            return;
        }

        try {

            await db
                .collection(
                    "rideRequests"
                )
                .doc(rideId)
                .update({

                    status:
                        "closed",

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                });

        } catch (error) {

            console.warn(
                "Ride request close failed:",
                error
            );
        }
    };


    /* ========================================================
       GET CURRENT RIDE
       ======================================================== */

    BOOKING.getCurrentRide = function () {

        return BOOKING.state.currentRide;
    };


    BOOKING.getCurrentRideId = function () {

        return BOOKING.state.currentRideId;
    };


    /* ========================================================
       LOAD CURRENT CUSTOMER RIDE
       ======================================================== */

    BOOKING.loadCurrentRide = async function () {

        if (
            !RX.isLoggedIn()
        ) {
            return null;
        }

        const db =
            BOOKING.db();

        if (!db) {
            return null;
        }

        try {

            const snapshot =
                await db
                    .collection("rides")
                    .where(
                        "customerId",
                        "==",
                        RX.getCurrentUser().uid
                    )
                    .where(
                        "status",
                        "in",
                        [
                            "requested",
                            "searching",
                            "accepted",
                            "arriving",
                            "arrived",
                            "started",
                            "ongoing"
                        ]
                    )
                    .limit(1)
                    .get();

            if (
                snapshot.empty
            ) {

                return null;
            }

            const doc =
                snapshot.docs[0];

            const ride =
                {
                    id:
                        doc.id,
                    ...doc.data()
                };

            BOOKING.state.currentRide =
                ride;

            BOOKING.state.currentRideId =
                doc.id;

            BOOKING.listenToRide(
                doc.id
            );

            return ride;

        } catch (error) {

            console.warn(
                "Current ride loading failed:",
                error
            );

            return null;
        }
    };


    /* ========================================================
       INIT
       ======================================================== */

    BOOKING.init = function () {

        BOOKING.renderService();

        BOOKING.renderFare();

        BOOKING.setPaymentMethod(
            BOOKING.state.paymentMethod
        );

        document
            .querySelectorAll(
                "[data-service]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset.rxBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            BOOKING.setService(
                                button.dataset
                                    .service
                            );
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-payment]"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset.rxBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            BOOKING.setPaymentMethod(
                                button.dataset
                                    .payment
                            );
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-action='book-ride']"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset.rxBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function (event) {

                            event.preventDefault();

                            BOOKING.createRide();
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-action='cancel-ride']"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset.rxBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset.rxBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function (event) {

                            event.preventDefault();

                            BOOKING.cancelRide(
                                "Cancelled by customer"
                            );
                        }
                    );
                }
            );


        BOOKING.loadCurrentRide();

        console.log(
            "RiderX Booking Engine loaded."
        );
    };


    /* ========================================================
       CLEANUP
       ======================================================== */

    window.addEventListener(
        "beforeunload",
        function () {

            BOOKING.stopRideListener();

            BOOKING.stopMatchingTimer();
        }
    );


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            BOOKING.init
        );

    } else {

        BOOKING.init();
    }

})();
