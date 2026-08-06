// =================================
// RiderX Admin Rider Management
// =================================

import {db} from "../firebase/config.js";

import {

collection,
getDocs,
doc,
updateDoc

}

from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



const riderList =
document.getElementById("riderList");

const search =
document.getElementById("searchRider");



let riders=[];



async function loadRiders(){


const snap =
await getDocs(
collection(db,"users")
);


riders=[];


snap.forEach((user)=>{


let data=user.data();



if(data.role==="rider"){

riders.push({

id:user.id,

...data

});

}


});



showRiders(riders);


}







function showRiders(list){


riderList.innerHTML="";



if(list.length===0){


riderList.innerHTML=

`
<div class="service-card">

<h3>No Riders Found</h3>

</div>
`;

return;

}





list.forEach((rider)=>{



riderList.innerHTML +=


`

<div class="service-card">


<h3>

🏍 ${rider.name || "Rider"}

</h3>


<p>

📱 ${rider.phone || "No Phone"}

</p>


<p>

📧 ${rider.email || ""}

</p>



<p>

Status:

${rider.approved ? "✅ Approved" : "⏳ Pending"}

</p>



<button onclick="approveRider('${rider.id}')">

${rider.approved ? "Approved" : "Approve Rider"}

</button>



</div>

`;



});


}








window.approveRider = async(id)=>{


await updateDoc(

doc(db,"users",id),

{


approved:true,

status:"Approved"

}

);



alert("Rider Approved ✅");


loadRiders();


};







search.oninput=()=>{


let value=

search.value.toLowerCase();



let filtered=

riders.filter((r)=>


(r.name || "")
.toLowerCase()
.includes(value)


);



showRiders(filtered);



};





loadRiders();
