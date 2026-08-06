// ==========================================
// RiderX Booking Engine V6
// Ride + Parcel + Food Booking
// Map + Fare + Firebase
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
addDoc,
doc,
getDoc,
setDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";






let currentUser=null;

let map;

let pickupCoords=null;

let dropCoords=null;

let pickupMarker=null;

let dropMarker=null;

let distance=0;

let fare=0;

let selectedService="Bike";






const pickup =
document.getElementById("pickup");


const drop =
document.getElementById("drop");


const fareBox =
document.getElementById("fare");


const distanceBox =
document.getElementById("distance");


const bookBtn =
document.getElementById("bookBtn");


const locationBtn =
document.getElementById("locationBtn");


const paymentMethod =
document.getElementById("paymentMethod");









// AUTH


onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}


currentUser=user;


});









// MAP


window.onload=()=>{


map=L.map("map")

.setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

)

.addTo(map);





map.on("click",(e)=>{


if(!pickupCoords){


setPickup(

e.latlng.lat,

e.latlng.lng

);


}

else{


setDrop(

e.latlng.lat,

e.latlng.lng

);


calculateFare();


}


});


};









// SERVICE SELECT


document.querySelectorAll(".serviceBtn")

.forEach(btn=>{


btn.onclick=()=>{


selectedService=

btn.dataset.service;



document.querySelectorAll(".serviceBtn")

.forEach(b=>{


b.style.opacity="0.5";


});


btn.style.opacity="1";



calculateFare();



};



});









// PICKUP


function setPickup(lat,lng){


pickupCoords={lat,lng};



pickup.value=

lat.toFixed(6)+","+lng.toFixed(6);



if(pickupMarker)

map.removeLayer(pickupMarker);



pickupMarker=

L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"📍 Pickup"

);


}









// DROP


function setDrop(lat,lng){


dropCoords={lat,lng};



drop.value=

lat.toFixed(6)+","+lng.toFixed(6);



if(dropMarker)

map.removeLayer(dropMarker);



dropMarker=

L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"🏁 Drop"

);


}









// LOCATION


locationBtn.onclick=()=>{


navigator.geolocation.getCurrentPosition(

(pos)=>{


setPickup(

pos.coords.latitude,

pos.coords.longitude

);



map.setView(

[

pos.coords.latitude,

pos.coords.longitude

],

16

);



},

()=>{


alert(

"Location permission allow karo"

);


}

);


};









// FARE


function calculateFare(){


if(!pickupCoords || !dropCoords)

return;



distance=

map.distance(

[

pickupCoords.lat,

pickupCoords.lng

],

[

dropCoords.lat,

dropCoords.lng

]

)/1000;



distance=

Number(

distance.toFixed(1)

);



distanceBox.innerHTML=

distance+" KM";





let rate=0;




if(selectedService==="Bike")

rate=8;


if(selectedService==="Taxi")

rate=12;


if(selectedService==="Cab")

rate=15;


if(selectedService==="Parcel")

rate=80;


if(selectedService==="Food")

rate=60;







if(

selectedService==="Parcel" ||

selectedService==="Food"

){


fare=rate;


}

else{


fare=

50+(distance*rate);


}





fareBox.innerHTML=

Math.round(fare);


}









// BOOK


bookBtn.onclick=async()=>{


if(!currentUser)

return alert(

"Login Required"

);



if(!pickupCoords || !dropCoords)

return alert(

"Pickup Drop select karo"

);






try{



let ride = await addDoc(

collection(db,"rides"),

{


customerId:

currentUser.uid,



service:

selectedService,



pickup:

pickup.value,



drop:

drop.value,



pickupCoords,



dropCoords,



distance,



fare:

Math.round(fare),



paymentMethod:

paymentMethod.value,



status:

"searching",



createdAt:

serverTimestamp()



}

);







await setDoc(

doc(

db,

"liveLocations",

currentUser.uid

),

{

role:"customer",

rideId:ride.id,

location:pickupCoords,

updatedAt:

serverTimestamp()

}

);






localStorage.setItem(

"rideId",

ride.id

);





alert(

"Booking Created ✅"

);



location.href="Home.html";





}

catch(error){


alert(

error.message

);


}



};





console.log(

"RiderX Booking V6 Loaded"

);
