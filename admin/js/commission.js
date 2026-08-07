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






const percent =
document.getElementById("percent");


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

admin.data().role!=="admin"

){


alert(
"Access Denied"
);



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


percent.value =

snap.data().percent || 20;



}

else{


percent.value=20;


}



}

catch(error){


console.log(error);


}



}









// ===============================
// SAVE COMMISSION
// ===============================


save.onclick =
async()=>{


try{


let value =
Number(
percent.value
);



if(value < 0 || value > 100){


alert(
"Commission 0-100 ke beech hona chahiye"
);


return;


}







await setDoc(

doc(
db,
"settings",
"commission"

),

{


percent:value,


updatedAt:

new Date()



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
