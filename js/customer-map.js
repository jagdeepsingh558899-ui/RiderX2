// ==========================================
// RiderX Customer Map System V5
// Live Rider Tracking + Ride Status
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

doc,
onSnapshot

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





let map;

let riderMarker=null;

let user=null;

let rideId=null;






const statusBox =
document.getElementById("rideStatus");


const otpBox =
document.getElementById("otpBox");


const otpText =
document.getElementById("rideOTP");


const riderCard =
document.getElementById("riderCard");


const pickupText =
document.getElementById("pickupText");


const dropText =
document.getElementById("dropText");


const fareText =
document.getElementById("fareText");





// ==============================
// CREATE MAP
// ==============================


function initMap(){


if(!document.getElementById("map")){

return;

}



map = L.map("map",{

zoomControl:true

})

.setView(

[30.7333,76.7794],

13

);





L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19,

attribution:"© OpenStreetMap"

}

)

.addTo(map);



setTimeout(()=>{

map.invalidateSize();

},500);



}






initMap();









// ==============================
// AUTH
// ==============================


onAuthStateChanged(auth,(u)=>{


if(!u){

window.location.href="../auth/login.html";

return;

}



user=u;



rideId=

localStorage.getItem("rideId");




if(rideId){

loadRide();

}



});









// ==============================
// LOAD RIDE
// ==============================


function loadRide(){



const rideRef=

doc(

db,

"rides",

rideId

);



onSnapshot(

rideRef,

(snapshot)=>{



if(!snapshot.exists()){

return;

}



const ride=snapshot.data();





updateRide(ride);





if(ride.riderId){

listenRider(

ride.riderId

);

}



}

);



}









// ==============================
// UPDATE UI
// ==============================


function updateRide(ride){



statusBox.innerHTML=

ride.status || "Searching Rider...";




pickupText.innerHTML=

ride.pickup || "-";



dropText.innerHTML=

ride.drop || "-";



fareText.innerHTML=

ride.fare || 0;





if(ride.otp){


otpBox.style.display="block";


otpText.innerHTML
