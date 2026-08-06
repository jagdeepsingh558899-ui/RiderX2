// ==========================================
// RiderX Rider Engine V4
// GPS + Ride Accept + OTP + Status + Chat
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
serverTimestamp,
getDoc

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



const otpCard =
document.getElementById("otpCard");


const otpInput =
document.getElementById("otpInput");


const verifyOtpBtn =
document.getElementById("verifyOtpBtn");


const otpStatus =
document.getElementById("otpStatus");



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


const navigationBtn =
document.getElementById("navigationBtn");





let currentUser=null;

let online=false;

let currentRide=null;

let watchId=null;

let otpVerified=false;








// AUTH


onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}


currentUser=user;


listenRides();


});








// ONLINE


onlineBtn.onclick=()=>{


if(online){

goOffline();

}

else{

goOnline();

}

};







async function goOnline(){


online=true;


onlineBtn.innerHTML="Go Offline";


riderStatus.innerHTML="Online 🟢";


startGPS();


await saveStatus(true);


}








async function goOffline(){


online=false;


onlineBtn.innerHTML="Go Online";


riderStatus.innerHTML="Offline 🔴";



if(watchId){

navigator.geolocation.clearWatch(watchId);

}



await saveStatus(false);


}








async function saveStatus(status){



await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{

online:status,

status:

status ? "available":"offline",

updatedAt:
serverTimestamp()


},

{
merge:true
}

);


}









// LIVE GPS


function startGPS(){



watchId =

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

enableHighAccuracy:true

}



);



}









// FIND RIDES


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



showRequest();


});



});



}









function showRequest(){



rideRequest.style.display="block";

noRide.style.display="none";



requestPickup.innerHTML=

currentRide.pickup;



requestDrop.innerHTML=

currentRide.drop;



requestFare.innerHTML=

"₹"+currentRide.fare;



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



rideRequest.style.display="none";


activeRide.style.display="block";


otpCard.style.display="block";



rideStatus.innerHTML="Accepted";


activeFare.innerHTML=

"₹"+currentRide.fare;



};









// OTP VERIFY


verifyOtpBtn.onclick=async()=>{


if(!currentRide)

return;



let otp=

otpInput.value;




if(

otp === currentRide.otp

){



otpVerified=true;


otpStatus.innerHTML=

"OTP Verified ✅";



await updateDoc(

doc(

db,

"rides",

currentRide.id

),

{


otpVerified:true


}

);



}

else{


otpStatus.innerHTML=

"Wrong OTP ❌";


}



};









// ARRIVED


arrivedBtn.onclick=async()=>{


await updateDoc(

doc(

db,

"rides",

currentRide.id

),

{


status:"arriving"


}

);



rideStatus.innerHTML=

"Arrived Pickup";


};









// START RIDE


startRideBtn.onclick=async()=>{


if(!otpVerified){


alert("First verify OTP");


return;


}



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



rideStatus.innerHTML=

"Ride Started 🏍";


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



rideStatus.innerHTML=

"Completed ✅";


};









// CALL


callCustomer.onclick=()=>{


alert(

"Call Customer system will connect"

);


};








// CHAT


chatCustomer.onclick=()=>{


localStorage.setItem(

"rideId",

currentRide.id

);


location.href="chat.html";


};








// NAVIGATION


navigationBtn.onclick=()=>{


if(currentRide){


let url =

"https://www.google.com/maps/dir/?api=1&destination="

+

currentRide.pickupCoords.lat

+

","

+

currentRide.pickupCoords.lng;



window.open(url,"_blank");


}



};







console.log(

"RiderX Rider Engine V4 Loaded"

);
