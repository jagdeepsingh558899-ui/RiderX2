// =====================================
// RiderX Admin Manage Riders
// Firebase v10
// =====================================


import {

auth,
db

}
from "../../firebase/firebase-config.js";



import {

onAuthStateChanged

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";



import {

collection,
getDocs,
doc,
getDoc,
updateDoc

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";





const riderList =
document.getElementById("riderList");






// ===============================
// ADMIN CHECK
// ===============================


onAuthStateChanged(
auth,
async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



const adminSnap =
await getDoc(
doc(db,"users",user.uid)
);



if(
!adminSnap.exists() ||
adminSnap.data().role !== "admin"
){


alert("Access Denied");


location.href="../customer/home.html";


return;

}



loadRiders();


});








// ===============================
// LOAD RIDERS
// ===============================


async function loadRiders(){


try{


const snap =
await getDocs(
collection(db,"users")
);



riderList.innerHTML="";



let found=false;



snap.forEach((item)=>{


const data =
item.data();



if(data.role==="rider"){


found=true;



const id =
item.id;



riderList.innerHTML += `

<div class="rider-card">


<div class="row">
<span class="label">Name:</span>
${data.name || "No Name"}
</div>


<div class="row">
<span class="label">Phone:</span>
${data.phone || "No Phone"}
</div>



<div class="row">
<span class="label">Vehicle:</span>
${data.vehicle || "Not Added"}
</div>



<div class="row">
<span class="label">Status:</span>
${data.status || "pending"}
</div>



<div class="row">
<span class="label">Online:</span>
${data.online ? "Online":"Offline"}
</div>



<button onclick="approveRider('${id}')">

Approve Rider

</button>



<button class="block"
onclick="blockRider('${id}')">

Block Rider

</button>



</div>

`;



}



});




if(!found){

riderList.innerHTML=
"No Riders Found";


}



}

catch(error){


console.log(error);


riderList.innerHTML =
"Error: "+error.message;


}



}








// ===============================
// APPROVE RIDER
// ===============================


window.approveRider =
async(id)=>{


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


loadRiders();


};








// ===============================
// BLOCK RIDER
// ===============================


window.blockRider =
async(id)=>{


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


loadRiders();



};
