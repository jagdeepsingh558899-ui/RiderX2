// =====================================
// RiderX Customer Engine
// Map + Fare + Booking + Firebase
// =====================================


import {
auth,
db
}
from "../firebase/firebase-config.js";


import {

collection,
addDoc,
serverTimestamp

}

from

"https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";



console.log("RiderX Customer Engine Loaded");



let map;

let pickupMarker;
let dropMarker;


let pickupCoords=null;
let dropCoords=null;


let selectedService="bike";



const baseFare={

bike:20,
cab:50,
parcel:30,
food:25

};






// ================= MAP =================


function initMap(){


const mapBox=document.getElementById("map");


if(!mapBox) return;



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


const lat=e.latlng.lat;
const lng=e.latlng.lng;



const text =
lat.toFixed(5)+", "+
lng.toFixed(5);





if(!pickupCoords){


pickupCoords={lat,lng};



pickupMarker=
L.marker([lat,lng])
.addTo(map)
.bindPopup("Pickup")
.openPopup();



document.getElementById(
"pickupLocation"
).value=text;



setStatus("Pickup Selected");


}





else if(!dropCoords){


dropCoords={lat,lng};



dropMarker=
L.marker([lat,lng])
.addTo(map)
.bindPopup("Drop")
.openPopup();



document.getElementById(
"dropoffLocation"
).value=text;



calculateFare();



setStatus("Drop Selected");


}



});



}






// ================= SERVICE =================


function setupServices(){


document
.querySelectorAll(".service")
.forEach(item=>{


item.onclick=()=>{


document
.querySelectorAll(".service")
.forEach(x=>
x.classList.remove("active")
);



item.classList.add("active");


selectedService =
item.dataset.service;


calculateFare();


};



});


}







// ================= FARE =================


function calculateFare(){


if(!pickupCoords || !dropCoords){

document.getElementById("fare").innerText="₹0";

return 0;

}



let km =
getDistance(

pickupCoords.lat,
pickupCoords.lng,

dropCoords.lat,
dropCoords.lng

);



let rate=8;



let hour =
new Date().getHours();



if(hour>=22 || hour<6){

rate=11;

}

else if(km>10){

rate=9;

}





let total =
baseFare[selectedService]
+
(km*rate);



total=Math.round(total);



document.getElementById("fare").innerText=
"₹"+total;



return total;


}








// ================= DISTANCE =================


function getDistance(
lat1,
lon1,
lat2,
lon2
){


const R=6371;


const dLat=
(lat2-lat1)
*Math.PI/180;


const dLon=
(lon2-lon1)
*Math.PI/180;



const a=

Math.sin(dLat/2)**2

+

Math.cos(lat1*Math.PI/180)
*
Math.cos(lat2*Math.PI/180)
*
Math.sin(dLon/2)**2;



return R *
2 *
Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);


}








// ================= BOOK RIDE =================


function setupBooking(){


const btn=
document.getElementById("bookRide");



if(!btn)return;



btn.onclick=async()=>{


const user=auth.currentUser;



if(!user){

alert("Please Login First");

return;

}





const pickup=
document.getElementById(
"pickupLocation"
).value;



const drop=
document.getElementById(
"dropoffLocation"
).value;




if(!pickup || !drop){


alert(
"Pickup and Drop select kare"
);


return;


}





try{


await addDoc(

collection(db,"rides"),

{


customerId:user.uid,


pickupLocation:pickup,


dropLocation:drop,


pickupCoords,


dropCoords,


serviceType:selectedService,


paymentMethod:
document.getElementById(
"paymentMethod"
).value,


fare:
calculateFare(),


status:"REQUESTED",


createdAt:
serverTimestamp()


}

);




setStatus(
"Searching RiderX Rider..."
);



}


catch(error){


console.error(error);

alert(error.message);


}



};


}







function setStatus(text){


const box=
document.getElementById(
"bookingStatus"
);



if(box){

box.innerText=text;

}


}







// ================= START =================


window.onload=()=>{


initMap();


setupServices();


setupBooking();


};
