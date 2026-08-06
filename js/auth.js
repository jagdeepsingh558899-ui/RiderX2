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
"Logged User:",
user.email || user.phoneNumber
);



try{


const snap = await getDoc(

doc(
db,
"users",
user.uid
)

);



if(snap.exists()){


const role =
snap.data().role;



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


const emailBtn =
document.getElementById("emailLogin");



if(emailBtn){


emailBtn.addEventListener(
"click",

async()=>{


const email =
document.getElementById("email").value;



const password =
document.getElementById("password").value;



if(!email || !password){

alert(
"Enter email and password"
);

return;

}



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



}

);


}








// =====================================
// FORGOT PASSWORD
// =====================================


const forgot =
document.getElementById("forgot");



if(forgot){


forgot.onclick=async()=>{


const email =
document.getElementById("email").value;



if(!email){


alert(
"Enter your email"
);


return;


}



try{


await sendPasswordResetEmail(

auth,

email

);



alert(
"Reset email sent"
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



let confirmationResult;



const sendOtp =
document.getElementById("sendOtp");



const verifyOtp =
document.getElementById("verifyOtp");





if(sendOtp){



window.recaptchaVerifier =

new RecaptchaVerifier(

auth,

"recaptcha-container",

{

size:"invisible"

}

);




sendOtp.onclick = async()=>{


const phone =

document.getElementById("phone").value;



if(phone.length!==10){


alert(
"Enter valid mobile number"
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



document
.getElementById("otp")
.classList
.remove("hidden");



verifyOtp
.classList
.remove("hidden");



alert(
"OTP Sent"
);



}

catch(error){


console.log(error);


alert(
error.message
);



}



};



}








// =====================================
// VERIFY OTP
// =====================================



if(verifyOtp){



verifyOtp.onclick = async()=>{


const otp =

document.getElementById("otp").value;



if(!otp){


alert(
"Enter OTP"
);


return;

}



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
"Invalid OTP"
);



}



};



}
