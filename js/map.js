// =================================
// RiderX Advanced Map System
// =================================



let map;

let markers=[];

let routeLine;




// Create Map

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





// Clear Old Markers


function clearMarkers(){


markers.forEach((m)=>{


map.removeLayer(m);


});


markers=[];


if(routeLine){

map.removeLayer(routeLine);

}


}






// Show Ride On Map


export function showRide(

pickup,

drop,

fare,

distance

){



clearMarkers();




let pickupMarker = L.marker(

pickup

)

.addTo(map)

.bindPopup(

"📍 Pickup<br>💰 ₹"+fare

);




let dropMarker = L.marker(

drop

)

.addTo(map)

.bindPopup(

"🏁 Drop<br>📏 "+distance+" km"

);





markers.push(

pickupMarker,

dropMarker

);





routeLine = L.polyline(

[

pickup,

drop

]

)

.addTo(map);



map.fitBounds(

routeLine.getBounds()

);



}






// Rider Current Location


export function showRiderLocation(

lat,

lng

){



let rider = L.marker(

[lat,lng],

{

icon:L.icon({

iconUrl:
"https://cdn-icons-png.flaticon.com/512/3448/3448339.png",

iconSize:[40,40]

})

}

)

.addTo(map);



rider.bindPopup(

"🏍 Rider"

);



}
