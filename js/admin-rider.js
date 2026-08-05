import { db } from "../firebase/config.js";


import {

collection,
onSnapshot,
doc,
updateDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




const box =

document.getElementById("riders");




onSnapshot(

collection(db,"riders"),

(snapshot)=>{


box.innerHTML="";



snapshot.forEach((item)=>{


let rider = item.data();


box.innerHTML +=

`

<div class="card">


<h3>
${rider.name}
</h3>


<p>
Bike: ${rider.bike}
</p>


<p>
Number: ${rider.vehicleNumber}
</p>


<p>
Licence: ${rider.license}
</p>


<p>
Status: ${rider.status}
</p>



<button onclick="approveRider('${item.id}')">

Approve ✅

</button>



<button onclick="rejectRider('${item.id}')">

Reject ❌

</button>



</div>

`;



});


});


window.approveRider = async function(id){


await updateDoc(

doc(db,"riders",id),

{

status:"approved"

}

);


alert("Rider Approved");


};





window.rejectRider = async function(id){


await updateDoc(

doc(db,"riders",id),

{

status:"rejected"

}

);


alert("Rider Rejected");


};
