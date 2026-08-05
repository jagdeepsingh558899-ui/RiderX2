import { db } from "../firebase/config.js";


import {

collection,
query,
where,
onSnapshot,
doc,
updateDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




const box =
document.getElementById("rideRequests");



const q =
query(

collection(db,"rides"),

where(
"status",
"==",
"requested"
)

);




onSnapshot(q,(snapshot)=>{


box.innerHTML="";



snapshot.forEach((item)=>{


let data=item.data();



box.innerHTML += `

<div class="card">

<h3>${data.type}</h3>

<p>
Pickup: ${data.pickup}
</p>

<p>
Drop: ${data.drop}
</p>

<p>
Fare: ₹${data.fare}
</p>


<button onclick="acceptRide('${item.id}')">
Accept
</button>


<button onclick="rejectRide('${item.id}')">
Reject
</button>


</div>

`;


});


});






window.acceptRide=async function(id){


await updateDoc(

doc(db,"rides",id),

{

status:"accepted"

}

);


alert("Ride Accepted");


};





window.rejectRide=async function(id){


await updateDoc(

doc(db,"rides",id),

{

status:"rejected"

}

);


alert("Ride Rejected");


};





window.backHome=function(){

window.location.href="dashboard.html";

};
