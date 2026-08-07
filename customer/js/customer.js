// =====================================
// RiderX Customer Dashboard JS
// =====================================


// Service Selection

let selectedService = "bike";


const services = document.querySelectorAll(".service");


services.forEach(service=>{


service.addEventListener("click",()=>{


services.forEach(s=>s.classList.remove("active"));


service.classList.add("active");


selectedService =
service.innerText.toLowerCase();



calculateFare();



});


});




// =====================================
// MAP
// =====================================


let map;


let userMarker;



function initMap(){


map = L.map('map').setView(
[30.7333,76.7794],
13
);



L.tileLayer(
'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
)
.addTo(map);



getCurrentLocation();


}





// =====================================
// Current Location
// =====================================


function getCurrentLocation(){



if(navigator.geolocation){


navigator.geolocation.getCurrentPosition(
(position)=>{


let lat =
position.coords.latitude;


let lng =
position.coords.longitude;



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



},
()=>{


console.log(
"Location permission denied"
);


}

);



}



}





// =====================================
// Distance & Fare
// =====================================


function calculateFare(){



let distance = 5; 
// temporary distance
// later Google/OSM routing se aayega



let hour =
new Date().getHours();



let rate = 8;



if(hour >=22 || hour <6){


rate = 11;


}

else if(distance > 10){


rate = 9;


}




let serviceCharge = 0;



if(selectedService.includes("cab")){

serviceCharge = 50;

}


if(selectedService.includes("parcel")){

serviceCharge = 30;

}


if(selectedService.includes("food")){

serviceCharge = 20;

}



let total =
(distance * rate)+serviceCharge;



document.getElementById("fare").innerHTML =
"₹"+total.toFixed(0);



}





// =====================================
// Book Ride
// =====================================


document
.getElementById("bookRide")
.addEventListener(
"click",
()=>{



let pickup =
document.getElementById("pickup").value;



let drop =
document.getElementById("drop").value;




if(drop===""){


alert(
"Please enter destination"
);


return;


}





let rideData = {


service:selectedService,


pickup:pickup,


drop:drop,


payment:
document.getElementById("payment").value,


fare:
document.getElementById("fare").innerText,


status:"searching",


createdAt:
new Date()



};





console.log(
"Ride Created",
rideData
);





alert(
"Searching nearby RiderX riders..."
);





// Firebase Firestore yaha connect hoga
// riders ko notification jayega



});








// Start

window.onload=function(){


initMap();


calculateFare();


};
