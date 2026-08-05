// =================================
// RiderX Rider Dashboard
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs,
query,
where

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Load Rider Stats

export async function loadRiderStats(){


let rideCount = document.getElementById("rides");


if(!rideCount) return;



try{


const q = query(

collection(db,"rides"),

where("status","==","Completed")

);



const snapshot = await getDocs(q);



rideCount.innerHTML = snapshot.size;



}


catch(error){

console.log(error);

rideCount.innerHTML = "0";

}


}






// Rider Online Status


export function setRiderStatus(status){


let statusBox =
document.getElementById("status");



if(!statusBox) return;



if(status=="online"){


statusBox.innerHTML="🟢 Online";


}

else{


statusBox.innerHTML="⚫ Offline";


}


}
