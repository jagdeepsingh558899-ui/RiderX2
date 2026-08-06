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
let pickupMarker = null;

// =====================================
// Authentication
// =====================================

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href = "../auth/login.html";
        return;

    }

    currentUser = user;

});

// =====================================
// OpenStreetMap
// =====================================

const map = L.map("map").setView([30.7333, 76.7794], 13);

L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19,

attribution:"© OpenStreetMap"

}

).addTo(map);

// =====================================
// Current Location
// =====================================

if(navigator.geolocation){

navigator.geolocation.getCurrentPosition(

(position)=>{

const lat=position.coords.latitude;
const lng=position.coords.longitude;

map.setView([lat,lng],15);

L.marker([lat,lng])

.addTo(map)

.bindPopup("You are Here")

.openPopup();

},

(error)=>{

console.log(error);

}

);

}

// =====================================
// Pickup Location
// =====================================

map.on("click",(e)=>{

if(pickupMarker){

map.removeLayer(pickupMarker);

}

pickupMarker=L.marker(e.latlng).addTo(map);

pickup.value=

e.latlng.lat.toFixed(6)+

","+

e.latlng.lng.toFixed(6);

calculateFare();

});

// =====================================
// Fare Calculation
// =====================================

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

const totalFare=

baseFare+

(distance*8);

fare.innerHTML=totalFare;

}

service.addEventListener("change",calculateFare);

drop.addEventListener("input",calculateFare);

calculateFare();
// =====================================
// Booking Validation
// =====================================

function validateBooking(){

    if(pickup.value.trim()===""){

        alert("Please Select Pickup Location");
        return false;

    }

    if(drop.value.trim()===""){

        alert("Please Enter Drop Location");
        return false;

    }

    return true;

}


// =====================================
// Reset Booking Form
// =====================================

function resetBookingForm(){

    service.selectedIndex=0;

    pickup.value="";
    drop.value="";

    calculateFare();

    if(pickupMarker){

        map.removeLayer(pickupMarker);
        pickupMarker=null;

    }

}


// =====================================
// Booking Success
// =====================================

async function bookingSuccess(bookingId){

    alert(
        "🎉 Ride Booked Successfully!\n\nBooking ID : "+bookingId
    );

    resetBookingForm();

    setTimeout(()=>{

        window.location.href="../customer/history.html";

    },1500);

}


// =====================================
// Rider Notification
// =====================================

async function notifyNearbyRiders(bookingId){

    console.log("Searching Nearby Riders...");

    // Future:
    // Nearby online riders ko notification bhejna.

    return true;

}
// =====================================
// Book Ride
// =====================================

bookBtn.addEventListener("click", async()=>{

    if(!currentUser){

        alert("Please Login First");
        return;

    }

    if(!validateBooking()){

        return;

    }

    try{

        const bookingData={

            customerId:currentUser.uid,

            customerEmail:currentUser.email,

            service:service.value,

            pickup:pickup.value,

            drop:drop.value,

            fare:Number(fare.innerHTML),

            status:"pending",

            paymentStatus:"Pending",

            riderId:null,

            bookingDate:new Date().toLocaleDateString(),

            bookingTime:new Date().toLocaleTimeString(),

            createdAt:serverTimestamp()

        };

        const bookingRef=await addDoc(

            collection(db,"bookings"),

            bookingData

        );

        await notifyNearbyRiders(bookingRef.id);

        await bookingSuccess(bookingRef.id);

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

});


// =====================================
// Auto Refresh Fare
// =====================================

setInterval(()=>{

    calculateFare();

},5000);
// =====================================
// Booking Status
// =====================================

function updateBookingStatus(status){

    console.log("Booking Status :",status);

}


// =====================================
// Page Initialization
// =====================================

window.addEventListener("load",()=>{

    calculateFare();

    console.log("Booking Page Loaded");

});


// =====================================
// Service Change
// =====================================

service.addEventListener("change",()=>{

    calculateFare();

});


// =====================================
// Pickup Input
// =====================================

pickup.addEventListener("input",()=>{

    calculateFare();

});


// =====================================
// Drop Input
// =====================================

drop.addEventListener("input",()=>{

    calculateFare();

});


// =====================================
// Map Resize Fix
// =====================================

setTimeout(()=>{

    map.invalidateSize();

},500);


// =====================================
// Utility Functions
// =====================================

function getBookingData(){

    return{

        service:service.value,

        pickup:pickup.value,

        drop:drop.value,

        fare:Number(fare.innerHTML)

    };

}
// =====================================
// Booking Summary
// =====================================

function showBookingSummary(){

    const booking=getBookingData();

    console.log("========== Booking Summary ==========");
    console.log("Service :",booking.service);
    console.log("Pickup :",booking.pickup);
    console.log("Drop :",booking.drop);
    console.log("Fare : ₹"+booking.fare);
    console.log("=====================================");

}


// =====================================
// Clear Booking
// =====================================

function clearBooking(){

    service.selectedIndex=0;

    pickup.value="";

    drop.value="";

    calculateFare();

    if(pickupMarker){

        map.removeLayer(pickupMarker);

        pickupMarker=null;

    }

}


// =====================================
// Map Zoom Controls
// =====================================

function zoomIn(){

    map.zoomIn();

}

function zoomOut(){

    map.zoomOut();

}


// =====================================
// Refresh Location
// =====================================

function refreshLocation(){

    if(!navigator.geolocation){

        return;

    }

    navigator.geolocation.getCurrentPosition(

        (position)=>{

            const lat=position.coords.latitude;

            const lng=position.coords.longitude;

            map.setView([lat,lng],15);

        },

        (error)=>{

            console.log(error);

        }

    );

}


// =====================================
// Console Message
// =====================================

console.log("Booking Module Loaded Successfully");
// =====================================
// Future Features (Coming Soon)
// =====================================

// Live Rider Tracking
// Customer Live Tracking
// ETA Calculation
// Route Navigation
// Wallet Payment
// Razorpay / UPI Payment
// Coupons & Offers
// SOS Emergency
// Ride Sharing
// Voice Navigation
// Push Notifications
// Chat System
// Calling System
// Driver Rating
// Customer Rating


// =====================================
// RiderX Booking System Ready
// =====================================

console.log("====================================");
console.log(" RiderX Booking System Ready ");
console.log(" Firebase Connected ");
console.log(" OpenStreetMap Loaded ");
console.log(" Booking Service Active ");
console.log("====================================");

// End of booking.js
