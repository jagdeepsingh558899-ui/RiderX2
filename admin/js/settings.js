// =====================================
// RiderX Admin App Settings
// Firebase v10
// =====================================


import {

auth,
db

}
from "../../firebase/firebase-config.js";



import {

onAuthStateChanged

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";



import {

doc,
getDoc,
setDoc

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";






const appName =
document.getElementById("appName");


const support =
document.getElementById("support");


const referral =
document.getElementById("referral");



const bike =
document.getElementById("bike");


const cab =
document.getElementById("cab");


const parcel =
document.getElementById("parcel");


const food =
document.getElementById("food");


const maintenance =
document.getElementById("maintenance");



const save =
document.getElementById("save");


const status =
document.getElementById("status");







// ===============================
// ADMIN CHECK
// ===============================


onAuthStateChanged(

auth,

async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}




const admin =
await getDoc(

doc(
db,
"users",
user.uid

)

);



if(

!admin.exists()

||

admin.data().role !== "admin"

){


alert("Access Denied");


location.href="../customer/home.html";


return;


}



loadSettings();


});







// ===============================
// LOAD SETTINGS
// ===============================


async function loadSettings(){


try{


const snap =
await getDoc(

doc(
db,
"settings",
"app"

)

);



if(snap.exists()){


const data =
snap.data();



appName.value =
data.appName || "RiderX";


support.value =
data.support || "";


referral.value =
data.referral || 0;



bike.checked =
data.bike ?? true;


cab.checked =
data.cab ?? true;


parcel.checked =
data.parcel ?? true;


food.checked =
data.food ?? true;


maintenance.checked =
data.maintenance ?? false;



}

else{


bike.checked=true;

cab.checked=true;

parcel.checked=true;

food.checked=true;


}



}

catch(error){


console.log(error);


}



}







// ===============================
// SAVE SETTINGS
// ===============================


save.onclick =
async()=>{


try{


await setDoc(

doc(
db,
"settings",
"app"

),

{


appName:
appName.value,


support:
support.value,


referral:
Number(
referral.value || 0
),



bike:
bike.checked,


cab:
cab.checked,


parcel:
parcel.checked,


food:
food.checked,


maintenance:
maintenance.checked



}

);



status.innerHTML =
"✅ Settings Saved";



setTimeout(()=>{


status.innerHTML="";


},3000);



}

catch(error){


status.innerHTML =
error.message;


}



};
