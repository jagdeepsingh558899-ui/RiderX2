// =================================
// RiderX Advanced Live Map System V2
// Live Rider + Customer + Route
// =================================


let map;

let markers = {};

let routeLine = null;


// ===============================
// CREATE MAP
// ===============================

export function createMap(){


if(!document.getElementById("map")){

return null;

}



map = L.map("map")

.setView(

[30.7333,76.7794],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19,

attribution:"© OpenStreetMap"

}

)

.addTo(map);



return map;


}





// ===============================
// REMOVE OBJECTS
// ===============================


export function clearMap(){


Object.values(markers).forEach(marker=>{


if(marker){

map.removeLayer(marker);

}


});


markers={};



if(routeLine){


map.removeLayer(routeLine);


routeLine=null;


}



}







// ===============================
// SHOW PICKUP DROP
// ===============================


export function showRide(

pickup,

drop,

fare,

distance

){



if(!map)
return;



clearMap();



markers.pickup = L.marker(

pickup

)

.addTo(map)

.bindPopup(

"📍 Pickup<br>₹"+fare

);





markers.drop = L.marker(

drop

)

.addTo(map)

.bindPopup(

"🏁 Drop<br>"+distance+" KM"

);





routeLine = L.polyline(

[

pickup,

drop

],

{

weight:5

}

)

.addTo(map);




map.fitBounds(

routeLine.getBounds()

);



}







// ===============================
// CUSTOMER LOCATION
// ===============================


export function showCustomerLocation(

lat,

lng

){



if(!map)
return;




if(markers.customer){


markers.customer.setLatLng(

[lat,lng]

);


}

else{


markers.customer = L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(

"👤 Customer"

);


}



}







// ===============================
// LIVE RIDER LOCATION
// ===============================


export function showRiderLocation(

lat,

lng

){



if(!map)
return;



if(markers.rider){


markers.rider.setLatLng(

[lat,lng]

);


}

else{


markers.rider = L.marker(

[lat,lng],

{


icon:L.icon({


iconUrl:

"https://cdn-icons-png.flaticon.com/512/3448/3448339.png",


iconSize:

[45,45]



})


}

)

.addTo(map)

.bindPopup(

"🏍 Rider"

);


}



map.panTo(

[lat,lng]

);



}







// ===============================
// DRAW LIVE ROUTE
// ===============================


export function drawRoute(

points

){



if(!map)
return;



if(routeLine){


map.removeLayer(routeLine);


}




routeLine = L.polyline(

points,

{

weight:5

}

)

.addTo(map);



map.fitBounds(

routeLine.getBounds()

);



}






console.log(
"RiderX Live Map System Loaded"
);
