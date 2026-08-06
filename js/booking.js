// ==========================================
// RiderX Booking Engine V6
// Ride + Parcel + Food Booking
// Fare + Payment + OTP + Firebase
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
addDoc,
doc,
getDoc,
setDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const service =
document.getElementById("service");


const pickup =
document.getElementById("pickup");


const drop =
document.getElementById("drop");


const fareBox =
document.getElementById("fare");


const distanceBox =
document.getElementById("distance");


const bookBtn =
document.getElementById("bookBtn");


const locationBtn =
document.getElementById("locationBtn");


const paymentMethod =
document.getElementById("paymentMethod");



const rideOption =
document.getElementById("rideOption");


const parcelOption =
document.getElementById("parcelOption");







let currentUser=null;


let bookingMode="ride";


let map;


let pickupCoords=null;

let dropCoords=null;


let pickupMarker=null;

let dropMarker=null;


let distance=0;

let fare=0;






let fareSettings={

base:50,

bike:8,

taxi:12,

cab:15,

parcel:80,

food:60,

night:3

};









// AUTH

onAuthStateChanged(auth,(user)=>{


if(user){

currentUser=user;

}

else{

location.href="../auth/login.html";

}


});









// FARE SETTINGS


async function loadFare(){


try{


const snap=

await getDoc(

doc(db,"settings","fare")

);



if(snap.exists()){


fareSettings={

...fareSettings,

...snap.data()

};


}


}

catch(e){

console.log(e);

}


}


loadFare();









// MAP


window.onload=()=>{


map=L.map("map")

.setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

)

.addTo(map);





map.on("click",(e)=>{


if(!pickupCoords){


setPickup(

e.latlng.lat,

e.latlng.lng

);


}

else if(!dropCoords){


setDrop(

e.latlng.lat,

e.latlng.lng

);


calculateFare();


}



});


};









function setPickup(lat,lng){


pickupCoords={lat,lng};


pickup.value=

lat.toFixed(6)+","+lng.toFixed(6);



if(pickupMarker)

map.removeLayer(pickupMarker);



pickupMarker=

L.marker(

[lat,lng]

)

.addTo(map);



}








function setDrop(lat,lng){


dropCoords={lat,lng};


drop.value=

lat.toFixed(6)+","+lng.toFixed(6);



if(dropMarker)

map.removeLayer(dropMarker);



dropMarker=

L.marker(

[lat,lng]

)

.addTo(map);



}









// CURRENT LOCATION


locationBtn.onclick=()=>{


navigator.geolocation.getCurrentPosition(

(pos)=>{


setPickup(

pos.coords.latitude,

pos.coords.longitude

);



map.setView(

[

pos.coords.latitude,

pos.coords.longitude

],

16

);



}


);


};









// SERVICE MODE


if(rideOption){


rideOption.onclick=()=>{


bookingMode="ride";


bookBtn.innerHTML="Book Ride";


};


}



if(parcelOption){


parcelOption.onclick=()=>{


bookingMode="parcel";


service.value="Parcel";


bookBtn.innerHTML="Book Parcel";


};


}











// FARE CALCULATION


function calculateFare(){



if(!pickupCoords || !dropCoords)

return;




distance=

map.distance(

[

pickupCoords.lat,

pickupCoords.lng

],

[

dropCoords.lat,

dropCoords.lng

]

)/1000;




distance=

Number(

distance.toFixed(1)

);



distanceBox.innerHTML=

distance+" KM";





let rate=0;



switch(service.value){


case "Bike":

rate=fareSettings.bike;

break;



case "Taxi":

rate=fareSettings.taxi;

break;



case "Cab":

rate=fareSettings.cab;

break;



case "Parcel":

rate=fareSettings.parcel;

break;



case "Food":

rate=fareSettings.food;

break;


}






let hour=

new Date().getHours();



if(hour>=22 || hour<6){

rate+=Number(fareSettings.night);

}





if(

service.value==="Parcel" ||

service.value==="Food"

){


fare=rate;


}

else{


fare=

fareSettings.base+

(distance*rate);


}






fareBox.innerHTML=

Math.round(fare);



}



service.onchange=

calculateFare;









// OTP


function generateOTP(){


return Math.floor(

1000+

Math.random()*9000

).toString();


}









// BOOKING


bookBtn.onclick=async()=>{



if(!currentUser)

return alert("Login Required");





if(!pickupCoords || !dropCoords)

return alert("Pickup Drop select karo");






let otp=

generateOTP();





try{


const ride=

await addDoc(

collection(db,"rides"),

{


customerId:

currentUser.uid,



bookingType:

bookingMode,



serviceType:

service.value,



pickup:

pickup.value,



drop:

drop.value,



pickupCoords,

dropCoords,



distance,



fare:

Math.round(fare),



otp,



paymentMethod:

paymentMethod.value,



paymentStatus:

"pending",



status:

"searching",



createdAt:

serverTimestamp()



}



);








await setDoc(

doc(

db,

"liveLocations",

currentUser.uid

),

{

role:"customer",

rideId:ride.id,

location:pickupCoords,

updatedAt:serverTimestamp()

}

);






localStorage.setItem(

"rideId",

ride.id

);






alert(

bookingMode==="ride"

?

"Ride Searching 🚕"

:

"Parcel Searching 📦"

);





location.href="map.html";



}

catch(error){


alert(error.message);


}



};







console.log(

"RiderX Booking V6 Loaded"

);
