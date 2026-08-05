import { db } from "../firebase/config.js";


import {

doc,
updateDoc,
onSnapshot

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



let rideId =

localStorage.getItem("rideId");




// Rider Location


window.startTripLocation=function(){


navigator.geolocation.watchPosition(

(position)=>{


localStorage.setItem(

"riderLat",

position.coords.latitude

);


localStorage.setItem(

"riderLng",

position.coords.longitude

);



document.getElementById("status").innerHTML=

"Location Sharing 🟢";


}

);


};







// Start Ride


window.startRide = async function(){


if(!rideId)return;



await updateDoc(

doc(db,"rides",rideId),

{

status:"started"

}

);


alert("Ride Started");


};







// Complete Ride


window.completeRide = async function(){


if(!rideId)return;



await updateDoc(

doc(db,"rides",rideId),

{

status:"completed"

}

);


alert("Trip Completed");


};








// Customer Status


let box =

document.getElementById("tripStatus");



if(box && rideId){


onSnapshot(

doc(db,"rides",rideId),

(snapshot)=>{


let data=snapshot.data();


box.innerHTML=

"Ride Status: "+data.status;



}

);


}







window.giveRating=function(){


let r = prompt(

"Give Rating 1-5"

);



if(r){


alert(

"Thanks For Rating ⭐"

);


}


};
