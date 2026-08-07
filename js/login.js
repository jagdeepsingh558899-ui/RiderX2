// =====================================
// RiderX Login System
// Customer + Rider + Admin
// Firebase v10 Compatible
// =====================================

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



const loginForm = document.getElementById("login-form");
const message = document.getElementById("error-message");



function showMessage(text){

    if(message){

        message.style.display = "block";
        message.innerHTML = text;

    }

}





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



if(!email || !password){

showMessage("Please enter email and password");
return;

}



try{


showMessage("Logging in...");



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
doc(
db,
"users",
user.uid
)
);





if(!userSnap.exists()){


showMessage(
"User profile not found"
);


return;

}





const data =
userSnap.data();


// Debug check
console.log(
"RiderX User Data:",
data
);



showMessage(
"Login Successful"
);





setTimeout(()=>{



// ADMIN

if(data.role === "admin"){


window.location.href =
"../admin/dashboard.html";


}



// RIDER

else if(data.role === "rider"){



if(
data.approved === true &&
data.status === "active"
){


window.location.href =
"../rider/home.html";


}

else{


window.location.href =
"../rider/pending.html";


}



}



// CUSTOMER

else{


window.location.href =
"../customer/home.html";


}




},500);






}

catch(error){


console.error(
"Login Error:",
error
);



showMessage(
error.message
);



}



});


}
