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


window.location.href=
"verify-otp.html";


})

.catch((error)=>{


alert(error.message);


});


};







window.verifyOTP=function(){


let otp =

document.getElementById("otp").value;



confirmationResult.confirm(otp)

.then(async(result)=>{


let user=result.user;



let role =

localStorage.getItem("role")

|| "customer";



await setDoc(

doc(db,"users",user.uid),

{

phone:user.phoneNumber,

role:role,

createdAt:new Date()

},

{

merge:true

}

);



if(role=="rider"){


window.location.href=
"../rider/dashboard.html";


}

else{


window.location.href=
"../customer/menu.html";


}



})

.catch(()=>{


alert("Invalid OTP");


});


};
