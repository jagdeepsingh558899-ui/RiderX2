// =================================
// RiderX Authentication
// =================================


import { auth, db } from "../firebase/config.js";


import {

createUserWithEmailAndPassword,
signInWithEmailAndPassword

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Register Function

window.register = async function(){


const name =
document.getElementById("name").value;


const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



try{


const userCredential =
await createUserWithEmailAndPassword(
auth,
email,
password
);



const user =
userCredential.user;



await setDoc(
doc(db,"users",user.uid),
{

name:name,

email:email,

role:"customer",

createdAt:new Date()

}

);



alert("RiderX Account Created");


window.location.href="../customer/home.html";



}

catch(error){


alert(error.message);


}


};





// Login Function


window.login = async function(){


const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



try{


await signInWithEmailAndPassword(
auth,
email,
password
);



alert("Login Successful");


window.location.href="../customer/home.html";



}

catch(error){


alert(error.message);


}


};
