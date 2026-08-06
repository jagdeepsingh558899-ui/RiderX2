// =================================
// RiderX Ride Complete System
// =================================


import { db } from "../firebase/config.js";


import {

doc,
updateDoc,
serverTimestamp,
getDoc

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Complete Ride

export async function completeRide(rideId){


try{


const rideRef = doc(db,"rides",rideId);



const snap = await getDoc(rideRef);



if(!snap.exists()){

return false;

}



const data = snap.data();




await updateDoc(

rideRef,

{


status:"Completed",


paymentStatus:"Pending",


completedAt:serverTimestamp(),


earning:data.fare || 0


}

);





// Rider offline

if(data.riderId){


await updateDoc(

doc(db,"riderLocations",data.riderId),

{


status:"Offline",

updatedAt:serverTimestamp()


}

);


}





return true;



}

catch(error){


console.log(

"Complete Ride Error:",

error

);


return false;


}


}
