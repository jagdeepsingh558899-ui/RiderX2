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

            timeout:
                15000,

            maximumAge:
                5000

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

    const R =
        6371;


    const dLat =
        (
            lat2 -
            lat1
        )
        *
        Math.PI /
        180;


    const dLng =
        (
            lng2 -
            lng1
        )
        *
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
            Math.sqrt(
                1 - a
            )
        );


    return R * c;

}


// ============================================================
// LOAD FARE SETTINGS
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
                "RiderX fare settings:",
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
            "Fare settings error:",
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

    const service =
        selectedService;


    const defaults =
        DEFAULT_FARE[
            service
        ] ||
        DEFAULT_FARE.bike;


    if (
        fareSettings &&
        fareSettings[service]
    ) {

        return {

            ...defaults,

            ...fareSettings[
                service
            ]

        };

    }


    return defaults;

}


// ============================================================
// CALCULATE FARE
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
            rate
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
            distance *
            rate;

    } else {

        total +=
            10 *
            rate;


        total +=
            (
                distance -
                10
            )
            *
            extraRate;

    }


    total =
        Math.max(
            base,
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
            "₹" +
            fare;

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

        routeLayer =
            null;

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

                weight:5,

                opacity:.85

            }

        )
        .addTo(map);


    try {

        map.fitBounds(
            routeLayer.getBounds(),
            {
                padding:
                    [
                        70,
                        120
                    ]
            }
        );

    } catch (error) {

        console.warn(
            "Map fitBounds error:",
            error
        );

    }

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
// BOOK BUTTON STATE
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


    if (
        currentUser &&
        pickupCoords &&
        dropCoords
    ) {

        if (
            button.disabled
        ) {

            button.disabled =
                false;

        }

    }

}


// ============================================================
// SERVICES
// ============================================================

function setupServices() {

    document
        .querySelectorAll(
            ".service"
        )
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

                                    item.classList
                                        .remove(
                                            "active"
                                        );

                                }
                            );


                        service.classList
                            .add(
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

            }
        );

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
// LOCATION BUTTONS
// ============================================================

function setupLocationButton() {

    const buttons = [

        $("myLocation"),

        $("mapLocationButton")

    ];


    buttons.forEach(
        (button) => {

            if (!button) {

                return;

            }


            button.addEventListener(
                "click",
                useCurrentLocation
            );

        }
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
// LOADING UI
// ============================================================

function showLoading() {

    const overlay =
        $("rideLoading");


    if (overlay) {

        overlay.style.display =
            "flex";

    }

}


function hideLoading() {

    const overlay =
        $("rideLoading");


    if (overlay) {

        overlay.style.display =
            "none";

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

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding Rider...';

    }


    showLoading();


    try {

        const fare =
            calculateFare();


        const pickupInput =
            $("pickupLocation");


        const dropInput =
            $("dropoffLocation");


        const paymentInput =
            $("paymentMethod");


        const pickupAddress =
            pickupInput?.value?.trim() ||
            "Pickup location";


        const dropAddress =
            dropInput?.value?.trim() ||
            "Destination";


        const payment =
            paymentInput?.value ||
            "cash";


        const timestamp =
            serverTimestamp();


        // ====================================================
        // SINGLE SOURCE OF TRUTH
        // Rider engine listens for REQUESTED
        // ====================================================

        const rideData = {

            customerId:
                currentUser.uid,


            customerName:
                currentUser.displayName ||
                currentUser.email ||
                "RiderX Customer",


            customerPhone:
                currentUser.phoneNumber ||
                "",


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
                String(
                    payment
                )
                .trim()
                .toLowerCase(),


            status:
                "REQUESTED",


            riderId:
                null,


            driverId:
                null,


            riderName:
                "",


            riderPhone:
                "",


            riderLocation:
                null,


            otp:
                null,


            createdAt:
                timestamp,


            requestedAt:
                timestamp,


            acceptedAt:
                null,


            startedAt:
                null,


            completedAt:
                null,


            cancelledAt:
                null

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


        localStorage.setItem(
            "RiderXCurrentRideId",
            rideRef.id
        );


        hideLoading();


        setStatus(
            "Finding a nearby RiderX rider..."
        );


        if (button) {

            button.innerHTML =
                '<i class="fa-solid fa-location-dot"></i> Finding Rider...';

        }


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


        hideLoading();


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
                '<i class="fa-solid fa-paper-plane"></i> Book RiderX';

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


                // =================================================
                // REQUESTED
                // =================================================

                if (
                    status ===
                    "REQUESTED"
                ) {

                    setStatus(
                        "Searching nearby RiderX riders..."
                    );

                }


                // =================================================
                // ACCEPTED
                // =================================================

                else if (
                    status ===
                    "ACCEPTED"
                ) {

                    hideLoading();


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


                // =================================================
                // ARRIVING
                // =================================================

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


                // =================================================
                // STARTED
                // =================================================

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


                    window.dispatchEvent(

                        new CustomEvent(
                            "riderx:ride-started",
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


                // =================================================
                // COMPLETED
                // =================================================

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


                // =================================================
                // CANCELLED
                // =================================================

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

let riderLocationMarker =
    null;


function updateRiderLocation(
    ride
) {

    if (
        !map ||
        !ride
    ) {

        return;

    }


    const location =
        ride.riderLocation ||
        ride.riderCurrentLocation ||
        ride.driverLocation;


    if (
        !location ||
        location.lat === undefined ||
        location.lng === undefined
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
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        return;

    }


    const riderIcon =
        L.divIcon({

            className:
                "riderx-rider-marker",

            html:
                `<div style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    background:#ffe500;
                    color:#000;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border:3px solid #000;
                    box-shadow:0 4px 15px rgba(0,0,0,.4);
                    font-size:18px;
                ">
                    <i class="fa-solid fa-motorcycle"></i>
                </div>`,

            iconSize:
                [
                    42,
                    42
                ],

            iconAnchor:
                [
                    21,
                    21
                ]

        });


    if (!riderLocationMarker) {

        riderLocationMarker =
            L.marker(
                [
                    lat,
                    lng
                ],
                {
                    icon:
                        riderIcon
                }
            )
            .addTo(map);

    } else {

        riderLocationMarker.setLatLng(
            [
                lat,
                lng
            ]
        );

    }

}


// ============================================================
// RESET
// ============================================================

function resetBooking() {

    pickupCoords =
        null;


    dropCoords =
        null;


    routeDistanceKm =
        0;


    currentRideId =
        null;


    window.RiderXCurrentRideId =
        null;


    localStorage.removeItem(
        "RiderXCurrentRideId"
    );


    if (
        typeof rideUnsubscribe ===
        "function"
    ) {

        rideUnsubscribe();

        rideUnsubscribe =
            null;

    }


    if (
        pickupMarker &&
        map
    ) {

        map.removeLayer(
            pickupMarker
        );

        pickupMarker =
            null;

    }


    if (
        dropMarker &&
        map
    ) {

        map.removeLayer(
            dropMarker
        );

        dropMarker =
            null;

    }


    if (
        routeLayer &&
        map
    ) {

        map.removeLayer(
            routeLayer
        );

        routeLayer =
            null;

    }


    if (
        riderLocationMarker &&
        map
    ) {

        map.removeLayer(
            riderLocationMarker
        );

        riderLocationMarker =
            null;

    }


    const pickup =
        $("pickupLocation");


    const drop =
        $("dropoffLocation");


    if (pickup) {

        pickup.value =
            "";

    }


    if (drop) {

        drop.value =
            "";

    }


    updateFareUI(
        0,
        0
    );


    selectingMode =
        "pickup";


    setStatus(
        "Select pickup location"
    );


    updateBookButton();

}


// ============================================================
// PUBLIC LOCATION FUNCTION
// ============================================================

function locate() {

    useCurrentLocation();

}


// ============================================================
// PUBLIC API
// ============================================================

window.RiderXCustomer = {

    init:
        init,

    locate:
        locate,

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
        () =>
            currentRideId,

    getRide:
        () => ({

            rideId:
                currentRideId,

            pickup:
                pickupCoords,

            drop:
                dropCoords,

            service:
                selectedService,

            distance:
                routeDistanceKm,

            fare:
                calculateFare()

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


    // ========================================================
    // BOOK BUTTON
    // ========================================================

    const button =
        $("bookRide");


    if (button) {

        button.addEventListener(
            "click",
            bookRide
        );

    }

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
// RESTORE CURRENT RIDE ID
// ============================================================

const savedRideId =
    localStorage.getItem(
        "RiderXCurrentRideId"
    );


if (savedRideId) {

    currentRideId =
        savedRideId;


    window.RiderXCurrentRideId =
        savedRideId;

}
