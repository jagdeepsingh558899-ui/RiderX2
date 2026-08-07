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


// ===============================
// Global State
// ===============================

let selectedService = "bike";
let currentUser = null;


// ===============================
// Firebase Auth Check
// ===============================

onAuthStateChanged(auth, (user) => {

    if(user){

        currentUser = user;

        console.log(
            "Customer Login:",
            user.email
        );

    }

});



// ===============================
// Service Selection
// ===============================

const services = document.querySelectorAll(".service");


services.forEach(service => {


    service.addEventListener("click",()=>{


        services.forEach(item=>{
            item.classList.remove("active");
        });


        service.classList.add("active");


        selectedService =
        service.dataset.service;


        calculateFare();


    });


});




// ===============================
// Fare Calculation
// ===============================

function calculateFare(){


    let distance = 5;


    let fare = 0;



    switch(selectedService){


        case "bike":
            fare = distance * 8;
            break;


        case "cab":
            fare = distance * 14;
            break;


        case "parcel":
            fare = distance * 10;
            break;


        case "food":
            fare = distance * 40;
            break;


    }



    const fareBox =
    document.getElementById("fare");


    if(fareBox){

        fareBox.innerText =
        "₹" + fare;

    }


}



calculateFare();




// ===============================
// Book Ride
// ===============================


const bookBtn =
document.getElementById("bookRide");



if(bookBtn){


bookBtn.addEventListener(
"click",
async()=>{


const pickup =
document.getElementById("pickup").value.trim();


const drop =
document.getElementById("drop").value.trim();



if(!pickup || !drop){

alert(
"Pickup and Drop location required"
);

return;

}



try{


const fare =
Number(
document
.getElementById("fare")
.innerText
.replace("₹","")
);



const rideData = {


customerId:
currentUser ?
currentUser.uid :
"guest",


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


fare:fare,


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


console.error(
"Ride Error:",
error
);


alert(
"Ride booking failed"
);



}



});


}





// ===============================
// Ride Modal
// ===============================


function openRideModal(){


const modal =
document.getElementById("rideModal");


if(modal){

modal.style.display="flex";

}



}



const cancelBtn =
document.getElementById("cancelRide");



if(cancelBtn){


cancelBtn.addEventListener(
"click",
()=>{


const modal =
document.getElementById("rideModal");


if(modal){

modal.style.display="none";

}


});


}




// ===============================
// Navigation
// ===============================


window.openHistory = function(){

window.location.href =
"history.html";

}



window.openWallet = function(){

window.location.href =
"wallet.html";

}



window.openProfile = function(){

window.location.href =
"profile.html";

}




// ===============================
// Bottom Menu
// ===============================


const bottom =
document.querySelectorAll(".bottom div");



if(bottom.length >= 4){


bottom[0].onclick =
()=>{

window.location.href =
"home.html";

};



bottom[1].onclick =
()=>{

openHistory();

};



bottom[2].onclick =
()=>{

openWallet();

};



bottom[3].onclick =
()=>{

openProfile();

};



}




console.log(
"RiderX Customer JS Loaded Successfully"
);
