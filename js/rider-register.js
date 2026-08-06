// =====================================
// RiderX Rider Registration
// =====================================


import { auth, db } from "../firebase/config.js";


import {

createUserWithEmailAndPassword

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
setDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const registerBtn =
document.getElementById("registerBtn");


const message =
document.getElementById("message");



registerBtn.onclick = async()=>{


const name =
document.getElementById("name").value.trim();


const bike =
document.getElementById("bike").value.trim();


const number =
document.getElementById("number").value.trim();


const license =
document.getElementById("license").value.trim();





if(!name || !bike || !number || !license){

message.innerHTML =
"Please fill all details";

return;

}




// Demo email/password for rider account
// Later rider can login with own email


let email =
prompt("Enter Rider Email");


let password =
prompt("Create Password");




if(!email || !password){

return;

}





try{


const result =
await createUserWithEmailAndPassword(

auth,

email,

password

);



const uid =
result.user.uid;





await setDoc(

doc(db,"riders",uid),

{


name:name,


bike:bike,


vehicleNumber:number,


license:license,


status:"offline",


createdAt:serverTimestamp()


}

);





await setDoc(

doc(db,"users",uid),

{


role:"rider",


name:name,


email:email,


createdAt:serverTimestamp()


}

);





localStorage.setItem(

"role",

"rider"

);





alert(
"Rider Account Created ✅"
);



window.location.href =
"dashboard.html";



}

catch(error){


message.innerHTML =
error.message;


}



};
