import { db } from "../firebase/config.js";


import {

collection,
addDoc,
query,
orderBy,
onSnapshot

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Create Notification


export async function sendNotification(
userId,
message
){


await addDoc(

collection(db,"notifications"),

{

userId:userId,

message:message,

read:false,

createdAt:new Date()

}

);


}





// Show Notifications


const box =

document.getElementById("notifications");



if(box){


const q = query(

collection(db,"notifications"),

orderBy(
"createdAt",
"desc"
)

);



onSnapshot(q,(snapshot)=>{


box.innerHTML="";



snapshot.forEach((item)=>{


let data=item.data();



box.innerHTML +=

`

<div class="card">

<h3>
🔔 RiderX Alert
</h3>

<p>
${data.message}
</p>


</div>

`;


});


});


}
