// ======================================
// RiderX Customer Dashboard
// Final Ride Tracking System
// ======================================


import { auth, db }
from "../../firebase/firebase-config.js";


import {
onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {

collection,
addDoc,
serverTimestamp,
doc,
onSnapshot,
updateDoc

}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";





let map;

let userMarker;

let pickupMarker;

let currentUser=null;

let selectedService="bike";

let currentRideId=null;





// ===============================
// Auth
// ===============================


onAuthStateChanged(
auth,
(user)=>{

if(user){

currentUser=user;

}

});








document.addEventListener(
"DOMContentLoaded",
()=>{


initMap();

setupServices();

setupBookRide();

setupCancelRide();


});








// ===============================
// Map
// ===============================


function initMap(){


map =
L.map("map")
.setView(
[30.7333,76.7794],
13
);



L.tileLayer(
"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
)
.addTo(map);



map.on(
"click",
(e)=>{


setPickup(
e.latlng.lat,
e.latlng.lng
);


});


getLocation();


}







function getLocation(){


navigator.geolocation.getCurrentPosition(
(pos)=>{


let lat=pos.coords.latitude;

let lng=pos.coords.longitude;



map.setView(
[lat,lng],
15
);



userMarker =
L.marker(
[lat,lng]
)
.addTo(map);



setPickup(
lat,
lng
);



}

);


}








function setPickup(lat,lng){


if(pickupMarker)
map.removeLayer(pickupMarker);



pickupMarker =
L.marker(
[lat,lng]
)
.addTo(map);



document.getElementById("pickup").value=

lat.toFixed(5)+", "+lng.toFixed(5);



calculateFare();



}









// ===============================
// Services
// ===============================


function setupServices(){


document
.querySelectorAll(".service")
.forEach(
(service)=>{


service.onclick=()=>{


document
.querySelectorAll(".service")
.forEach(
(s)=>s.classList.remove("active")
);


service.classList.add("active");


selectedService=
service.dataset.service;



calculateFare();



};



});



}









// ===============================
// Fare
// ===============================


function calculateFare(){


let distance=5;


let rate=8;


let hour=new Date().getHours();



if(hour>=22 || hour<6){

rate=11;

}



let extra=0;



if(selectedService==="cab")
extra=50;


if(selectedService==="parcel")
extra=30;


if(selectedService==="food")
extra=20;




document.getElementById("fare").innerText=

"₹"+((distance*rate)+extra);



}









// ===============================
// Book Ride
// ===============================


function setupBookRide(){


document
.getElementById("bookRide")
.onclick=
async()=>{


let drop=
document.getElementById("drop").value;



if(!drop){

alert("Enter drop location");

return;

}




if(!currentUser){

alert("Login required");

return;

}





openRideModal();





let ride={


customerId:
currentUser.uid,


service:
selectedService,


pickup:
document.getElementById("pickup").value,


drop:drop,


fare:
document.getElementById("fare").innerText,


payment:
document.getElementById("payment").value,


status:"searching",


riderId:null,


otp:
Math.floor(1000+Math.random()*9000),


createdAt:
serverTimestamp()


};





let ref =
await addDoc(
collection(db,"rides"),
ride
);



currentRideId=ref.id;



listenRide();



};


}








// ===============================
// Ride Listener
// ===============================


function listenRide(){


const rideRef=
doc(
db,
"rides",
currentRideId
);



onSnapshot(
rideRef,
(snapshot)=>{


if(!snapshot.exists())
return;


let data=snapshot.data();



if(data.status==="accepted"){


document.getElementById("rideStatus")
.innerText=
"Rider Accepted";


document.getElementById("rideInfo")
.innerText=
"Your Rider is coming";


document.getElementById("riderDetails").style.display="block";


document.getElementById("riderName")
.innerText=
"Rider ID: "+data.riderId;



document.getElementById("rideOtp")
.innerText=
data.otp || "----";



}



});



}









// ===============================
// Modal
// ===============================


function openRideModal(){


document.getElementById("rideModal")
.style.display="flex";


}





function setupCancelRide(){


let btn =
document.getElementById("cancelRide");



btn.onclick=
async()=>{


if(currentRideId){


await updateDoc(
doc(db,"rides",currentRideId),
{

status:"cancelled"

}

);


}



document.getElementById("rideModal")
.style.display="none";


};



}
