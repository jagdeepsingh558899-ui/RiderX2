// RiderX Customer Dashboard Debug Engine

import { auth, db } from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


console.log("RiderX CUSTOMER JS LOADED");


let map;

let pickupCoords = null;
let dropCoords = null;

let pickupMarker = null;
let dropMarker = null;

let selectedService = "bike";


const rates = {
    bike:20,
    cab:50,
    parcel:30,
    food:25
};




// START

document.addEventListener("DOMContentLoaded",()=>{


    console.log("DOM READY");


    setStatus("System Loaded");


    initMap();


    setupServices();


    setupBooking();


});





// STATUS

function setStatus(text){

let status =
document.getElementById("status");

if(status){

status.innerText = text;

}

}







// MAP

function initMap(){


let box =
document.getElementById("map");


if(!box){

console.log("MAP DIV NOT FOUND");

return;

}



map =
L.map("map")
.setView(
[30.7333,76.7794],
13
);



L.tileLayer(
"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
{
maxZoom:19
}
)
.addTo(map);



setStatus("Map Loaded");



map.on("click",(e)=>{


let lat =
e.latlng.lat;


let lng =
e.latlng.lng;



let text =
lat.toFixed(5)+
", "+
lng.toFixed(5);



if(!pickupCoords){


pickupCoords={
lat,
lng
};


pickupMarker =
L.marker([lat,lng])
.addTo(map)
.bindPopup("Pickup")
.openPopup();



document.getElementById("pickup").value =
text;



setStatus("Pickup Selected");



}

else if(!dropCoords){


dropCoords={
lat,
lng
};



dropMarker =
L.marker([lat,lng])
.addTo(map)
.bindPopup("Drop")
.openPopup();



document.getElementById("drop").value =
text;



setStatus("Drop Selected");


calculateFare();


}



});



}








// SERVICES


function setupServices(){


document
.querySelectorAll(".service")
.forEach(btn=>{


btn.onclick=()=>{


document
.querySelectorAll(".service")
.forEach(x=>
x.classList.remove("active")
);



btn.classList.add("active");


selectedService =
btn.dataset.type;


calculateFare();


setStatus(
selectedService+" selected"
);


};



});


}







// FARE


function calculateFare(){


if(!pickupCoords || !dropCoords){

document.getElementById("fare").innerText="₹0";

return 0;

}



let km =
distance(
pickupCoords.lat,
pickupCoords.lng,
dropCoords.lat,
dropCoords.lng
);



let rate = 8;


let hour =
new Date().getHours();



if(hour>=22 || hour<6){

rate=11;

}

else if(km>10){

rate=9;

}



let total =
rates[selectedService]
+
(km*rate);



total=Math.round(total);



document.getElementById("fare").innerText=
"₹"+total;


return total;


}







// DISTANCE


function distance(a,b,c,d){


let R=6371;


let x =
(c-a)*Math.PI/180;


let y =
(d-b)*Math.PI/180;


let z =
Math.sin(x/2)**2
+
Math.cos(a*Math.PI/180)
*
Math.cos(c*Math.PI/180)
*
Math.sin(y/2)**2;



return R*
2*
Math.atan2(
Math.sqrt(z),
Math.sqrt(1-z)
);


}








// BOOKING


function setupBooking(){


let btn =
document.getElementById("bookRide");



if(!btn){

console.log("BOOK BUTTON NOT FOUND");

return;

}



btn.onclick=async()=>{


setStatus("Booking Clicked");



let user =
auth.currentUser;



if(!user){

alert("Please login first");

return;

}



let pickup =
document.getElementById("pickup").value;


let drop =
document.getElementById("drop").value;



if(!pickup || !drop){

alert("Select pickup and drop");

return;

}




await addDoc(
collection(db,"rides"),
{

customerId:user.uid,

pickupLocation:pickup,

dropLocation:drop,

pickupCoords,

dropCoords,

serviceType:selectedService,

fare:calculateFare(),

status:"REQUESTED",

createdAt:serverTimestamp()

}

);



setStatus("Ride Requested");


};



}
