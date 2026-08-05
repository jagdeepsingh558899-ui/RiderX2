import { db } from "../firebase/config.js";


import {

collection,
addDoc,
onSnapshot,
doc,
updateDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Customer Search Ride


let statusBox =

document.getElementById("status");



if(statusBox){


onSnapshot(

collection(db,"rides"),

(snapshot)=>{


snapshot.forEach((ride)=>{


let data = ride.data();



if(data.status=="accepted"){


statusBox.innerHTML=

"Rider Found ✅";


localStorage.setItem(

"rideId",

ride.id

);



window.location.href=

"ride-status.html";


}


});


}

);


}






// Show Customer Status


let rideBox =

document.getElementById("ride");



if(rideBox){


let id =

localStorage.getItem("rideId");



if(id){


onSnapshot(

doc(db,"rides",id),

(data)=>{


let ride=data.data();



rideBox.innerHTML=

`

<h3>
Status: ${ride.status}
</h3>


<p>
Fare: ₹${ride.fare || 0}
</p>


`;



}

);


}


}







// Rider Accept


window.acceptRide = async function(){


let id =

localStorage.getItem("rideId");



if(id){


await updateDoc(

doc(db,"rides",id),

{

status:"accepted"

}

);



alert("Ride Accepted");


}


};






window.rejectRide=function(){


alert("Ride Rejected");


};
