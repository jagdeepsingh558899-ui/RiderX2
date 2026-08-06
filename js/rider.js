// =====================================
// RiderX Rider System
// Online + Ride Requests
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

updateDoc,

serverTimestamp


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





let isOnline=false;





const statusBtn =

document.getElementById(
"statusBtn"
);



const rideBox =

document.getElementById(
"rideRequests"
);









// =====================================
// ONLINE OFFLINE
// =====================================


if(statusBtn){



statusBtn.onclick=async()=>{


isOnline=!isOnline;



if(isOnline){


statusBtn.innerHTML="ONLINE";


statusBtn.style.background="#FFD600";

statusBtn.style.color="#000";



listenRides();



}

else{


statusBtn.innerHTML="OFFLINE";


statusBtn.style.background="#333";

statusBtn.style.color="#FFD600";



rideBox.innerHTML=

"No requests available";



}



};


}









// =====================================
// LISTEN NEW RIDES
// =====================================



function listenRides(){



const q = query(

collection(
db,
"rides"
),


where(

"status",

"==",

"searching"

)


);







onSnapshot(q,(snapshot)=>{



if(snapshot.empty){



rideBox.innerHTML=

"No requests available";

return;


}





rideBox.innerHTML="";





snapshot.forEach((rideDoc)=>{



const ride = rideDoc.data();





rideBox.innerHTML +=



`

<div class="request">


<p>

🏍 ${ride.service}

</p>


<p>

📍 ${ride.pickup}

</p>


<p>

📍 ${ride.drop}

</p>


<p>

💰 ${ride.fare}

</p>



<button 

onclick="acceptRide('${rideDoc.id}')">

Accept Ride

</button>



</div>


`;



});



});



}









// =====================================
// ACCEPT RIDE
// =====================================



window.acceptRide = async(id)=>{



const user = auth.currentUser;



if(!user){

return;

}



try{



await updateDoc(

doc(
db,
"rides",
id
),


{


status:"accepted",


riderId:user.uid,


acceptedAt:
serverTimestamp()



}

);





alert(

"Ride Accepted"

);





}

catch(error){



alert(

error.message

);



}



};
