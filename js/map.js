// =================================
// RiderX Map Location System
// =================================


let map;

let pickupMarker;

let dropMarker;




// Initialize Map

export function createMap(){


if(!document.getElementById("map")){

return;

}



map = L.map("map").setView(

[26.9124,75.7873],

13

);



L.tileLayer(

"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

{

attribution:"© OpenStreetMap"

}

).addTo(map);



return map;


}





// Add Pickup Location


export function setPickup(

lat,
lng

){


if(pickupMarker){

map.removeLayer(pickupMarker);

}



pickupMarker = L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup("Pickup Location")

.openPopup();


}





// Add Drop Location


export function setDrop(

lat,
lng

){


if(dropMarker){

map.removeLayer(dropMarker);

}



dropMarker = L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup("Drop Location")

.openPopup();


}





// Get Current Location


export function getCurrentLocation(){


return new Promise((resolve)=>{


if(navigator.geolocation){


navigator.geolocation.getCurrentPosition(

(position)=>{


resolve({

lat:position.coords.latitude,

lng:position.coords.longitude

});


}


);


}

else{


resolve(null);


}


});


}
