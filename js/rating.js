// =================================
// RiderX Rating System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
addDoc,
serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Add Rating


export async function addRating(

rideId,

userId,

rating,

comment

){


try{


await addDoc(

collection(db,"ratings"),

{


rideId:rideId,

userId:userId,

rating:rating,

comment:comment,

createdAt:serverTimestamp()


}

);



return true;


}

catch(error){


console.log(error);


return false;


}


}
