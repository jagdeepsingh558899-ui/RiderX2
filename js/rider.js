// ==========================================
// RiderX Rider Engine V7
// Live GPS + Route + Ride Accept
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

let routeLine=null;

let watchID=null;

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









onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}


currentUser=user;


initMap();


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



listenRides();


}









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



if(watchID){

navigator.geolocation.clearWatch(watchID);

}


}


};









function startGPS(){


watchID =

navigator.geolocation.watchPosition(

async(position)=>{


let lat=

position.coords.latitude;



let lng=

position.coords.longitude;





if(!riderMarker){


riderMarker=

L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"🏍 You"

);


}

else{


riderMarker.setLatLng(

[lat,lng]

);


}





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

(err)=>{

alert(

"GPS permission required"

);

},

{

enableHighAccuracy:true

}

);


}









function listenRides(){



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


snap.forEach((item)=>{


showRide(

item.id,

item.data()

);


});


});


}









function showRide(id,ride){



currentRide={

id,

...ride

};





requestBox.style.display="block";



document.getElementById("rideService").innerHTML=

ride.serviceType || ride.service;



document.getElementById("pickupLocation").innerHTML=

ride.pickup;



document.getElementById("dropLocation").innerHTML=

ride.drop;



document.getElementById("rideDistance").innerHTML=

ride.distance+" KM";



document.getElementById("rideFare").innerHTML=

ride.fare;



document.getElementById("payment").innerHTML=

ride.paymentMethod;



showRoute(

ride.pickupCoords,

ride.dropCoords

);


}









function showRoute(pickup,drop){



if(!pickup || !drop)

return;




if(pickupMarker)

map.removeLayer(pickupMarker);


if(dropMarker)

map.removeLayer(dropMarker);


if(routeLine)

map.removeLayer(routeLine);





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






routeLine=

L.polyline(

[

[

pickup.lat,

pickup.lng

],

[

drop.lat,

drop.lng

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

"accepted",


acceptedAt:

serverTimestamp()


}

);





await setDoc(

doc(

db,

"rideAssignments",

currentRide.id

),

{

riderId:

currentUser.uid,

rideId:

currentRide.id,

updatedAt:

serverTimestamp()

}

);



alert(

"Ride Accepted ✅"

);


};









rejectBtn.onclick=()=>{


requestBox.style.display="none";


currentRide=null;


};





console.log(

"RiderX Rider V7 Loaded"

);
