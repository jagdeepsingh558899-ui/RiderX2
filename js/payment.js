// =================================
// RiderX Payment System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
addDoc,
serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Create Payment Record

export async function createPayment(

customer,
amount,
method

){


try{


await addDoc(

collection(db,"payments"),

{


customer:customer,

amount:amount,

method:method,

status:"Paid",

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





// Payment Status


export function paymentSuccess(){


alert("Payment Successful ✅");


}
