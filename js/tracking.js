// =================================
// RiderX Ride Tracking System
// =================================


import { db } from "../firebase/config.js";


import {

doc,
setDoc,
getDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Update Rider Location

export async function updateRiderLocation(

riderId,
lat,
lng

){


try{


await setDoc(

doc(db,"locations",riderId),

{


latitude:lat,

longitude:lng,

updatedAt:new Date()


}

);



return true;


}

catch(error){


console.log(error);


return false;


}


}





// Get Rider Location


export async function getRiderLocation(

riderId

){


try{


const location = await getDoc(

doc(db,"locations",riderId)

);



if(location.exists()){


return location.data();


}


return null;


}

catch(error){


console.log(error);


return null;


}


}
