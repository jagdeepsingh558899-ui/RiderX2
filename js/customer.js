// RiderX Customer Dashboard Engine
// Map + GPS + Fare + Firebase Ride Booking


import {
auth,
db,
collection,
addDoc,
serverTimestamp
}
from "../firebase/firebase-config.js";


let selectedService = "bike";

let map;
let marker;



const fareRates = {

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

maxZoom:19,
attribution:"© OpenStreetMap"

}

).addTo(map);




if(navigator.geolocation){


navigator.geolocation.getCurrentPosition(

(position)=>{


let lat=position.coords.latitude;
let lng=position.coords.longitude;



map.setView(
[lat,lng],
16
);



marker=L.marker(
[lat,lng]
)
.addTo(map)
.bindPopup(
"Your Location"
)
.openPopup();



}

);



}


}




// ================= SERVICE =================



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


selectedService=
item.dataset.type;



calculateFare();



};


});





// ================= FARE =================



function calculateFare(){


let distance=5;


let data=
fareRates[selectedService];


let total=
data.base+
(data.perKm*distance);



document
.getElementById("fare")
.innerText=
"₹"+total;



return total;


}






// ================= BOOK RIDE =================



document
.getElementById("bookRide")
.onclick=async()=>{



const user=
auth.currentUser;



if(!user){


alert(
"Please Login First"
);


location.href=
"../auth/login.html";


return;


}



let pickup=
document.getElementById("pickup").value;



let drop=
document.getElementById("drop").value;



let payment=
document.getElementById("payment").value;





if(!pickup || !drop){


alert(
"Pickup and Drop required"
);


return;

}




try{


let rideData={


customerId:user.uid,


pickupLocation:pickup,


dropLocation:drop,


serviceType:selectedService,


paymentMethod:payment,


fare:calculateFare(),


status:"REQUESTED",


createdAt:serverTimestamp()


};





await addDoc(

collection(db,"rides"),

rideData

);





document.getElementById("status")
.innerHTML=
"Searching RiderX Rider...";





}

catch(error){


alert(
error.message
);


}



};







document.addEventListener(

"DOMContentLoaded",

()=>{


initMap();

calculateFare();


}

);
