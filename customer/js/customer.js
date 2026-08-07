// ======================================
// RiderX Customer Dashboard
// Firebase Ride System Final
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
onSnapshot

}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";




// ===============================
// Variables
// ===============================


let map;

let userMarker;

let pickupMarker;

let currentUser = null;

let selectedService = "bike";

let currentLocation = null;

let currentRideId = null;

let rideListener = null;





// ===============================
// Auth
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
"No User Login"
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



getCurrentLocation();


}









// ===============================
// GPS
// ===============================


function getCurrentLocation(){



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




if(userMarker)
map.removeLayer(userMarker);




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
"GPS Error",
error
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



if(pickupMarker){

map.removeLayer(
pickupMarker
);

}




pickupMarker =
L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup(
"Pickup Location"
);





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



const btn =
document
.getElementById("bookRide");



btn.onclick =
async()=>{



let drop =
document
.getElementById("drop")
.value.trim();





if(!drop){


alert(
"Enter Drop Location"
);


return;


}






if(!currentUser){


alert(
"Please Login First"
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



currentRideId =
rideRef.id;




listenRideStatus(
currentRideId
);



alert(
"Searching nearby RiderX riders..."
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
// Realtime Ride Status
// ===============================


function listenRideStatus(
rideId
){



const rideRef =
doc(
db,
"rides",
rideId
);



rideListener =
onSnapshot(

rideRef,

(snapshot)=>{


if(!snapshot.exists())
return;



let data =
snapshot.data();





if(data.status==="accepted"){


alert(
"🎉 Rider Accepted Your Ride"
);


console.log(
"Rider:",
data.riderId
);



}




if(data.status==="completed"){


alert(
"Ride Completed"
);



}



}



);



  }
