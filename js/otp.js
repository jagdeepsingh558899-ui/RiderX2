import { auth, db } from "../firebase/config.js";


import {

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



let confirmationResult;



window.sendOTP=function(){


let phone =
document.getElementById("phone").value;



window.recaptchaVerifier =

new RecaptchaVerifier(

auth,

"recaptcha-container",

{

size:"invisible"

}

);



signInWithPhoneNumber(

auth,

phone,

window.recaptchaVerifier

)

.then((result)=>{


confirmationResult=result;


localStorage.setItem(
"phone",
phone
);


window.location.href=
"verify-otp.html";


})

.catch((error)=>{


alert(error.message);


});


};





window.verifyOTP=function(){


let code =
document.getElementById("otp").value;



confirmationResult.confirm(code)

.then(async(result)=>{


let user=result.user;



await setDoc(

doc(db,"users",user.uid),

{

phone:user.phoneNumber,

role:"customer"

}

);



window.location.href=
"../customer/menu.html";


})

.catch(()=>{


alert("Wrong OTP");


});


};
