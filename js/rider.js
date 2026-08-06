
// ==========================================
// RiderX Rider Engine V6
// Online + Live Location + Ride Request
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
query,
where,
onSnapshot,
doc,
updateDoc,
setDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





let currentUser=null;

let online=false;

let map;

let riderMarker=null;

let pickupMarker=null;

let dropMarker=null;

let currentRide=null;







const onlineBtn =
document.getElementById("onlineBtn");


const status =
document.getElementById("riderStatus");


const requestBox =
document.getElementById("rideRequest");


const acceptBtn =
document.getElementById("acceptRide");


const rejectBtn =
document.getElementById("rejectRide");







// AUTH


onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}


currentUser=user;


initMap();


});









// MAP


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





startRideListener();


}









// ONLINE BUTTON


onlineBtn.onclick=()=>{


online=!online;



if(online){


onlineBtn.innerHTML="🟢 Online";


status.innerHTML="Online";


startGPS();


}


else{


onlineBtn.innerHTML="🔴 Offline";


status.innerHTML="Offline";


}


};









// GPS


function startGPS(){


navigator.geolocation.watchPosition(

async(pos)=>{


const lat=
pos.coords.latitude;


const lng=
pos.coords.longitude;




if(!riderMarker){


riderMarker=

L.marker(

[lat,lng]

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





await setDoc(

doc(

db,

"riders",

currentUser.uid

),

{


online:true,


location:{

lat,

lng

},


updatedAt:

serverTimestamp()


},


{

merge:true

}


);



},


(error)=>{

alert(
"GPS permission allow karo"
);

},


{

enableHighAccuracy:true

}


);


}









// LISTEN RIDES


function startRideListener(){



const q=

query(

collection(db,"rides"),

where(

"status",

"==",

"searching"

)

);





onSnapshot(q,(snap)=>{



snap.forEach((doc)=>{



const ride=doc.data();


showRide(doc.id,ride);



});



});



}









// SHOW REQUEST


function showRide(id,ride){



currentRide={

id,

...ride

};




requestBox.style.display="block";





document.getElementById(

"rideService"

)

.innerHTML=

ride.serviceType;





document.getElementById(

"pickupLocation"

)

.innerHTML=

ride.pickup;





document.getElementById(

"dropLocation"

)

.innerHTML=

ride.drop;





document.getElementById(

"rideDistance"

)

.innerHTML=

ride.distance+" KM";





document.getElementById(

"rideFare"

)

.innerHTML=

ride.fare;





document.getElementById(

"payment"

)

.innerHTML=

ride.paymentMethod;





showMarkers(

ride.pickupCoords,

ride.dropCoords

);



}









// MARKERS


function showMarkers(pickup,drop){



if(pickupMarker)

map.removeLayer(pickupMarker);


if(dropMarker)

map.removeLayer(dropMarker);





pickupMarker=

L.marker(

[

pickup.lat,

pickup.lng

]

)

.addTo(map)

.bindPopup(

"📍 Pickup"

);





dropMarker=

L.marker(

[

drop.lat,

drop.lng

]

)

.addTo(map)

.bindPopup(

"🏁 Drop"

);






map.fitBounds(

[

[

pickup.lat,

pickup.lng

],

[

drop.lat,

drop.lng

]

]

);



}









// ACCEPT


acceptBtn.onclick=async()=>{


if(!currentRide)

return;



await updateDoc(

doc(

db,

"rides",

currentRide.id

),

{


riderId:

currentUser.uid,


status:

"accepted"



}

);





alert(

"Ride Accepted"

);


};









// REJECT


rejectBtn.onclick=()=>{


requestBox.style.display="none";


currentRide=null;


};





console.log(
"RiderX Rider V6 Loaded"
);
