// =================================
// RiderX Map System
// Leaflet + OpenStreetMap
// =================================



let map;

let userMarker;

let userLocation = {

lat:30.7333,

lng:76.7794

};





// Initialize Map


function initMap(){



map = L.map("map").setView(

[userLocation.lat,userLocation.lng],

13

);





// OpenStreetMap Layer


L.tileLayer(

"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19,

}

).addTo(map);





// Default Marker


userMarker = L.marker(

[userLocation.lat,userLocation.lng]

)

.addTo(map)

.bindPopup(

"RiderX Pickup Location"

)

.openPopup();







// Get Current Location


if(navigator.geolocation){



navigator.geolocation.getCurrentPosition(



(position)=>{



userLocation.lat =

position.coords.latitude;



userLocation.lng =

position.coords.longitude;





updateMarker();





const pickup =
document.getElementById("pickup");



if(pickup){

pickup.value =

`${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;

}





},



(error)=>{


console.log(

"Location permission denied",

error

);


}



);



}



}





// Update Marker


function updateMarker(){



if(userMarker){



userMarker.setLatLng(

[

userLocation.lat,

userLocation.lng

]

);



map.setView(

[

userLocation.lat,

userLocation.lng

],

15

);



}



}







// Expose Location


window.RiderXLocation = userLocation;





// Start Map


document.addEventListener(

"DOMContentLoaded",

()=>{


if(document.getElementById("map")){


initMap();


}



});
