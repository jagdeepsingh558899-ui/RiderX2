// =====================================
// RiderX Admin Commission Settings
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






const percentInput =
document.getElementById("percent");


const saveBtn =
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



const adminSnap =
await getDoc(

doc(
db,
"users",
user.uid

)

);



if(

!adminSnap.exists()

||

adminSnap.data().role !== "admin"

){


alert("Access Denied");


location.href="../customer/home.html";


return;

}



loadCommission();


});









// ===============================
// LOAD COMMISSION
// ===============================


async function loadCommission(){


try{


const snap =
await getDoc(

doc(
db,
"settings",
"commission"

)

);



if(snap.exists()){


percentInput.value =

snap.data().percent || 20;


}

else{


percentInput.value = 20;


}



}

catch(error){


console.log(error);


}



}








// ===============================
// SAVE COMMISSION
// ===============================


saveBtn.onclick =
async()=>{


try{


const percent =
Number(
percentInput.value
);



if(percent < 0 || percent > 100){


status.innerHTML =
"Enter 0 to 100 only";


return;


}



await setDoc(

doc(
db,
"settings",
"commission"

),

{


percent:percent


}

);



status.innerHTML =
"✅ Commission Updated";



setTimeout(()=>{


status.innerHTML="";


},3000);



}

catch(error){


status.innerHTML =
error.message;


}



};
