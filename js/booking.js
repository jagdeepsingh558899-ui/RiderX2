// =====================================
// RiderX Booking System Final
// =====================================


import { auth, db } from "../firebase/config.js";


import {

collection,
addDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";




// Elements

const service =
document.getElementById("service");


const pickup =
document.getElementById("pickup");


const drop =
document.getElementById("drop");


const fareBox =
document.getElementById("fare");


const bookBtn =
document.getElementById("bookBtn");


const distanceBox =
document.getElementById("distance");



let currentUser=null;


let map;


let marker=null;


let pickupLat=null;

let pickupLng=null;


let fare=0;




// ================================
// User Check
// ================================


onAuthStateChanged(auth,(user)=>{


if(user){

currentUser=user;

}

else{

window.location.href="../auth/login.html";

}


});





// ================================
// Create Map
// ================================


map=L.map("map").setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19,

attribution:"© OpenStreetMap"

}

).addTo(map);





setTimeout(()=>{

map.invalidateSize();

},500);





// ================================
// Current Location
// ================================


document
.getElementById("locationBtn")
.onclick=function(){



navigator.geolocation.getCurrentPosition(

(position)=>{


pickupLat =
position.coords.latitude;


pickupLng =
position.coords.longitude;



pickup.value =

pickupLat.toFixed(6)

+

", "

+

pickupLng.toFixed(6);




if(marker){

map.removeLayer(marker);

}




marker=L.marker(

[pickupLat,pickupLng]

)

.addTo(map)

.bindPopup(

"📍 Pickup Location"

)

.openPopup();



map.setView(

[pickupLat,pickupLng],

16

);



calculateFare();



},


()=>{


alert(
"Location permission allow karo"
);


}


);



};






// ================================
// Fare
// ================================


function calculateFare(){


let base=50;



if(service.value==="Cab"){

base=120;

}


if(service.value==="Parcel"){

base=80;

}


if(service.value==="Food"){

base=60;

}



fare=base+40;



fareBox.innerHTML=

Math.round(fare);



distanceBox.innerHTML=

"5 KM";


}




service.addEventListener(

"change",

calculateFare

);



calculateFare();





// ================================
// Booking
// ================================


bookBtn.onclick=async()=>{



if(!pickup.value){

alert(
"Pickup select karo"
);

return;

}



if(!drop.value){

alert(
"Drop location enter karo"
);

return;

}




try{


const ride = await addDoc(

collection(db,"rides"),

{


customerId:

currentUser.uid,


service:

service.value,


pickup:

pickup.value,


drop:

drop.value,


pickupLat,

pickupLng,


fare,


status:

"Pending",


createdAt:

serverTimestamp()


}

);



localStorage.setItem(

"rideId",

ride.id

);



alert(

"Ride Booked Successfully ✅"

);



window.location.href=

"ride-status.html";




}

catch(error){


alert(

error.message

);


}



};




console.log(

"RiderX Booking Map Loaded"

);
