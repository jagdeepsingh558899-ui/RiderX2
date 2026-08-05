import { db } from "../firebase/config.js";


import {

ref,
set,
onValue

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";



let map;


let marker;



function createMap(){


map = L.map("map").setView(

[20.5937,78.9629],

5

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

).addTo(map);



}



createMap();






window.getCustomerLocation=function(){



navigator.geolocation.getCurrentPosition(

(position)=>{


let lat =
position.coords.latitude;


let lng =
position.coords.longitude;



map.setView(

[lat,lng],

16

);



L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"You are here"

)

.openPopup();



}

);


};







window.startRiderLocation=function(){



navigator.geolocation.watchPosition(

(position)=>{


let lat =
position.coords.latitude;


let lng =
position.coords.longitude;



if(marker){

marker.setLatLng(
[lat,lng]
);


}

else{


marker =
L.marker(
[lat,lng]
)

.addTo(map);



}



map.setView(

[lat,lng],

16

);



set(

ref(

db,

"liveRider/location"

),

{

latitude:lat,

longitude:lng

}

);



}

);


};






// Show Rider Location For Customer


const riderMap = document.getElementById("map");


if(riderMap){


onValue(

ref(db,"liveRider/location"),

(snapshot)=>{


let data =
snapshot.val();



if(data && marker){


marker.setLatLng(

[
data.latitude,
data.longitude
]

);


}


}

);


}
