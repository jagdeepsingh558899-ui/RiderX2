// ==========================================
// RiderX Rider Engine V1
// Online + GPS + Ride Request + Accept
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

doc,
setDoc,
collection,
query,
where,
onSnapshot,
updateDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";




// ELEMENTS


const onlineBtn =
document.getElementById("onlineBtn");


const rideBox =
document.getElementById("rideBox");


const pickup =
document.getElementById("pickup");


const drop =
document.getElementById("drop");


const fare =
document.getElementById("fare");


const acceptBtn =
document.getElementById("acceptBtn");


const rejectBtn =
document.getElementById("rejectBtn");





let currentUser=null;

let isOnline=false;

let currentRide=null;

let watchId=null;



// MAP


let map;


let riderMarker=null;



window.onload=()=>{


map=L.map("map")
.setView(
[30.7333,76.7794],
13
);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

).addTo(map);



};






// AUTH


onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



currentUser=user;


startRideListener();


});







// ONLINE BUTTON


onlineBtn.onclick=()=>{


if(!currentUser)
return;



if(isOnline){


goOffline();


}

else{


goOnline();


}


};







// GO ONLINE


async function goOnline(){



isOnline=true;


onlineBtn.innerHTML="Online";


onlineBtn.className="online";



startLocation();



listenLocationPermission();



}






// GO OFFLINE


async function goOffline(){


isOnline=false;


onlineBtn.innerHTML="Offline";


onlineBtn.className="offline";



if(watchId){

navigator.geolocation.clearWatch(watchId);

}




await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{

online:false,

status:"offline",

updatedAt:serverTimestamp()

},

{
merge:true
}

);



}







// LIVE LOCATION


function startLocation(){



watchId=

navigator.geolocation.watchPosition(

async(position)=>{


if(!isOnline)
return;




let location={


lat:
position.coords.latitude,


lng:
position.coords.longitude


};





await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{

online:true,

status:"available",

location,

updatedAt:serverTimestamp()

},

{
merge:true
}


);





showMarker(location);



},



(error)=>{


alert(
"GPS permission allow karo"
);


},



{

enableHighAccuracy:true,

maximumAge:0

}



);



}







// MAP MARKER


function showMarker(location){



if(!map)
return;



if(riderMarker)

map.removeLayer(riderMarker);



riderMarker=L.marker(

[
location.lat,
location.lng
]

)

.addTo(map)

.bindPopup(
"Your Location"
);


map.setView(

[
location.lat,
location.lng
],

16

);



}







// LISTEN RIDES


function startRideListener(){



const q=query(

collection(db,"rides"),

where(
"status",
"==",
"searching"
)

);




onSnapshot(q,(snap)=>{


snap.forEach((item)=>{


let ride=item.data();



currentRide={

id:item.id,

...ride

};





showRide(ride);



});



});



}







// SHOW REQUEST


function showRide(ride){


rideBox.style.display="block";



pickup.innerHTML=
ride.pickup;



drop.innerHTML=
ride.drop;



fare.innerHTML=
ride.fare;



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

status:"accepted",

riderId:
currentUser.uid,

acceptedAt:
serverTimestamp()

}


);



alert(
"Ride Accepted"
);



};







// REJECT


rejectBtn.onclick=()=>{


rideBox.style.display="none";


currentRide=null;



};





console.log(
"RiderX Rider Engine Loaded"
);
