// =================================
// RiderX Free Map System (Leaflet)
// =================================


// Initialize Map

export function initMap(){


let mapElement = document.getElementById("map");


if(!mapElement){

return;

}



let map = L.map("map").setView(

[26.9124,75.7873],

13

);





L.tileLayer(

"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

{

attribution:
"© OpenStreetMap"

}

).addTo(map);



return map;


}







// Add Marker

export function addMarker(

map,
lat,
lng,
title

){



let marker = L.marker(

[lat,lng]

).addTo(map);



if(title){


marker.bindPopup(title);


}



return marker;


}
