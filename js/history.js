// =================================
// RiderX Customer Ride History
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
onValue

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";






let customerId = null;






onAuthStateChanged(

auth,

(user)=>{


if(user){


customerId = user.uid;


loadHistory();


}



});







function loadHistory(){



const ridesRef =

ref(

rtdb,

"rides"

);





onValue(

ridesRef,

(snapshot)=>{



const box =

document.getElementById("rideHistory");



if(!box)

return;





box.innerHTML="";






let found = false;







snapshot.forEach((child)=>{



const ride = child.val();






if(

ride.customerId === customerId

){



found=true;





let date =

new Date(

ride.createdAt

)

.toLocaleString();






box.innerHTML += `



<div class="booking-card">



<h2>

${ride.service}

</h2>




<p>

📍 ${ride.pickup}

</p>



<p>

🏁 ${ride.drop}

</p>




<p>

Distance:

${ride.distance} KM

</p>




<h3>

₹${ride.fare}

</h3>




<p>

Status:

${ride.status}

</p>



<small>

${date}

</small>



</div>



`;



}



});







if(!found){


box.innerHTML =

"<p>No rides found</p>";


}





}



);



}
