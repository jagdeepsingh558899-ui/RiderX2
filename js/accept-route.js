// =================================
// RiderX Accept Ride Route Handler
// =================================


import { showRoute } from "./route.js";


export function openRideRoute(

map,

pickupLat,

pickupLng,

dropLat,

dropLng

){


let distance = showRoute(

map,

[

pickupLat,

pickupLng

],

[

dropLat,

dropLng

]

);


return distance;


}
