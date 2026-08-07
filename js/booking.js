// =====================================
// RiderX Super App
// Booking & Ride Dispatch Controller
// Firebase v10
// Admin Fare Connected
// =====================================


import {

auth,
db

}
from "../firebase/firebase-config.js";



import {

collection,
addDoc,
doc,
getDoc,
updateDoc,
onSnapshot,
Timestamp

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";






// ===============================
// GLOBAL STATE
// ===============================


window.RiderXBookingState = {


activeService:"bike",


pickupLocation:null,


dropLocation:null,


estimatedFare:0,


estimatedDistance:0,


estimatedDuration:0,


currentRideId:null,


rideListener:null,


fareSettings:null


};








// ===============================
// INIT
// ===============================


export async function initBookingModule(){


console.log(
"RiderX Booking Started"
);



await loadFareSettings();



setupServiceSelectors();



}







// ===============================
// LOAD ADMIN FARE
// ===============================


async function loadFareSettings(){


try{


const snap =
await getDoc(

doc(
db,
"settings",
"fare"

)

);



if(snap.exists()){


window.RiderXBookingState.fareSettings =
snap.data();



}

else{


console.log(
"No Fare Settings Found"
);


}



}

catch(error){


console.log(
"Fare Load Error:",
error
);


}



}








// ===============================
// SERVICE SELECT
// ===============================


function setupServiceSelectors(){


const buttons =
document.querySelectorAll(
".service-select-btn"
);



buttons.forEach((btn)=>{


btn.addEventListener(
"click",
()=>{


buttons.forEach(b=>{

b.classList.remove(
"active"
);

});



btn.classList.add(
"active"
);



window.RiderXBookingState.activeService =
btn.dataset.service || "bike";



calculateFareEstimate();



});



});



}








// ===============================
// LOCATION SET
// ===============================


export function setPickupLocation(
lat,
lng,
address
){


window.RiderXBookingState.pickupLocation={

lat,

lng,

address

};



calculateFareEstimate();


}






export function setDropLocation(
lat,
lng,
address
){


window.RiderXBookingState.dropLocation={

lat,

lng,

address

};



calculateFareEstimate();


}








// ===============================
// DISTANCE CALCULATION
// ===============================


function calculateDistance(
lat1,
lon1,
lat2,
lon2
){


const R=6371;


const dLat =
(lat2-lat1) *
Math.PI/180;


const dLon =
(lon2-lon1) *
Math.PI/180;



const a =

Math.sin(dLat/2) *
Math.sin(dLat/2)

+

Math.cos(lat1*Math.PI/180)

*

Math.cos(lat2*Math.PI/180)

*

Math.sin(dLon/2)

*

Math.sin(dLon/2);



const c =
2 *
Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);



return R*c;


}


// ===============================
// FARE CALCULATION
// ===============================


export function calculateFareEstimate(){


const state =
window.RiderXBookingState;



if(
!state.pickupLocation ||
!state.dropLocation
){

return;

}





const distance =
calculateDistance(

state.pickupLocation.lat,

state.pickupLocation.lng,

state.dropLocation.lat,

state.dropLocation.lng

);





state.estimatedDistance =
Number(
distance.toFixed(2)
);



state.estimatedDuration =
Math.round(
distance * 3
);







const settings =
state.fareSettings;



const serviceFare =

settings?.[state.activeService]



||
{

baseFare:30,

dayRate:8,

extraRate:9,

nightRate:11

};







const hour =
new Date().getHours();



let perKm =
serviceFare.dayRate;





// Night Fare

if(
hour >=22 ||
hour <6
){

perKm =
serviceFare.nightRate;

}






let fare =
Number(
serviceFare.baseFare || 0
);






// Extra 10 KM Rule

if(
state.estimatedDistance > 10
){



fare +=

10 *
perKm;



fare +=

(
state.estimatedDistance - 10
)

*

Number(
serviceFare.extraRate || perKm
);



}

else{


fare +=

state.estimatedDistance *

perKm;



}






state.estimatedFare =
Math.max(
Math.round(fare),
30
);





updateFareUI();



}








// ===============================
// UPDATE UI
// ===============================


function updateFareUI(){


const state =
window.RiderXBookingState;



const fare =
document.getElementById(
"estimated-fare-display"
);



if(fare){

fare.innerText =
"₹"+state.estimatedFare;

}




const distance =
document.getElementById(
"estimated-distance-display"
);



if(distance){

distance.innerText =
state.estimatedDistance+" KM";

}




const time =
document.getElementById(
"estimated-time-display"
);



if(time){

time.innerText =
state.estimatedDuration+" mins";

}



}








// ===============================
// CREATE RIDE
// ===============================


export async function createRideRequest(
paymentMethod="cash"
){



const state =
window.RiderXBookingState;



const user =
auth.currentUser;




if(!user){


alert(
"Login Required"
);


location.href="../auth/login.html";


return;


}





if(
!state.pickupLocation ||
!state.dropLocation
){


alert(
"Select pickup and drop"
);


return;


}







try{


const ride = {


customerId:user.uid,


customerName:

user.displayName ||
"RiderX Customer",



serviceType:

state.activeService,



pickup:

state.pickupLocation,



drop:

state.dropLocation,



fare:

state.estimatedFare,



distance:

state.estimatedDistance,



duration:

state.estimatedDuration,



paymentMethod,



status:

"searching",



driverId:null,



createdAt:

Timestamp.now()



};






const ref =
await addDoc(

collection(
db,
"rides"
),

ride

);





state.currentRideId =
ref.id;




startRideStatusListener(
ref.id
);



return ref.id;



}

catch(error){


console.log(
error
);



alert(
"Ride booking failed"
);


}



}








// ===============================
// RIDE LISTENER
// ===============================


function startRideStatusListener(id){


const rideRef =
doc(
db,
"rides",
id
);




stateListener =
onSnapshot(
rideRef,
(snapshot)=>{


if(snapshot.exists()){


const data =
snapshot.data();



window.dispatchEvent(

new CustomEvent(

"riderx
