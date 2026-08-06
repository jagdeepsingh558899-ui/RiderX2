// =====================================
// RiderX Booking System
// Map Pickup Drop + Ride Create
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


const pickupBox =
document.getElementById("pickup");


const dropBox =
document.getElementById("drop");


const fareBox =
document.getElementById("fare");


const distanceBox =
document.getElementById("distance");


const bookBtn =
document.getElementById("bookBtn");


const locationBtn =
document.getElementById("locationBtn");



let user=null;


let map;


let pickupMarker=null;

let dropMarker=null;


let pickupCoords=null;

let dropCoords=null;



let fare=0;





// ============================
// AUTH
// ============================


onAuthStateChanged(auth,(u)=>{


if(u){

user=u;

}

else{

location.href="../auth/login.html";

}


});






// ============================
// MAP INIT
// ============================


window.onload=()=>{


map=L.map("map").setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

).addTo(map);



setTimeout(()=>{

map.invalidateSize();

},1000);





// Map Click

map.on("click",(e)=>{



if(!pickupCoords){


pickupCoords={

lat:e.latlng.lat,

lng:e.latlng.lng

};


pickupBox.value=

pickupCoords.lat.toFixed(5)+
", "+
pickupCoords.lng.toFixed(5);



pickupMarker=L.marker(

[e.latlng.lat,e.latlng.lng]

)

.addTo(map)

.bindPopup("Pickup")

.openPopup();



}

else if(!dropCoords){


dropCoords={

lat:e.latlng.lat,

lng:e.latlng.lng

};


dropBox.value=

dropCoords.lat.toFixed(5)+
", "+
dropCoords.lng.toFixed(5);



dropMarker=L.marker(

[e.latlng.lat,e.latlng.lng]

)

.addTo(map)

.bindPopup("Drop")

.openPopup();



calculateDistance();


}



});


};







// ============================
// CURRENT LOCATION
// ============================


locationBtn.onclick=()=>{


navigator.geolocation.getCurrentPosition(

(pos)=>{


pickupCoords={

lat:pos.coords.latitude,

lng:pos.coords.longitude

};



pickupBox.value=

pickupCoords.lat.toFixed(5)+
", "+
pickupCoords.lng.toFixed(5);



if(pickupMarker){

map.removeLayer(pickupMarker);

}



pickupMarker=L.marker(

[

pickupCoords.lat,

pickupCoords.lng

]

)

.addTo(map)

.bindPopup("Your Pickup")

.openPopup();



map.setView(

[

pickupCoords.lat,

pickupCoords.lng

],

16

);



},

()=>{

alert(
"Location permission allow karo"
);

}


);


};








// ============================
// DISTANCE
// ============================


function calculateDistance(){


if(!pickupCoords || !dropCoords)
return;



let distance =

map.distance(

[

pickupCoords.lat,

pickupCoords.lng

],

[

dropCoords.lat,

dropCoords.lng

]

)

/

1000;



distance=

Number(distance.toFixed(1));



distanceBox.innerHTML=

distance+" KM";




let rate=8;



let hour=

new Date().getHours();



if(hour>=22 || hour<6){

rate=11;

}

else if(distance>10){

rate=9;

}



fare=

50+(distance*rate);



fareBox.innerHTML=

Math.round(fare);



}





service.addEventListener(

"change",

calculateDistance

);






// ============================
// BOOK RIDE
// ============================


bookBtn.onclick=async()=>{


if(!pickupCoords || !dropCoords){

alert(
"Pickup aur Drop map se select karo"
);

return;

}



try{


let ride=await addDoc(

collection(db,"rides"),

{


customerId:user.uid,


service:service.value,


pickup:pickupBox.value,


drop:dropBox.value,


pickupCoords,


dropCoords,


fare,


status:"Pending",


createdAt:serverTimestamp()


}

);



localStorage.setItem(

"rideId",

ride.id

);



alert(
"Ride Booked Successfully ✅"
);



location.href="ride-status.html";



}

catch(e){


alert(e.message);


}



};




console.log(
"RiderX Booking Loaded"
);
