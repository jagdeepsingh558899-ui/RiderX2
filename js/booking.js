// =====================================
// RiderX Booking System
// Fare + Ride Request
// =====================================


import {

db,
auth

}

from "../firebase/config.js";



import {

collection,
addDoc,
serverTimestamp

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





let selectedService="bike";

let selectedPayment="cash";

let distance=5; // temporary default km





// =====================================
// SERVICE SELECT
// =====================================


const services =

document.querySelectorAll(".service");



services.forEach(service=>{


service.onclick=()=>{


services.forEach(item=>{

item.classList.remove("active");

});



service.classList.add("active");



selectedService =

service.dataset.type;



calculateFare();


};


});







// =====================================
// PAYMENT SELECT
// =====================================



const paymentButtons =

document.querySelectorAll(".payment button");



paymentButtons.forEach(btn=>{


btn.onclick=()=>{


paymentButtons.forEach(b=>{

b.classList.remove("active");

});


btn.classList.add("active");


selectedPayment =

btn.innerText.toLowerCase();



};


});








// =====================================
// FARE CALCULATION
// =====================================


function calculateFare(){


let hour =

new Date().getHours();



let pricePerKm;



if(hour>=22 || hour<6){


pricePerKm=11;


}

else if(distance>10){


pricePerKm=9;


}

else{


pricePerKm=8;


}



let fare =

distance * pricePerKm;




document.getElementById(
"fare"
).innerHTML =

"₹"+fare;



}



calculateFare();









// =====================================
// CREATE RIDE REQUEST
// =====================================



const bookBtn =

document.getElementById(
"bookRide"
);





if(bookBtn){



bookBtn.onclick=async()=>{



const pickup =

document.getElementById(
"pickup"
).value;



const drop =

document.getElementById(
"drop"
).value;




if(!pickup || !drop){


alert(
"Enter pickup and drop location"
);


return;

}




try{



const user = auth.currentUser;



if(!user){


alert(
"Please login first"
);


return;


}







await addDoc(

collection(
db,
"rides"
),


{


customerId:user.uid,


pickup:pickup,


drop:drop,


service:selectedService,


payment:selectedPayment,


distance:distance,


fare:document.getElementById(
"fare"
).innerText,


status:"searching",


createdAt:
serverTimestamp()



}



);





alert(

"Ride Requested Successfully"

);



window.location.href="history.html";



}



catch(error){


console.log(error);


alert(
error.message
);



}



};



}
