// =================================
// RiderX Route System
// =================================


let route;



export async function showRoute(

map,

pickup,

drop

){


if(route){

map.removeLayer(route);

}



route = L.polyline(

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

route.getBounds()

);



return calculateDistance(

pickup[0],

pickup[1],

drop[0],

drop[1]

);



}





function calculateDistance(

lat1,

lon1,

lat2,

lon2

){


let R = 6371;



let dLat =

(lat2-lat1)*Math.PI/180;



let dLon =

(lon2-lon1)*Math.PI/180;



let a =

Math.sin(dLat/2)**2 +

Math.cos(lat1*Math.PI/180)

*

Math.cos(lat2*Math.PI/180)

*

Math.sin(dLon/2)**2;



let c =

2*Math.atan2(

Math.sqrt(a),

Math.sqrt(1-a)

);



return (R*c).toFixed(2);


}
