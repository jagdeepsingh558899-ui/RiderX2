// =====================================
// RiderX Register System
// Customer + Rider
// Firebase v10/v12 Compatible
// =====================================


import {

auth,
db

}

from "../firebase/firebase-config.js";



import {

createUserWithEmailAndPassword

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,
setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// =====================================
// ROLE SELECT
// =====================================


let selectedRole = "customer";



const customerRole =
document.getElementById("customerRole");



const riderRole =
document.getElementById("riderRole");





if(customerRole){


customerRole.onclick = ()=>{


selectedRole = "customer";


customerRole.classList.add("active");

if(riderRole){

riderRole.classList.remove("active");

}


};


}





if(riderRole){


riderRole.onclick = ()=>{


selectedRole = "rider";


riderRole.classList.add("active");


if(customerRole){

customerRole.classList.remove("active");

}


};


}






// =====================================
// REGISTER
// =====================================


const registerBtn =
document.getElementById("registerBtn");





if(registerBtn){



registerBtn.onclick = async ()=>{



const name =
document.getElementById("name").value.trim();



const phone =
document.getElementById("phone").value.trim();



const email =
document.getElementById("email").value.trim();



const password =
document.getElementById("password").value.trim();





if(
!name ||
!phone ||
!email ||
!password

){


alert("Please fill all details");

return;

}





try{


// Create Firebase Account

const userCredential =

await createUserWithEmailAndPassword(

auth,

email,

password

);



const user = userCredential.user;





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



// Rider approval system

approved:

selectedRole === "rider"
?
false
:
true,



status:

selectedRole === "rider"
?
"pending"
:
"active",



wallet:0,


createdAt:new Date()


}


);







alert(
"Account Created Successfully"
);







// Redirect

if(selectedRole === "rider"){


window.location.href =

"../rider/pending.html";


}

else{


window.location.href =

"../customer/home.html";


}





}

catch(error){



console.error(error);


alert(
error.message
);



}



};



}
