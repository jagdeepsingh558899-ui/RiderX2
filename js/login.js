// RiderX Login System
// Firebase v10.8.0 Compatible


import {
    auth,
    db
} from "../firebase/firebase-config.js";


import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";




const loginForm =
document.getElementById("loginForm");


const message =
document.getElementById("message");





if(loginForm){


loginForm.addEventListener(
"submit",
async(e)=>{


e.preventDefault();



const email =
document.getElementById("email")
.value
.trim();



const password =
document.getElementById("password")
.value;



try{


if(message){

message.innerHTML =
"Logging in...";

}



const result =
await signInWithEmailAndPassword(
auth,
email,
password
);



const user =
result.user;




const userSnap =
await getDoc(
doc(db,"users",user.uid)
);




if(!userSnap.exists()){


if(message){

message.innerHTML =
"User profile not found";

}

return;


}




const data =
userSnap.data();




if(message){

message.innerHTML =
"Login Successful";

}





setTimeout(()=>{



if(data.role==="admin"){


location.href =
"../admin/dashboard.html";


}

else if(data.role==="rider"){


location.href =
"../rider/home.html";


}

else{


location.href =
"../customer/home.html";


}



},500);




}

catch(error){



if(message){

message.innerHTML =
error.message;

}


}



});


}
