// =====================================
// RiderX Booking System
// Fixed Map Loading + Pickup Drop
// =====================================


import { auth, db } from "../firebase/config.js";

import {
collection,
addDoc,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



const service = document.getElementById("service");

const pickup = document.getElementById("pickup");

const drop = document.getElementById("drop");

const fareBox = document.getElementById("fare");

const distanceBox = document.getElementById("distance");

const bookBtn = document.getElementById("bookBtn");

const locationBtn = document.getElementById("locationBtn");



let currentUser = null;

let map = null;

let pickupMarker = null;

let dropMarker = null;


let pickupCoords = null;

let dropCoords = null;


let fare = 0;





// ============================
// AUTH CHECK
// ============================


onAuthStateChanged(auth,(user)=>{

if(user){

currentUser = user;

}
else{

window.location.href="../auth/login.html";

}

});






// ============================
// MAP LOAD
// ============================


document.addEventListener("DOMContentLoaded",()=>{


setTimeout(()=>{


map = L.map("map").setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19,

attribution:"© OpenStreetMap"

}

).addTo(map);



map.invalidateSize();




// MAP CLICK

map.on("click",(e)=>{


if(!pickupCoords){


pickupCoords={

lat:e.latlng.lat,

lng:e.latlng.lng

};


pickup.value =

pickupCoords.lat.toFixed(6)+
", "+
pickupCoords.lng.toFixed(6);



pickupMarker=L.marker(

[

pickupCoords.lat,

pickupCoords.lng

]

)

.addTo(map)

.bindPopup("Pickup Location")

.openPopup();


}


else if(!dropCoords){


dropCoords={

lat:e.latlng.lat,

lng:e.latlng.lng

};



drop.value =

dropCoords.lat.toFixed(6)+
", "+
dropCoords.lng.toFixed(6);



dropMarker=L.marker(

[

dropCoords.lat,

dropCoords.lng

]

)

.addTo(map)

.bindPopup("Drop Location")

.openPopup();



calculateFare();


}


});



},300);



});







// ============================
// CURRENT LOCATION
// ============================


locationBtn.onclick=()=>{


navigator.geolocation.getCurrentPosition(

(position)=>{


pickupCoords={

lat:position.coords.latitude,

lng:position.coords.longitude

};



pickup.value=

pickupCoords.lat.toFixed(6)+
", "+
pickupCoords.lng.toFixed(6);



if(pickupMarker){

map.removeLayer(pickupMarker);

}



pickupMarker=L.marker(

[

pickupCoords.lat,

pickupCoords.lng

]

)

.addTo(map)

.bindPopup("Your Location")

.openPopup();



map.setView(

[

pickupCoords.lat,

pickupCoords.lng

],

16

);



},

()=>{

alert("Location permission allow karo");

}


);


};







// ============================
// FARE
// ============================


function calculateFare(){


if(!pickupCoords || !dropCoords)
return;



let km =

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



km = Number(km.toFixed(1));



distanceBox.innerHTML=

km+" KM";



let rate=8;


let hour=new Date().getHours();



if(hour>=22 || hour<6){

rate=11;

}

else if(km>10){

rate=9;

}



fare=

50+(km*rate);



fareBox.innerHTML=

Math.round(fare);



}





service.addEventListener(

"change",

calculateFare

);







// ============================
// BOOK RIDE
// ============================


bookBtn.onclick=async()=>{


if(!pickupCoords || !dropCoords){

alert(
"Map se Pickup aur Drop select karo"
);

return;

}



try{


const ride = await addDoc(

collection(db,"rides"),

{


customerId:

currentUser.uid,


service:

service.value,


pickup:

pickup.value,


drop:

drop.value,


pickupCoords,

dropCoords,


fare,


status:"Pending",


createdAt:serverTimestamp()


}

);



localStorage.setItem(

"rideId",

ride.id

);



alert(

"Ride Booked Successfully ✅"

);



window.location.href="ride-status.html";



}

catch(error){


alert(error.message);


}


};




console.log("RiderX Booking Ready");
