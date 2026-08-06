// =====================================
// RiderX Route Navigation System
// Pickup -> Drop Route
// OpenStreetMap Routing
// =====================================


let routeLine = null;



// Draw Route Between Two Points

export async function drawRoute(

map,

start,

end

){



try{


const url =

`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;





const response =

await fetch(url);





const data =

await response.json();





if(!data.routes || !data.routes.length)

return;





const coordinates =

data.routes[0].geometry.coordinates.map(

(point)=>[

point[1],

point[0]

]

);







if(routeLine){


map.removeLayer(routeLine);


}





routeLine = L.polyline(

coordinates,

{

weight:5

}

)

.addTo(map);







map.fitBounds(

routeLine.getBounds()

);






return {


distance:

(data.routes[0].distance/1000).toFixed(2),


time:

Math.ceil(

data.routes[0].duration/60

)


};



}

catch(error){


console.log(

"Route Error",

error

);


return null;


}



}








// Remove Old Route


export function clearRoute(map){



if(routeLine){


map.removeLayer(routeLine);


routeLine=null;


}


}
