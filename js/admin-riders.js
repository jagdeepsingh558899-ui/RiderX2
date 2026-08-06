// =====================================
// RiderX Admin Rider Management
// =====================================


import {

db

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







const ridersBox =

document.getElementById(
"riders"
);









// =====================================
// LOAD RIDERS
// =====================================



function loadRiders(){



const q = query(

collection(
db,
"users"
),


where(

"role",

"==",

"rider"

)


);







onSnapshot(q,(snapshot)=>{



if(snapshot.empty){



ridersBox.innerHTML=

`

<div class="empty">

No Riders Found

</div>

`;

return;


}






ridersBox.innerHTML="";






snapshot.forEach((riderDoc)=>{



const rider = riderDoc.data();






ridersBox.innerHTML +=



`

<div class="rider-card">


<h3>

🏍 ${rider.name || "Rider"}

</h3>



<div class="info">

📱 ${rider.phone || "No Phone"}

</div>



<div class="info">

📧 ${rider.email || "No Email"}

</div>



<div class="status">

Status:

${rider.status || "pending"}

</div>





<button onclick="approveRider('${riderDoc.id}')">

Approve Rider

</button>





<button class="block"

onclick="blockRider('${riderDoc.id}')">

Block Rider

</button>



</div>


`;



});





});



}









// =====================================
// APPROVE RIDER
// =====================================



window.approveRider = async(id)=>{


await updateDoc(

doc(

db,

"users",

id

),


{


status:"approved"


}


);



alert(

"Rider Approved"

);



};









// =====================================
// BLOCK RIDER
// =====================================



window.blockRider = async(id)=>{


await updateDoc(

doc(

db,

"users",

id

),


{


status:"blocked"


}


);



alert(

"Rider Blocked"

);



};









loadRiders();
