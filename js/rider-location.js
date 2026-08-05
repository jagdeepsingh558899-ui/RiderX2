// =================================
// RiderX Rider Live Location
// =================================


import { db } from "../firebase/config.js";


import {

doc,
setDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Start Rider Location Tracking


export function startLocationTracking(riderId){


if(!navigator.geolocation){


console.log("Location not supported");

return;


}



navigator.geolocation.watchPosition(

async(position)=>{


let latitude =
position.coords.latitude;


let longitude =
position.coords.longitude;



await setDoc(

doc(

db,

"locations",

riderId

),

{


latitude:latitude,

longitude:longitude,

online:true,

updatedAt:new Date()


}

);



},

(error)=>{


console.log(error);


},

{

enableHighAccuracy:true,

maximumAge:10000,

timeout:5000


}


);



}
