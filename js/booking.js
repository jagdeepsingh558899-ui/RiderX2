import { db } from "../firebase/config.js";


import {

collection,
addDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



let map;

let userLat;

let userLng;


let dropLat;

let dropLng;



let distanceKM=0;

let fare=0;



map = L.map("map").setView(

[20.5937,78.9629],

5

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

).addTo(map);





// Current Location


navigator.geolocation.getCurrentPosition(

(position)=>{


userLat =
position.coords.latitude;


userLng =
position.coords.longitude;



map.setView(

[userLat,userLng],

15

);



L.marker(

[userLat,userLng]

)

.addTo(map)

.bindPopup(

"Pickup Location"

)

.openPopup();



document.getElementById("pickup").value =

userLat+","+userLng;



}

);






// Drop Search Enter


document.getElementById("drop")

.addEventListener(

"change",

async()=>{


let place =

document.getElementById("drop").value;



let url =

`https://nominatim.openstreetmap.org/search?format=json&q=${place}`;



let response =

await fetch(url);



let data =

await response.json();



if(data.length){


dropLat =
data[0].lat;


dropLng =
data[0].lon;



L.marker(

[dropLat,dropLng]

)

.addTo(map)

.bindPopup(

"Drop Location"

)

.openPopup();



map.setView(

[dropLat,dropLng],

14

);



}


}

);







// Distance Calculate


window.calculateRide=function(){



if(!dropLat){

alert("Drop location select karo");

return;

}



let R=6371;



let dLat=

(dropLat-userLat)*Math.PI/180;


let dLon=

(dropLng-userLng)*Math.PI/180;



let a=

Math.sin(dLat/2)**2 +

Math.cos(userLat*Math.PI/180)*

Math.cos(dropLat*Math.PI/180)*

Math.sin(dLon/2)**2;



distanceKM=

R*2*Math.atan2(

Math.sqrt(a),

Math.sqrt(1-a)

);



distanceKM =

distanceKM.toFixed(1);




let vehicle =

document.getElementById("vehicle").value;



if(vehicle=="bike"){

fare =
50 + distanceKM*12;

}


if(vehicle=="cab"){

fare =
80 + distanceKM*20;

}


if(vehicle=="parcel"){

fare =
40 + distanceKM*15;

}




document.getElementById("distance").innerHTML=

"Distance: "+distanceKM+" KM";



document.getElementById("fare").innerHTML=

"Fare: ₹"+Math.round(fare);



};







// Book Ride


window.bookRide=async function(){


await addDoc(

collection(db,"rides"),

{

pickup:

{

lat:userLat,

lng:userLng

},


drop:

{

lat:dropLat,

lng:dropLng

},


distance:distanceKM,


fare:Math.round(fare),


vehicle:

document.getElementById("vehicle").value,


status:"requested"


}

);



document.getElementById("message").innerHTML=

"Ride Booked Successfully 🚀";


};
