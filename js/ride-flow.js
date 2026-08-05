// =================================
// RiderX Ride Flow System
// =================================


import { db } from "../firebase/config.js";


import {

doc,
updateDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Assign Rider To Ride

export async function assignRider(

rideId,
riderId

){


try{


await updateDoc(

doc(db,"rides",rideId),

{


riderId:riderId,

status:"Accepted"


}

);



return true;


}

catch(error){


console.log(error);


return false;


}


}






// Complete Ride


export async function completeRide(

rideId

){


try{


await updateDoc(

doc(db,"rides",rideId),

{


status:"Completed"


}

);



return true;


}

catch(error){


console.log(error);


return false;


}


}
