// ======================================
// RiderX Customer Dashboard
// Firebase Ride System
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
serverTimestamp

}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";





let map;

let userMarker;

let pickupMarker;

let currentUser = null;

let selectedService = "bike";

let currentLocation = null;







// ===============================
// Auth Check
// ===============================


onAuthStateChanged(
auth,
(user)=>{


if(user){

currentUser = user;

console.log(
"Customer:",
user.uid
);


}

else{


console.log(
"User not login"
);


}



});









// ===============================
// Start
// ===============================


document.addEventListener(
"DOMContentLoaded",
()=>{


initMap();


setupServices();


setupBookRide();



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
// GPS
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



currentLocation={
lat,
lng
};




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



}

);



}









// ===============================
// Pickup
// ===============================


function setPickup(
lat,
lng
){



if(pickupMarker)
map.removeLayer(pickupMarker);




pickupMarker =
L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup(
"Pickup"
)
.openPopup();




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
// Service
// ===============================


function setupServices(){



document
.querySelectorAll(".service")
.forEach(
(item)=>{


item.onclick=()=>{


document
.querySelectorAll(".service")
.forEach(
(x)=>
x.classList.remove("active")
);



item.classList.add("active");



selectedService =
item.dataset.service;



calculateFare();



};


});



}









// ===============================
// Fare
// ===============================


function calculateFare(){



let distance = 5;



let hour =
new Date()
.getHours();



let rate = 8;



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





let total =
(distance*rate)+extra;



document
.getElementById("fare")
.innerText =
"₹"+total;



}









// ===============================
// Book Ride
// ===============================


function setupBookRide(){



document
.getElementById("bookRide")
.onclick =
async ()=>{


let drop =
document
.getElementById("drop")
.value;



if(!drop){


alert(
"Please enter drop location"
);


return;


}




if(!currentUser){


alert(
"Please login first"
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


payment:
document
.getElementById("payment")
.value,


fare:
document
.getElementById("fare")
.innerText,


status:
"searching",


riderId:null,


createdAt:
serverTimestamp()



};







try{


const rideRef =
await addDoc(
collection(db,"rides"),
rideData
);



console.log(
"Ride Created:",
rideRef.id
);



alert(
"Searching nearby RiderX riders..."
);





}


catch(error){


console.log(error);


alert(
"Ride failed"
);



}



};



}
