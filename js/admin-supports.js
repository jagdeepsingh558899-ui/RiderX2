// =================================
// RiderX Admin Support Management
// =================================


import {db} from "../firebase/config.js";


import {

collection,
getDocs,
doc,
updateDoc,
query,
orderBy

}

from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const supportList =
document.getElementById("supportList");







async function loadSupports(){



const q=query(

collection(db,"supports"),

orderBy("createdAt","desc")

);



const snap =
await getDocs(q);



supportList.innerHTML="";





if(snap.empty){


supportList.innerHTML=`

<div class="service-card">

<h3>

No Support Requests

</h3>

</div>

`;

return;

}





snap.forEach((ticket)=>{


let data=ticket.data();



supportList.innerHTML += `


<div class="service-card">


<h3>

${data.subject || "Support"}

</h3>



<p>

👤 User:

${data.userId || "-"}

</p>



<p>

📝 Message:

${data.message || "-"}

</p>



<p>

Status:

${data.status || "Pending"}

</p>



<button onclick="resolveTicket('${ticket.id}')">

✅ Resolve

</button>



</div>


`;



});



}








window.resolveTicket = async(id)=>{


await updateDoc(

doc(db,"supports",id),

{


status:"Resolved"

}

);



alert("Ticket Resolved ✅");


loadSupports();


};






loadSupports();
