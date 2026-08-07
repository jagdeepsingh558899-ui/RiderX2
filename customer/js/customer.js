// ======================================
// RiderX Customer Dashboard
// Final Fixed JS
// ======================================


let map;

let userMarker;

let pickupMarker;

let selectedService = "bike";

let currentLocation = null;





// ===============================
// Start App
// ===============================


document.addEventListener(
"DOMContentLoaded",
()=>{


initMap();


setupServices();


setupBookButton();


});








// ===============================
// Map Setup
// ===============================


function initMap(){



map = L.map("map")
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





// Map click pickup select


map.on(
"click",
function(e){



let lat =
e.latlng.lat;


let lng =
e.latlng.lng;



setPickupLocation(
lat,
lng
);



}

);





getCurrentLocation();



}









// ===============================
// Current GPS Location
// ===============================


function getCurrentLocation(){



if(!navigator.geolocation){

return;

}



navigator.geolocation.getCurrentPosition(

(position)=>{


let lat =
position.coords.latitude;


let lng =
position.coords.longitude;



currentLocation={
lat:lat,
lng:lng
};




map.setView(
[lat,lng],
15
);





if(userMarker){

map.removeLayer(userMarker);

}



userMarker =
L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup(
"Your Location"
)
.openPopup();





setPickupLocation(
lat,
lng
);



},



(error)=>{


console.log(
"Location permission denied"
);



}

);



}









// ===============================
// Pickup Select
// ===============================


function setPickupLocation(lat,lng){



if(pickupMarker){

map.removeLayer(pickupMarker);

}



pickupMarker =
L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup(
"Pickup Location"
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
// Service Selection
// ===============================


function setupServices(){



const services =
document.querySelectorAll(".service");



services.forEach(
(service)=>{


service.onclick=function(){



services.forEach(
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
// Fare Calculation
// ===============================


function calculateFare(){



let distance = 5;



let hour =
new Date()
.getHours();



let rate = 8;



if(hour >=22 || hour <6){

rate=11;

}

else if(distance >10){

rate=9;

}





let extra=0;



if(selectedService==="cab"){

extra=50;

}



if(selectedService==="parcel"){

extra=30;

}



if(selectedService==="food"){

extra=20;

}




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


function setupBookButton(){



document
.getElementById("bookRide")
.onclick=function(){



let pickup =
document
.getElementById("pickup")
.value;



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





let ride={


service:selectedService,


pickup:pickup,


drop:drop,


payment:
document
.getElementById("payment")
.value,


fare:
document
.getElementById("fare")
.innerText,


status:"searching",


createdAt:
new Date()

};





console.log(
"RiderX Ride:",
ride
);





alert(
"Searching nearby RiderX riders..."
);





// Next step:
// Firestore ride create



};



}
