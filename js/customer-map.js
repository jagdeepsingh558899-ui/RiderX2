// ==========================================
// RiderX Customer Live Tracking V4
// Live Rider Location + Status + OTP
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

doc,
getDoc,
onSnapshot

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





let map;

let riderMarker;

let user=null;

let rideId=null;

let currentRide=null;







const statusBox =
document.getElementById("rideStatus");


const otpBox =
document.getElementById("otpBox");


const otpText =
document.getElementById("rideOTP");


const riderCard =
document.getElementById("riderCard");


const riderName =
document.getElementById("riderName");


const riderPhone =
document.getElementById("riderPhone");


const pickupText =
document.getElementById("pickupText");


const dropText =
document.getElementById("dropText");


const fareText =
document.getElementById("fareText");



const callBtn =
document.getElementById("callRider");


const chatBtn =
document.getElementById("chatRider");









// AUTH


onAuthStateChanged(auth,(u)=>{


if(!u){

location.href="../auth/login.html";

return;

}


user=u;


rideId=

localStorage.getItem("rideId");



if(rideId){

loadRide();


}



});









// MAP CREATE


function createMap(){



map=L.map("map")

.setView(

[30.7333,76.7794],

14

);





L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

)

.addTo(map);



}





createMap();









// LOAD RIDE


async function loadRide(){



const rideRef=

doc(

db,

"rides",

rideId

);



onSnapshot(

rideRef,

(snapshot)=>{



if(!snapshot.exists())

return;



currentRide=snapshot.data();



updateUI();



if(

currentRide.riderId

){


listenRider(

currentRide.riderId

);



}



}

);



}









function updateUI(){



statusBox.innerHTML=

currentRide.status || "Searching";



pickupText.innerHTML=

currentRide.pickup || "-";


dropText.innerHTML=

currentRide.drop || "-";


fareText.innerHTML=

currentRide.fare || 0;






if(currentRide.otp){


otpBox.style.display="block";


otpText.innerHTML=

currentRide.otp;



}





if(currentRide.riderId){


riderCard.style.display="block";


}






}









// RIDER LIVE LOCATION


function listenRider(riderId){



const riderRef=

doc(

db,

"riders",

riderId

);




onSnapshot(

riderRef,

(snapshot)=>{



let data=snapshot.data();



if(

data && data.location

){


showRider(

data.location.lat,

data.location.lng

);


}



}



);



}









function showRider(lat,lng){



if(!riderMarker){



riderMarker=

L.marker(

[lat,lng],

{


icon:

L.icon({

iconUrl:

"https://cdn-icons-png.flaticon.com/512/3448/3448339.png",


iconSize:[45,45]


})



}

)

.addTo(map);



}


else{


riderMarker.setLatLng(

[lat,lng]

);


}



map.setView(

[lat,lng],

15

);



}









// CALL


callBtn.onclick=()=>{


alert(

"Calling Rider..."

);


};









// CHAT


chatBtn.onclick=()=>{


localStorage.setItem(

"rideId",

rideId

);



location.href="chat.html";


};








console.log(

"RiderX Customer Live Map V4 Loaded"

);
