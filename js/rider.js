// ==========================================
// RiderX Rider Engine V3
// Online + GPS + Ride Accept + Status Flow
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
query,
where,
onSnapshot,
doc,
setDoc,
updateDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";




// ELEMENTS


const onlineBtn =
document.getElementById("onlineBtn");


const riderStatus =
document.getElementById("riderStatus");


const rideRequest =
document.getElementById("rideRequest");


const noRide =
document.getElementById("noRide");


const requestPickup =
document.getElementById("requestPickup");


const requestDrop =
document.getElementById("requestDrop");


const requestFare =
document.getElementById("requestFare");


const acceptBtn =
document.getElementById("acceptBtn");


const rejectBtn =
document.getElementById("rejectBtn");



const activeRide =
document.getElementById("activeRide");


const rideStatus =
document.getElementById("rideStatus");


const activeFare =
document.getElementById("activeFare");


const arrivedBtn =
document.getElementById("arrivedBtn");


const startRideBtn =
document.getElementById("startRideBtn");


const completeRideBtn =
document.getElementById("completeRideBtn");


const callCustomer =
document.getElementById("callCustomer");


const chatCustomer =
document.getElementById("chatCustomer");





let currentUser=null;

let online=false;

let currentRide=null;

let watchId=null;






// AUTH


onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



currentUser=user;


listenRides();


});








// ONLINE BUTTON


onlineBtn.onclick=()=>{


if(online){

goOffline();

}

else{

goOnline();

}


};







// ONLINE


async function goOnline(){


online=true;


onlineBtn.innerHTML="Go Offline";


riderStatus.innerHTML="You are Online 🟢";



startGPS();



await updateRiderStatus(true);


}








// OFFLINE


async function goOffline(){


online=false;


onlineBtn.innerHTML="Go Online";


riderStatus.innerHTML="You are Offline";


if(watchId)

navigator.geolocation.clearWatch(watchId);



await updateRiderStatus(false);


}








// SAVE RIDER STATUS


async function updateRiderStatus(status){



await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{

online:status,

status:
status?"available":"offline",

updatedAt:
serverTimestamp()


},

{
merge:true
}

);


}








// GPS


function startGPS(){



watchId=

navigator.geolocation.watchPosition(

async(position)=>{


let location={


lat:
position.coords.latitude,


lng:
position.coords.longitude


};




await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{

location,

updatedAt:
serverTimestamp()

},

{
merge:true
}

);



},


(error)=>{


console.log(error);


},


{


enableHighAccuracy:true,

maximumAge:0


}


);



}








// LISTEN SEARCHING RIDES


function listenRides(){



const q=query(

collection(db,"rides"),

where(
"status",
"==",
"searching"
)

);




onSnapshot(q,(snapshot)=>{


snapshot.forEach((item)=>{


let ride=item.data();



currentRide={

id:item.id,

...ride

};



showRequest(ride);



});



});


}








// SHOW REQUEST


function showRequest(ride){



rideRequest.style.display="block";

noRide.style.display="none";



requestPickup.innerHTML=
ride.pickup;


requestDrop.innerHTML=
ride.drop;


requestFare.innerHTML=
"₹"+ride.fare;



}








// ACCEPT


acceptBtn.onclick=async()=>{


if(!currentRide)
return;




await updateDoc(

doc(
db,
"rides",
currentRide.id
),

{


status:"accepted",

riderId:
currentUser.uid,


acceptedAt:
serverTimestamp()


}

);



showActiveRide();



};







function showActiveRide(){


activeRide.style.display="block";


rideRequest.style.display="none";



rideStatus.innerHTML="Accepted";


activeFare.innerHTML=

"₹"+currentRide.fare;



}







// REJECT


rejectBtn.onclick=()=>{


rideRequest.style.display="none";


currentRide=null;


};








// ARRIVED


arrivedBtn.onclick=async()=>{


if(!currentRide)
return;



await updateDoc(

doc(
db,
"rides",
currentRide.id
),

{

status:"arriving",

}

);



rideStatus.innerHTML="Arrived Pickup";


};









// START RIDE


startRideBtn.onclick=async()=>{


await updateDoc(

doc(
db,
"rides",
currentRide.id
),

{

status:"started",

startedAt:
serverTimestamp()


}

);



rideStatus.innerHTML="Ride Started";


};









// COMPLETE


completeRideBtn.onclick=async()=>{


await updateDoc(

doc(
db,
"rides",
currentRide.id
),

{

status:"completed",

completedAt:
serverTimestamp()


}

);



rideStatus.innerHTML="Completed";


};








// CALL


callCustomer.onclick=()=>{


alert(
"Call system connect hoga"
);


};







// CHAT


chatCustomer.onclick=()=>{


location.href="chat.html";


};






console.log(
"RiderX Rider Engine V3 Loaded"
);
