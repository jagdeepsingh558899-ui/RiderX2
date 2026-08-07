// ======================================
// RiderX Rider Dashboard JS
// Firebase Ride System
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





let riderId = null;

let online = false;

let currentRideId = null;






// ===============================
// Auth Check
// ===============================


onAuthStateChanged(
auth,
async(user)=>{


if(!user){


alert(
"Please login first"
);


window.location.href="../auth/login.html";


return;


}



riderId=user.uid;



checkRider();



});








// ===============================
// Rider Approval Check
// ===============================


async function checkRider(){



const riderRef =
doc(db,"users",riderId);



const riderSnap =
await getDoc(riderRef);



if(riderSnap.exists()){


const data =
riderSnap.data();



if(data.role!=="rider"){


alert(
"Only Rider account allowed"
);


return;


}



if(data.approved===false){


alert(
"Admin approval pending"
);


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


setRiderOnline(true);


listenForRides();



}

else{


document
.getElementById("onlineBtn")
.innerHTML=
"🟢 Go Online";


setRiderOnline(false);



}



};








// ===============================
// Rider Online Status
// ===============================


function setRiderOnline(status){



if(!riderId)
return;



const riderStatusRef =
ref(
realtimeDB,
"onlineRiders/"+riderId
);



set(
riderStatusRef,
{


online:status,


updatedAt:
Date.now()



}

);



}









// ===============================
// Listen Ride Request
// ===============================


function listenForRides(){



const q =
query(

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
(docSnap)=>{


showRide(
docSnap.id,
docSnap.data()
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
"Customer ID: "
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


if(!currentRideId)
{


alert(
"No ride available"
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


status:"accepted",


riderId:riderId,


acceptedAt:
new Date()



}


);




document
.getElementById("otpCode")
.innerHTML=
Math.floor(
1000+
Math.random()*9000
);



alert(
"Ride Accepted"
);



};









// ===============================
// Reject Ride
// ===============================


document
.getElementById("rejectRide")
.onclick=()=>{


currentRideId=null;


alert(
"Ride Rejected"
);



};
