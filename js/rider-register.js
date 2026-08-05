// =================================
// RiderX Rider Registration
// =================================


import { auth, db } from "../firebase/config.js";


import {

createUserWithEmailAndPassword

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
setDoc

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";






// Register Rider


export async function registerRider(

name,
email,
password,
vehicle

){


try{


const user = await createUserWithEmailAndPassword(

auth,

email,

password

);



await setDoc(

doc(

db,

"users",

user.user.uid

),

{


name:name,

email:email,

role:"rider",

vehicle:vehicle,

status:"Pending",

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
