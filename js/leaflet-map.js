// =================================
// RiderX Leaflet Map System
// =================================


let riderMap;



// Create Map

export function initMap(){


const mapElement =
document.getElementById("map");



if(!mapElement){

console.log("Map element not found");

return;

}



riderMap = L.map("map").setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

{

attribution:
"© OpenStreetMap"

}

).addTo(riderMap);



return riderMap;


}




// Add Marker


export function addMarker(

map,
lat,
lng,
title

){


const marker = L.marker(

[lat,lng]

)

.addTo(map);



if(title){

marker.bindPopup(title)
.openPopup();

}



return marker;


}




// Show Route


export function showRoute(

map,
pickup,
drop

){


const line = L.polyline(

[

pickup,
drop

],

{

color:"#00eaff"

}

)

.addTo(map);



map.fitBounds(
line.getBounds()
);



return line;


}
