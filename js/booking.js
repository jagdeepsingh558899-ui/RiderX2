// ==========================================
// RiderX Booking Engine V4
// Uber Style Ride Create System
// Firebase + GPS + Fare + Live Ready
// ==========================================

import { auth, db } from "../firebase/config.js";

import {
    collection,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


// ELEMENTS

const service = document.getElementById("service");
const pickup = document.getElementById("pickup");
const drop = document.getElementById("drop");

const fareBox = document.getElementById("fare");
const distanceBox = document.getElementById("distance");

const bookBtn = document.getElementById("bookBtn");
const locationBtn = document.getElementById("locationBtn");


// VARIABLES

let currentUser = null;

let map;
let pickupMarker;
let dropMarker;

let pickupCoords = null;
let dropCoords = null;

let distance = 0;
let fare = 0;

let rideCreating = false;



let fareSettings = {

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

        window.location.href="../auth/login.html";

    }


});




// LOAD FARE FROM ADMIN

async function loadFare(){


try{

const snap = await getDoc(
doc(db,"settings","fare")
);


if(snap.exists()){


fareSettings={
...fareSettings,
...snap.data()
};


}


}catch(e){

console.log(e);

}


}


loadFare();





// MAP START

window.addEventListener("load",()=>{


map=L.map("map")
.setView(
[30.7333,76.7794],
13
);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

).addTo(map);



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



});






// SET PICKUP

function setPickup(lat,lng){


pickupCoords={lat,lng};


pickup.value =
lat.toFixed(6)+","+lng.toFixed(6);



if(pickupMarker)

map.removeLayer(pickupMarker);



pickupMarker=L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup("Pickup")
.openPopup();


}




// SET DROP


function setDrop(lat,lng){


dropCoords={lat,lng};


drop.value =
lat.toFixed(6)+","+lng.toFixed(6);



if(dropMarker)

map.removeLayer(dropMarker);



dropMarker=L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup("Drop")
.openPopup();


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



},

()=>{

alert("GPS permission allow karo");

}

);



};







// DISTANCE

function getDistance(a,b){


return map.distance(

[
a.lat,
a.lng
],

[
b.lat,
b.lng
]

)/1000;


}






// FARE


function calculateFare(){


if(!pickupCoords || !dropCoords)
return;



distance =
Number(
getDistance(
pickupCoords,
dropCoords
)
.toFixed(1)
);



distanceBox.innerHTML =
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





service.addEventListener(
"change",
calculateFare
);








// OTP

function createOTP(){


return Math.floor(
1000+
Math.random()*9000
).toString();


}








// BOOK RIDE


bookBtn.onclick=async()=>{


if(rideCreating)
return;


if(!currentUser){

alert("Login required");

return;

}




if(!pickupCoords || !dropCoords){


alert(
"Pickup aur Drop select karo"
);


return;

}





rideCreating=true;

bookBtn.innerHTML="Searching Rider...";





try{


const otp=createOTP();




// CREATE RIDE


const rideRef = await addDoc(

collection(db,"rides"),

{


customerId:
currentUser.uid,


service:
service.value,


pickup,
drop,


pickupCoords,
dropCoords,


distance,


fare:
Math.round(fare),



otp,


status:
"searching",



paymentStatus:
"pending",



createdAt:
serverTimestamp()



}


);





// SAVE CUSTOMER LIVE LOCATION


await setDoc(

doc(
db,
"liveLocations",
currentUser.uid
),

{

role:"customer",

rideId:rideRef.id,

location:pickupCoords,

updatedAt:serverTimestamp()

}

);





localStorage.setItem(
"rideId",
rideRef.id
);




alert(
"Ride searching 🚕"
);



window.location.href=
"ride-status.html";





}

catch(error){


alert(
error.message
);


}


rideCreating=false;


bookBtn.innerHTML="Confirm Booking";



};





console.log(
"RiderX V4 Booking Engine Loaded"
);
