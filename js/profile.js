
// ==========================================
// RiderX Profile System V1
// Load + Update User Profile
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

doc,
getDoc,
setDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";







const nameInput =
document.getElementById("name");


const phoneInput =
document.getElementById("phone");


const emailInput =
document.getElementById("email");


const vehicleType =
document.getElementById("vehicleType");


const vehicleNumber =
document.getElementById("vehicleNumber");


const saveBtn =
document.getElementById("saveProfile");





let userId=null;








onAuthStateChanged(auth,async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



userId=user.uid;



phoneInput.value =
user.phoneNumber || "";



emailInput.value =
user.email || "";



loadProfile();



});









async function loadProfile(){


const ref=

doc(

db,

"users",

userId

);



const snap=

await getDoc(ref);



if(snap.exists()){


const data=snap.data();



nameInput.value =
data.name || "";



if(vehicleType){

vehicleType.value =
data.vehicleType || "Bike";

}



if(vehicleNumber){

vehicleNumber.value =
data.vehicleNumber || "";

}



}






}









saveBtn.onclick=async()=>{


if(!userId)

return;



await setDoc(

doc(

db,

"users",

userId

),

{

name:

nameInput.value,


vehicleType:

vehicleType?.value || "",


vehicleNumber:

vehicleNumber?.value || "",


updatedAt:

serverTimestamp()


},


{

merge:true

}

);



alert(

"Profile Updated ✅"

);


};






console.log(

"RiderX Profile JS Loaded"

);
