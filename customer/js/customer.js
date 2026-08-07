// ======================================
// RiderX Customer Dashboard
// FINAL FIXED CUSTOMER JS
// ======================================


import { auth, db }
from "../firebase/firebase-config.js";


import {
onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {

collection,
addDoc,
doc,
onSnapshot,
updateDoc,
serverTimestamp

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
// AUTH
// ===============================


onAuthStateChanged(
auth,
(user)=>{


if(user){

currentUser=user;

console.log(
"Customer Login:",
user.uid
);


}

else{


console.log(
"Not Login"
);


}


});







// ===============================
// START
// ===============================


document.addEventListener(
"DOMContentLoaded",
()=>{


initMap();


setupServices();


setupBookRide();


setupCancelRide();


});









// ===============================
// MAP
// ===============================


function initMap(){


map =
L.map("map")
.setView(
[30.7333,76.7794],
13
);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{
maxZoom:19
}

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









// ===============================
// LOCATION
// ===============================


function getLocation(){


if(!navigator.geolocation)
return;



navigator.geolocation.getCurrentPosition(

(position)=>{


let lat =
position.coords.latitude;


let lng =
position.coords.longitude;



map.setView(
[lat,lng],
15
);



userMarker =
L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup(
"Your Location"
)
.openPopup();




setPickup(
lat,
lng
);



},


(error)=>{


console.log(
"Location Error",
error
);


}

);


}









// ===============================
// PICKUP
// ===============================


function setPickup(lat,lng){


if(pickupMarker){

map.removeLayer(
pickupMarker
);

}



pickupMarker =
L.marker(
[lat,lng]
)
.addTo(map);



document
.getElementById("pickup")
.value =

lat.toFixed(5)
+
", "
+
lng.toFixed(5);



calculateFare();



}









// ===============================
// SERVICE
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
(s)=>
s.classList.remove("active")
);



service.classList.add("active");



selectedService =
service.dataset.service;



calculateFare();


};



});


}









// ===============================
// FARE
// ===============================


function calculateFare(){



let distance=5;


let hour =
new Date()
.getHours();



let rate=8;



if(hour>=22 || hour<6){

rate=11;

}

else if(distance>10){

rate=9;

}




let extra=0;



if(selectedService==="cab")
extra=50;


if(selectedService==="parcel")
extra=30;


if(selectedService==="food")
extra=20;



let total =
(distance*rate)+extra;



document
.getElementById("fare")
.innerText =
"₹"+total;



}









// ===============================
// BOOK RIDE
// ===============================


function setupBookRide(){



document
.getElementById("bookRide")
.onclick = async()=>{



if(!currentUser){

alert(
"Please login first"
);

return;

}



let drop =
document
.getElementById("drop")
.value.trim();



if(drop===""){


alert(
"Enter destination"
);


return;


}





let rideData={



customerId:
currentUser.uid,


service:
selectedService,


pickup:
document
.getElementById("pickup")
.value,


drop:drop,


fare:
document
.getElementById("fare")
.innerText,


payment:
document
.getElementById("payment")
.value,


status:
"searching",


riderId:null,


otp:
Math.floor(
1000+
Math.random()*9000
),


createdAt:
serverTimestamp()


};




try{


let rideRef =
await addDoc(
collection(db,"rides"),
rideData
);



currentRideId =
rideRef.id;



openRideModal();


listenRide();



console.log(
"Ride Created",
rideRef.id
);



}


catch(error){


console.log(
error
);


alert(
"Ride booking failed"
);



}



};



}









// ===============================
// TRACK RIDE
// ===============================


function listenRide(){



const rideRef =
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



let data =
snapshot.data();




if(data.status==="accepted"){



document
.getElementById("rideStatus")
.innerText =
"Rider Accepted";



document
.getElementById("rideInfo")
.innerText =
"Your Rider is coming";



document
.getElementById("riderDetails")
.style.display =
"block";



document
.getElementById("riderName")
.innerText =
"Rider ID: "
+
data.riderId;



document
.getElementById("rideOtp")
.innerText =
data.otp;



}



if(data.status==="cancelled"){



document
.getElementById("rideStatus")
.innerText =
"Ride Cancelled";


}



});


}









// ===============================
// MODAL
// ===============================


function openRideModal(){


document
.getElementById("rideModal")
.style.display =
"flex";


}









// ===============================
// CANCEL
// ===============================


function setupCancelRide(){



document
.getElementById("cancelRide")
.onclick =
async()=>{



if(currentRideId){


await updateDoc(

doc(
db,
"rides",
currentRideId
),

{

status:"cancelled"

}

);


}



document
.getElementById("rideModal")
.style.display =
"none";



};



}
