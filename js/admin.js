// =====================================
// RiderX Admin Dashboard
// Compatible With Current Ride System
// =====================================


import { db, auth } from "../firebase/config.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

collection,
getDocs

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const totalCustomers =
document.getElementById("totalCustomers");


const totalRiders =
document.getElementById("totalRiders");


const activeBookings =
document.getElementById("activeBookings");


const totalEarnings =
document.getElementById("totalEarnings");





onAuthStateChanged(auth, async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



try{



// USERS

const usersSnap =
await getDocs(
collection(db,"users")
);



let customers=0;
let riders=0;



usersSnap.forEach((u)=>{


let data=u.data();



if(data.role==="customer"){

customers++;

}



if(data.role==="rider"){

riders++;

}



});



if(totalCustomers)

totalCustomers.innerHTML=customers;



if(totalRiders)

totalRiders.innerHTML=riders;








// RIDES


const ridesSnap =
await getDocs(
collection(db,"rides")
);



let active=0;

let earnings=0;



ridesSnap.forEach((ride)=>{


let data=ride.data();



if(

data.status==="Pending" ||

data.status==="Accepted" ||

data.status==="Started"

){

active++;

}



if(data.status==="Completed"){

earnings += Number(data.fare || 0);

}



});






if(activeBookings)

activeBookings.innerHTML=active;



if(totalEarnings)

totalEarnings.innerHTML="₹"+earnings;



}


catch(error){


console.log(
"Admin Dashboard Error:",
error
);


}



});
