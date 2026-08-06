// =================================
// RiderX Authentication System
// Register + Role Management
// =================================


// Firebase

import {

auth,
db

} from "../firebase/Firebase-config.js";



import {

createUserWithEmailAndPassword

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,
setDoc,
serverTimestamp

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Elements


const form = document.getElementById("registerForm");

const message = document.getElementById("message");



let selectedRole = "customer";




// Role Select


const customerRole =
document.getElementById("customerRole");


const riderRole =
document.getElementById("riderRole");





if(customerRole && riderRole){


customerRole.onclick = ()=>{


selectedRole="customer";


customerRole.classList.add("active");

riderRole.classList.remove("active");


};



riderRole.onclick = ()=>{


selectedRole="rider";


riderRole.classList.add("active");

customerRole.classList.remove("active");


};



}







// Register


if(form){


form.addEventListener(
"submit",
async(e)=>{


e.preventDefault();



const name =
document.getElementById("name").value.trim();



const phone =
document.getElementById("phone").value.trim();



const email =
document.getElementById("email").value.trim();



const password =
document.getElementById("password").value;



const confirmPassword =
document.getElementById("confirmPassword").value;






if(password !== confirmPassword){


message.innerHTML =
"Password does not match";


return;


}




try{



message.innerHTML =
"Creating account...";




// Firebase Auth Create


const userCredential =
await createUserWithEmailAndPassword(

auth,

email,

password

);



const user =
userCredential.user;





// Save User Data



await setDoc(

doc(
db,
"users",
user.uid

),


{


uid:user.uid,

name:name,

phone:phone,

email:email,

role:selectedRole,


createdAt:
serverTimestamp()


}



);






message.innerHTML =
"Account Created Successfully";





setTimeout(()=>{



if(selectedRole==="rider"){


window.location.href =
"../rider/home.html";


}

else{


window.location.href =
"../customer/home.html";


}



},1500);






}

catch(error){


message.innerHTML =
error.message;


}



}


);
}
