// =================================
// RiderX Booking System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
addDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Calculate Fare

export function calculateFare(service){


let fare = 0;


switch(service){


case "Bike Taxi":

fare = 50;

break;


case "Cab":

fare = 150;

break;


case "Parcel":

fare = 80;

break;


case "Food":

fare = 100;

break;


default:

fare = 50;


}


return fare;


}





// Create Ride Request


export async function createRide(

pickup,
drop,
service

){


try{


let fare = calculateFare(service);



await addDoc(

collection(db,"rides"),

{

pickup:pickup,

drop:drop,

service:service,

fare:fare,

status:"Pending",

createdAt:new Date()

}

);



return true;


}

catch(error){


console.log(error);

return false;


}


}
