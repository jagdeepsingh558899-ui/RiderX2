// =================================
// RiderX Admin Rider Management
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs,
query,
where,
updateDoc,
doc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Load Riders


export async function loadRiders(){


let box = document.getElementById("riderList");


if(!box) return;



try{


const q = query(

collection(db,"users"),

where("role","==","rider")

);



const snapshot = await getDocs(q);



box.innerHTML="";



if(snapshot.empty){


box.innerHTML="<p>No riders found</p>";

return;


}



snapshot.forEach((rider)=>{


let data = rider.data();



box.innerHTML += `

<div class="rider-card">


<h3>
🏍 ${data.name || "Rider"}
</h3>


<p>
📧 ${data.email || ""}
</p>


<p>
Status: ${data.status || "Offline"}
</p>


<button onclick="approveRider('${rider.id}')">
Approve
</button>


</div>

`;



});


}

catch(error){


console.log(error);


box.innerHTML="Error loading riders";


}


}





// Approve Rider


window.approveRider = async function(id){


await updateDoc(

doc(db,"users",id),

{

status:"Approved"

}

);



alert("Rider Approved ✅");


loadRiders();


}
