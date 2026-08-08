// ============================================================
// RiderX Customer Engine
// UNIFIED CUSTOMER BOOKING / MAP / FARE / RIDE STATUS
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

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ============================================================
// DOM HELPER
// ============================================================

const $ = (id) =>
    document.getElementById(id);


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

let selectedPayment = "cash";

let currentUser = null;

let currentRideId = null;

let rideUnsubscribe = null;

let distanceKm = 0;

let durationMin = 0;

let estimatedFare = 0;

let fareSettings = null;

let bookingInProgress = false;

let searchTimer = null;


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
// STATUS
// ============================================================

function setStatus(text) {

    const statusElement =
        $("status");

    if (statusElement) {

        statusElement.textContent =
            text;

    }

}


// ============================================================
// TOAST
// ============================================================

function showToast(text) {

    const toast =
        $("toast");

    if (!toast) {

        return;

    }

    toast.textContent =
        text;

    toast.className =
        "toast show";


    clearTimeout(
        toast._timer
    );


    toast._timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2600
        );

}


// ============================================================
// SEARCHING OVERLAY
// ============================================================

function showSearching(
    show,
    text = "Looking for nearby riders..."
) {

    const overlay =
        $("searchingOverlay");


    if (!overlay) {

        return;

    }


    overlay.classList.toggle(
        "show",
        show
    );


    const message =
        $("searchingText");


    if (message) {

        message.textContent =
            text;

    }

}


// ============================================================
// BOOK BUTTON
// ============================================================

function updateBookButton() {

    const button =
        $("bookRideBtn") ||
        $("bookRide");


    if (!button) {

        return;

    }


    button.disabled =
        !currentUser ||
        !pickupCoords ||
        !dropCoords ||
        bookingInProgress;

}


// ============================================================
// MAP INIT
// ============================================================

function initMap() {

    const mapElement =
        $("map");


    if (!mapElement) {

        return;

    }


    if (map) {

        return;

    }


    if (!window.L) {

        console.error(
            "Leaflet is not loaded."
        );

        setStatus(
            "Map loading failed"
        );

        return;

    }


    map =
        L.map(
            "map",
            {
                zoomControl: true
            }
        )
        .setView(
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
                "&copy; OpenStreetMap contributors"

        }

    )
    .addTo(map);


    map.on(
        "click",
        handleMapClick
    );


    setTimeout(
        () => {

            map.invalidateSize();

        },
        300
    );


    useCurrentLocation();

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
            null;


        setStatus(
            "Pickup & destination selected"
        );

    }

}


// ============================================================
// MARKER
// ============================================================

function createMarker(
    type,
    lat,
    lng
) {

    if (
        type ===
        "pickup"
    ) {

        if (
            pickupMarker
        ) {

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
                "Pickup location"
            );

        return;

    }


    if (
        type ===
        "drop"
    ) {

        if (
            dropMarker
        ) {

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

    pickupCoords = {

        lat:
            Number(lat),

        lng:
            Number(lng),

        address:
            String(address || "")

    };


    createMarker(
        "pickup",
        lat,
        lng
    );


    const input =
        $("pickupInput");


    if (input) {

        input.value =
            address ||
            `${lat}, ${lng}`;

    }


    updatePreview();

}


// ============================================================
// SET DROP
// ============================================================

function setDrop(
    lat,
    lng,
    address = ""
) {

    dropCoords = {

        lat:
            Number(lat),

        lng:
            Number(lng),

        address:
            String(address || "")

    };


    createMarker(
        "drop",
        lat,
        lng
    );


    const input =
        $("dropInput");


    if (input) {

        input.value =
            address ||
            `${lat}, ${lng}`;

    }


    updatePreview();

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
                    position.coords.latitude.toFixed(6)
                );


            const lng =
                Number(
                    position.coords.longitude.toFixed(6)
                );


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


            selectingMode =
                "drop";


            setStatus(
                "Now select destination"
            );

        },

        (error) => {

            console.warn(
                "Location error:",
                error
            );


            setStatus(
                "Select pickup location"
            );

        },

        {

            enableHighAccuracy:
                true,

            timeout:
                12000,

            maximumAge:
                5000

        }

    );

}


// ============================================================
// HAVERSINE DISTANCE
// ============================================================

function haversine(
    pointA,
    pointB
) {

    const R =
        6371;


    const dLat =
        (
            pointB.lat -
            pointA.lat
        )
        *
        Math.PI /
        180;


    const dLng =
        (
            pointB.lng -
            pointA.lng
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
            pointA.lat *
            Math.PI /
            180
        )

        *

        Math.cos(
            pointB.lat *
            Math.PI /
            180
        )

        *

        Math.sin(
            dLng / 2
        ) ** 2;


    return (

        R *

        2 *

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(
                1 - a
            )

        )

    );

}


// ============================================================
// LOAD FARE SETTINGS
// ============================================================

async function loadFareSettings() {

    try {

        const reference =
            doc(
                db,
                "settings",
                "fare"
            );


        const snapshot =
            await getDoc(
                reference
            );


        if (
            snapshot.exists()
        ) {

            fareSettings =
                snapshot.data();

        } else {

            fareSettings =
                DEFAULT_FARE;

        }

    }

    catch (error) {

        console.warn(
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

    const defaultFare =
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

            ...defaultFare,

            ...fareSettings[
                selectedService
            ]

        };

    }


    return defaultFare;

}


// ============================================================
// CALCULATE FARE
// ============================================================

function calculateFare() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        distanceKm = 0;

        durationMin = 0;

        estimatedFare = 0;

        updateFareUI();

        return 0;

    }


    const fare =
        getServiceFare();


    const hour =
        new Date()
            .getHours();


    const rate =

        (
            hour >= 22 ||
            hour < 6
        )

            ?

        Number(
            fare.nightRate ??
            11
        )

            :

        Number(
            fare.dayRate ??
            8
        );


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
        distanceKm <= 10
    ) {

        total +=
            distanceKm *
            rate;

    }

    else {

        total +=
            10 *
            rate;


        total +=

            (
                distanceKm -
                10
            )
            *
            extraRate;

    }


    estimatedFare =
        Math.max(

            base,

            Math.round(
                total
            )

        );


    updateFareUI();


    return estimatedFare;

}


// ============================================================
// FARE UI
// ============================================================

function updateFareUI() {

    const distance =
        $("distanceDisplay");


    if (distance) {

        distance.textContent =

            distanceKm > 0

                ?

            `${distanceKm.toFixed(1)} km`

                :

            "0 km";

    }


    const duration =
        $("durationDisplay");


    if (duration) {

        duration.textContent =

            durationMin > 0

                ?

            `${durationMin} min`

                :

            "0 min";

    }


    const fare =
        $("fareDisplay");


    if (fare) {

        fare.textContent =
            `₹${estimatedFare}`;

    }


    const oldFare =
        $("fare");


    if (oldFare) {

        oldFare.textContent =
            `₹${estimatedFare}`;

    }


    const oldDistance =
        $("estimated-distance-display");


    if (oldDistance) {

        oldDistance.textContent =

            distanceKm > 0

                ?

            `${distanceKm.toFixed(1)} KM`

                :

            "0 KM";

    }


    updateBookButton();

}


// ============================================================
// ROAD ROUTE
// ============================================================

async function roadRoute() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        return null;

    }


    try {

        const url =

            "https://router.project-osrm.org/route/v1/driving/" +

            `${pickupCoords.lng},${pickupCoords.lat};` +

            `${dropCoords.lng},${dropCoords.lat}` +

            "?overview=full&geometries=geojson&steps=true";


        const response =
            await fetch(url);


        if (
            !response.ok
        ) {

            throw new Error(
                "Route request failed"
            );

        }


        const data =
            await response.json();


        if (
            !data.routes ||
            !data.routes.length
        ) {

            throw new Error(
                "No route found"
            );

        }


        const route =
            data.routes[0];


        distanceKm =
            Number(
                route.distance /
                1000
            );


        durationMin =
            Math.max(

                1,

                Math.round(
                    route.duration /
                    60
                )

            );


        return route;

    }

    catch (error) {

        console.warn(
            "Road routing unavailable:",
            error
        );


        distanceKm =
            haversine(
                pickupCoords,
                dropCoords
            );


        durationMin =
            Math.max(

                1,

                Math.round(
                    distanceKm * 3
                )

            );


        return null;

    }

}


// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute(
    route
) {

    if (
        !map ||
        !pickupCoords ||
        !dropCoords
    ) {

        return;

    }


    if (
        routeLayer
    ) {

        map.removeLayer(
            routeLayer
        );

    }


    let points;


    if (
        route &&
        route.geometry &&
        route.geometry.coordinates
    ) {

        points =
            route
                .geometry
                .coordinates
                .map(
                    point => [
                        point[1],
                        point[0]
                    ]
                );

    }

    else {

        points = [

            [
                pickupCoords.lat,
                pickupCoords.lng
            ],

            [
                dropCoords.lat,
                dropCoords.lng
            ]

        ];

    }


    routeLayer =
        L.polyline(

            points,

            {

                weight:
                    5,

                opacity:
                    0.9,

                color:
                    "#ffe500"

            }

        )
        .addTo(map);


    map.fitBounds(

        routeLayer.getBounds(),

        {

            padding:
                [80, 100]

        }

    );

}


// ============================================================
// UPDATE PREVIEW
// ============================================================

async function updatePreview() {

    if (
        !pickupCoords ||
        !dropCoords
    ) {

        distanceKm = 0;

        durationMin = 0;

        estimatedFare = 0;

        updateFareUI();

        return;

    }


    setStatus(
        "Calculating route..."
    );


    const route =
        await roadRoute();


    calculateFare();


    drawRoute(
        route
    );


    setStatus(
        "Ready to book"
    );

}


// ============================================================
// SEARCH SETUP
// ============================================================

function setupSearch(
    inputId,
    resultId,
    type
) {

    const input =
        $(inputId);


    const results =
        $(resultId);


    if (
        !input ||
        !results
    ) {

        return;

    }


    input.addEventListener(
        "focus",
        () => {

            selectingMode =
                type;


            setStatus(

                type === "pickup"

                    ?

                "Choose pickup"

                    :

                "Choose destination"

            );

        }
    );


    input.addEventListener(
        "input",
        () => {

            clearTimeout(
                searchTimer
            );


            const query =
                input.value.trim();


            if (
                query.length < 3
            ) {

                results.style.display =
                    "none";

                return;

            }


            searchTimer =
                setTimeout(
                    () => {

                        searchPlaces(
                            query,
                            type,
                            results
                        );

                    },
                    450
                );

        }
    );

}


// ============================================================
// SEARCH PLACES
// ============================================================

async function searchPlaces(
    query,
    type,
    results
) {

    try {

        const url =

            "https://nominatim.openstreetmap.org/search" +

            "?format=json" +

            "&limit=6" +

            "&countrycodes=in" +

            "&q=" +

            encodeURIComponent(
                query
            );


        const response =
            await fetch(
                url,
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        const data =
            await response.json();


        results.innerHTML =
            "";


        if (
            !data.length
        ) {

            results.style.display =
                "none";

            return;

        }


        data.forEach(
            place => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "result";


                item.textContent =
                    place.display_name;


                item.addEventListener(
                    "click",
                    () => {

                        const lat =
                            Number(
                                place.lat
                            );


                        const lng =
                            Number(
                                place.lon
                            );


                        if (
                            type ===
                            "pickup"
                        ) {

                            setPickup(

                                lat,

                                lng,

                                place.display_name

                            );


                            selectingMode =
                                "drop";

                        }

                        else {

                            setDrop(

                                lat,

                                lng,

                                place.display_name

                            );


                            selectingMode =
                                null;

                        }


                        results.style.display =
                            "none";


                        if (map) {

                            map.setView(
                                [lat, lng],
                                16
                            );

                        }


                        updatePreview();

                    }
                );


                results.appendChild(
                    item
                );

            }
        );


        results.style.display =
            "block";

    }

    catch (error) {

        console.warn(
            "Location search failed:",
            error
        );


        results.style.display =
            "none";

    }

}


// ============================================================
// BOOK RIDE
// ============================================================

async function bookRide() {

    if (
        bookingInProgress
    ) {

        return;

    }


    if (!currentUser) {

        window.location.href =
            "../auth/login.html?role=customer";

        return;

    }


    if (
        !pickupCoords ||
        !dropCoords
    ) {

        showToast(
            "Pickup aur destination select karein"
        );

        return;

    }


    bookingInProgress =
        true;


    updateBookButton();


    showSearching(
        true,
        "Calculating route..."
    );


    try {

        const route =
            await roadRoute();


        if (route) {

            drawRoute(
                route
            );

        }


        calculateFare();


        const pickupAddress =
            $("pickupInput")?.value ||

            pickupCoords.address ||

            "Pickup location";


        const dropAddress =
            $("dropInput")?.value ||

            dropCoords.address ||

            "Destination";


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
                    distanceKm.toFixed(2)
                ),


            duration:
                Number(
                    durationMin
                ),


            fare:
                Number(
                    estimatedFare
                ),


            paymentMethod:
                selectedPayment,


            status:
                "REQUESTED",


            riderId:
                null,


            driverId:
                null,


            createdAt:
                serverTimestamp(),


            requestedAt:
                serverTimestamp()

        };


        showSearching(
            true,
            "Searching nearby RiderX riders..."
        );


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


        console.log(
            "RiderX ride created:",
            rideRef.id
        );


        startRideListener(
            rideRef.id
        );


        setStatus(
            "Searching nearby RiderX riders..."
        );


        showToast(
            "Ride request sent"
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

    }

    catch (error) {

        console.error(
            "RiderX booking error:",
            error
        );


        bookingInProgress =
            false;


        updateBookButton();


        showSearching(
            false
        );


        if (
            error.code ===
            "permission-denied"
        ) {

            setStatus(
                "Booking permission denied. Check Firestore Rules."
            );

            showToast(
                "Firestore permission denied"
            );

        }

        else {

            setStatus(
                "Ride booking failed"
            );

            showToast(
                "Booking failed"
            );

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

                    showSearching(
                        false
                    );


                    setStatus(
                        "Ride request no longer exists"
                    );


                    return;

                }


                const ride =
                    snapshot.data();


                const rideStatus =
                    String(
                        ride.status ||
                        "REQUESTED"
                    )
                    .toUpperCase();


                console.log(
                    "RiderX Ride Status:",
                    rideStatus
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
                                    rideStatus

                            }

                        }
                    )

                );


                /* REQUESTED */

                if (

                    rideStatus ===
                    "REQUESTED" ||

                    rideStatus ===
                    "SEARCHING"

                ) {

                    showSearching(

                        true,

                        "Searching nearby RiderX riders..."

                    );


                    setStatus(
                        "Searching nearby RiderX riders..."
                    );

                }


                /* ACCEPTED */

                else if (
                    rideStatus ===
                    "ACCEPTED"
                ) {

                    showSearching(
                        false
                    );


                    bookingInProgress =
                        false;


                    updateBookButton();


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


                /* ARRIVING */

                else if (
                    rideStatus ===
                    "ARRIVING"
                ) {

                    showSearching(
                        false
                    );


                    setStatus(
                        "Your RiderX rider is arriving"
                    );

                }


                /* ARRIVED */

                else if (
                    rideStatus ===
                    "ARRIVED"
                ) {

                    showSearching(
                        false
                    );


                    setStatus(
                        "Rider has arrived • Verify OTP"
                    );

                }


                /* STARTED */

                else if (
                    rideStatus ===
                    "STARTED"
                ) {

                    showSearching(
                        false
                    );


                    setStatus(
                        "Ride started"
                    );

                }


                /* COMPLETED */

                else if (
                    rideStatus ===
                    "COMPLETED"
                ) {

                    showSearching(
                        false
                    );


                    bookingInProgress =
                        false;


                    updateBookButton();


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


                /* CANCELLED */

                else if (
                    rideStatus ===
                    "CANCELLED"
                ) {

                    showSearching(
                        false
                    );


                    bookingInProgress =
                        false;


                    updateBookButton();


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


                showSearching(
                    false
                );


                setStatus(
                    "Unable to track ride"
                );

            }

        );

}


// ============================================================
// UI SETUP
// ============================================================

function setupUI() {


    /* BACK */

    $("backBtn")
        ?.addEventListener(
            "click",
            () => {

                history.back();

            }
        );


    /* CURRENT LOCATION */

    $("myLocation")
        ?.addEventListener(
            "click",
            useCurrentLocation
        );


    /* PICKUP MAP BUTTON */

    $("pickupMapBtn")
        ?.addEventListener(
            "click",
            () => {

                selectingMode =
                    "pickup";


                const center =
                    $("centerMarker");


                if (center) {

                    center.style.display =
                        "block";

                }


                setStatus(
                    "Move map to choose pickup"
                );

            }
        );


    /* DROP MAP BUTTON */

    $("dropMapBtn")
        ?.addEventListener(
            "click",
            () => {

                selectingMode =
                    "drop";


                const center =
                    $("centerMarker");


                if (center) {

                    center.style.display =
                        "block";

                }


                setStatus(
                    "Move map to choose destination"
                );

            }
        );


    /* SERVICES */

    document
        .querySelectorAll(
            ".service"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedService =
                            String(
                                button.dataset.service ||
                                "bike"
                            )
                            .trim()
                            .toLowerCase();


                        document
                            .querySelectorAll(
                                ".service"
                            )
                            .forEach(
                                item => {

                                    item.classList.toggle(

                                        "active",

                                        item ===
                                        button

                                    );

                                }
                            );


                        calculateFare();

                    }
                );

            }
        );


    /* PAYMENT */

    document
        .querySelectorAll(
            ".payment-option"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedPayment =
                            String(
                                button.dataset.payment ||
                                "cash"
                            )
                            .trim()
                            .toLowerCase();


                        document
                            .querySelectorAll(
                                ".payment-option"
                            )
                            .forEach(
                                item => {

                                    item.classList.toggle(

                                        "active",

                                        item ===
                                        button

                                    );

                                }
                            );

                    }
                );

            }
        );


    /* BOOK BUTTON */

    $("bookRideBtn")
        ?.addEventListener(
            "click",
            bookRide
        );


    /* SEARCH */

    setupSearch(
        "pickupInput",
        "pickupResults",
        "pickup"
    );


    setupSearch(
        "dropInput",
        "dropResults",
        "drop"
    );

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(

    auth,

    user => {

        currentUser =
            user;


        if (!user) {

            setStatus(
                "Please login first"
            );

        }

        else if (
            !pickupCoords
        ) {

            setStatus(
                "Select pickup location"
            );

        }


        updateBookButton();

    }

);


// ============================================================
// RESET
// ============================================================

function resetBooking() {

    pickupCoords =
        null;

    dropCoords =
        null;

    distanceKm =
        0;

    durationMin =
        0;

    estimatedFare =
        0;

    currentRideId =
        null;


    bookingInProgress =
        false;


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
        $("pickupInput")
    ) {

        $("pickupInput").value =
            "";

    }


    if (
        $("dropInput")
    ) {

        $("dropInput").value =
            "";

    }


    selectingMode =
        "pickup";


    showSearching(
        false
    );


    updateFareUI();


    updateBookButton();


    setStatus(
        "Select pickup location"
    );

}


// ============================================================
// INIT
// ============================================================

async function init() {

    console.log(
        "RiderX Customer Engine Started"
    );


    initMap();


    setupUI();


    await loadFareSettings();


    calculateFare();


    updateBookButton();

}


// ============================================================
// GLOBAL API
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

    getRideId:

        () =>
            currentRideId,

    reset:

        resetBooking

};


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

}

else {

    init();

        }
