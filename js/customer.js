// RiderX Customer Engine
// Map + GPS + Fare + Ride Booking
// Firebase v10 Modular SDK


import {

auth,
db,
doc,
addDoc,
collection,
serverTimestamp

}

from "../firebase/firebase-config.js";





let map;
let userMarker;

let selectedService = "bike";






const fares = {

bike:{
base:20,
perKm:8
},

cab:{
base:50,
perKm:15
},

parcel:{
base:30,
perKm:10
},

food:{
base:25,
perKm:9
}

};







// ===============================
// INIT MAP
// ===============================


function initMap(){


if(!document.getElementById("map"))
return;



map = L.map("map").setView(
[30.7333,76.7794],
14
);




L.tileLayer(
"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
{

maxZoom:19,
attribution:"© OpenStreetMap"

}

).addTo(map);




startGPS();


}









// ===============================
// GPS
// ===============================


function startGPS(){



if(!navigator.geolocation){

alert("GPS not supported");

return;

}




navigator.geolocation.watchPosition(

(position)=>{


const lat =
position.coords.latitude;


const lng =
position.coords.longitude;




if(!userMarker){


userMarker =
L.marker([lat,lng])
.addTo(map)
.bindPopup("You are here")
.openPopup();


map.setView(
[lat,lng],
16
);



}

else{


userMarker.setLatLng(
[lat,lng]
);


}



},


(error)=>{

console.log(
"GPS Error",
error
);

},


{

enableHighAccuracy:true

}



);


}









// ===============================
// FARE
// ===============================


function calculateFare(){



const distance = 5;



const fareData =
fares[selectedService];



const total =
fareData.base +
(
fareData.perKm *
distance
);



document.getElementById("fare")
.innerText =
"₹"+Math.round(total);



return Math.round(total);


}








// ===============================
// SERVICE SELECT
// ===============================


document
.querySelectorAll(".service")
.forEach((item)=>{


item.onclick = ()=>{


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









// ===============================
// BOOK RIDE
// ===============================


const bookBtn =
document.getElementById("bookRide");



if(bookBtn){



bookBtn.onclick =
async ()=>{



const user =
auth.currentUser;



if(!user){


alert(
"Please login first"
);


window.location.href =
"../auth/login.html";


return;

}





const pickup =
document
.getElementById("pickupLocation")
.value;



const drop =
document
.getElementById("dropoffLocation")
.value;



const payment =
document
.getElementById("paymentMethod")
.value;



if(!pickup || !drop){


alert(
"Enter pickup and drop location"
);


return;

}






try{


const ride = {


customerId:user.uid,


pickupLocation:pickup,


dropLocation:drop,


serviceType:selectedService,


paymentMethod:payment,


fare:calculateFare(),


status:"REQUESTED",


createdAt:
serverTimestamp()



};





const ref =
await addDoc(
collection(db,"rides"),
ride
);





document.getElementById(
"bookingStatus"
).innerHTML =


`
<div style="
background:#111;
padding:15px;
border-radius:15px;
margin-top:15px;
border:1px solid #FFD600">

<h3 style="color:#FFD600">

Ride Requested

</h3>


<p>
Ride ID:
${ref.id}
</p>


<p>
Searching RiderX Rider...
</p>


</div>
`;





}

catch(error){


alert(
error.message
);


}



};



}







// Start

document.addEventListener(
"DOMContentLoaded",
()=>{


initMap();

calculateFare();


}

);
