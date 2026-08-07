// ======================================
// RiderX Rider Dashboard
// Complete Ride System
// ======================================


import { auth, db, realtimeDB }
from "../../firebase/firebase-config.js";


import {

onAuthStateChanged

}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {

doc,
getDoc,
updateDoc,
collection,
query,
where,
onSnapshot,
limit

}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {

ref,
set

}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";





let riderId=null;

let currentRideId=null;

let online=false;

let rideOTP=null;

let earning=0;






// ===============================
// Auth
// ===============================


onAuthStateChanged(
auth,
async(user)=>{


if(!user){

window.location.href="../auth/login.html";

return;

}



riderId=user.uid;


checkRider();


});









// ===============================
// Check Rider
// ===============================


async function checkRider(){


const snap=
await getDoc(
doc(db,"users",riderId)
);



if(snap.exists()){


let data=snap.data();



if(data.role!=="rider"){


alert("Only rider account allowed");


}



if(data.approved===false){


alert("Admin approval pending");


}



}


}









// ===============================
// Online Button
// ===============================


document
.getElementById("onlineBtn")
.onclick=()=>{


online=!online;



if(online){


document
.getElementById("onlineBtn")
.innerHTML=
"🔴 Go Offline";


setOnline(true);

listenRides();



}

else{


document
.getElementById("onlineBtn")
.innerHTML=
"🟢 Go Online";


setOnline(false);


}



};









// ===============================
// Rider Online Status
// ===============================


function setOnline(status){


if(!riderId)
return;



set(

ref(
realtimeDB,
"onlineRiders/"+riderId
),

{

online:status,

updatedAt:Date.now()

}

);



}









// ===============================
// Listen Ride
// ===============================


function listenRides(){



let q=query(

collection(db,"rides"),

where(
"status",
"==",
"searching"
),

limit(1)

);





onSnapshot(
q,
(snapshot)=>{


snapshot.forEach(
(item)=>{


showRide(
item.id,
item.data()
);


});



});


}









// ===============================
// Show Ride
// ===============================


function showRide(id,data){



currentRideId=id;



document
.getElementById("customerName")
.innerHTML=
"Customer: "
+
data.customerId;



document
.getElementById("pickupText")
.innerHTML=
"Pickup: "
+
data.pickup;



document
.getElementById("dropText")
.innerHTML=
"Drop: "
+
data.drop;



document
.getElementById("fareText")
.innerHTML=
"Fare: "
+
data.fare;



}









// ===============================
// Accept Ride
// ===============================


document
.getElementById("acceptRide")
.onclick=
async()=>{


if(!currentRideId){

alert("No ride found");

return;

}



rideOTP =
Math.floor(
1000+
Math.random()*9000
);



await updateDoc(

doc(
db,
"rides",
currentRideId
),

{


status:"accepted",

riderId:riderId,

otp:rideOTP

}


);



document
.getElementById("otpInput")
.value=
"OTP: "+rideOTP;



document
.getElementById("rideStatus")
.innerHTML=
"Ride Accepted";



alert(
"Ride Accepted"
);



};









// ===============================
// Reject Ride
// ===============================


document
.getElementById("rejectRide")
.onclick=
async()=>{


if(!currentRideId)
return;



await updateDoc(

doc(
db,
"rides",
currentRideId
),

{

status:"rejected"

}

);



currentRideId=null;


};









// ===============================
// Start Ride OTP Verify
// ===============================


document
.getElementById("startRide")
.onclick=
async()=>{


let entered =
document
.getElementById("otpInput")
.value;



entered =
entered.replace(
"OTP:",
""
)
.trim();





if(
entered != rideOTP
){


alert(
"Wrong OTP"
);


return;

}




await updateDoc(

doc(
db,
"rides",
currentRideId
),

{


status:"started"

}


);



document
.getElementById("rideStatus")
.innerHTML=
"Ride Started 🚀";



};









// ===============================
// Complete Ride
// ===============================


document
.getElementById("completeRide")
.onclick=
async()=>{


if(!currentRideId)
return;



await updateDoc(

doc(
db,
"rides",
currentRideId
),

{


status:"completed"


}

);





earning += 100;



document
.getElementById("earningAmount")
.innerHTML=
"₹"+earning;



document
.getElementById("rideStatus")
.innerHTML=
"Ride Completed ✅";



currentRideId=null;



};
