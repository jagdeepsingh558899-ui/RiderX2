// ============================================================
// RiderX Customer Engine
// COMPLETE CUSTOMER BOOKING ENGINE
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

const $ = (id) =>
    document.getElementById(id);


// ============================================================
// STATUS
// ============================================================

function setStatus(text) {

    const status =
        $("status");

    if (status) {

        status.innerText =
            text;

    }


    const bookingStatus =
        $("bookingStatus");

    if (bookingStatus) {

        bookingStatus.innerText =
            text;

    }

}


// ============================================================
// AUTH STATE
// ============================================================

auth.onAuthStateChanged(
    (user) => {

        currentUser =
            user || null;


        const button =
            $("bookRide");


        if (!user) {

            setStatus(
                "Please login first"
            );


            if (button) {

                button.disabled =
                    true;

            }


            return;

        }


        if (
            pickupCoords &&
            dropCoords
        ) {

            setStatus(
                "Ready to book"
            );

        } else {

            setStatus(
                "Select pickup location"
            );

        }


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


    map =
        L.map(
            "map",
            {
                zoomControl: true
            }
        ).setView(
            [
                30.7333,
                76.7794
            ],
            13
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap"
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
        selectingMode ===
        "pickup"
    ) {

        setPickup(
            lat,
            lng,
            `${lat}, ${lng}`
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
            `${lat}, ${lng}`
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

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return;

    }


    pickupCoords = {

        lat:
            Number(lat),

        lng:
            Number(lng)

    };


    if (
        pickupMarker &&
        map
    ) {

        map.removeLayer(
            pickupMarker
        );

    }


    if (map) {

        pickupMarker =
            L.marker(
                [
                    lat,
                    lng
                ]
            )
            .addTo(map)
            .bindPopup(
                "Pickup location"
            );

    }


    const input =
        $("pickupLocation");


    if (input) {

        input.value =
            address ||
            `${lat}, ${lng}`;

    }


    updateRideData();

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


    dropCoords = {

        lat:
            Number(lat),

        lng:
            Number(lng)

    };


    if (
        dropMarker &&
        map
    ) {

        map.removeLayer(
            dropMarker
        );

    }


    if (map) {

        dropMarker =
            L.marker(
                [
                    lat,
                    lng
                ]
            )
            .addTo(map)
            .bindPopup(
                "Destination"
            );

    }


    const input =
        $("dropoffLocation");


    if (input) {

        input.value =
            address ||
            `${lat}, ${lng}`;

    }


    updateRideData();

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


            if (map) {

                map.setView(
                    [
                        lat,
                        lng
                    ],
                    16,
                    {
                        animate: true
                    }
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


            if (
                error &&
                error.code === 1
            ) {

                setStatus(
                    "Location permission denied"
                );

            } else {

                setStatus(
                    "Unable to get location"
                );

            }

        },

        {

            enableHighAccuracy:
                true,

           
