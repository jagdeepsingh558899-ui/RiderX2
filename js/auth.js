// =================================
// RiderX Authentication System
// Gmail + Mobile Support
// =================================


import { auth, db } from "../firebase/config.js";


import {

createUserWithEmailAndPassword,
signInWithEmailAndPassword,
RecaptchaVerifier,
signInWithPhoneNumber

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// ================================
// Gmail Register
// ================================


window.registerEmail = async function(){


const name =
document.getElementById("name").value;


const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



try{


const userCredential =
await createUserWithEmailAndPassword(
auth,
email,
password
);



const user =
userCredential.user;



await setDoc(
doc(db,"users",user.uid),
{

name:name,

email:email,

role:"customer",

createdAt:new Date()

}

);



alert("RiderX Account Created");


window.location.href="../customer/home.html";


}


catch(error){

alert(error.message);

}


};







// ================================
// Mobile OTP Register
// ================================


window.registerPhone = async function(){



const name =
document.getElementById("name").value;


const phone =
document.getElementById("phone").value;



window.recaptchaVerifier =
new RecaptchaVerifier(
auth,
"recaptcha-container",
{

size:"normal"

}

);



const appVerifier =
window.recaptchaVerifier;



try{


const confirmationResult =

await signInWithPhoneNumber(
auth,
phone,
appVerifier
);



window.confirmationResult =
confirmationResult;



let otp =
prompt("Enter OTP");


const result =
await confirmationResult.confirm(otp);



const user =
result.user;



await setDoc(

doc(db,"users",user.uid),

{

name:name,

phone:phone,

role:"customer",

createdAt:new Date()

}

);



alert("Mobile Account Created");


window.location.href="../customer/home.html";


}


catch(error){

alert(error.message);

}


};







// ================================
// Login
// ================================


window.login = async function(){


const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



try{


await signInWithEmailAndPassword(

auth,

email,

password

);



alert("Login Successful");


window.location.href="../customer/home.html";


}


catch(error){

alert(error.message);

}


};
