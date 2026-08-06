// =================================
// RiderX Advanced Navigation Map V3
// Leaflet + OSRM Routing
// =================================


let map;

let markers = {};

let routeLine;



// CREATE MAP

export function createMap(){


if(!document.getElementById("map"))
return;



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





// CLEAR MAP


export function clearMap(){


Object.values(markers).forEach(marker=>{


if(marker)

map.removeLayer(marker);


});


markers={};



if(routeLine){


map.removeLayer(routeLine);


routeLine=null;


}


}







// SHOW PICKUP DROP


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



drawRoute(

[

pickup,

drop

]

);



}







// RIDER LIVE MARKER


export function showRiderLocation(

lat,

lng

){



if(!map)
return;



let position=[lat,lng];



if(markers.rider){


markers.rider.setLatLng(position);


}

else{


markers.rider = L.marker(

position,

{

icon:L.icon({

iconUrl:
"https://cdn-icons-png.flaticon.com/512/3448/3448339.png",

iconSize:[45,45]

})

}

)

.addTo(map)

.bindPopup(
"🏍 Rider"
);


}



map.panTo(position);



}








// CUSTOMER MARKER


export function showCustomerLocation(

lat,

lng

){



if(markers.customer){


markers.customer.setLatLng(

[lat,lng]

);


}

else{


markers.customer=L.marker(

[lat,lng]

)

.addTo(map)

.bindPopup(
"👤 Customer"
);


}



}









// ROUTE DRAW


export function drawRoute(points){



if(!map)
return;



if(routeLine){

map.removeLayer(routeLine);

}



routeLine=L.polyline(

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







// FREE NAVIGATION ROUTE

export async function getRoute(

start,

end

){



let url =

`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;




try{


let res = await fetch(url);


let data = await res.json();



if(data.routes.length){


let coords =

data.routes[0]

.geometry.coordinates.map(

c=>[

c[1],

c[0]

]

);



drawRoute(coords);



return data.routes[0];



}



}

catch(e){


console.log(
"Route error",
e
);


}



}






console.log(
"RiderX Navigation Map V3 Loaded"
);
