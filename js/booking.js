// ==========================================
// RiderX Booking Engine V5
// Fare + Payment + OTP + Ride Create
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





let currentUser=null;


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








// LOAD FARE


async function loadFare(){


const snap = await getDoc(

doc(
db,
"settings",
"fare"

)

);



if(snap.exists()){


fareSettings={

...fareSettings,

...snap.data()

};


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



pickupMarker=L.marker(

[lat,lng]

)

.addTo(map);


}







function setDrop(lat,lng){



dropCoords={lat,lng};


drop.value=

lat.toFixed(6)+","+lng.toFixed(6);



dropMarker=L.marker(

[lat,lng]

)

.addTo(map);


}







// LOCATION


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









// FARE


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



if(service.value==="Bike Taxi")

rate=fareSettings.bike;



if(service.value==="Cab")

rate=fareSettings.cab;



if(service.value==="Parcel")

rate=fareSettings.parcel;



if(service.value==="Food")

rate=fareSettings.food;




let hour=new Date().getHours();



if(hour>=22 || hour<6){

rate += Number(fareSettings.night);

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








// BOOK


bookBtn.onclick=async()=>{



if(!currentUser)

return alert("Login Required");




if(!pickupCoords || !dropCoords)

return alert("Pickup Drop select karo");






let otp=

generateOTP();




let payment =

paymentMethod.value;






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



pickupCoords,

dropCoords,



distance,



fare:

Math.round(fare),



otp,



paymentMethod:

payment,



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

updatedAt:
serverTimestamp()

}

);







localStorage.setItem(

"rideId",

ride.id

);




alert(

"Ride Searching 🚕"

);




location.href=

"map.html";





}

catch(error){


alert(error.message);


}




};




console.log(
"RiderX Booking V5 Loaded"
);
