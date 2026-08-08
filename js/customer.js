// ============================================================
// RiderX Customer Engine
// Uber-style Customer Booking Core
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
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ============================================================
// STATE
// ============================================================

let map = null;

let currentUser = null;

let pickupMarker = null;
let dropMarker = null;
let riderMarker = null;
let routeLayer = null;

let pickupCoords = null;
let dropCoords = null;

let selectingMode = "pickup";

let selectedService = "bike";
let selectedPayment = "cash";

let distanceKm = 0;
let durationMin = 0;
let estimatedFare = 0;

let fareSettings = null;

let currentRideId = null;
let rideUnsubscribe = null;

let searchTimer = null;


// ============================================================
// DEFAULT FARES
// ============================================================

const DEFAULT_FARES = {

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

const $ = id =>
    document.getElementById(id);


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    init,
    { once:true }
);


// ============================================================
// INIT
// ============================================================

async function init(){

    console.log(
        "RiderX Customer Engine Started"
    );


    setupButtons();

    setupServices();

    setupPayment();

    setupInputs();

    setupAuth();

    initMap();

    await loadFareSettings();

    updateFareUI();

    updateBookButton();

}


// ============================================================
// AUTH
// ============================================================

function setupAuth(){

    onAuthStateChanged(
        auth,
        user => {

            currentUser = user;


            if(!user){

                setStatus(
                    "Please login to book a ride"
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

}


// ============================================================
// MAP
// ============================================================

function initMap(){

    const mapElement =
        $("map");


    if(!mapElement){

        console.error(
            "RiderX: map element missing"
        );

        return;
    }


    if(typeof L === "undefined"){

        console.error(
            "Leaflet is not loaded"
        );

        return;
    }


    map =
        L.map(
            mapElement,
            {
                zoomControl:true
            }
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);


    map.setView(
        [30.7333,76.7794],
        13
    );


    map.on(
        "click",
        event => {

            const lat =
                Number(
                    event.latlng.lat.toFixed(6)
                );

            const lng =
                Number(
                    event.latlng.lng.toFixed(6)
                );


            if(
                selectingMode ===
                "pickup"
            ){

                setPickup(
                    lat,
                    lng,
                    "Selected pickup"
                );


                selectingMode =
                    "drop";


                setStatus(
                    "Now select destination"
                );


                return;
            }


            setDrop(
                lat,
                lng,
                "Selected destination"
            );


            selectingMode =
                "pickup";


            setStatus(
                "Pickup & destination selected"
            );

        }
    );


    setTimeout(
        () => {

            map.invalidateSize();

        },
        400
    );


    setTimeout(
        useCurrentLocation,
        700
    );

}


// ============================================================
// CURRENT LOCATION
// ============================================================

function useCurrentLocation(){

    if(
        !navigator.geolocation
    ){

        showToast(
            "GPS is not supported on this device.",
            "error"
        );

        return;
    }


    setStatus(
        "Getting your location..."
    );


    navigator.geolocation.getCurrentPosition(

        async position => {

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;


            if(map){

                map.setView(
                    [lat,lng],
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


            try{

                const address =
                    await reverseGeocode(
                        lat,
                        lng
                    );


                if(address){

                    const input =
                        $("pickupInput");


                    if(input){

                        input.value =
                            address;

                    }

                }

            }
            catch(error){

                console.warn(
                    "Reverse geocode failed",
                    error
                );

            }

        },

        error => {

            console.warn(
                "GPS error",
                error
            );


            setStatus(
                "Select pickup location"
            );


            showToast(
                "Location permission allow karein.",
                "error"
            );

        },

        {
            enableHighAccuracy:true,
            timeout:10000,
            maximumAge:10000
        }

    );

}


// ============================================================
// SET PICKUP
// ============================================================

function setPickup(
    lat,
    lng,
    address=""
){

    pickupCoords = {

        lat:Number(lat),

        lng:Number(lng),

        address:String(
            address || ""
        )

    };


    if(
        pickupMarker &&
        map
    ){

        map.removeLayer(
            pickupMarker
        );

    }


    pickupMarker =
        L.marker(
            [lat,lng]
        )
        .addTo(map)
        .bindPopup(
            "Pickup"
        );


    const input =
        $("pickupInput");


    if(input){

        input.value =
            address ||
            `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    }


    updateRideData();

}


// ============================================================
// SET DROP
// ============================================================

function setDrop(
    lat,
    lng,
    address=""
){

    dropCoords = {

        lat:Number(lat),

        lng:Number(lng),

        address:String(
            address || ""
        )

    };


    if(
        dropMarker &&
        map
    ){

        map.removeLayer(
            dropMarker
        );

    }


    dropMarker =
        L.marker(
            [lat,lng]
        )
        .addTo(map)
        .bindPopup(
            "Destination"
        );


    const input =
        $("dropInput");


    if(input){

        input.value =
            address ||
            `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    }


    updateRideData();

}


// ============================================================
// DISTANCE
// ============================================================

function calculateDistance(
    lat1,
    lng1,
    lat2,
    lng2
){

    const R =
        6371;


    const dLat =
        (lat2-lat1)
        * Math.PI / 180;


    const dLng =
        (lng2-lng1)
        * Math.PI / 180;


    const a =

        Math.sin(
            dLat/2
        ) ** 2

        +

        Math.cos(
            lat1*Math.PI/180
        )

        *

        Math.cos(
            lat2*Math.PI/180
        )

        *

        Math.sin(
            dLng/2
        ) ** 2;


    return (

        R *

        2 *

        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        )

    );

}


// ============================================================
// ROUTE
// ============================================================

async function calculateRoute(){

    if(
        !pickupCoords ||
        !dropCoords
    ){

        distanceKm = 0;
        durationMin = 0;

        updateFare();

        return;
    }


    try{

        const url =

            "https://router.project-osrm.org/route/v1/driving/" +

            `${pickupCoords.lng},${pickupCoords.lat};` +

            `${dropCoords.lng},${dropCoords.lat}` +

            "?overview=full&geometries=geojson";


        const response =
            await fetch(url);


        if(
            !response.ok
        ){

            throw new Error(
                "Routing service unavailable"
            );

        }


        const data =
            await response.json();


        if(
            !data.routes ||
            !data.routes.length
        ){

            throw new Error(
                "Route not found"
            );

        }


        const route =
            data.routes[0];


        distanceKm =
            Number(
                (
                    route.distance /
                    1000
                ).toFixed(2)
            );


        durationMin =
            Math.max(
                1,
                Math.round(
                    route.duration /
                    60
                )
            );


        drawRoute(
            route.geometry
        );


    }
    catch(error){

        console.warn(
            "OSRM route failed. Using direct distance.",
            error
        );


        distanceKm =
            Number(
                calculateDistance(

                    pickupCoords.lat,
                    pickupCoords.lng,

                    dropCoords.lat,
                    dropCoords.lng

                ).toFixed(2)
            );


        durationMin =
            Math.max(
                1,
                Math.round(
                    distanceKm * 3
                )
            );


        drawStraightRoute();

    }


    updateFare();

}


// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute(
    geometry
){

    if(
        !map ||
        !geometry ||
        !geometry.coordinates
    ){

        return;
    }


    if(routeLayer){

        map.removeLayer(
            routeLayer
        );

    }


    const points =
        geometry.coordinates.map(
            point => [
                point[1],
                point[0]
            ]
        );


    routeLayer =
        L.polyline(
            points,
            {
                color:"#ffe500",
                weight:6,
                opacity:.9
            }
        ).addTo(map);


    map.fitBounds(
        routeLayer.getBounds(),
        {
            padding:[
                100,
                100
            ]
        }
    );

}


// ============================================================
// STRAIGHT ROUTE FALLBACK
// ============================================================

function drawStraightRoute(){

    if(
        !map ||
        !pickupCoords ||
        !dropCoords
    ){

        return;
    }


    if(routeLayer){

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
                color:"#ffe500",
                weight:5,
                dashArray:"10 8"
            }
        ).addTo(map);

}


// ============================================================
// FARE SETTINGS
// ============================================================

async function loadFareSettings(){

    try{

        const ref =
            doc(
                db,
                "settings",
                "fare"
            );


        const snapshot =
            await getDoc(ref);


        if(
            snapshot.exists()
        ){

            fareSettings =
                snapshot.data();


        }else{

            fareSettings =
                DEFAULT_FARES;

        }

    }
    catch(error){

        console.warn(
            "Fare settings unavailable.",
            error
        );


        fareSettings =
            DEFAULT_FARES;

    }

}


// ============================================================
// SERVICE FARE
// ============================================================

function getServiceFare(){

    const defaults =
        DEFAULT_FARES[
            selectedService
        ] ||
        DEFAULT_FARES.bike;


    const admin =
        fareSettings &&
        fareSettings[
            selectedService
        ];


    return {

        ...defaults,

        ...(admin || {})

    };

}


// ============================================================
// CALCULATE FARE
// ============================================================

function calculateFare(){

    if(
        !pickupCoords ||
        !dropCoords ||
        distanceKm <= 0
    ){

        estimatedFare = 0;

        updateFareUI();

        return 0;
    }


    const fare =
        getServiceFare();


    const hour =
        new Date().getHours();


    let perKm;


    if(
        hour >= 22 ||
        hour < 6
    ){

        perKm =
            Number(
                fare.nightRate ??
                11
            );

    }
    else{

        perKm =
            Number(
                fare.dayRate ??
                8
            );

    }


    const extraRate =
        Number(
            fare.extraRate ??
            perKm
        );


    const baseFare =
        Number(
            fare.baseFare ??
            30
        );


    let total =
        baseFare;


    if(
        distanceKm <= 10
    ){

        total +=
            distanceKm *
            perKm;

    }
    else{

        total +=
            10 *
            perKm;


        total +=
            (
                distanceKm - 10
            ) *
            extraRate;

    }


    estimatedFare =
        Math.max(
            50,
            Math.round(total)
        );


    updateFareUI();


    return estimatedFare;

}


// ============================================================
// FARE UI
// ============================================================

function updateFare(){

    calculateFare();

    updateFareUI();

}


// ============================================================
// FARE DISPLAY
// ============================================================

function updateFareUI(){

    const distance =
        $("distanceDisplay");


    const duration =
        $("durationDisplay");


    const fare =
        $("fareDisplay");


    const info =
        $("fareInfo");


    if(distance){

        distance.textContent =
            distanceKm > 0
                ? `${distanceKm.toFixed(1)} km`
                : "0 km";

    }


    if(duration){

        duration.textContent =
            durationMin > 0
                ? `${durationMin} min`
                : "0 min";

    }


    if(fare){

        fare.textContent =
            "₹" +
            estimatedFare;

    }


    if(info){

        if(
            distanceKm > 0
        ){

            info.textContent =
                `${selectedService.toUpperCase()} • ${distanceKm.toFixed(1)} km`;

        }else{

            info.textContent =
                "Select pickup & destination";

        }

    }

}


// ============================================================
// RIDE DATA UPDATE
// ============================================================

async function updateRideData(){

    updateBookButton();

    calculateFare();

    if(
        pickupCoords &&
        dropCoords
    ){

        await calculateRoute();

    }

}


// ============================================================
// BOOK BUTTON
// ============================================================

function updateBookButton(){

    const button =
        $("bookRideBtn");


    if(!button){

        return;
    }


    button.disabled = !(
        currentUser &&
        pickupCoords &&
        dropCoords &&
        distanceKm > 0
    );

}


// ============================================================
// SERVICES
// ============================================================

function setupServices(){

    document
        .querySelectorAll(
            ".service"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".service"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        element.classList.add(
                            "active"
                        );


                        selectedService =
                            String(
                                element.dataset.service ||
                                "bike"
                            )
                            .toLowerCase();


                        calculateFare();

                    }
                );

            }
        );

}


// ============================================================
// PAYMENT
// ============================================================

function setupPayment(){

    document
        .querySelectorAll(
            ".payment-option"
        )
        .forEach(
            option => {

                option.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".payment-option"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        option.classList.add(
                            "active"
                        );


                        selectedPayment =
                            String(
                                option.dataset.payment ||
                                "cash"
                            )
                            .toLowerCase();

                    }
                );

            }
        );

}


// ============================================================
// BUTTONS
// ============================================================

function setupButtons(){

    $("backBtn")
        ?.addEventListener(
            "click",
            () => history.back()
        );


    $("myLocation")
        ?.addEventListener(
            "click",
            useCurrentLocation
        );


    $("pickupMapBtn")
        ?.addEventListener(
            "click",
            () => {

                selectingMode =
                    "pickup";


                $("centerMarker")
                    .style.display =
                    "block";


                setStatus(
                    "Move map and select pickup"
                );

            }
        );


    $("dropMapBtn")
        ?.addEventListener(
            "click",
            () => {

                selectingMode =
                    "drop";


                $("centerMarker")
                    .style.display =
                    "block";


                setStatus(
                    "Move map and select destination"
                );

            }
        );


    $("bookRideBtn")
        ?.addEventListener(
            "click",
            bookRide
        );

}


// ============================================================
// INPUTS
// ============================================================

function setupInputs(){

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


    $("pickupInput")
        ?.addEventListener(
            "focus",
            () => {

                selectingMode =
                    "pickup";

            }
        );


    $("dropInput")
        ?.addEventListener(
            "focus",
            () => {

                selectingMode =
                    "drop";

            }
        );

}


// ============================================================
// SEARCH LOCATION
// ============================================================

function setupSearch(
    inputId,
    resultsId,
    type
){

    const input =
        $(inputId);

    const results =
        $(resultsId);


    if(
        !input ||
        !results
    ){

        return;
    }


    input.addEventListener(
        "input",
        () => {

            const value =
                input.value.trim();


            clearTimeout(
                searchTimer
            );


            if(
                value.length < 3
            ){

                results.classList.remove(
                    "show"
                );

                results.innerHTML =
                    "";

                return;
            }


            searchTimer =
                setTimeout(
                    () => {

                        searchLocation(
                            value,
                            type,
                            results
                        );

                    },
                    500
                );

        }
    );

}


// ============================================================
// NOMINATIM SEARCH
// ============================================================

async function searchLocation(
    text,
    type,
    resultsElement
){

    try{

        resultsElement.classList.add(
            "show"
        );


        resultsElement.innerHTML =
            `<div class="search-item">
                Searching...
            </div>`;


        const url =

            "https://nominatim.openstreetmap.org/search" +

            "?format=json" +

            "&limit=5" +

            "&countrycodes=in" +

            "&q=" +

            encodeURIComponent(text);


        const response =
            await fetch(
                url,
                {
                    headers:{
                        "Accept":
                            "application/json"
                    }
                }
            );


        const results =
            await response.json();


        if(
            !results.length
        ){

            resultsElement.innerHTML =
                `<div class="search-item">
                    Location not found
                </div>`;

            return;
        }


        resultsElement.innerHTML =
            "";


        results.forEach(
            result => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "search-item";


                item.textContent =
                    result.display_name;


                item.addEventListener(
                    "click",
                    () => {

                        const lat =
                            Number(
                                result.lat
                            );

                        const lng =
                            Number(
                                result.lon
                            );


                        if(
                            type ===
                            "pickup"
                        ){

                            setPickup(
                                lat,
                                lng,
                                result.display_name
                            );

                            selectingMode =
                                "drop";

                        }else{

                            setDrop(
                                lat,
                                lng,
                                result.display_name
                            );

                            selectingMode =
                                "pickup";

                        }


                        resultsElement.classList.remove(
                            "show"
                        );


                        if(map){

                            map.setView(
                                [lat,lng],
                                16
                            );

                        }

                    }
                );


                resultsElement.appendChild(
                    item
                );

            }
        );

    }
    catch(error){

        console.error(
            "Location search error",
            error
        );


        resultsElement.innerHTML =
            `<div class="search-item">
                Search failed
            </div>`;

    }

}


// ============================================================
// REVERSE GEOCODE
// ============================================================

async function reverseGeocode(
    lat,
    lng
){

    const url =

        "https://nominatim.openstreetmap.org/reverse" +

        "?format=json" +

        "&lat=" +
        encodeURIComponent(lat) +

        "&lon=" +
        encodeURIComponent(lng);


    const response =
        await fetch(
            url
        );


    if(
        !response.ok
    ){

        return "";
    }


    const data =
        await response.json();


    return (
        data.display_name ||
        ""
    );

}


// ============================================================
// BOOK RIDE
// ============================================================

async function bookRide(){

    if(!currentUser){

        showToast(
            "Please login first.",
            "error"
        );


        setTimeout(
            () => {

                window.location.href =
                    "../auth/login.html?role=customer";

            },
            500
        );


        return;
    }


    if(
        !pickupCoords ||
        !dropCoords
    ){

        showToast(
            "Pickup aur destination select karein.",
            "error"
        );

        return;
    }


    calculateFare();


    if(
        !estimatedFare
    ){

        showToast(
            "Fare calculate nahi hua.",
            "error"
        );

        return;
    }


    const button =
        $("bookRideBtn");


    if(button){

        button.disabled =
            true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

    }


    showSearching(
        "Creating your ride request..."
    );


    try{

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


            pickup:{

                lat:
                    pickupCoords.lat,

                lng:
                    pickupCoords.lng,

                address:
                    pickupCoords.address ||
                    $("pickupInput")?.value ||
                    "Pickup",

                name:
                    $("pickupInput")?.value ||
                    "Pickup"

            },


            drop:{

                lat:
                    dropCoords.lat,

                lng:
                    dropCoords.lng,

                address:
                    dropCoords.address ||
                    $("dropInput")?.value ||
                    "Destination",

                name:
                    $("dropInput")?.value ||
                    "Destination"

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


            riderLocation:
                null,


            createdAt:
                serverTimestamp(),


            requestedAt:
                serverTimestamp()

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


        console.log(
            "RiderX Ride Created:",
            rideRef.id
        );


        startRideListener(
            rideRef.id
        );


        hideSearching();


        setStatus(
            "Finding nearby RiderX riders..."
        );


        showToast(
            "Ride request sent successfully.",
            "success"
        );


        window.dispatchEvent(
            new CustomEvent(
                "riderx:ride-created",
                {
                    detail:{
                        rideId:
                            rideRef.id,

                        ride:
                            rideData
                    }
                }
            )
        );


    }
    catch(error){

        console.error(
            "RiderX booking error:",
            error
        );


        hideSearching();


        if(
            error.code ===
            "permission-denied"
        ){

            showToast(
                "Firestore permission denied. Rules check karein.",
                "error"
            );

        }else{

            showToast(
                "Ride booking failed.",
                "error"
            );

        }


        if(button){

            button.disabled =
                false;

            button.innerHTML =
                '<i class="fa-solid fa-car-side"></i> Confirm Ride';

        }

    }

}


// ============================================================
// RIDE LISTENER
// ============================================================

function startRideListener(
    rideId
){

    if(
        typeof rideUnsubscribe ===
        "function"
    ){

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

            snapshot => {

                if(
                    !snapshot.exists()
                ){

                    setStatus(
                        "Ride request removed"
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
                    .toUpperCase();


                console.log(
                    "RiderX Ride Status:",
                    status
                );


                window.dispatchEvent(
                    new CustomEvent(
                        "riderx:ride-status",
                        {
                            detail:{
                                rideId,
                                ride,
                                status
                            }
                        }
                    )
                );


                if(
                    status ===
                    "REQUESTED"
                ){

                    showSearching(
                        "Looking for nearby RiderX riders..."
                    );


                    setStatus(
                        "Searching nearby riders..."
                    );

                }


                else if(
                    status ===
                    "ACCEPTED"
                ){

                    hideSearching();


                    setStatus(
                        "Rider accepted your ride"
                    );


                    showToast(
                        "Rider accepted your ride!",
                        "success"
                    );


                    updateRiderMarker(
                        ride
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx:ride-accepted",
                            {
                                detail:{
                                    rideId,
                                    ride
                                }
                            }
                        )
                    );


                    setTimeout(
                        () => {

                            if(
                                window.location.pathname
                                    .includes(
                                        "/booking.html"
                                    )
                            ){

                                window.location.href =
                                    "ride-status.html?id=" +
                                    encodeURIComponent(
                                        rideId
                                    );

                            }

                        },
                        1200
                    );

                }


                else if(
                    status ===
                    "ARRIVING"
                ){

                    hideSearching();


                    setStatus(
                        "Your RiderX rider is arriving"
                    );


                    updateRiderMarker(
                        ride
                    );

                }


                else if(
                    status ===
                    "ARRIVED"
                ){

                    hideSearching();


                    setStatus(
                        "Rider has arrived"
                    );


                    updateRiderMarker(
                        ride
                    );

                }


                else if(
                    status ===
                    "STARTED"
                ){

                    hideSearching();


                    setStatus(
                        "Ride started"
                    );


                    updateRiderMarker(
                        ride
                    );

                }


                else if(
                    status ===
                    "COMPLETED"
                ){

                    hideSearching();


                    setStatus(
                        "Ride completed"
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx:ride-completed",
                            {
                                detail:{
                                    rideId,
                                    ride
                                }
                            }
                        )
                    );

                }


                else if(
                    status ===
                    "CANCELLED"
                ){

                    hideSearching();


                    setStatus(
                        "Ride cancelled"
                    );


                    showToast(
                        "Ride cancelled.",
                        "error"
                    );


                    window.dispatchEvent(
                        new CustomEvent(
                            "riderx:ride-cancelled",
                            {
                                detail:{
                                    rideId,
                                    ride
                                }
                            }
                        )
                    );

                }

            },

            error => {

                console.error(
                    "Ride listener error:",
                    error
                );


                hideSearching();


                setStatus(
                    "Unable to track ride"
                );

            }

        );

}


// ============================================================
// RIDER LIVE MARKER
// ============================================================

function updateRiderMarker(
    ride
){

    if(
        !map
    ){

        return;
    }


    const location =
        ride.riderLocation;


    if(
        !location ||
        location.lat === undefined ||
        location.lng === undefined
    ){

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


    if(
        riderMarker
    ){

        riderMarker.setLatLng(
            [lat,lng]
        );

    }else{

        riderMarker =
            L.marker(
                [lat,lng]
            )
            .addTo(map)
            .bindPopup(
                "RiderX Rider"
            );

    }

}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    text
){

    const status =
        $("status");


    if(status){

        status.textContent =
            text;

    }

}


// ============================================================
// SEARCHING
// ============================================================

function showSearching(
    text
){

    const overlay =
        $("searchingOverlay");


    const message =
        $("searchingText");


    if(message){

        message.textContent =
            text;

    }


    if(overlay){

        overlay.classList.add(
            "show"
        );

    }

}


function hideSearching(){

    const overlay =
        $("searchingOverlay");


    if(overlay){

        overlay.classList.remove(
            "show"
        );

    }

}


// ============================================================
// TOAST
// ============================================================

function showToast(
    text,
    type=""
){

    const toast =
        $("toast");


    if(!toast){

        return;
    }


    toast.textContent =
        text;


    toast.className =
        "toast show " +
        type;


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        2800
    );

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

    getRideId:
        () => currentRideId,

    getState:
        () => ({
            pickupCoords,
            dropCoords,
            selectedService,
            selectedPayment,
            distanceKm,
            durationMin,
            estimatedFare,
            currentRideId
        })

};
