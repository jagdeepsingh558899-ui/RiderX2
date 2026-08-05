// =================================
// RiderX Ride History
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs,
query,
orderBy

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Load Ride History

export async function loadRideHistory(){


let rideBox = document.getElementById("rideList");


if(!rideBox) return;



try{


const q = query(

collection(db,"rides"),

orderBy("createdAt","desc")

);



const snapshot = await getDocs(q);



rideBox.innerHTML="";



if(snapshot.empty){


rideBox.innerHTML =
"<p>No rides found</p>";


return;


}




snapshot.forEach((doc)=>{


let ride = doc.data();



rideBox.innerHTML += `


<div class="ride-card">


<h3>
${ride.service || "Ride"}
</h3>


<p>
📍 ${ride.pickup || "N/A"} 
➡ 
${ride.drop || "N/A"}
</p>


<p>
💰 Fare: ₹${ride.fare || 0}
</p>


<p>
Status: ${ride.status || "Pending"}
</p>


</div>


`;



});



}


catch(error){


console.log(error);


rideBox.innerHTML =
"Unable to load rides";


}


}
