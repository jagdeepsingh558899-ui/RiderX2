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





const loginForm =
document.getElementById("login-form");


const message =
document.getElementById("error-message");







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

message.style.display="block";

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





const snap =

await getDoc(

doc(
db,
"users",
user.uid
)

);






if(!snap.exists()){


message.innerHTML =
"Profile not found";


return;


}





const data =
snap.data();






message.innerHTML =
"Login Successful";








setTimeout(()=>{






// ADMIN

if(data.role==="admin"){


location.href =
"../admin/dashboard.html";


}







// RIDER

else if(data.role==="rider"){



if(
data.approved===true &&
data.status==="active"

){


location.href =
"../rider/home.html";


}

else{


location.href =
"../rider/pending.html";


}



}








// CUSTOMER

else{


location.href =
"../customer/home.html";


}






},500);






}



catch(error){



if(message){


message.style.display="block";


message.innerHTML =
error.message;


}



}



});



}
