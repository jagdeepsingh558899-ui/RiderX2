// =================================
// RiderX Admin Customer Management
// =================================


import {db} from "../firebase/config.js";


import {

collection,
getDocs

}

from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




const customerList =
document.getElementById("customerList");


const search =
document.getElementById("searchCustomer");



let customers=[];







async function loadCustomers(){


const snap = await getDocs(

collection(db,"users")

);



customers=[];



snap.forEach((user)=>{


let data=user.data();



if(data.role==="customer"){


customers.push({

id:user.id,

...data

});


}



});





showCustomers(customers);



}







function showCustomers(list){


customerList.innerHTML="";





if(list.length===0){


customerList.innerHTML=


`

<div class="service-card">

<h3>

No Customers Found

</h3>

</div>

`;


return;

}





list.forEach((customer)=>{



customerList.innerHTML +=


`

<div class="service-card">


<h3>

👤 ${customer.name || "Customer"}

</h3>



<p>

📱 ${customer.phone || "No Phone"}

</p>



<p>

📧 ${customer.email || ""}

</p>



<p>

Account:

${customer.status || "Active"}

</p>



</div>


`;



});



}









search.oninput=()=>{


let value=

search.value.toLowerCase();




let filtered=

customers.filter((c)=>


(c.name || "")
.toLowerCase()
.includes(value)


);



showCustomers(filtered);



};






loadCustomers();
