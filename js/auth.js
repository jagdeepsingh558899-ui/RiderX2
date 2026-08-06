// =========================================
// RiderX Authentication System
// Firebase Compat Version
// =========================================

console.log("RiderX Auth Loaded");


// ================================
// UI HELPERS
// ================================

function showToast(message){
    alert(message);
}


function showLoader(){
    console.log("Loading...");
}


function hideLoader(){
    console.log("Done");
}


// ================================
// PASSWORD TOGGLE
// ================================

function togglePasswordVisibility(id, icon){

    const input = document.getElementById(id);

    if(!input) return;


    if(input.type === "password"){

        input.type = "text";

        if(icon){
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }

    }else{

        input.type = "password";

        if(icon){
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }

    }

}


// ================================
// REGISTER USER
// ================================

async function registerUserAccount(data){

try{

showLoader();


const {
    role,
    fullName,
    mobileNumber,
    email,
    password
}=data;



const userCredential =
await firebase.auth()
.createUserWithEmailAndPassword(
email,
password
);



const user=userCredential.user;



await user.updateProfile({

displayName:fullName

});



const userData={

uid:user.uid,

fullName:fullName,

mobileNumber:mobileNumber,

email:email,

role:role,

createdAt:
firebase.firestore.FieldValue.serverTimestamp()

};




// CUSTOMER

if(role==="customer"){


userData.status="Active";


await firebase.firestore()
.collection("customers")
.doc(user.uid)
.set(userData);



showToast(
"Customer register successfully"
);



setTimeout(()=>{

window.location.href=
"../customer/home.html";


},1500);



}



// RIDER

else{


userData.status="Pending";

userData.adminApproved=false;



await firebase.firestore()
.collection("riders")
.doc(user.uid)
.set(userData);



showToast(
"Rider registration submitted"
);



setTimeout(()=>{

window.location.href=
"../rider/pending.html";


},1500);


}



}

catch(error){

console.log(error);

showToast(error.message);


}

finally{

hideLoader();

}


}



// ================================
// LOGIN USER
// ================================

async function loginUser(email,password){

try{


const result =
await firebase.auth()
.signInWithEmailAndPassword(
email,
password
);



const uid=result.user.uid;



const customer =
await firebase.firestore()
.collection("customers")
.doc(uid)
.get();



if(customer.exists){


window.location.href =
"../customer/home.html";


return;

}




const rider =
await firebase.firestore()
.collection("riders")
.doc(uid)
.get();



if(rider.exists){


if(rider.data().adminApproved===true){


window.location.href =
"../rider/home.html";


}else{


window.location.href =
"../rider/pending.html";


}


return;

}



window.location.href =
"../auth/register.html";


}


catch(error){

showToast(error.message);

}


}
// ================================
// GOOGLE LOGIN
// ================================

async function handleGoogleSignUp(){

try{


const provider =
new firebase.auth.GoogleAuthProvider();



const result =
await firebase.auth()
.signInWithPopup(provider);



const user=result.user;



await firebase.firestore()
.collection("customers")
.doc(user.uid)
.set({

uid:user.uid,

fullName:user.displayName || "Customer",

email:user.email,

role:"customer",

createdAt:
firebase.firestore.FieldValue.serverTimestamp()


},
{
merge:true
});



window.location.href =
"../customer/home.html";


}

catch(error){

showToast(error.message);

}


}



// ================================
// PHONE OTP
// ================================

let confirmationResult=null;



function openPhoneOTPModal(){


const modal =
document.getElementById("otpModal");


if(modal){

modal.style.display="flex";

}



window.recaptchaVerifier =
new firebase.auth.RecaptchaVerifier(
"recaptcha-container",
{
size:"invisible"
});


}




function closePhoneOTPModal(){


const modal =
document.getElementById("otpModal");


if(modal){

modal.style.display="none";

}


}




async function requestOTP(){


try{


const phone =
document.getElementById(
"otpPhoneNumber"
).value;



confirmationResult =
await firebase.auth()
.signInWithPhoneNumber(
phone,
window.recaptchaVerifier
);



document.getElementById(
"otpInputGroup"
).style.display="block";



document.getElementById(
"sendOtpBtn"
).style.display="none";



document.getElementById(
"verifyOtpBtn"
).style.display="block";



showToast("OTP sent successfully");


}


catch(error){

showToast(error.message);

}


}





async function verifyOTP(){


try{


const code =
document.getElementById(
"otpCode"
).value;



await confirmationResult.confirm(code);



window.location.href =
"../customer/home.html";


}


catch(error){

showToast(error.message);

}


}




// ================================
// LOGOUT
// ================================

async function logout(){


await firebase.auth().signOut();


window.location.href =
"../auth/login.html";


}




// ================================
// GLOBAL FUNCTIONS
// ================================

window.registerUserAccount =
registerUserAccount;


window.loginUser =
loginUser;


window.handleGoogleSignUp =
handleGoogleSignUp;


window.openPhoneOTPModal =
openPhoneOTPModal;


window.closePhoneOTPModal =
closePhoneOTPModal;


window.requestOTP =
requestOTP;


window.verifyOTP =
verifyOTP;


window.togglePasswordVisibility =
togglePasswordVisibility;


window.logout =
logout;


console.log(
"RiderX Auth System Ready"
);
