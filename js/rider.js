// =================================
// RiderX Rider System
// =================================


import { db } from "../firebase/config.js";


import {

doc,
updateDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Update Rider Online Status


export async function updateRiderStatus(

riderId,

status

){


try{


await updateDoc(

doc(

db,

"users",

riderId

),

{


status:status


}

);



return true;


}

catch(error){


console.log(error);


return false;


}


}





// Go Online


export function goOnline(){


let status =
document.getElementById("status");


if(status){


status.innerHTML="🟢 Online";


}


}





// Go Offline


export function goOffline(){


let status =
document.getElementById("status");


if(status){


status.innerHTML="⚫ Offline";


}


}
