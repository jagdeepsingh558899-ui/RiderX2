// RiderX Customer Home Engine
// Map + Pickup + Drop + Fare + Firebase Booking


import {
    auth,
    db
} from "../firebase/firebase-config.js";


import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";



console.log("RiderX Customer Engine Loaded");



let map;

let pickupMarker = null;
let dropMarker = null;


let pickupCoords = null;
let dropCoords = null;


let selectedService = "bike";




const baseFare = {

    bike:20,
    cab:50,
    parcel:30,
    food:25

};






// ================= MAP =================


function initMap(){


const mapBox =
document.getElementById("map");


if(!mapBox){

console.log("Map missing");
return;

}



map =
L.map("map")
.setView(
[30.7333,76.7794],
13
);



L.tileLayer(
"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
{
maxZoom:19,
attribution:"OpenStreetMap"
}
)
.addTo(map);



map.on("click",(e)=>{


let lat =
e.latlng.lat;


let lng =
e.latlng.lng;



let text =
lat.toFixed(5)+", "+
lng.toFixed(5);



if(!pickupCoords){


pickupCoords={
lat,
lng
};



if(pickupMarker)
map.removeLayer(pickupMarker);



pickupMarker =
L.marker([lat,lng])
.addTo(map)
.bindPopup("Pickup")
.openPopup();



document.getElementById(
"pickupLocation"
).value=text;



setStatus(
"Pickup selected"
);



}



else if(!dropCoords){



dropCoords={
lat,
lng
};



if(dropMarker)
map.removeLayer(dropMarker);



dropMarker =
L.marker([lat,lng])
.addTo(map)
.bindPopup("Drop")
.openPopup();



document.getElementById(
"dropoffLocation"
).value=text;



calculateFare();



setStatus(
"Drop selected"
);



}



});



}








// ================= SERVICE =================


function setupServices(){


document
.querySelectorAll(".service")
.forEach(btn=>{


btn.onclick=()=>{


document
.querySelectorAll(".service")
.forEach(x=>
x.classList.remove("active")
);



btn.classList.add("active");


selectedService =
btn.dataset.service;



calculateFare();



};



});


}








// ================= FARE =================


function calculateFare(){


if(
!pickupCoords ||
!dropCoords
){

document.getElementById(
"fare"
).innerText="₹0";


return 0;

}



let km =
distance(
pickupCoords.lat,
pickupCoords.lng,
dropCoords.lat,
dropCoords.lng
);



let perKm = 8;


let hour =
new Date()
.getHours();



if(hour>=22 || hour<6){

perKm=11;

}

else if(km>10){

perKm=9;

}



let total =
baseFare[selectedService]
+
(km*perKm);



total=Math.round(total);



document.getElementById(
"fare"
).innerText =
"₹"+total;



return total;


}








// ================= DISTANCE =================


function distance(
lat1,
lon1,
lat2,
lon2
){


let R=6371;


let dLat =
(lat2-lat1)
*Math.PI/180;


let dLon =
(lon2-lon1)
*Math.PI/180;



let a =
Math.sin(dLat/2)**2 +

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








// ================= BOOK =================


function setupBooking(){


const btn =
document.getElementById(
"bookRide"
);



if(!btn)
return;



btn.onclick =
async()=>{



let user =
auth.currentUser;



if(!user){


alert(
"Please Login First"
);


return;

}



let pickup =
document.getElementById(
"pickupLocation"
).value;



let drop =
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

alert(
error.message
);


}



};



}








function setStatus(text){


let box =
document.getElementById(
"bookingStatus"
);



if(box){

box.innerText=text;

}



}







// ================= START =================


window.addEventListener(
"load",
()=>{


initMap();


setupServices();


setupBooking();



});
