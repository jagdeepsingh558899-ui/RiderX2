// =================================
// RiderX Wallet System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs,
query,
where

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Get Rider Earnings


export async function getWalletBalance(){


try{


const q = query(

collection(db,"rides"),

where("status","==","Completed")

);



const snapshot = await getDocs(q);



let total = 0;



snapshot.forEach((ride)=>{


let data = ride.data();



total += Number(data.fare || 0);



});



return total;


}

catch(error){


console.log(error);


return 0;


}


}
