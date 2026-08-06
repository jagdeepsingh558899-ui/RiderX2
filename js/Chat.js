// ==========================================
// RiderX Chat System V1
// Customer <-> Rider Real Time Chat
// ==========================================


import { db, auth } from "../firebase/config.js";


import {

collection,
addDoc,
query,
orderBy,
onSnapshot,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const chatBox =
document.getElementById("chatBox");


const messageInput =
document.getElementById("messageInput");


const sendBtn =
document.getElementById("sendBtn");





let user=null;


let rideId =
localStorage.getItem("rideId");





auth.onAuthStateChanged((u)=>{


if(u){

user=u;

loadMessages();

}


});







// SEND MESSAGE


sendBtn.onclick=async()=>{


let text =
messageInput.value.trim();



if(!text)
return;



if(!rideId)
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


message:text,


createdAt:
serverTimestamp()


}

);



messageInput.value="";


};








// LOAD CHAT


function loadMessages(){



const q=query(

collection(

db,

"chats",

rideId,

"messages"

),

orderBy(
"createdAt",
"asc"
)

);





onSnapshot(q,(snapshot)=>{



chatBox.innerHTML="";



snapshot.forEach((doc)=>{



let data=doc.data();



let div=document.createElement("div");



if(data.senderId===user.uid){


div.className="my-message";


}

else{


div.className="other-message";


}



div.innerHTML=

data.message;



chatBox.appendChild(div);



});



chatBox.scrollTop =
chatBox.scrollHeight;



});



}





console.log(
"RiderX Chat Engine Loaded"
);
