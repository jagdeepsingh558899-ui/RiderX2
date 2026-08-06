// ==========================================
// RiderX Customer Live Tracking V1
// Rider Location + Ride Status + Map
// ==========================================


import { db } from "../firebase/config.js";


import {

doc,
onSnapshot,
getDoc

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





let map;


let riderMarker=null;

let pickupMarker=null;

let dropMarker=null;

let routeLine=null;



const rideId =

localStorage.getItem("rideId");






const statusBox =

document.getElementById("rideStatus");





const riderName =

document.getElementById("riderName");





const vehicle =

document.getElementById("vehicle");








// MAP INIT


map=L.map("map")

.setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

)

.addTo(map);









// RIDE LISTENER


if(rideId){


onSnapshot(

doc(db,"rides",rideId),

(snapshot)=>{


if(!snapshot.exists())

return;



const ride=snapshot.data();




statusBox.innerHTML=

ride.status;



if(

ride.pickupCoords

&&

!pickupMarker

){


pickupMarker=

L.marker(

[

ride.pickupCoords.lat,

ride.pickupCoords.lng

]

)

.addTo(map)

.bindPopup(

"📍 Pickup"

);


}





if(

ride.dropCoords

&&

!dropMarker

){


dropMarker=

L.marker(

[

ride.dropCoords.lat,

ride.dropCoords.lng

]

)

.addTo(map)

.bindPopup(

"🏁 Drop"

);


}





if(

ride.riderId

){


loadRider(

ride.riderId

);


listenRiderLocation(

ride.riderId

);


}




}

);



}









// RIDER DATA


async function loadRider(uid){


const snap=

await getDoc(

doc(db,"users",uid)

);



if(snap.exists()){


const data=snap.data();


riderName.innerHTML=

data.name || "Rider";



vehicle.innerHTML=

data.vehicleNumber || "-";


}


}









// LIVE RIDER LOCATION


function listenRiderLocation(uid){



onSnapshot(

doc(db,"riders",uid),

(snapshot)=>{


if(!snapshot.exists())

return;



const data=snapshot.data();



if(!data.location)

return;



const lat=

data.location.lat;



const lng=

data.location.lng;






if(!riderMarker){


riderMarker=

L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"🏍 Rider"

);


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

);



}









console.log(

"RiderX Customer Map V1 Loaded"

);
