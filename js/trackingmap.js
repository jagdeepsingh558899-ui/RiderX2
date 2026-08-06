// =================================
// RiderX Tracking Map
// Live Rider + Customer Location
// =================================


import {

rtdb

} from "../firebase/Firebase-config.js";


import {

ref,
onValue

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





let map;


let riderMarker;

let customerMarker;





// Start Map


function startTrackingMap(){



if(!document.getElementById("map"))

return;





map = L.map("map").setView(

[30.7333,76.7794],

13

);





L.tileLayer(

"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

).addTo(map);





}





// Rider Location


function trackRider(riderId){



const locationRef =

ref(

rtdb,

"riders/"+riderId

);





onValue(

locationRef,

(snapshot)=>{


const data = snapshot.val();



if(!data)

return;




updateRiderMarker(

data.lat,

data.lng

);



}

);



}







// Customer Location


function trackCustomer(customerId){



const locationRef =

ref(

rtdb,

"customers/"+customerId

);





onValue(

locationRef,

(snapshot)=>{


const data = snapshot.val();



if(!data)

return;



updateCustomerMarker(

data.lat,

data.lng

);



}

);



}







// Rider Marker


function updateRiderMarker(

lat,

lng

){



if(!riderMarker){



riderMarker = L.marker(

[lat,lng],

{

icon:

L.icon({

iconUrl:

"../assets/logo.png",

iconSize:[45,45]

})

}

)

.addTo(map)

.bindPopup(

"🏍 Rider"

);



}

else{


riderMarker.setLatLng(

[lat,lng]

);


}




}








// Customer Marker


function updateCustomerMarker(

lat,

lng

){



if(!customerMarker){



customerMarker = L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"📍 Customer"

);



}

else{


customerMarker.setLatLng(

[lat,lng]

);


}




}







window.RiderXTracking = {


start:startTrackingMap,


rider:trackRider,


customer:trackCustomer



};
