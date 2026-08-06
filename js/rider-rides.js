// =====================================
// RiderX Rider Rides System
// Accepted / Start / Complete
// =====================================


import {

db,
auth

}

from "../firebase/config.js";



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







const ridesBox =

document.getElementById(
"rides"
);









function loadRides(){



const user = auth.currentUser;



if(!user){

return;

}







const q = query(

collection(
db,
"rides"
),


where(
"riderId",
"==",
user.uid
)


);








onSnapshot(q,(snapshot)=>{



if(snapshot.empty){



ridesBox.innerHTML=

`

<div class="empty">

No Rides Available

</div>

`;

return;


}







ridesBox.innerHTML="";






snapshot.forEach((rideDoc)=>{



const ride = rideDoc.data();





ridesBox.innerHTML +=



`

<div class="ride-card">


<h3>

${ride.service}

</h3>



<div class="info">

📍 Pickup:
${ride.pickup}

</div>



<div class="info">

📍 Drop:
${ride.drop}

</div>



<div class="info">

💰 Fare:
${ride.fare}

</div>



<div class="status">

Status:
${ride.status}

</div>





${

ride.status==="accepted"

?

`

<button onclick="startRide('${rideDoc.id}')">

Start Ride

</button>

`

:""

}






${

ride.status==="started"

?

`

<button onclick="completeRide('${rideDoc.id}')">

Complete Ride

</button>

`

:""

}




</div>


`;



});



});



}









// =====================================
// START RIDE
// =====================================



window.startRide = async(id)=>{


try{


await updateDoc(

doc(
db,
"rides",
id
),


{

status:"started"

}


);



alert(

"Ride Started"

);



}



catch(error){


alert(
error.message
);


}



};









// =====================================
// COMPLETE RIDE
// =====================================



window.completeRide = async(id)=>{


try{



await updateDoc(

doc(
db,
"rides",
id
),


{

status:"completed"

}


);





alert(

"Ride Completed"

);



}



catch(error){


alert(
error.message
);


}



};








auth.onAuthStateChanged(()=>{


loadRides();


});
