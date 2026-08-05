// =================================
// RiderX Ride Requests System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs,
doc,
updateDoc,
query,
where

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Load Pending Requests

export async function loadRideRequests(){


let box = document.getElementById("requestList");


if(!box) return;



try{


const q = query(

collection(db,"rides"),

where("status","==","Pending")

);



const snapshot = await getDocs(q);



box.innerHTML="";



if(snapshot.empty){


box.innerHTML =
"<p>No ride requests available</p>";


return;


}




snapshot.forEach((ride)=>{


let data = ride.data();



box.innerHTML += `


<div class="request-card">


<h3>
🚕 ${data.service || "Ride"}
</h3>


<p>
📍 ${data.pickup || "N/A"}
➡
${data.drop || "N/A"}
</p>


<p>
💰 Fare: ₹${data.fare || 0}
</p>



<button onclick="acceptRide('${ride.id}')">
Accept
</button>


<button onclick="rejectRide('${ride.id}')">
Reject
</button>


</div>


`;



});


}


catch(error){

console.log(error);

box.innerHTML="Error loading requests";


}


}







// Accept Ride


window.acceptRide = async function(id){


await updateDoc(

doc(db,"rides",id),

{

status:"Accepted"

}

);


alert("Ride Accepted");


loadRideRequests();


}






// Reject Ride


window.rejectRide = async function(id){


await updateDoc(

doc(db,"rides",id),

{

status:"Rejected"

}

);


alert("Ride Rejected");


loadRideRequests();


}
