import { db } from "../firebase/config.js";


import {

collection,
addDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



let latitude;

let longitude;


let rideType =
localStorage.getItem("rideType") || "Bike";



document.getElementById("rideType").innerHTML =
rideType + " Booking";



let fare = 0;





// Current Location


window.getLocation=function(){


if(navigator.geolocation){


navigator.geolocation.getCurrentPosition(

(position)=>{


latitude =
position.coords.latitude;


longitude =
position.coords.longitude;



document.getElementById("pickup").value =

"Lat: "+latitude+
" Lng: "+longitude;



}

);


}

else{


alert("Location not supported");


}


};







// Fare Calculate


window.calculateFare=function(){


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







// Book Ride


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

distance:

document.getElementById("distance").value,


fare:fare,


latitude:latitude,

longitude:longitude,


status:"requested",


createdAt:new Date()

}


);



document.getElementById("message").innerHTML =

"Ride Request Sent 🚀";


}


catch(error){


alert(error.message);


}


};
