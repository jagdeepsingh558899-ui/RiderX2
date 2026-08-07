// =====================================
// RiderX Admin Manage Rides
// Firebase v10
// =====================================


import {

auth,
db

}
from "../../firebase/firebase-config.js";



import {

onAuthStateChanged

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";



import {

collection,
getDocs,
doc,
getDoc,
updateDoc

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";





const rideList =
document.getElementById("rideList");






// ===============================
// ADMIN CHECK
// ===============================


onAuthStateChanged(

auth,

async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



const adminSnap =
await getDoc(

doc(
db,
"users",
user.uid

)

);



if(

!adminSnap.exists()

||

adminSnap.data().role !== "admin"

){


alert("Access Denied");


location.href="../customer/home.html";


return;

}



loadRides();


});







// ===============================
// LOAD RIDES
// ===============================


async function loadRides(){


try{


const ridesSnap =
await getDocs(

collection(
db,
"rides"

)

);



rideList.innerHTML="";



if(ridesSnap.empty){

rideList.innerHTML=
"No Rides Found";

return;

}



ridesSnap.forEach((item)=>{


const ride =
item.data();



const id =
item.id;



rideList.innerHTML += `


<div class="ride-card">



<div class="row">

<span class="label">
Ride ID:
</span>

${id}

</div>




<div class="row">

<span class="label">
Customer:
</span>

${ride.customerId || "N/A"}

</div>




<div class="row">

<span class="label">
Rider:
</span>

${ride.driverId || "Not Assigned"}

</div>




<div class="row">

<span class="label">
Service:
</span>

${ride.serviceType || "Bike"}

</div>




<div class="row">

<span class="label">
Fare:
</span>

₹${ride.fare || 0}

</div>




<div class="row">

<span class="label">
Distance:
</span>

${ride.distance || 0} KM

</div>




<div class="row">

<span class="label">
Payment:
</span>

${ride.paymentMethod || "Cash"}

</div>




<div class="row status">

Status:

${ride.status || "pending"}

</div>




<button class="cancel"
onclick="cancelRide('${id}')">

Cancel Ride

</button>



</div>


`;



});



}

catch(error){


console.log(error);


rideList.innerHTML =
"Error: "+error.message;


}



}








// ===============================
// CANCEL RIDE
// ===============================


window.cancelRide =
async(id)=>{


const confirmCancel =
confirm(
"Cancel this ride?"
);



if(!confirmCancel)
return;



await updateDoc(

doc(
db,
"rides",
id

),

{


status:"cancelled"

}


);



alert(
"Ride Cancelled"
);



loadRides();



};
