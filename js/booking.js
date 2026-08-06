// =====================================
// RiderX Professional Booking System
// =====================================

import { auth, db } from "../firebase/config.js";

import {
collection,
addDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const service = document.getElementById("service");
const pickup = document.getElementById("pickup");
const drop = document.getElementById("drop");
const fare = document.getElementById("fare");
const bookBtn = document.getElementById("bookBtn");

let currentUser = null;

onAuthStateChanged(auth,(user)=>{

    if(!user){

        window.location.href="../auth/login.html";
        return;

    }

    currentUser=user;

});

// ===========================
// OpenStreetMap
// ===========================

const map=L.map("map").setView([30.7333,76.7794],13);

L.tileLayer(
"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
{
maxZoom:19,
attribution:"© OpenStreetMap"
}
).addTo(map);

let pickupMarker=null;

map.on("click",(e)=>{

    if(pickupMarker){

        map.removeLayer(pickupMarker);

    }

    pickupMarker=L.marker(e.latlng).addTo(map);

    pickup.value=
    e.latlng.lat.toFixed(6)+","+e.latlng.lng.toFixed(6);

    calculateFare();

});

// ===========================
// Current Location
// ===========================

if(navigator.geolocation){

navigator.geolocation.getCurrentPosition(

(position)=>{

const lat=position.coords.latitude;
const lng=position.coords.longitude;

map.setView([lat,lng],15);

L.marker([lat,lng])
.addTo(map)
.bindPopup("You are here")
.openPopup();

},

(error)=>{

console.log(error);

}

);

}

// ===========================
// Fare Calculation
// ===========================

function calculateFare(){

let baseFare=50;

switch(service.value){

case "Bike Taxi":
baseFare=50;
break;

case "Cab":
baseFare=120;
break;

case "Parcel":
baseFare=80;
break;

case "Food":
baseFare=60;
break;

}

let distance=5;

if(drop.value.trim()!==""){

distance=10;

}

const total=baseFare+(distance*8);

fare.innerHTML=total;

}

service.onchange=calculateFare;

drop.oninput=calculateFare;

calculateFare();
// ===========================
// Book Ride
// ===========================

bookBtn.onclick = async () => {

    if (!currentUser) {

        alert("Please Login First");
        return;

    }

    if (pickup.value.trim() === "") {

        alert("Please Select Pickup Location");
        return;

    }

    if (drop.value.trim() === "") {

        alert("Please Enter Drop Location");
        return;

    }

    try {

        const bookingRef = await addDoc(

            collection(db, "bookings"),

            {

                customerId: currentUser.uid,

                service: service.value,

                pickup: pickup.value,

                drop: drop.value,

                fare: Number(fare.innerHTML),

                riderId: null,

                status: "pending",

                paymentStatus: "Pending",

                bookingTime: new Date().toLocaleString(),

                createdAt: serverTimestamp()

            }

        );

        await bookingSuccess(bookingRef.id);

    }

    catch (error) {

        console.log(error);

        alert(error.message);

    }

};


// ===========================
// Booking Success
// ===========================

async function bookingSuccess(bookingId) {

    alert(
        "🎉 Ride Booked Successfully!\n\nBooking ID : " + bookingId
    );

    resetBookingForm();

    setTimeout(() => {

        window.location.href =
        "../customer/history.html";

    }, 1500);

}


// ===========================
// Reset Form
// ===========================

function resetBookingForm() {

    service.selectedIndex = 0;

    pickup.value = "";

    drop.value = "";

    calculateFare();

    if (pickupMarker) {

        map.removeLayer(pickupMarker);

        pickupMarker = null;

    }

}
// ===========================
// Rider Notification
// ===========================

async function notifyNearbyRiders(bookingId){

    console.log("Searching Nearby Riders...");

    // Future Update:
    // Yaha nearby online riders ko notification bheja jayega.

    return true;

}


// ===========================
// Live Booking Status
// ===========================

async function updateBookingStatus(status){

    console.log("Booking Status :", status);

}


// ===========================
// Service Change
// ===========================

service.addEventListener("change",()=>{

    calculateFare();

});


// ===========================
// Drop Location Change
// ===========================

drop.addEventListener("keyup",()=>{

    calculateFare();

});


// ===========================
// Pickup Location Change
// ===========================

pickup.addEventListener("keyup",()=>{

    calculateFare();

});


// ===========================
// Map Click
// ===========================
// Utility Functions
// ===========================

function getSelectedService(){

    return service.value;

}

function getPickupLocation(){

    return pickup.value.trim();

}

function getDropLocation(){

    return drop.value.trim();

}


// ===========================
// Validate Booking
// ===========================

function validateBooking(){

    if(getPickupLocation()===""){

        alert("Please Select Pickup Location");
        return false;

    }

    if(getDropLocation()===""){

        alert("Please Enter Drop Location");
        return false;

    }

    return true;

}


// ===========================
// Refresh Fare
// ===========================

setInterval(()=>{

    calculateFare();

},5000);


// ===========================
// Future Features
// ===========================

// Live Rider Tracking
// Route Navigation
// Distance API
// ETA Calculation
// Coupon System
// Wallet Payment
// Online Payment Gateway
// SOS Button
// Ride Sharing
// Voice Navigation
// Push Notifications


// ===========================
// RiderX Booking System Ready
// ===========================

console.log("=================================");
console.log(" RiderX Booking System Ready ");
console.log(" Firebase Connected ");
console.log(" OpenStreetMap Loaded ");
console.log(" Booking Module Active ");
console.log("=================================");
