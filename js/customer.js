// ============================================================
// RiderX Customer Engine
// FINAL - Uber-style Customer Booking / Ride Tracking
// Firebase v10 Modular SDK
// ============================================================

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GLOBAL STATE
// ============================================================

const state = {

    map: null,

    pickupMarker: null,
    dropMarker: null,
    routeLayer: null,

    pickupCoords: null,
    dropCoords: null,

    pickupAddress: "",
    dropAddress: "",

    selectingMode: "pickup",

    selectedService: "bike",

    currentUser: null,

    currentRideId: null,

    rideUnsubscribe: null,

    fareSettings: null,

    distanceKm: 0,

    durationMinutes: 0,

    fare: 0,

    bookingInProgress: false,

    locationWatchId: null,

    riderMarker: null

};


// ============================================================
// DEFAULT FARE
// ============================================================

const DEFAULT_FARE = {

    bike: {
        baseFare: 30,
        dayRate: 8,
        extraRate: 9,
        nightRate: 11
    },

    cab: {
        baseFare: 50,
        dayRate: 12,
        extraRate: 14,
        nightRate: 16
    },

    parcel: {
        baseFare: 30,
        dayRate: 8,
        extraRate: 9,
        nightRate: 11
    },

    food: {
        baseFare: 25,
        dayRate: 8,
        extraRate: 9,
        nightRate: 11
    }

};


// ============================================================
// DOM HELPER
// ============================================================

const $ = (id) => document.getElementById(id);


// ============================================================
// STATUS
// ============================================================

function setStatus(message) {

    const status = $("status");

    if (status) {
        status.innerText = message;
    }


    const bookingStatus = $("bookingStatus");

    if (bookingStatus) {
        bookingStatus.innerText = message;
    }

}


// ============================================================
// AUTH
// ============================================================

auth.onAuthStateChanged((user) => {

    state.currentUser = user;


    const button = $("bookRide");


    if (!user) {

        setStatus("Please login first");

        if (button) {
            button.disabled = true;
        }

        return;

    }


    if (
        state.pickupCoords &&
        state.dropCoords
    ) {

        setStatus(
            "Pickup & destination selected"
        );

    } else {

        setStatus(
            "Select pickup location"
        );

    }


    updateBookButton();

});


// ============================================================
// MAP INIT
// ============================================================

function initMap() {

    const mapElement = $("map");

    if (!mapElement) {
        console.error(
            "RiderX: #map not found"
        );
        return;
    }


    if (state.map) {
        return;
    }


    if (
        typeof L === "undefined"
    ) {

        console.error(
            "Leaflet is not loaded."
        );

        setStatus(
            "Map failed to load"
        );

        return;

    }


    state.map =
        L.map(
            "map",
            {
                zoomControl: true
            }
        )
        .setView(
            [30.7333, 76.7794],
            13
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    )
    .addTo(state.map);


    state.map.on(
        "click",
        handleMapClick
    );


    setTimeout(
        () => {

            if (state.map) {
                state.map.invalidateSize();
            }

        },
        500
    );


    setStatus(
        "Select pickup location"
    );

}


// ============================================================
// MAP CLICK
// ============================================================

function handleMapClick(event) {

    if (!event || !event.latlng) {
        return;
    }


    const lat =
        Number(
            event.latlng.lat.toFixed(6)
        );


    const lng =
        Number(
            event.latlng.lng.toFixed(6)
        );


    if (
        state.selectingMode ===
        "pickup"
    ) {

        setPickup(
            lat,
            lng,
            `${lat}, ${lng}`
        );


        state.selectingMode =
            "drop";


        setStatus(
            "Now select destination"
        );


        return;

    }


    if (
        state.selectingMode ===
        "drop"
    ) {

        setDrop(
            lat,
            lng,
            `${lat}, ${lng}`
        );


        state.selectingMode =
            "pickup";


        setStatus(
            "Pickup & destination selected"
        );

    }

}


// ============================================================
// SET PICKUP
// ============================================================

function setPickup(
    lat,
    lng,
    address = ""
) {

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {
        return;
    }


    state.pickupCoords = {
        lat: Number(lat),
        lng: Number(lng)
    };


    state.pickupAddress =
        String(
            address ||
            `${lat}, ${lng}`
        );


    if (
        state.pickupMarker &&
        state.map
    ) {

        state.map.removeLayer(
            state.pickupMarker
        );

    }


    if (state.map) {

        state.pickupMarker =
            L.marker(
                [lat, lng]
            )
            .addTo(state.map)
            .bindPopup(
                "RiderX Pickup"
            );

    }


    const input =
        $("pickupLocation");


    if (input) {

        input.value =
            state.pickupAddress;

    }


    updateRide();

}


// ============================================================
// SET DROP
// ============================================================

function setDrop(
    lat,
    lng,
    address = ""
) {

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {
        return;
    }


    state.dropCoords = {
        lat: Number(lat),
        lng: Number(lng)
    };


    state.dropAddress =
        String(
            address ||
            `${lat}, ${lng}`
        );


    if (
        state.dropMarker &&
        state.map
    ) {

        state.map.removeLayer(
            state.dropMarker
        );

    }


    if (state.map) {

        state.dropMarker =
            L.marker(
                [lat, lng]
            )
            .addTo(state.map)
            .bindPopup(
                "RiderX Destination"
            );

    }


    const input =
        $("dropoffLocation");


    if (input) {

        input.value =
            state.dropAddress;

    }


    updateRide();

}


// ============================================================
// CURRENT LOCATION
// ============================================================

function useCurrentLocation() {

    if (
        !navigator.geolocation
    ) {

        setStatus(
            "Location is not supported"
        );

        return;

    }


    setStatus(
        "Getting your location..."
    );


    navigator.geolocation.getCurrentPosition(

        (position) => {

            const lat =
                Number(
                    position.coords.latitude
                );


            const lng =
                Number(
                    position.coords.longitude
                );


            if (state.map) {

                state.map.setView(
                    [lat, lng],
                    16
                );

            }


            setPickup(
                lat,
                lng,
                "Current location"
            );


            state.selectingMode =
                "drop";


            setStatus(
                "Now select destination"
            );

        },

        (error) => {

            console.error(
                "RiderX location error:",
                error
            );


            if (
                error.code ===
                1
            ) {

                setStatus(
                    "Location permission denied"
                );

            } else {

                setStatus(
                    "Unable to get your location"
                );

            }

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000
        }

    );

}


// ============================================================
// DISTANCE
// ============================================================

function calculateDistance(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R = 6371;


    const dLat =
        (
            lat2 -
            lat1
        ) *
        Math.PI /
        180;


    const dLng =
        (
            lng2 -
            lng1
        ) *
        Math.PI /
        180;


    const a =

        Math.sin(
            dLat / 2
        ) ** 2

        +

        Math.cos(
            lat1 *
            Math.PI /
            180
        )

        *

        Math.cos(
            lat2 *
            Math.PI /
            180
        )

        *

        Math.sin(
            dLng / 2
        ) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


// ============================================================
// LOAD FARE SETTINGS
// ============================================================

async function loadFareSettings() {

    try {

        const ref =
            doc(
                db,
                "settings",
                "fare"
            );


        const snap =
            await getDoc(ref);


        if (
            snap.exists()
        ) {

            state.fareSettings =
                snap.data();

            console.log(
                "RiderX fare settings:",
                state.fareSettings
            );

        } else {

            state.fareSettings =
                DEFAULT_FARE;

        }

    } catch (error) {

        console.error(
            "RiderX fare settings error:",
            error
        );


        state.fareSettings =
            DEFAULT_FARE;

    }

}


// ============================================================
// SERVICE FARE
// ============================================================

function getServiceFare() {

    const service =
        state.selectedService;


    const defaults =
        DEFAULT_FARE[
            service
        ] ||
        DEFAULT_FARE.bike;


    if (
        state.fareSettings &&
        state.fareSettings[service]
    ) {

        return {
            ...defaults,
            ...state.fareSettings[service]
        };

    }


    return defaults;

}


// ============================================================
// CALCULATE FARE
// ============================================================

function calculateFare() {

    if (
        !state.pickupCoords ||
        !state.dropCoords
    ) {

        state.distanceKm = 0;
        state.durationMinutes = 0;
        state.fare = 0;

        updateFareUI();

        return 0;

    }


    const distance =
        calculateDistance(

            state.pickupCoords.lat,
            state.pickupCoords.lng,

            state.dropCoords.lat,
            state.dropCoords.lng

        );


    state.distanceKm =
        Number(
            distance.toFixed(2)
        );


    /*
     * Approximate ETA.
     * Actual road ETA/navigation will be
     * handled by the routing/navigation layer.
     */

    state.durationMinutes =
        Math.max(
            1,
            Math.round(
                state.distanceKm * 3
            )
        );


    const fareSettings =
        getServiceFare();


    const hour =
        new Date().getHours();


    let rate;


    if (
        hour >= 22 ||
        hour < 6
    ) {

        rate =
            Number(
                fareSettings.nightRate ??
                11
            );

    } else {

        rate =
            Number(
                fareSettings.dayRate ??
                8
            );

    }


    const extraRate =
        Number(
            fareSettings.extraRate ??
            rate
        );


    const baseFare =
        Number(
            fareSettings.baseFare ??
            30
        );


    let total =
        baseFare;


    if (
        state.distanceKm <= 10
    ) {

        total +=
            state.distanceKm *
            rate;

    } else {

        total +=
            10 *
            rate;


        total +=
            (
                state.distanceKm -
                10
            ) *
            extraRate;

    }


    state.fare =
        Math.max(
            50,
            Math.round(total)
        );


    updateFareUI();


    return state.fare;

}


// ============================================================
// FARE UI
// ============================================================

function updateFareUI() {

    const fare =
        $("fare");


    if (fare) {

        fare.innerText =
            "₹" +
            state.fare;

    }


    const distance =
        $("estimated-distance-display");


    if (distance) {

        distance.innerText =
            state.distanceKm > 0

                ? `${state.distanceKm.toFixed(1)} KM`

                : "0 KM";

    }


    const info =
        $("fareInfo");


    if (info) {

        if (
            state.distanceKm > 0
        ) {

            info.innerText =
                `${state.selectedService.toUpperCase()} • ${state.distanceKm.toFixed(1)} km`;

        } else {

            info.innerText =
                "Select pickup & drop";

        }

    }

}


// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute() {

    if (
        !state.map ||
        !state.pickupCoords ||
        !state.dropCoords
    ) {

        return;

    }


    if (
        state.routeLayer
    ) {

        state.map.removeLayer(
            state.routeLayer
        );

    }


    /*
     * Temporary straight-line route.
     *
     * Later routing engine can replace this
     * with actual road navigation.
     */

    state.routeLayer =
        L.polyline(

            [

                [
                    state.pickupCoords.lat,
                    state.pickupCoords.lng
                ],

                [
                    state.dropCoords.lat,
                    state.dropCoords.lng
                ]

            ],

            {
                weight: 5
            }

        )
        .addTo(state.map);


    try {

        state.map.fitBounds(
            state.routeLayer.getBounds(),
            {
                padding: [
                    80,
                    120
                ]
            }
        );

    } catch (error) {

        console.warn(
            "RiderX map bounds error:",
            error
        );

    }

}


// ============================================================
// UPDATE RIDE
// ============================================================

function updateRide() {

    calculateFare();

    drawRoute();

    updateBookButton();

}


// ============================================================
// BOOK BUTTON
// ============================================================

function updateBookButton() {

    const button =
        $("bookRide");


    if (!button) {
        return;
    }


    if (
        state.bookingInProgress
    ) {

        button.disabled =
            true;

        return;

    }


    button.disabled =
        !state.currentUser ||
        !state.pickupCoords ||
        !state.dropCoords;

}


// ============================================================
// SERVICE SELECTOR
// ============================================================

function setupServices() {

    document
        .querySelectorAll(".service")
        .forEach(
            (service) => {

                service.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".service"
                            )
                            .forEach(
                                (item) => {

                                    item.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        service.classList.add(
                            "active"
                        );


                        state.selectedService =
                            String(
                                service.dataset.service ||
                                "bike"
                            )
                            .trim()
                            .toLowerCase();


                        calculateFare();

                    }
                );

            }
        );

}


// ============================================================
// PICKUP MAP BUTTON
// ============================================================

function setupPickupButton() {

    const button =
        $("pickupMapBtn");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            state.selectingMode =
                "pickup";


            setStatus(
                "Move map and select pickup"
            );

        }
    );

}


// ============================================================
// DROP MAP BUTTON
// ============================================================

function setupDropButton() {

    const button =
        $("dropMapBtn");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            state.selectingMode =
                "drop";


            setStatus(
                "Move map and select destination"
            );

        }
    );

}


// ============================================================
// LOCATION BUTTON
// ============================================================

function setupLocationButton() {

    const button =
        $("myLocation");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        useCurrentLocation
    );

}


// ============================================================
// INPUTS
// ============================================================

function setupInputs() {

    const pickup =
        $("pickupLocation");


    const drop =
        $("dropoffLocation");


    if (pickup) {

        pickup.addEventListener(
            "focus",
            () => {

                state.selectingMode =
                    "pickup";


                setStatus(
                    "Select pickup on map"
                );

            }
        );

    }


    if (drop) {

        drop.addEventListener(
            "focus",
            () => {

                state.selectingMode =
                    "drop";


                setStatus(
                    "Select destination on map"
                );

            }
        );

    }

}


// ============================================================
// RIDE REQUEST SOUND
// ============================================================

function playRideSound() {

    try {

        const audio =
            new Audio(
                "../assets/sounds/ride-request.mp3"
            );


        audio.volume =
            0.8;


        audio.play()
            .catch(
                () => {
                    /*
                     * Browser may block autoplay.
                     */
                }
            );

    } catch (error) {

        console.warn(
            "RiderX sound error:",
            error
        );

    }

}


// ============================================================
// BOOK RIDE
// ============================================================

async function bookRide() {

    if (
        state.bookingInProgress
    ) {

        return;

    }


    if (
        !state.currentUser
    ) {

        window.location.href =
            "../auth/login.html?role=customer";


        return;

    }


    if (
        !state.pickupCoords ||
        !state.dropCoords
    ) {

        setStatus(
            "Please select pickup & destination"
        );

        return;

    }


    const button =
        $("bookRide");


    state.bookingInProgress =
        true;


    if (button) {

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding Rider...';

    }


    try {

        const fare =
            calculateFare();


        const pickupAddress =
            $("pickupLocation")?.value ||
            state.pickupAddress ||
            "Pickup location";


        const dropAddress =
            $("dropoffLocation")?.value ||
            state.dropAddress ||
            "Destination";


        const paymentMethod =
            $("paymentMethod")?.value ||
            "cash";


        const timestamp =
            serverTimestamp();


        const rideData = {

            customerId:
                state.currentUser.uid,


            customerName:
                state.currentUser.displayName ||
                state.currentUser.email ||
                "RiderX Customer",


            serviceType:
                state.selectedService,


            service:
                state.selectedService,


            pickup: {

                lat:
                    state.pickupCoords.lat,

                lng:
                    state.pickupCoords.lng,

                address:
                    pickupAddress,

                name:
                    pickupAddress

            },


            drop: {

                lat:
                    state.dropCoords.lat,

                lng:
                    state.dropCoords.lng,

                address:
                    dropAddress,

                name:
                    dropAddress

            },


            distance:
                Number(
                    state.distanceKm.toFixed(2)
                ),


            duration:
                Number(
                    state.durationMinutes
                ),


            fare:
                Number(fare),


            paymentMethod:
                String(
                    paymentMethod
                )
                .trim()
                .toLowerCase(),


            status:
                "REQUESTED",


            riderId:
                null,


            driverId:
                null,


            createdAt:
                timestamp,


            requestedAt:
                timestamp

        };


        const rideRef =
            await addDoc(

                collection(
                    db,
                    "rides"
                ),

                rideData

            );


        state.currentRideId =
            rideRef.id;


        window.RiderXCurrentRideId =
            rideRef.id;


        console.log(
            "RiderX ride created:",
            rideRef.id
        );


        setStatus(
            "Searching nearby RiderX riders..."
        );


        playRideSound();


        startRideListener(
            rideRef.id
        );


        window.dispatchEvent(

            new CustomEvent(
                "riderx:ride-created",
                {
                    detail: {

                        rideId:
                            rideRef.id,

                        ride:
                            rideData

                    }
                }
            )

        );


    } catch (error) {

        console.error(
            "RiderX booking error:",
            error
        );


        state.bookingInProgress =
            false;


        if (
            error.code ===
            "permission-denied"
        ) {

            setStatus(
                "Booking permission denied. Check Firestore Rules."
            );

        } else {

            setStatus(
                "Ride booking failed. Please try again."
            );

        }


        if (button) {

            button.disabled =
                false;


            button.innerHTML =
                '<i class="fa-solid fa-paper-plane"></i> Book Ride';

        }

    }

}


// ============================================================
// RIDE STATUS LISTENER
// ============================================================

function startRideListener(
    rideId
) {

    if (
        typeof state.rideUnsubscribe ===
        "function"
    ) {

        state.rideUnsubscribe();

        state.rideUnsubscribe =
            null;

    }


    const rideRef =
        doc(
            db,
            "rides",
            rideId
        );


    state.rideUnsubscribe =
        onSnapshot(

            rideRef,

            (snapshot) => {

                if (
                    !snapshot.exists()
                ) {

                    setStatus(
                        "Ride request no longer exists"
                    );

                    return;

                }


                const ride =
                    snapshot.data();


                const status =
                    String(
                        ride.status ||
                        "REQUESTED"
                    )
                    .trim()
                    .toUpperCase();


                console.log(
                    "RiderX ride status:",
                    status
                );


                window.dispatchEvent(

                    new CustomEvent(
                        "riderx:ride-status",
                        {
                            detail: {

                                rideId:
                                    rideId,

                                ride:
                                    ride,

                                status:
                                    status

                            }
                        }
                    )

                );


                // --------------------------------------------
                // REQUESTED
                // --------------------------------------------

                if (
                    status ===
                    "REQUESTED"
                ) {

                    setStatus(
                        "Searching nearby RiderX riders..."
                    );

                }


                // --------------------------------------------
                // ACCEPTED
                // --------------------------------------------

                else if (
                    status ===
                    "ACCEPTED"
                ) {

                    setStatus(
                        "Rider accepted your ride"
                    );


                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-accepted",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    ride:
                                        ride

                                }
                            }
                        )

                    );

                }


                // --------------------------------------------
                // ARRIVING
                // --------------------------------------------

                else if (
                    status ===
                    "ARRIVING"
                ) {

                    setStatus(
                        "Your RiderX rider is arriving"
                    );


                    updateRiderLocation(
                        ride
                    );

                }


                // --------------------------------------------
                // STARTED
                // --------------------------------------------

                else if (
                    status ===
                    "STARTED"
                ) {

                    setStatus(
                        "Ride started"
                    );


                    updateRiderLocation(
                        ride
                    );

                }


                // --------------------------------------------
                // COMPLETED
                // --------------------------------------------

                else if (
                    status ===
                    "COMPLETED"
                ) {

                    setStatus(
                        "Ride completed"
                    );


                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-completed",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    ride:
                                        ride

                                }
                            }
                        )

                    );

                }


                // --------------------------------------------
                // CANCELLED
                // --------------------------------------------

                else if (
                    status ===
                    "CANCELLED"
                ) {

                    setStatus(
                        "Ride cancelled"
                    );


                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-cancelled",
                            {
                                detail: {

                                    rideId:
                                        rideId,

                                    ride:
                                        ride

                                }
                            }
                        )

                    );

                }

            },

            (error) => {

                console.error(
                    "RiderX ride listener error:",
                    error
                );


                setStatus(
                    "Unable to track ride"
                );

            }

        );

}


// ============================================================
// RIDER LIVE LOCATION
// ============================================================

function updateRiderLocation(
    ride
) {

    if (
        !state.map
    ) {
        return;
    }


    const location =
        ride.riderLocation ||
        ride.driverLocation ||
        null;


    if (
        !location ||
        !Number.isFinite(
            Number(location.lat)
        ) ||
        !Number.isFinite(
            Number(location.lng)
        )
    ) {

        return;

    }


    const lat =
        Number(
            location.lat
        );


    const lng =
        Number(
            location.lng
        );


    if (
        state.riderMarker
    ) {

        state.riderMarker.setLatLng(
            [lat, lng]
        );

        return;

    }


    state.riderMarker =
        L.marker(
            [lat, lng]
        )
        .addTo(state.map)
        .bindPopup(
            "RiderX Rider"
        );

}


// ============================================================
// CANCEL RIDE
// ============================================================

async function cancelRide() {

    if (
        !state.currentRideId
    ) {

        return;

    }


    if (
        !state.currentUser
    ) {

        return;

    }


    try {

        await updateDoc(

            doc(
                db,
                "rides",
                state.currentRideId
            ),

            {

                status:
                    "CANCELLED",

                cancelledBy:
                    "customer",

                cancelledAt:
                    serverTimestamp()

            }

        );


        setStatus(
            "Ride cancelled"
        );


    } catch (error) {

        console.error(
            "RiderX cancel error:",
            error
        );


        setStatus(
            "Unable to cancel ride"
        );

    }

}


// ============================================================
// RESET BOOKING
// ============================================================

function resetBooking() {

    if (
        typeof state.rideUnsubscribe ===
        "function"
    ) {

        state.rideUnsubscribe();

    }


    state.rideUnsubscribe =
        null;


    if (
        state.locationWatchId !==
        null
    ) {

        navigator.geolocation.clearWatch(
            state.locationWatchId
        );

        state.locationWatchId =
            null;

    }


    if (
        state.pickupMarker &&
        state.map
    ) {

        state.map.removeLayer(
            state.pickupMarker
        );

    }


    if (
        state.dropMarker &&
        state.map
    ) {

        state.map.removeLayer(
            state.dropMarker
        );

    }


    if (
        state.routeLayer &&
        state.map
    ) {

        state.map.removeLayer(
            state.routeLayer
        );

    }


    if (
        state.riderMarker &&
        state.map
    ) {

        state.map.removeLayer(
            state.riderMarker
        );

    }


    state.pickupMarker =
        null;

    state.dropMarker =
        null;

    state.routeLayer =
        null;

    state.riderMarker =
        null;

    state.pickupCoords =
        null;

    state.dropCoords =
        null;

    state.pickupAddress =
        "";

    state.dropAddress =
        "";

    state.distanceKm =
        0;

    state.durationMinutes =
        0;

    state.fare =
        0;

    state.currentRideId =
        null;

    state.bookingInProgress =
        false;

    state.selectingMode =
        "pickup";


    const pickup =
        $("pickupLocation");


    const drop =
        $("dropoffLocation");


    if (pickup) {
        pickup.value = "";
    }


    if (drop) {
        drop.value = "";
    }


    updateFareUI();

    updateBookButton();


    setStatus(
        "Select pickup location"
    );

}


// ============================================================
// GET CURRENT RIDE
// ============================================================

async function getCurrentRide() {

    if (
        !state.currentRideId
    ) {

        return null;

    }


    try {

        const snapshot =
            await getDoc(

                doc(
                    db,
                    "rides",
                    state.currentRideId
                )

            );


        if (
            !snapshot.exists()
        ) {

            return null;

        }


        return {

            id:
                snapshot.id,

            ...snapshot.data()

        };

    } catch (error) {

        console.error(
            "RiderX get ride error:",
            error
        );


        return null;

    }

}


// ============================================================
// GLOBAL API
// ============================================================

window.RiderXCustomer = {

    init,

    setPickup,

    setDrop,

    calculateFare,

    bookRide,

    cancelRide,

    reset:
        resetBooking,

    getCurrentRide,

    getRideId:
        () =>
            state.currentRideId,

    getState:
        () => ({
            ...state
        })

};


// ============================================================
// INIT
// ============================================================

async function init() {

    console.log(
        "RiderX Customer Engine Started"
    );


    initMap();

    setupServices();

    setupPickupButton();

    setupDropButton();

    setupLocationButton();

    setupInputs();


    await loadFareSettings();


    calculateFare();

    updateBookButton();

}


// ============================================================
// DOM READY
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

} else {

    init();

}


// ============================================================
// BOOK BUTTON
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const button =
            $("bookRide");


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            bookRide
        );

    },
    {
        once: true
    }
);
