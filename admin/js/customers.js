// =====================================
// RiderX Admin Manage Customers
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





const customerList =
document.getElementById("customerList");







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



const admin =
await getDoc(

doc(
db,
"users",
user.uid

)

);



if(

!admin.exists()

||

admin.data().role !== "admin"

){


alert("Access Denied");


location.href="../customer/home.html";


return;

}



loadCustomers();


});








// ===============================
// LOAD CUSTOMERS
// ===============================


async function loadCustomers(){


try{


const usersSnap =
await getDocs(
collection(db,"users")
);



customerList.innerHTML="";



let found=false;



usersSnap.forEach((item)=>{


const data =
item.data();



if(data.role==="customer"){



found=true;



const id =
item.id;



customerList.innerHTML += `


<div class="customer-card">


<div class="row">

<span class="label">
Name:
</span>

${data.name || "No Name"}

</div>



<div class="row">

<span class="label">
Phone:
</span>

${data.phone || "No Phone"}

</div>




<div class="row">

<span class="label">
Email:
</span>

${data.email || "No Email"}

</div>




<div class="row">

<span class="label">
Status:
</span>

${data.status || "active"}

</div>




<button onclick="unblockCustomer('${id}')">

Unblock Customer

</button>



<button class="block"
onclick="blockCustomer('${id}')">

Block Customer

</button>



</div>


`;



}



});





if(!found){

customerList.innerHTML =
"No Customers Found";

}



}

catch(error){


console.log(error);


customerList.innerHTML =
"Error: "+error.message;


}



}








// ===============================
// BLOCK CUSTOMER
// ===============================


window.blockCustomer =
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
"Customer Blocked"
);



loadCustomers();



};







// ===============================
// UNBLOCK CUSTOMER
// ===============================


window.unblockCustomer =
async(id)=>{


await updateDoc(

doc(
db,
"users",
id
),

{

status:"active"

}


);



alert(
"Customer Activated"
);



loadCustomers();


};
