// ==========================================
// RiderX Rider History System V1
// Earnings + Completed Rides
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
query,
where,
onSnapshot

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const historyBox =
document.getElementById("rideHistory");


const earningBox =
document.getElementById("totalEarning");





let rider=null;


let total=0;








onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



rider=user;


loadHistory();



});








function loadHistory(){



const q=query(

collection(db,"rides"),

where(

"riderId",

"==",

rider.uid

)

);






onSnapshot(q,(snapshot)=>{



historyBox.innerHTML="";


total=0;




if(snapshot.empty){


historyBox.innerHTML=

"<p>No completed rides</p>";


earningBox.innerHTML="0";


return;


}





snapshot.forEach((item)=>{


let ride=item.data();




if(

ride.status==="completed"

){



total += Number(

ride.fare || 0

);





let card=document.createElement("div");


card.className="card";



card.innerHTML=


`

<h3>

${ride.service || "Ride"}

</h3>


<p>

📍 ${ride.pickup}

</p>


<p>

🏁 ${ride.drop}

</p>


<p>

💰 ₹${ride.fare}

</p>


<p>

💳 ${ride.paymentMethod || "Cash"}

</p>


`;



historyBox.appendChild(card);



}




});






earningBox.innerHTML=

total;



});



}




console.log(
"RiderX Rider History Loaded"
);
