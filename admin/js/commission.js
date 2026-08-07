// =======================================
// RiderX Admin Commission Settings
// Firebase v10
// =======================================


import {
auth,
db
}
from "../../firebase/firebase-config.js";


import {

doc,
getDoc,
setDoc

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


import {

onAuthStateChanged

}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";





const input =
document.getElementById(
"commissionPercent"
);


const saveBtn =
document.getElementById(
"saveCommission"
);


const status =
document.getElementById(
"status"
);



let adminUID=null;





// ==========================
// ADMIN CHECK
// ==========================


onAuthStateChanged(
auth,
async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}




const adminSnap =
await getDoc(
doc(db,"users",user.uid)
);



if(
!adminSnap.exists() ||
adminSnap.data().role!=="admin"
){


alert("Access Denied");


location.href="../customer/home.html";


return;

}



adminUID=user.uid;


loadCommission();


});







// ==========================
// LOAD
// ==========================


async function loadCommission(){


try{


const snap =
await getDoc(
doc(db,"settings","commission")
);



if(snap.exists()){


input.value =
snap.data().percent || 20;


}
else{


input.value=20;


}



}

catch(error){

console.log(error);

}


}







// ==========================
// SAVE
// ==========================


saveBtn.onclick =
async()=>{


try{


let value =
Number(input.value);



if(
value < 0 ||
value > 100
){


status.innerHTML=
"❌ Commission 0-100% ke beech honi chahiye";


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


updatedBy:adminUID,


updatedAt:new Date()


}


);





status.innerHTML=
"✅ Commission Updated";



setTimeout(()=>{

status.innerHTML="";

},3000);



}

catch(error){


status.innerHTML=
"❌ "+error.message;


}


};
