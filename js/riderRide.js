// ==========================================
// RiderX Rider Ride Control V1
// Start + Complete Ride
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
query,
where,
onSnapshot,
doc,
updateDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";







let currentUser=null;

let rideId=null;

let map;

let pickupMarker=null;

let dropMarker=null;

let routeLine=null;







const rideCard =
document.getElementById("rideCard");


const service =
document.getElementById("service");


const pickup =
document.getElementById("pickup");


const drop =
document.getElementById("drop");


const distance =
document.getElementById("distance");


const fare =
document.getElementById("fare");


const startBtn =
document.getElementById("startRide");


const completeBtn =
document.getElementById("completeRide");









onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}


currentUser=user;


initMap();


loadRide();


});









function initMap(){


map=L.map("map")

.setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

)

.addTo(map);



}









function loadRide(){



const q=

query(

collection(db,"rides"),

where(

"riderId",

"==",

currentUser.uid

)

);





onSnapshot(q,(snap)=>{


snap.forEach((item)=>{


const ride=item.data();



if(

ride.status==="accepted" ||

ride.status==="started"

){



rideId=item.id;



showRide(ride);



}


});


});


}









function showRide(ride){



rideCard.style.display="block";



service.innerHTML=

ride.service;



pickup.innerHTML=

ride.pickup;



drop.innerHTML=

ride.drop;



distance.innerHTML=

ride.distance+" KM";



fare.innerHTML=

ride.fare;





showMap(

ride.pickupCoords,

ride.dropCoords

);



}









function showMap(pick,dropPoint){



if(pickupMarker)

map.removeLayer(pickupMarker);


if(dropMarker)

map.removeLayer(dropMarker);


if(routeLine)

map.removeLayer(routeLine);





pickupMarker=

L.marker(

[

pick.lat,

pick.lng

]

)

.addTo(map)

.bindPopup(

"📍 Pickup"

);





dropMarker=

L.marker(

[

dropPoint.lat,

dropPoint.lng

]

)

.addTo(map)

.bindPopup(

"🏁 Drop"

);





routeLine=

L.polyline(

[

[

pick.lat,

pick.lng

],

[

dropPoint.lat,

dropPoint.lng

]

],

{

color:"#FFD600",

weight:5

}

)

.addTo(map);





map.fitBounds(

routeLine.getBounds()

);


}









startBtn.onclick=async()=>{


if(!rideId)

return;



await updateDoc(

doc(

db,

"rides",

rideId

),

{

status:"started",

startedAt:

serverTimestamp()

}

);



alert(

"Ride Started 🚕"

);


};









completeBtn.onclick=async()=>{


if(!rideId)

return;



await updateDoc(

doc(

db,

"rides",

rideId

),

{

status:"completed",

completedAt:

serverTimestamp()

}

);



alert(

"Ride Completed ✅"

);


};







console.log(

"RiderX Rider Ride V1 Loaded"

);
