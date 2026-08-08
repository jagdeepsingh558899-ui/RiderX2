// ============================================================
// RiderX Customer Engine
// FINAL CUSTOMER BOOKING ENGINE
// Map + GPS + Route + Fare + Firebase + Ride Tracking
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

let selectedService = "bike";
let selectingMode = "pickup";

let currentUser = null;
let currentRideId = null;
let rideUnsubscribe = null;

let routeDistanceKm = 0;
let estimatedFare = 0;

let fareSettings = null;

let isBooking = false;


// ============================================================
// RIDERX DEFAULT SETTINGS
// ============================================================

const DEFAULT_FARES = {

    bike: {
        baseFare: 20,
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
        dayRate: 9,
        extraRate: 10,
        nightRate: 12
    },

    food: {
        baseFare: 25,
        dayRate: 8,
        extraRate: 9,
        nightRate: 11
    }

};


// ============================================================
// ELEMENTS
// ============================================================

const pickupInput =
    document.getElementById("pickupLocation");

const dropInput =
    document.getElementById("dropoffLocation");

const fareElement =
    document.getElementById("fare");

const bookingStatus =
    document.getElementById("bookingStatus");

const bookButton =
    document.getElementById("bookRide");

const paymentMethod =
    document.getElementById("paymentMethod");


// ============================================================
// STATUS
// ============================================================

function setStatus(text, type = "") {

    if (!bookingStatus) return;

    bookingStatus.textContent = text;

    bookingStatus.style.color =
        type === "error"
            ? "#ff6666"
            : type === "success"
                ? "#22c55e"
                : "#ffe500";

}


// ============================================================
// MAP STATUS
// ============================================================

function setMapStatus(text) {

    const status =
        document.getElementById("status");

    if (status) {
        status.textContent = text;
    }

}


// ============================================================
// INIT MAP
// ============================================================

function initMap() {

    const mapBox =
        document.getElementById("map");

    if (!mapBox) return;

    if (map) return;

    map =
        L.map("map", {
            zoomControl: false
        }).setView(
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


    L.control.zoom({
        position: "bottomright"
    }).addTo(map);


    map.on(
        "moveend",
        handleMapMove
    );


    setMapStatus(
        "Select pickup location"
    );


    console.log(
        "RiderX Map Initialized"
    );

}


// ============================================================
// MAP MOVE
// ============================================================

function handleMapMove() {

    if (
        selectingMode !== "pickup" &&
        selectingMode !== "drop"
    ) {
        return;
    }


    const center =
        map.getCenter();


    if (
        selectingMode === "pickup"
    ) {

        setMapStatus(
            "Release map to set pickup"
        );

    } else {

        setMapStatus(
            "Release map to set destination"
        );

    }

}


// ============================================================
// MAP CENTER SELECTION
// ============================================================

async function selectMapCenter() {

    if (!map) return;

    const center =
        map.getCenter();


    const lat =
        Number(center.lat.toFixed(6));

    const lng =
        Number(center.lng.toFixed(6));


    setMapStatus(
        "Getting location..."
    );


    let address =
        `${lat}, ${lng}`;


    try {

        address =
            await reverseGeocode(
                lat,
                lng
            );

    } catch (error) {

        console.log(
            "Reverse geocoding failed:",
            error
        );

    }


    if (
        selectingMode === "pickup"
    ) {

        setPickup(
            lat,
            lng,
            address
        );


        selectingMode =
            "drop";


        setMapStatus(
            "Now select destination"
        );


    } else {

        setDrop(
            lat,
            lng,
            address
        );


        selectingMode =
            "pickup";


        setMapStatus(
            "Pickup & destination selected"
        );

    }

}


// ============================================================
// PICKUP
// ============================================================

function setPickup(
    lat,
    lng,
    address = ""
) {

    pickupCoords = {
        lat: Number(lat),
        lng: Number(lng)
    };


    if (pickupMarker) {

        map.removeLayer(
            pickupMarker
        );

    }


    pickupMarker =
        L.marker(
            [lat, lng]
        )
        .addTo(map)
        .bindPopup(
            "Pickup"
        );


    if (pickupInput) {

        pickupInput.value =
            address ||
            `${lat}, ${lng}`;

    }


    calculateRide();


    setStatus(
        "Pickup selected"
    );

}


// ============================================================
// DROP
// ============================================================

function setDrop(
    lat,
    lng,
    address = ""
) {

    dropCoords = {
        lat: Number(lat),
        lng: Number(lng)
    };


    if (dropMarker) {

        map.removeLayer(
            dropMarker
        );

    }


    dropMarker =
        L.marker(
            [lat, lng]
        )
        .addTo(map)
        .bindPopup(
            "Destination"
        );


    if (dropInput) {

        dropInput.value =
            address ||
            `${lat}, ${lng}`;

    }


    calculateRide();


    setStatus(
        "Destination selected"
    );

}


// ============================================================
// CURRENT GPS LOCATION
// ============================================================

function useCurrentLocation() {

    if (
        !navigator.geolocation
    ) {

        setStatus(
            "GPS is not supported on this device.",
            "error"
        );

        return;

    }


    setMapStatus(
        "Getting your current location..."
    );


    navigator.geolocation.getCurrentPosition(

        async position => {

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;


            map.setView(
                [lat, lng],
                16,
                {
                    animate: true
                }
            );


            let address =
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;


            try {

                address =
                    await reverseGeocode(
                        lat,
                        lng
                    );

            } catch (error) {

                console.log(
                    error
                );

            }


            setPickup(
                lat,
                lng,
                address
            );


            selectingMode =
                "drop";


            setMapStatus(
                "Now select destination"
            );


            setStatus(
                "Current location selected",
                "success"
            );

        },

        error => {

            console.error(
                "GPS Error:",
                error
            );


            setMapStatus(
                "Unable to get GPS location"
            );


            setStatus(
                "Please allow location permission.",
                "error"
            );

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000
        }

    );

}


// ============================================================
// REVERSE GEOCODING
// ============================================================

async function reverseGeocode(
    lat,
    lng
) {

    const url =
        "https://nominatim.openstreetmap.org/reverse" +
        `?format=jsonv2&lat=${lat}&lon=${lng}`;


    const response =
        await fetch(url, {
            headers: {
                "Accept":
                    "application/json"
            }
        });


    if (!response.ok) {

        throw new Error(
            "Address lookup failed"
        );

    }


    const data =
        await response.json();


    return (
        data.display_name ||
        `${lat}, ${lng}`
    );

}


// ============================================================
// SERVICE SELECTION
// ============================================================

function setupServices() {

    const services =
        document.querySelectorAll(
            ".service"
        );


    services.forEach(
        service => {

            service.addEventListener(
                "click",
                () => {

                    services.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    service.classList.add(
                        "active"
                    );


                    selectedService =
                        String(
                            service.dataset.service ||
                            "bike"
                        )
                            .trim()
                            .toLowerCase();


                    calculateRide();

                }
            );

        }
    );

}


// ============================================================
// DISTANCE
// ============================================================

function getDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;


    const dLat =
        (lat2 - lat1) *
        Math.PI /
        180;


    const dLon =
        (lon2 - lon1) *
        Math.PI /
        180;


    const a =

        Math.sin(dLat / 2) ** 2

        +

        Math.cos(
            lat1 * Math.PI / 180
        )

        *

        Math.cos(
            lat2 * Math.PI / 180
        )

        *

        Math.sin(dLon / 2) ** 2;


    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );

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


        if (snap.exists()) {

            fareSettings =
                snap.data();


            console.log(
                "RiderX Fare Settings:",
                fareSettings
            );

        }

    } catch (error) {

        console.log(
            "Fare settings unavailable. Using defaults.",
            error
        );

    }

}


// ============================================================
// GET SERVICE FARE
// ============================================================

function getFareConfig(
    service
) {

    if (
        fareSettings &&
        fareSettings[service]
    ) {

        return {
            ...DEFAULT_FARES[service],
            ...fareSettings[service]
        };

    }


    return (
        DEFAULT_FARES[service] ||
        DEFAULT_FARES.bike
    );

}


// ============================================================
// CALCULATE FARE
// ============================================================

function calculateFare() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        estimatedFare = 0;


        if (fareElement) {

            fareElement.textContent =
                "₹0";

        }


        return 0;

    }


    routeDistanceKm =
        getDistance(

            pickupCoords.lat,
            pickupCoords.lng,

            dropCoords.lat,
            dropCoords.lng

        );


    routeDistanceKm =
        Number(
            routeDistanceKm.toFixed(2)
        );


    const config =
        getFareConfig(
            selectedService
        );


    const hour =
        new Date().getHours();


    let rate;


    if (
        hour >= 22 ||
        hour < 6
    ) {

        rate =
            Number(
                config.nightRate ?? 11
            );

    } else {

        rate =
            Number(
                config.dayRate ?? 8
            );

    }


    const extraRate =
        Number(
            config.extraRate ??
            9
        );


    const base =
        Number(
            config.baseFare ??
            20
        );


    let total =
        base;


    if (
        routeDistanceKm <= 10
    ) {

        total +=
            routeDistanceKm *
            rate;

    } else {

        total +=
            10 * rate;


        total +=
            (
                routeDistanceKm - 10
            ) *
            extraRate;

    }


    /*
       Minimum fare
    */

    estimatedFare =
        Math.max(
            50,
            Math.round(total)
        );


    if (fareElement) {

        fareElement.textContent =
            "₹" +
            estimatedFare;

    }


    return estimatedFare;

}


// ============================================================
// DRAW ROUTE
// ============================================================

async function drawRoute() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        return;

    }


    if (routeLayer) {

        map.removeLayer(
            routeLayer
        );

        routeLayer = null;

    }


    /*
       Try real road route through OSRM.
    */

    try {

        const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            `${pickupCoords.lng},${pickupCoords.lat};` +
            `${dropCoords.lng},${dropCoords.lat}` +
            "?overview=full&geometries=geojson";


        const response =
            await fetch(url);


        if (
            response.ok
        ) {

            const data =
                await response.json();


            if (
                data.routes &&
                data.routes.length
            ) {

                const route =
                    data.routes[0];


                routeDistanceKm =
                    Number(
                        (
                            route.distance /
                            1000
                        ).toFixed(2)
                    );


                routeLayer =
                    L.geoJSON(
                        route.geometry,
                        {
                            style: {
                                weight: 5
                            }
                        }
                    ).addTo(map);


                map.fitBounds(
                    routeLayer.getBounds(),
                    {
                        padding: [50, 100]
                    }
                );


                calculateFare();

                return;

            }

        }

    } catch (error) {

        console.log(
            "OSRM route unavailable:",
            error
        );

    }


    /*
       Fallback straight-line route.
    */

    routeDistanceKm =
        getDistance(

            pickupCoords.lat,
            pickupCoords.lng,

            dropCoords.lat,
            dropCoords.lng

        );


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
                weight: 5
            }
        ).addTo(map);


    map.fitBounds(
        routeLayer.getBounds(),
        {
            padding: [50, 100]
        }
    );


    calculateFare();

}


// ============================================================
// COMPLETE RIDE CALCULATION
// ============================================================

async function calculateRide() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        calculateFare();

        return;

    }


    await drawRoute();

}


// ============================================================
// BUTTON LOADING
// ============================================================

function setBookingLoading(
    loading
) {

    if (!bookButton) return;


    bookButton.disabled =
        loading;


    if (loading) {

        bookButton.dataset.oldText =
            bookButton.innerHTML;


        bookButton.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding Rider...';

    } else {

        bookButton.innerHTML =
            bookButton.dataset.oldText ||
            '<i class="fa-solid fa-paper-plane"></i> Book Ride';

    }

}


// ============================================================
// BOOK RIDE
// ============================================================

async function bookRide() {

    if (isBooking) {
        return;
    }


    const user =
        auth.currentUser;


    if (!user) {

        setStatus(
            "Please login first.",
            "error"
        );


        setTimeout(
            () => {

                window.location.href =
                    "../auth/login.html?role=customer";

            },
            700
        );


        return;

    }


    if (
        !pickupCoords ||
        !dropCoords
    ) {

        setStatus(
            "Please select pickup and destination.",
            "error"
        );


        return;

    }


    if (
        pickupInput &&
        !pickupInput.value.trim()
    ) {

        setStatus(
            "Pickup address is required.",
            "error"
        );


        return;

    }


    if (
        dropInput &&
        !dropInput.value.trim()
    ) {

        setStatus(
            "Destination is required.",
            "error"
        );


        return;

    }


    isBooking = true;

    setBookingLoading(true);


    try {

        await calculateRide();


        const fare =
            calculateFare();


        const payment =
            paymentMethod
                ? String(
