// =====================================
// RiderX Customer Ride History
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

orderBy


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


ridesBox.innerHTML =

`
<div class="empty">
Please Login First
</div>
`;

return;


}






const q = query(

collection(db,"rides"),


where(
"customerId",
"==",
user.uid
),


orderBy(
"createdAt",
"desc"
)


);







onSnapshot(q,(snapshot)=>{



if(snapshot.empty){



ridesBox.innerHTML =

`
<div class="empty">

No Rides Found

</div>
`;

return;


}







ridesBox.innerHTML="";





snapshot.forEach(doc=>{



const ride = doc.data();





ridesBox.innerHTML +=



`

<div class="ride-card">


<h3>

${ride.service?.toUpperCase()}

</h3>


<div class="info">

📍 From:
${ride.pickup}

</div>


<div class="info">

📍 To:
${ride.drop}

</div>


<div class="info">

💰 Fare:
${ride.fare}

</div>


<div class="info">

💳 Payment:
${ride.payment}

</div>



<div class="status">

Status:
${ride.status}

</div>



${

ride.riderName ?

`

<div class="info">

🏍 Rider:
${ride.riderName}

</div>

`

:""

}



</div>


`;



});



});



}






auth.onAuthStateChanged(()=>{


loadRides();


});
