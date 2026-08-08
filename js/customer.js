// ============================================================
// RiderX Customer Engine
// FINAL CUSTOMER BOOKING ENGINE
// Firebase v10 Modular SDK
// ============================================================

import {
    auth,
    db,
    onAuthStateChanged
} from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// GLOBAL STATE
// ============================================================

let map = null;

let pickupMarker = null;
let dropMarker = null;
let routeLayer = null;

let pickupCoords = null;
let dropCoords = null;

let selectingMode = "pickup";

let selectedService = "bike";

let currentUser = null;

let routeDistanceKm = 0;

let currentRideId = null;

let rideUnsubscribe = null;

let fareSettings = null;

let bookingInProgress = false;


// ============================================================
// RIDERX DEFAULT FARE
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

const $ = (id) => {

    return document.getElementById(id);

};


// ============================================================
// STATUS
// ============================================================

function setStatus(message) {

    const status = $("status");

    const bookingStatus =
        $("bookingStatus");


    if (status) {

        status.innerText = message;

    }


    if (bookingStatus) {

        bookingStatus.innerText =
            message;

    }

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
    auth,
    (user) => {

        currentUser = user;


        if (!user) {

            setStatus(
                "Please login first"
            );


            updateBookButton();

            return;

        }


        setStatus(
            "Select pickup location"
        );


        updateBookButton();

    }
);


// ============================================================
// MAP INITIALIZATION
// ============================================================

function initMap() {

    const mapElement =
        $("map");


    if (!mapElement) {

        console.error(
            "RiderX: #map not found"
        );

        return;

    }


    if (typeof L === "undefined") {

        console.error(
            "Leaflet is not loaded"
        );

        setStatus(
            "Map failed to load"
        );

        return;

    }


    if (map) {

        return;

    }


    map = L.map(
        "map",
        {
            zoomControl: true
        }
    ).setView(
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

    ).addTo(map);


    map.on(
        "click",
        handleMapClick
    );


    setTimeout(
        () => {

            if (map) {

                map.invalidateSize();

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

    const lat =
        Number(
            event.latlng.lat.toFixed(6)
        );


    const lng =
        Number(
            event.latlng.lng.toFixed(6)
        );


    const address =
        `${lat}, ${lng}`;


    if (
        selectingMode ===
        "pickup"
    ) {

        setPickup(
            lat,
            lng,
            address
        );


        selectingMode =
            "drop";


        setStatus(
            "Now select destination"
        );


        return;

    }


    if (
        selectingMode ===
        "drop"
    ) {

        setDrop(
            lat,
            lng,
            address
        );


        selectingMode =
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

    if (!map) {

        return;

    }


    pickupCoords = {

        lat:
            Number(lat),

        lng:
            Number(lng)

    };


    if (pickupMarker) {

        map.removeLayer(
            pickupMarker
        );

    }


    pickupMarker =
        L.marker(
            [
                pickupCoords.lat,
                pickupCoords.lng
            ]
        )
        .addTo(map)
        .bindPopup(
            "Pickup location"
        );


    const input =
        $("pickupLocation");


    if (input) {

        input.value =
            address ||
            `${lat}, ${lng}`;

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

    if (!map) {

        return;

    }


    dropCoords = {

        lat:
            Number(lat),

        lng:
            Number(lng)

    };


    if (dropMarker) {

        map.removeLayer(
            dropMarker
        );

    }


    dropMarker =
        L.marker(
            [
                dropCoords.lat,
                dropCoords.lng
            ]
        )
        .addTo(map)
        .bindPopup(
            "Destination"
        );


    const input =
        $("dropoffLocation");


    if (input) {

        input.value =
            address ||
            `${lat}, ${lng}`;

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
        "Getting your current location..."
    );


    navigator.geolocation.getCurrentPosition(

        (position) => {

            const lat =
                Number(
                    position.coords.latitude
                        .toFixed(6)
                );


            const lng =
                Number(
                    position.coords.longitude
                        .toFixed(6)
                );


            if (map) {

                map.setView(
                    [
                        lat,
                        lng
                    ],
                    16
                );

            }


            setPickup(
                lat,
                lng,
                "Current location"
            );


            selectingMode =
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


            let message =
                "Unable to get location";


            if (
                error.code ===
                1
            ) {

                message =
                    "Location permission denied";

            }


            if (
                error.code ===
                2
            ) {

                message =
                    "Location unavailable";

            }


            if (
                error.code ===
                3
            ) {

                message =
                    "Location request timed out";

            }


            setStatus(
                message
            );

        },


        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000
        }

    );

}


// ============================================================
// DISTANCE CALCULATION
// ============================================================

function calculateDistance(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R =
        6371;


    const dLat =
        (
            lat2 - lat1
        ) *
        Math.PI /
        180;


    const dLng =
        (
            lng2 - lng1
        ) *
        Math.PI /
        180;


    const a =

        Math.sin(
            dLat / 2
        ) ** 2

        +

        Math.cos(
            lat1 * Math.PI / 180
        )

        *

        Math.cos(
            lat2 * Math.PI / 180
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
// LOAD ADMIN FARE SETTINGS
// ============================================================

async function loadFareSettings() {

    try {

        const fareRef =
            doc(
                db,
                "settings",
                "fare"
            );


        const snapshot =
            await getDoc(
                fareRef
            );


        if (
            snapshot.exists()
        ) {

            fareSettings =
                snapshot.data();


            console.log(
                "RiderX fare settings loaded:",
                fareSettings
            );

        } else {

            fareSettings =
                DEFAULT_FARE;


            console.log(
                "RiderX default fare active"
            );

        }

    } catch (error) {

        console.error(
            "RiderX fare settings error:",
            error
        );


        fareSettings =
            DEFAULT_FARE;

    }

}


// ============================================================
// GET SERVICE FARE
// ============================================================

function getServiceFare() {

    const serviceFare =
        DEFAULT_FARE[
            selectedService
        ] ||
        DEFAULT_FARE.bike;


    if (
        fareSettings &&
        fareSettings[
            selectedService
        ]
    ) {

        return {

            ...serviceFare,

            ...fareSettings[
                selectedService
            ]

        };

    }


    return serviceFare;

}


// ============================================================
// FARE CALCULATION
// ============================================================

function calculateFare() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        routeDistanceKm =
            0;


        updateFareUI(
            0,
            0
        );


        return 0;

    }


    routeDistanceKm =
        calculateDistance(

            pickupCoords.lat,
            pickupCoords.lng,

            dropCoords.lat,
            dropCoords.lng

        );


    const distance =
        Number(
            routeDistanceKm.toFixed(2)
        );


    const serviceFare =
        getServiceFare();


    const hour =
        new Date().getHours();


    let rate;


    /*
     * RIDERX:
     * 10 PM - 6 AM = NIGHT RATE
     */

    if (
        hour >= 22 ||
        hour < 6
    ) {

        rate =
            Number(
                serviceFare.nightRate ??
                11
            );

    } else {

        rate =
            Number(
                serviceFare.dayRate ??
                8
            );

    }


    const extraRate =
        Number(
            serviceFare.extraRate ??
            9
        );


    const baseFare =
        Number(
            serviceFare.baseFare ??
            30
        );


    let total =
        baseFare;


    /*
     * FIRST 10 KM
     */

    if (
        distance <= 10
    ) {

        total +=
            distance *
            rate;

    }


    /*
     * ABOVE 10 KM
     */

    else {

        total +=
            10 *
            rate;


        total +=
            (
                distance - 10
            ) *
            extraRate;

    }


    /*
     * MINIMUM RIDERX FARE
     */

    total =
        Math.max(
            50,
            Math.round(total)
        );


    updateFareUI(
        total,
        distance
    );


    return total;

}


// ============================================================
// UPDATE FARE UI
// ============================================================

function updateFareUI(
    fare = 0,
    distance = 0
) {

    const fareElement =
        $("fare");


    if (fareElement) {

        fareElement.innerText =
            "₹" +
            Math.round(fare);

    }


    const distanceElement =
        $("estimated-distance-display");


    if (distanceElement) {

        distanceElement.innerText =
            distance > 0

                ? `${distance.toFixed(1)} KM`

                : "0 KM";

    }


    const fareInfo =
        $("fareInfo");


    if (fareInfo) {

        if (distance > 0) {

            fareInfo.innerText =
                `${selectedService.toUpperCase()} • ${distance.toFixed(1)} km`;

        } else {

            fareInfo.innerText =
                "Select pickup & drop";

        }

    }

}


// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute() {

    if (
        !map ||
        !pickupCoords ||
        !dropCoords
    ) {

        return;

    }


    if (routeLayer) {

        map.removeLayer(
            routeLayer
        );

    }


    routeLayer =
        L.polyline(

            [

                [
                    pickupCoords.lat,
                    pickupCoords.lng
                ],

                [
                    dropCoords.lat,
                    dropCoords.lng
                ]

            ],

            {
                weight: 5,
                opacity: 0.9
            }

        )
        .addTo(map);


    map.fitBounds(

        routeLayer.getBounds(),

        {
            padding: [
                80,
                100
            ]
        }

    );

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
// BOOK BUTTON STATE
// ============================================================

function updateBookButton() {

    const button =
        $("bookRide");


    if (!button) {

        return;

    }


    if (bookingInProgress) {

        button.disabled =
            true;

        return;

    }


    button.disabled =
        !currentUser ||
        !pickupCoords ||
        !dropCoords;

}


// ============================================================
// SERVICE SELECTORS
// ============================================================

function setupServices() {

    const services =
        document.querySelectorAll(
            ".service"
        );


    services.forEach(
        (service) => {

            service.addEventListener(
                "click",
                () => {

                    services.forEach(
                        (item) => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    service.classList.add(
                        "active"
                    );


                    selectedService =
                        String(
                            service.dataset.service ||
                           
