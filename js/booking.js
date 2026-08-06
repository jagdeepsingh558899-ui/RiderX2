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

const service=document.getElementById("service");
const pickup=document.getElementById("pickup");
const drop=document.getElementById("drop");
const fare=document.getElementById("fare");
const bookBtn=document.getElementById("bookBtn");

let currentUser=null;

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
maxZoom:19
}
).addTo(map);

let pickupMarker=null;

map.on("click",(e)=>{

if(pickupMarker){

map.removeLayer(pickupMarker);

}

pickupMarker=L.marker(e.latlng).addTo(map);

pickup.value=e.latlng.lat.toFixed(6)+","+e.latlng.lng.toFixed(6);

calculateFare();

});


// ===========================
// Fare Calculation
// ===========================

function calculateFare(){

let base=40;

switch(service.value){

case "Bike Taxi":
base=50;
break;

case "Cab":
base=120;
break;

case "Parcel":
base=80;
break;

case "Food":
base=60;
break;

}

let distance=5;

if(drop.value.trim()!==""){

distance=10;

}

fare.innerHTML=base+(distance*8);

}

service.onchange=calculateFare;
drop.oninput=calculateFare;

calculateFare();


// ===========================
// Book Ride
// ===========================

bookBtn.onclick = async () => {

    if (!currentUser) {

        alert("Please login first.");
        return;

    }

    if (pickup.value.trim() === "") {

        alert("Please select pickup location.");
        return;

    }

    if (drop.value.trim() === "") {

        alert("Please enter drop location.");
        return;

    }

    try {

        const bookingData = {

            customerId: currentUser.uid,

            service: service.value,

            pickup: pickup.value,

            drop: drop.value,

            fare: Number(fare.innerHTML),

            status: "pending",

            paymentStatus: "Pending",

            riderId: "",

            createdAt: serverTimestamp()

        };

        const bookingRef = await addDoc(

            collection(db, "bookings"),

            bookingData

        );

        alert("Ride Booked Successfully 🚖");

        console.log("Booking ID:", bookingRef.id);

        pickup.value = "";
        drop.value = "";

        fare.innerHTML = "0";

        if (pickupMarker) {

            map.removeLayer(pickupMarker);
            pickupMarker = null;

        }

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

};


// ===========================
// Current Location
// ===========================

if (navigator.geolocation) {

    navigator.geolocation.getCurrentPosition(

        (position) => {

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            map.setView([lat, lng], 15);

            L.marker([lat, lng])
                .addTo(map)
                .bindPopup("You are here")
                .openPopup();

        },

        () => {

            console.log("Location permission denied.");

        }

    );

}

// ===========================
// Booking Success Flow
// ===========================

async function bookingSuccess(bookingId){

    try{

        alert("🎉 Booking Confirmed!\nBooking ID: " + bookingId);

        setTimeout(()=>{

            window.location.href =
            "../customer/history.html";

        },1500);

    }

    catch(error){

        console.log(error);

    }

}


// ===========================
// Reset Form
// ===========================

function resetBookingForm(){

    service.selectedIndex = 0;

    pickup.value = "";

    drop.value = "";

    fare.innerHTML = "0";

    if(pickupMarker){

        map.removeLayer(pickupMarker);

        pickupMarker = null;

    }

}


// ===========================
// Rider Notification
// ===========================

async function notifyNearbyRiders(bookingId){

    console.log("Searching Nearby Riders...");

    // Future Version:
    // Nearby riders will receive live ride requests here.

    return true;

}


// ===========================
// Update Booking Button
// ===========================

bookBtn.onclick = async()=>{

    if(!currentUser){

        alert("Please Login First");

        returns

