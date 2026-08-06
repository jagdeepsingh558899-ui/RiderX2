// ==========================================
// RiderX Customer History System V1
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
query,
where,
orderBy,
onSnapshot

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const historyList =
document.getElementById("historyList");



let user=null;







onAuthStateChanged(auth,(u)=>{


if(!u){

location.href="../auth/login.html";

return;

}


user=u;


loadHistory();


});








function loadHistory(){



const q=query(

collection(db,"rides"),

where(
"customerId",
"==",
user.uid
)

);





onSnapshot(q,(snapshot)=>{



historyList.innerHTML="";




if(snapshot.empty){


historyList.innerHTML=

"<p>No rides found</p>";


return;


}





snapshot.forEach((item)=>{



let ride=item.data();




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


<p>

Status:

<b>${ride.status}</b>

</p>


`;





historyList.appendChild(card);



});





});





}




console.log(
"RiderX History Loaded"
);
