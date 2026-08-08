// ============================================================
// RiderX Customer Engine
// FINAL CUSTOMER BOOKING ENGINE
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
// DEFAULT RIDERX FARE
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
// DOM
// ============================================================

const $ = (id) => document.getElementById(id);


// ============================================================
// AUTH
// ============================================================

auth.onAuthStateChanged((user) => {

    currentUser = user;

    if (!user) {

        setStatus("Please login first");

        const button = $("bookRide");

        if (button) {
            button.disabled = true;
        }

        return;
    }

    setStatus("Select pickup location");

    updateBookButton();

});


// ============================================================
// MAP INITIALIZATION
// ============================================================

function initMap() {

    const mapElement = $("map");

    if (!mapElement) {
        return;
    }

    if (map) {
        return;
    }

    map = L.map("map", {
        zoomControl: true
    }).setView(
        [30.7333, 76.7794],
        13
    );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap"
        }
    ).addTo(map);


    map.on("click", handleMapClick);


    setTimeout(() => {
        map.invalidateSize();
    }, 300);


    setStatus("Select pickup location");

}


// ============================================================
// MAP CLICK
// ============================================================

function handleMapClick(event) {

    const lat = Number(
        event.latlng.lat.toFixed(6)
    );

    const lng = Number(
        event.latlng.lng.toFixed(6)
    );


    if (selectingMode === "pickup") {

        setPickup(
            lat,
            lng,
            `${lat}, ${lng}`
        );

        selectingMode = "drop";

        setStatus(
            "Now select destination"
        );

        return;
    }


    if (selectingMode === "drop") {

        setDrop(
            lat,
            lng,
            `${lat}, ${lng}`
        );

        selectingMode = "pickup";

        setStatus(
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
        lat,
        lng
    };


    if (pickupMarker) {

        map.removeLayer(
            pickupMarker
        );

    }


    pickupMarker = L.marker(
        [lat, lng]
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


    updateRideData();

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
        lat,
        lng
    };


    if (dropMarker) {

        map.removeLayer(
            dropMarker
        );

    }


    dropMarker = L.marker(
        [lat, lng]
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
                position.coords.latitude;

            const lng =
                position.coords.longitude;


            if (map) {

                map.setView(
                    [lat, lng],
                    16
                );

            }


            setPickup(
                lat,
                lng,
                "Current location"
            );


            selectingMode = "drop";


            setStatus(
                "Now select destination"
            );

        },

        (error) => {

            console.error(
                "Location error:",
                error
            );


            setStatus(
                "Unable to get location"
            );

        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
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
        (lat2 - lat1) *
        Math.PI /
        180;


    const dLng =
        (lng2 - lng1) *
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

        Math.sin(dLng / 2) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


// ============================================================
// FARE SETTINGS
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
                "RiderX fare settings loaded",
                fareSettings
            );

        } else {

            fareSettings =
                DEFAULT_FARE;

            console.log(
                "Using default RiderX fare"
            );

        }

    } catch (error) {

        console.error(
            "Fare settings error:",
            error
        );

        fareSettings =
            DEFAULT_FARE;

    }

}


// ============================================================
// SERVICE FARE
// ============================================================

function getServiceFare() {

    const service =
        selectedService;


    if (
        fareSettings &&
        fareSettings[service]
    ) {

        return {
            ...DEFAULT_FARE[service],
            ...fareSettings[service]
        };

    }


    return (
        DEFAULT_FARE[service] ||
        DEFAULT_FARE.bike
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


    const fare =
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
                fare.nightRate ??
                11
            );

    } else {

        rate =
            Number(
                fare.dayRate ??
                8
            );

    }


    const extraRate =
        Number(
            fare.extraRate ??
            9
        );


    const base =
        Number(
            fare.baseFare ??
            30
        );


    let total =
        base;


    if (
        distance <= 10
    ) {

        total +=
            distance * rate;

    } else {

        total +=
            10 * rate;


        total +=
            (
                distance - 10
            ) *
            extraRate;

    }


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
// FARE UI
// ============================================================

function updateFareUI(
    fare = 0,
    distance = 0
) {

    const fareElement =
        $("fare");

    if (fareElement) {

        fareElement.innerText =
            "₹" + fare;

    }


    const distanceElement =
        $("estimated-distance-display");

    if (distanceElement) {

        distanceElement.innerText =
            distance > 0
                ? `${distance.toFixed(1)} KM`
                : "0 KM";

    }


    const info =
        $("fareInfo");

    if (info) {

        if (distance > 0) {

            info.innerText =
                `${selectedService.toUpperCase()} • ${distance.toFixed(1)} km`;

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
                weight: 5
            }

        )
        .addTo(map);


    map.fitBounds(
        routeLayer.getBounds(),
        {
            padding: [70, 120]
        }
    );

}


// ============================================================
// UPDATE RIDE DATA
// ============================================================

function updateRideData() {

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


    button.disabled =
        !currentUser ||
        !pickupCoords ||
        !dropCoords;

}


// ============================================================
// SERVICE SELECTOR
// ============================================================

function setupServices() {

    document
        .querySelectorAll(".service")
        .forEach((service) => {

            service.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".service")
                        .forEach((item) => {

                            item.classList.remove(
                                "active"
                            );

                        });


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


                    calculateFare();

                }
            );

        });

}


// ============================================================
// PICKUP BUTTON
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

            selectingMode =
                "pickup";


            setStatus(
                "Move map and select pickup"
            );

        }
    );

}


// ============================================================
// DROP BUTTON
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

            selectingMode =
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

                selectingMode =
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

                selectingMode =
                    "drop";

                setStatus(
                    "Select destination on map"
                );

            }
        );

    }

}


// ============================================================
// BOOK RIDE
// ============================================================

async function bookRide() {

    if (!currentUser) {

        alert(
            "Please login first."
        );


        window.location.href =
            "../auth/login.html?role=customer";


        return;

    }


    if (
        !pickupCoords ||
        !dropCoords
    ) {

        setStatus(
            "Please select pickup and destination"
        );

        return;

    }


    const button =
        $("bookRide");


    if (button) {

        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding Rider...';

    }


    try {

        const fare =
            calculateFare();


        const pickupAddress =
            $("pickupLocation")?.value ||
            "Pickup location";


        const dropAddress =
            $("dropoffLocation")?.value ||
            "Destination";


        const payment =
            $("paymentMethod")?.value ||
            "cash";


        const now =
            serverTimestamp();


        const rideData = {

            customerId:
                currentUser.uid,


            customerName:
                currentUser.displayName ||
                currentUser.email ||
                "RiderX Customer",


            serviceType:
                selectedService,


            service:
                selectedService,


            pickup: {

                lat:
                    pickupCoords.lat,

                lng:
                    pickupCoords.lng,

                address:
                    pickupAddress,

                name:
                    pickupAddress

            },


            drop: {

                lat:
                    dropCoords.lat,

                lng:
                    dropCoords.lng,

                address:
                    dropAddress,

                name:
                    dropAddress

            },


            distance:
                Number(
                    routeDistanceKm.toFixed(2)
                ),


            fare:
                Number(fare),


            paymentMethod:
                payment,


            status:
                "REQUESTED",


            riderId:
                null,


            driverId:
                null,


            createdAt:
                now,


            requestedAt:
                now

        };


        const rideRef =
            await addDoc(
                collection(
                    db,
                    "rides"
                ),
                rideData
            );


        currentRideId =
            rideRef.id;


        window.RiderXCurrentRideId =
            rideRef.id;


        setStatus(
            "Finding a nearby RiderX rider..."
        );


        console.log(
            "RiderX ride created:",
            rideRef.id
        );


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

            button.disabled = false;

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
        typeof rideUnsubscribe ===
        "function"
    ) {

        rideUnsubscribe();

        rideUnsubscribe =
            null;

    }


    const rideRef =
        doc(
            db,
            "rides",
            rideId
        );


    rideUnsubscribe =
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
                    ).toUpperCase();


                console.log(
                    "RiderX ride status:",
                    status
                );


                window.dispatchEvent(

                    new CustomEvent(
                        "riderx:ride-status",
                        {
                            detail: {

                                rideId,

                                ride,

                                status

                            }
                        }
                    )

                );


                // REQUESTED

                if (
                    status ===
                    "REQUESTED"
                ) {

                    setStatus(
                        "Searching nearby RiderX riders..."
                    );

                }


                // ACCEPTED

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
                                    rideId,
                                    ride
                                }
                            }
                        )

                    );

                }


                // ARRIVING

                else if (
                    status ===
                    "ARRIVING"
                ) {

                    setStatus(
                        "Your RiderX rider is arriving"
                    );

                }


                // STARTED

                else if (
                    status ===
                    "STARTED"
                ) {

                    setStatus(
                        "Ride started"
                    );

                }


                // COMPLETED

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
                                    rideId,
                                    ride
                                }
                            }
                        )

                    );

                }


                // CANCELLED

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
                                    rideId,
                                    ride
                                }
                            }
                        )

                    );

                }

            },

            (error) => {

                console.error(
                    "Ride listener error:",
                    error
                );


                setStatus(
                    "Unable to track ride"
                );

            }

        );

}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    text
) {

    const element =
        $("status");


    if (element) {

        element.innerText =
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
// RESET
// ============================================================

function resetBooking() {

    pickupCoords = null;
    dropCoords = null;

    routeDistanceKm = 0;

    currentRideId = null;


    if (
        typeof rideUnsubscribe ===
        "function"
    ) {

        rideUnsubscribe();

        rideUnsubscribe =
            null;

    }


    if (pickupMarker && map) {

        map.removeLayer(
            pickupMarker
        );

        pickupMarker =
            null;

    }


    if (dropMarker && map) {

        map.removeLayer(
            dropMarker
        );

        dropMarker =
            null;

    }


    if (routeLayer && map) {

        map.removeLayer(
            routeLayer
        );

        routeLayer =
            null;

    }


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


    updateFareUI(
        0,
        0
    );


    selectingMode =
        "pickup";


    updateBookButton();

}


// ============================================================
// GLOBAL RIDERX API
// ============================================================

window.RiderXCustomer = {

    init:
        init,

    setPickup:
        setPickup,

    setDrop:
        setDrop,

    calculateFare:
        calculateFare,

    bookRide:
        bookRide,

    reset:
        resetBooking,

    getRideId:
        () => currentRideId

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
// START
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
// EXPOSE BOOKING BUTTON
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
