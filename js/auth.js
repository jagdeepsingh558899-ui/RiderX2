// =================================
// RiderX Authentication System
// =================================


import { auth, db } from "../firebase/config.js";


import {

createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signOut

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
setDoc,
getDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Register User

export async function registerUser(
name,
email,
password,
role
){

try{


const userCredential =
await createUserWithEmailAndPassword(
auth,
email,
password
);



await setDoc(

doc(
db,
"users",
userCredential.user.uid
),

{

name:name,

email:email,

role:role,

createdAt:new Date()

}

);



return true;


}

catch(error){

console.log(error);

return false;

}


}





// Login User


export async function loginUser(
email,
password
){


try{


const userCredential =
await signInWithEmailAndPassword(
auth,
email,
password
);



const userDoc =
await getDoc(

doc(
db,
"users",
userCredential.user.uid
)

);



if(userDoc.exists()){


return userDoc.data();


}


return null;


}

catch(error){

console.log(error);

return null;

}


}





// Logout


export async function logoutUser(){


await signOut(auth);


window.location.href="../index.html";


}
