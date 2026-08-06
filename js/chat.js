// ==========================================
// RiderX Chat System V1
// Customer ↔ Rider Real Time Chat
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

collection,
addDoc,
query,
orderBy,
onSnapshot,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const chatBox =

document.getElementById("chatBox");


const messageInput =

document.getElementById("messageInput");


const sendBtn =

document.getElementById("sendBtn");





let user=null;


let rideId =

localStorage.getItem("rideId");









onAuthStateChanged(auth,(u)=>{


if(!u){

location.href="../auth/login.html";

return;

}



user=u;



if(rideId){

loadMessages();

}



});









// LOAD MESSAGES


function loadMessages(){



const q=query(


collection(

db,

"chats",

rideId,

"messages"

),


orderBy(

"time",

"asc"

)


);






onSnapshot(q,(snapshot)=>{



chatBox.innerHTML="";




snapshot.forEach((item)=>{



let data=item.data();




let div=document.createElement("div");



div.className="card";



div.style.marginTop="10px";





if(data.senderId===user.uid){



div.innerHTML=

`

<b>
You
</b>

<p>

${data.message}

</p>

`;



}

else{



div.innerHTML=

`

<b>
RiderX User
</b>

<p>

${data.message}

</p>

`;



}





chatBox.appendChild(div);



});





chatBox.scrollTop=

chatBox.scrollHeight;



});



}









// SEND MESSAGE


sendBtn.onclick=async()=>{



let text=

messageInput.value.trim();





if(!text)

return;





await addDoc(


collection(

db,

"chats",

rideId,

"messages"

),


{


senderId:

user.uid,


message:

text,


time:

serverTimestamp()



}



);






messageInput.value="";



};






console.log(

"RiderX Chat System Loaded"

);
