// =================================
// RiderX Rider Matching System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs,
query,
where

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Find Available Riders

export async function findAvailableRider(){


try{


const q = query(

collection(db,"riders"),

where("status","==","online")

);



const snapshot = await getDocs(q);



if(snapshot.empty){


return null;


}



let rider = null;



snapshot.forEach((doc)=>{


if(!rider){


rider={

id:doc.id,

...doc.data()

};


}


});



return rider;



}

catch(error){


console.log(error);


return null;


}


}
