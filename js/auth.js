// =====================================
// RiderX Authentication System
// Email + Phone OTP
// =====================================


import {

auth,
db

}

from "../firebase/config.js";



import {


signInWithEmailAndPassword,

createUserWithEmailAndPassword,

sendPasswordResetEmail,

RecaptchaVerifier,

signInWithPhoneNumber,

onAuthStateChanged


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {


doc,

getDoc


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// =====================================
// AUTO LOGIN CHECK
// =====================================


onAuthStateChanged(auth, async(user)=>{


if(user){


console.log(
"User Active:",
user.phoneNumber || user.email
);



try{


const userDoc =
await getDoc(
doc(db,"users",user.uid)
);



if(userDoc.exists()){


let role =
userDoc.data().role;



if(role==="rider"){


window.location.href =
"../rider/home.html";


}


else{


window.location.href =
"../customer/home.html";


}


}


}

catch(error){

console.log(error);

}



}



});







// =====================================
// EMAIL LOGIN
// =====================================


const emailLogin =
document.getElementById("emailLogin");



if(emailLogin){


emailLogin.onclick=async()=>{


let email =
document.getElementById("email").value;


let password =
document.getElementById("password").value;



try{


await signInWithEmailAndPassword(

auth,

email,

password

);



alert(
"Login Successful"
);



}

catch(error){


alert(
error.message
);


}



};


}









// =====================================
// FORGOT PASSWORD
// =====================================


const forgot =
document.getElementById("forgot");



if(forgot){


forgot.onclick=async()=>{


let email =
document.getElementById("email").value;



if(!email){

alert(
"Enter Email First"
);

return;

}



try{


await sendPasswordResetEmail(
auth,
email
);


alert(
"Password Reset Link Sent"
);



}

catch(error){


alert(
error.message
);


}



};


}









// =====================================
// PHONE OTP LOGIN
// =====================================



const sendOtp =
document.getElementById("sendOtp");



let confirmationResult;





if(sendOtp){



window.recaptchaVerifier =

new RecaptchaVerifier(

auth,

'recaptcha-container',

{

size:"invisible"

}

);



sendOtp.onclick=async()=>{


let phone =
document.getElementById("phone").value;



if(phone.length<10){

alert(
"Enter Valid Number"
);

return;

}




try{


confirmationResult =

await signInWithPhoneNumber(

auth,

"+91"+phone,

window.recaptchaVerifier

);



document.getElementById(
"otp"
).classList.remove("hidden");



document.getElementById(
"verifyOtp"
).classList.remove("hidden");



alert(
"OTP Sent"
);



}

catch(error){


alert(
error.message
);


}



};



}










// =====================================
// VERIFY OTP
// =====================================


const verifyOtp =

document.getElementById("verifyOtp");




if(verifyOtp){



verifyOtp.onclick=async()=>{


let otp =

document.getElementById("otp").value;



try{


await confirmationResult.confirm(
otp
);



alert(
"Phone Login Successful"
);



}

catch(error){


alert(
"Wrong OTP"
);


}



};



}
