// =====================================
// RiderX Booking System
// Admin Fare Connected
// Map + Pickup Drop + Booking
// =====================================


import { auth, db } from "../firebase/config.js";


import {

collection,
addDoc,
serverTimestamp,
doc,
getDoc

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



const service =
document.getElementById("service");


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



let currentUser=null;


let map=null;


let pickupMarker=null;


let dropMarker=null;


let pickupCoords=null;


let dropCoords=null;


let fare=0;



let fareSettings={

bike:8,
cab:15,
parcel:80,
food:60,
night:3

};






// =====================
// AUTH
// =====================


onAuthStateChanged(auth,(user)=>{


if(user){

currentUser=user;

}

else{

location.href="../auth/login.html";

}


});







// =====================
// LOAD ADMIN FARE
// =====================


async function loadFare(){


const snap = await getDoc(

doc(db,"settings","fare")

);



if(snap.exists()){


fareSettings=snap.data();


}


}



loadFare();







// =====================
// MAP
// =====================


document.addEventListener("DOMContentLoaded",()=>{


setTimeout(()=>{


map=L.map("map").setView(

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






map.on("click",(e)=>{


if(!pickupCoords){


pickupCoords={

lat:e.latlng.lat,
lng:e.latlng.lng

};



pickup.value=

pickupCoords.lat.toFixed(6)+
", "+
pickupCoords.lng.toFixed(6);



pickupMarker=L.marker(

[e.latlng.lat,e.latlng.lng]

)

.addTo(map)

.bindPopup("Pickup")

.openPopup();



}



else if(!dropCoords){


dropCoords={

lat:e.latlng.lat,
lng:e.latlng.lng

};



drop.value=

dropCoords.lat.toFixed(6)+
", "+
dropCoords.lng.toFixed(6);



dropMarker=L.marker(

[e.latlng.lat,e.latlng.lng]

)

.addTo(map)

.bindPopup("Drop")

.openPopup();



calculateFare();


}



});




},300);


});







// =====================
// CURRENT LOCATION
// =====================


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

.bindPopup("Pickup")

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







// =====================
// FARE CALCULATION
// =====================


function calculateFare(){


if(!pickupCoords || !dropCoords)

return;



let km=

map.distance(

[pickupCoords.lat,pickupCoords.lng],

[dropCoords.lat,dropCoords.lng]

)/1000;



km=Number(km.toFixed(1));



distanceBox.innerHTML=

km+" KM";




let base=0;

let rate=0;



if(service.value==="Bike Taxi"){

rate=fareSettings.bike || 8;

base=20;

}



if(service.value==="Cab"){

rate=fareSettings.cab || 15;

base=50;

}



if(service.value==="Parcel"){

rate=fareSettings.parcel || 80;

base=0;

}



if(service.value==="Food"){

rate=fareSettings.food || 60;

base=0;

}





let hour=new Date().getHours();



if(hour>=22 || hour<6){

rate += fareSettings.night || 3;

}





if(service.value==="Parcel" || service.value==="Food"){

fare=rate;

}

else{

fare=base+(km*rate);

}





fareBox.innerHTML=

Math.round(fare);



}





service.addEventListener(

"change",

calculateFare

);








// =====================
// BOOK RIDE
// =====================


bookBtn.onclick=async()=>{


if(!pickupCoords || !dropCoords){


alert(

"Map se Pickup aur Drop select karo"

);


return;

}




const ride=

await addDoc(

collection(db,"rides"),

{


customerId:currentUser.uid,


service:service.value,


pickup:pickup.value,


drop:drop.value,


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



location.href="ride-status.html";



};




console.log(

"RiderX Booking + Admin Fare Loaded"

);
