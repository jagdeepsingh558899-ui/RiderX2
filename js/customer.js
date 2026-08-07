/*
=================================================
 RiderX Customer Controller
 js/customer.js
=================================================
*/

import { auth, db } from "../firebase/firebase-config.js";

import {
 onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
 collection,
 addDoc,
 Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// State
let selectedService = "bike";
let currentUser = null;


// Firebase User Check
onAuthStateChanged(auth,(user)=>{

    if(user){

        currentUser = user;

        console.log(
        "Customer Login:",
        user.email
        );

    }

});


// Service Selection

document.querySelectorAll(".service")
.forEach(service=>{


service.addEventListener("click",()=>{


document.querySelectorAll(".service")
.forEach(s=>s.classList.remove("active"));


service.classList.add("active");


selectedService =
service.dataset.service;


calculateFare();


});


});



// Fare Calculation

function calculateFare(){


let distance = 5; // temporary


let fare = 0;


if(selectedService==="bike"){

fare = distance * 8;

}


if(selectedService==="cab"){

fare = distance * 14;

}


if(selectedService==="parcel"){

fare = distance * 10;

}


if(selectedService==="food"){

fare = distance * 40;

}


document.getElementById("fare")
.innerText =
"₹"+fare;



}



calculateFare();



// Book Ride


document
.getElementById("bookRide")
.addEventListener("click",async()=>{


let pickup =
document.getElementById("pickup").value;


let drop =
document.getElementById("drop").value;



if(!pickup || !drop){

alert(
"Pickup and Drop location required"
);

return;

}



try{


let rideData={


customerId:
currentUser ? currentUser.uid : "guest",


serviceType:
selectedService,


pickup:{
address:pickup
},


drop:{
address:drop
},


payment:
document.getElementById("payment").value,


fare:
Number(
document.getElementById("fare")
.innerText.replace("₹","")
),


status:
"requested",


createdAt:
Timestamp.now()



};



await addDoc(
collection(db,"rides"),
rideData
);



openRideModal();



alert(
"Ride Requested Successfully"
);



}
catch(error){


console.error(error);


alert(
"Ride booking failed"
);



}


});





// Ride Modal


function openRideModal(){


let modal =
document.getElementById("rideModal");


if(modal){

modal.style.display="flex";

}


}



document
.getElementById("cancelRide")
.addEventListener("click",()=>{


document
.getElementById("rideModal")
.style.display="none";


});




// Bottom Navigation


window.openHistory=function(){

window.location.href="history.html";

}


window.openWallet=function(){

window.location.href="wallet.html";

}


window.openProfile=function(){

window.location.href="profile.html";

}


// Bottom buttons auto attach

let bottom =
document.querySelectorAll(".bottom div");


if(bottom.length>=4){


bottom[0].onclick=
()=>window.location.href="home.html";


bottom[1].onclick=
()=>openHistory();


bottom[2].onclick=
()=>openWallet();


bottom[3].onclick=
()=>openProfile();


}



console.log(
"RiderX Customer JS Loaded"
);
