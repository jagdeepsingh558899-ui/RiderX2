// =====================================
// RiderX Customer Map System
// GPS + Fare + Booking
// =====================================


import {

db,

auth

}

from "../firebase/config.js";



import {

collection,

addDoc,

serverTimestamp

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";







let map;

let marker;

let currentLat;

let currentLng;

let selectedService="Bike Taxi";

let distance=0;









// =====================================
// INIT MAP
// =====================================



function initMap(){



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






getGPS();



}









// =====================================
// GPS
// =====================================



function getGPS(){



navigator.geolocation.getCurrentPosition(

(position)=>{



currentLat=

position.coords.latitude;



currentLng=

position.coords.longitude;







marker=L.marker(

[currentLat,currentLng]

).addTo(map);





map.setView(

[currentLat,currentLng],

16

);







document.getElementById(

"pickup"

).value=

currentLat+","+currentLng;







},

(error)=>{



alert(

"GPS Permission Required"

);



}



);



}









// =====================================
// SERVICE SELECT
// =====================================



document.querySelectorAll(

".service"

).forEach(btn=>{



btn.onclick=()=>{



document.querySelectorAll(

".service"

).forEach(x=>{


x.classList.remove("active");


});





btn.classList.add("active");



selectedService=

btn.dataset.service;



calculateFare();



};



});









// =====================================
// FARE CALCULATION
// =====================================



function calculateFare(){



let rate=8;



if(selectedService==="Cab"){


rate=12;


}



if(selectedService==="Parcel"){


rate=10;


}



if(selectedService==="Food"){


rate=20;


}






let fare=

Math.max(

50,

distance*rate

);






document.getElementById(

"fare"

).innerHTML=

"₹"+Math.round(fare);



}









// =====================================
// BOOK RIDE
// =====================================



document.getElementById(

"bookRide"

).onclick=async()=>{



const user=

auth.currentUser;



if(!user){



alert(

"Please login first"

);



return;


}






const pickup=

document.getElementById(

"pickup"

).value;



const drop=

document.getElementById(

"drop"

).value;






if(!drop){



alert(

"Enter destination"

);



return;


}







try{



await addDoc(

collection(

db,

"rides"

),


{


customerId:user.uid,


service:selectedService,


pickup:pickup,


drop:drop,


fare:document.getElementById(

"fare"

).innerHTML,


status:"searching",


createdAt:

serverTimestamp()



}


);






alert(

"Ride Searching..."

);



window.location.href=

"home.html";



}



catch(error){



alert(

error.message

);



}



};








initMap();
