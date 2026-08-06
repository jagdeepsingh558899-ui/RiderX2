// =====================================
// RiderX Live Tracking System
// Rider GPS + Firebase Location
// =====================================


import {

db,

auth

}

from "../firebase/config.js";



import {

doc,

setDoc,

updateDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";







let map;

let marker;

let rideId=null;









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






startGPS();



}









// =====================================
// START GPS
// =====================================



function startGPS(){



if(!navigator.geolocation){



alert(

"GPS Not Available"

);



return;


}






navigator.geolocation.watchPosition(

(position)=>{



const lat =

position.coords.latitude;



const lng =

position.coords.longitude;






if(!marker){



marker=L.marker(

[lat,lng]

).addTo(map);



map.setView(

[lat,lng],

16

);



}

else{



marker.setLatLng(

[lat,lng]

);



}






saveLiveLocation(

lat,

lng

);





},



(error)=>{


console.log(error);


},


{


enableHighAccuracy:true,


timeout:10000,


maximumAge:1000


}



);



}









// =====================================
// SAVE LOCATION
// =====================================



async function saveLiveLocation(lat,lng){



const user=

auth.currentUser;



if(!user){

return;

}







await setDoc(

doc(

db,

"locations",

user.uid

),


{


lat:lat,


lng:lng,


type:"rider",


time:new Date()



},


{

merge:true

}


);



}









// =====================================
// START RIDE
// =====================================



document.getElementById(

"startRide"

).onclick=async()=>{



document.getElementById(

"rideStatus"

).innerHTML=

"Started";



};









// =====================================
// COMPLETE RIDE
// =====================================



document.getElementById(

"completeRide"

).onclick=async()=>{



document.getElementById(

"rideStatus"

).innerHTML=

"Completed";



};








initMap();
