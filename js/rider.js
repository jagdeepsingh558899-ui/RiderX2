// =================================
// RiderX Rider System
// Live Ride Request + Accept Reject
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

let online = true;






// Login Check


onAuthStateChanged(

auth,

(user)=>{


if(user){


riderId = user.uid;


loadRides();


}


});








// Online Toggle


const toggle =

document.getElementById("statusToggle");


const statusText =

document.getElementById("statusText");




if(toggle){



toggle.addEventListener(

"click",

()=>{


online = !online;



if(online){


toggle.classList.add("active");


statusText.innerHTML="Online";


}

else{


toggle.classList.remove("active");


statusText.innerHTML="Offline";


}



}


);



}








// Load Ride Requests


function loadRides(){



const ridesRef =

ref(

rtdb,

"rides"

);





onValue(

ridesRef,

(snapshot)=>{



const rideList =

document.getElementById("rideList");




if(!rideList)

return;




rideList.innerHTML="";






snapshot.forEach((child)=>{



const ride = child.val();


const rideId = child.key;





if(

ride.status === "searching"

&& online

){





rideList.innerHTML += `



<div class="booking-card">



<h3>

${ride.service}

</h3>



<div class="location">


<p class="pickup">

📍 ${ride.pickup}

</p>



<p class="drop">

🏁 ${ride.drop}

</p>



</div>




<p>

Distance:

${ride.distance} KM

</p>



<h2 class="fare">

₹${ride.fare}

</h2>





<div class="request-buttons">



<button

class="btn btn-success"

onclick="acceptRide('${rideId}')">

Accept

</button>





<button

class="btn btn-danger"

onclick="rejectRide('${rideId}')">

Reject

</button>



</div>




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


riderId:riderId


}


);



alert(

"Ride Accepted 🚀"

);



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
