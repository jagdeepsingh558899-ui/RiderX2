// =====================================
// RiderX Live GPS Map System
// Leaflet + GPS
// =====================================



import {

db,
auth

}

from "../firebase/config.js";



import {

doc,
setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";








let map;

let marker;







// =====================================
// INIT MAP
// =====================================



function initMap(){



map = L.map("map").setView(

[30.7333,76.7794],

13

);






L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{


maxZoom:19


}

).addTo(map);







getLocation();



}









// =====================================
// GET GPS LOCATION
// =====================================



function getLocation(){



if(!navigator.geolocation){



alert(

"GPS not supported"

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



marker =

L.marker(

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







saveLocation(

lat,

lng

);





},





(error)=>{



console.log(error);



},



{


enableHighAccuracy:true,


maximumAge:1000,


timeout:10000


}



);



}









// =====================================
// SAVE LIVE LOCATION
// =====================================



async function saveLocation(lat,lng){



const user = auth.currentUser;



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


updatedAt:

new Date()



},


{


merge:true


}


);



}








window.initMap = initMap;
