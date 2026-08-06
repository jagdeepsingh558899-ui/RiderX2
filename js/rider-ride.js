// =================================
// RiderX Rider Ride Management
// Accept / Reject + Live Tracking
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
onValue,
update

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





let riderId = null;






onAuthStateChanged(

auth,

(user)=>{


if(user){


riderId = user.uid;


loadAvailableRides();



}



});








function loadAvailableRides(){



const ridesRef =

ref(

rtdb,

"rides"

);





onValue(

ridesRef,

(snapshot)=>{



const list =

document.getElementById("rideList");



if(!list)

return;




list.innerHTML="";







snapshot.forEach((child)=>{



const ride = child.val();



const id = child.key;






if(

ride.status==="searching"

){





list.innerHTML += `


<div class="booking-card">


<h2>

${ride.service}

</h2>


<p>

📍 Pickup:

${ride.pickup}

</p>



<p>

🏁 Drop:

${ride.drop}

</p>



<p>

Distance:

${ride.distance} KM

</p>



<h2>

₹${ride.fare}

</h2>





<button

class="btn"

onclick="acceptRide('${id}')">

Accept Ride

</button>



<button

class="btn btn-dark"

onclick="rejectRide('${id}')">

Reject

</button>




</div>


`;




}



});




}



);



}









// Accept Ride


window.acceptRide = async function(id){



await update(

ref(

rtdb,

"rides/"+id

),



{


status:"accepted",


riderId:riderId,


acceptedAt:Date.now()



}



);





const status =

document.getElementById("rideStatus");



if(status){


status.innerHTML =

"Ride Accepted 🚀";


}




// Start customer tracking

if(window.RiderXTracking){


window.RiderXTracking.start();


}





};









// Reject Ride


window.rejectRide = async function(id){



await update(

ref(

rtdb,

"rides/"+id

),


{


status:"rejected"



}


);



};
