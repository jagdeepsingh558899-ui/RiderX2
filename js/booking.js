import { db } from "../firebase/config.js";


import {

collection,
addDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



let rideType =
localStorage.getItem("rideType");


document.getElementById("rideTitle").innerHTML =
rideType + " Booking";



let fare = 0;



window.calculateFare = function(){


let km =
Number(
document.getElementById("distance").value
);



if(rideType=="Bike"){

fare = km * 12;

}


else if(rideType=="Cab"){

fare = km * 20;

}


else{

fare = km * 15;

}



document.getElementById("fare").innerHTML =
"Fare: ₹"+fare;



};





window.bookRide = async function(){



let pickup =
document.getElementById("pickup").value;


let drop =
document.getElementById("drop").value;



try{


await addDoc(

collection(db,"rides"),

{

type:rideType,

pickup:pickup,

drop:drop,

fare:fare,

status:"requested",

createdAt:new Date()

}

);



document.getElementById("msg").innerHTML =
"Ride Request Sent 🚀";


}


catch(error){


alert(error.message);


}


};
