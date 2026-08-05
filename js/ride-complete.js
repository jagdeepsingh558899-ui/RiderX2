// =================================
// RiderX Ride Complete System
// =================================


import { db } from "../firebase/config.js";


import {

doc,
updateDoc,
serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Complete Ride


export async function completeRide(rideId){


try{


await updateDoc(

doc(db,"rides",rideId),

{


status:"Completed",

completedAt:serverTimestamp()


}

);



return true;


}

catch(error){


console.log(error);


return false;


}


}
