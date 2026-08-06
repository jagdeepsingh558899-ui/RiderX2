// =====================================
// RiderX Admin Customer Management
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







const customersBox =

document.getElementById(
"customers"
);









// =====================================
// LOAD CUSTOMERS
// =====================================



function loadCustomers(){



const q = query(

collection(
db,
"users"
),


where(

"role",

"==",

"customer"

)


);







onSnapshot(q,(snapshot)=>{



if(snapshot.empty){



customersBox.innerHTML=

`

<div class="empty">

No Customers Found

</div>

`;

return;


}







customersBox.innerHTML="";






snapshot.forEach((customerDoc)=>{



const customer = customerDoc.data();






customersBox.innerHTML +=



`

<div class="customer-card">


<h3>

👤 ${customer.name || "Customer"}

</h3>



<div class="info">

📱 ${customer.phone || "No Phone"}

</div>



<div class="info">

📧 ${customer.email || "No Email"}

</div>



<div class="status">

Status:

${customer.status || "active"}

</div>





<button onclick="blockCustomer('${customerDoc.id}')">

Block Customer

</button>





<button onclick="unblockCustomer('${customerDoc.id}')">

Unblock Customer

</button>



</div>


`;



});





});



}









// =====================================
// BLOCK CUSTOMER
// =====================================



window.blockCustomer = async(id)=>{


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



};









// =====================================
// UNBLOCK CUSTOMER
// =====================================



window.unblockCustomer = async(id)=>{


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



};








loadCustomers();
