// =====================================
// RiderX Authentication System
// =====================================


import { auth } from "../firebase/config.js";


import {

signInWithEmailAndPassword

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const loginBtn = 
document.getElementById("loginBtn");



const emailBox =
document.getElementById("email");


const passwordBox =
document.getElementById("password");






loginBtn.onclick = async ()=>{


let email = emailBox.value.trim();

let password = passwordBox.value.trim();



if(!email || !password){

alert(
"Email aur password enter karo"
);

return;

}





try{


await signInWithEmailAndPassword(

auth,

email,

password

);




let role = localStorage.getItem("role");




if(role==="rider"){


window.location.href="../rider/dashboard.html";


}

else{


window.location.href="../customer/dashboard.html";


}





}

catch(error){


alert(

"Login Failed: "+error.message

);


}



};
