// ==========================================
// RiderX Customer Live Tracking V2
// Firebase Rider Location + Live Map
// ==========================================


import { db } from "../firebase/config.js";


import {

doc,
onSnapshot,
updateDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



import {

createMap,
showRiderLocation,
showCustomerLocation

}

from "./Map.js";





const statusBox =
document.getElementById("status");


const riderName =
document.getElementById("riderName");


const distanceBox =
document.getElementById("distance");


const etaBox =
document.getElementById("eta");


const cancelBtn =
document.getElementById("cancelBtn");





let map;


let rideId =
localStorage.getItem("rideId");


let riderId=null;



if(!rideId){

alert("Ride not found");

location.href="booking.html";

}







// START MAP


window.addEventListener(

"load",

()=>{


map=createMap();


loadRide();



}

);








// LOAD RIDE STATUS


function loadRide(){



onSnapshot(

doc(
db,
"rides",
rideId
),


(snapshot)=>{


if(!snapshot.exists())
return;



let ride=snapshot.data();




statusBox.innerHTML =
ride.status;





if(ride.pickupCoords){


showCustomerLocation(

ride.pickupCoords.lat,

ride.pickupCoords.lng

);


}





if(

ride.status==="accepted"

){



riderId =
ride.riderId;



statusBox.innerHTML =
"🏍 Rider Arriving";



trackRider();



}





if(

ride.status==="started"

){


statusBox.innerHTML =
"🚕 Ride Started";


}



if(

ride.status==="completed"

){


statusBox.innerHTML =
"✅ Ride Completed";


}





}



);



}








// TRACK RIDER


function trackRider(){



if(!riderId)
return;



onSnapshot(

doc(
db,
"riders",
riderId
),


(snapshot)=>{


if(!snapshot.exists())
return;



let data=snapshot.data();



if(!data.location)
return;




let lat =
data.location.lat;


let lng =
data.location.lng;





showRiderLocation(

lat,

lng

);




updateDistance(

lat,

lng

);



}



);



}








// DISTANCE


function updateDistance(

lat,

lng

){



let customerLocation =
[30.7333,76.7794];



let riderLocation =
[lat,lng];



let km =

L.latLng(
customerLocation
)

.distanceTo(

L.latLng(
riderLocation
)

)

 /1000;




distanceBox.innerHTML =

km.toFixed(1)+" KM";




etaBox.innerHTML =

Math.ceil(km*3)+" min";


}







// CANCEL


cancelBtn.onclick=async()=>{



await updateDoc(

doc(
db,
"rides",
rideId
),

{


status:"cancelled",


cancelledAt:
serverTimestamp()


}


);



alert(
"Ride Cancelled"
);



location.href="booking.html";


};





console.log(
"RiderX Customer Live Tracking V2 Loaded"
);
