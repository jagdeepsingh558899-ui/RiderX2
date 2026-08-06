// =================================
// RiderX Booking System
// Ride Request + Fare Calculation
// =================================


import {

auth,
rtdb

} from "../firebase/Firebase-config.js";



import {

onAuthStateChanged

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

ref,
push,
set

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





let selectedType = "Bike Taxi";

let currentUser = null;





// User Check


onAuthStateChanged(

auth,

(user)=>{


if(user){

currentUser=user;


}


});







// Ride Type Select


document.querySelectorAll(".option")

.forEach(option=>{


option.addEventListener(

"click",

()=>{


document.querySelectorAll(".option")

.forEach(item=>{

item.classList.remove("active");

});



option.classList.add("active");



selectedType =

option.dataset.type;



}


);


});








// Distance Calculator

function calculateDistance(){



// Temporary distance

// Later GPS route API connect hoga


let distance =

Math.floor(

Math.random()*10

)+1;



return distance;



}






// Fare Calculator


function calculateFare(distance){



let hour =

new Date().getHours();



let pricePerKm;



if(hour >=22 || hour <6){


pricePerKm = 11;


}

else{


pricePerKm = 8;


if(distance > 10){


pricePerKm = 9;


}


}



return distance * pricePerKm;



}






// Book Ride



const bookBtn =

document.getElementById("bookRide");





if(bookBtn){



bookBtn.addEventListener(

"click",

async()=>{





const pickup =

document.getElementById("pickup").value;



const drop =

document.getElementById("drop").value;






if(!pickup || !drop){


document.getElementById("message").innerHTML =

"Please enter pickup and drop location";


return;


}







if(!currentUser){


document.getElementById("message").innerHTML =

"Please login first";


return;


}






let distance =

calculateDistance();



let fare =

calculateFare(distance);





document.getElementById("distance").innerHTML =

distance+" KM";




document.getElementById("fare").innerHTML =

"₹"+fare;







const rideData = {


customerId:

currentUser.uid,


service:

selectedType,


pickup:


pickup,


drop:

drop,


distance:

distance,


fare:

fare,


status:

"searching",



createdAt:

Date.now()



};








try{



const rideRef =

push(

ref(rtdb,"rides")

);



await set(

rideRef,

rideData

);






document.getElementById("message").innerHTML =

"Ride Request Sent 🚀";






}



catch(error){


document.getElementById("message").innerHTML =

error.message;


}



}


);


}
