// =====================================
// RiderX Admin Fare Settings
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





const service =
document.getElementById("service");


const baseFare =
document.getElementById("baseFare");


const dayRate =
document.getElementById("dayRate");


const extraRate =
document.getElementById("extraRate");


const nightRate =
document.getElementById("nightRate");


const saveBtn =
document.getElementById("saveFare");


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



loadFare();


});








// ===============================
// LOAD FARE
// ===============================


async function loadFare(){


try{


const snap =
await getDoc(

doc(
db,
"settings",
"fare"

)

);



if(snap.exists()){


const data =
snap.data();



setFields(
data[service.value]
);



}

else{


setDefault();


}



}

catch(error){


console.log(error);


}



}








function setFields(data){


if(!data){

setDefault();

return;

}



baseFare.value =
data.baseFare || 0;


dayRate.value =
data.dayRate || 0;


extraRate.value =
data.extraRate || 0;


nightRate.value =
data.nightRate || 0;



}







function setDefault(){


baseFare.value=30;

dayRate.value=8;

extraRate.value=9;

nightRate.value=11;


}








service.onchange = ()=>{


loadFare();


};








// ===============================
// SAVE FARE
// ===============================


saveBtn.onclick =
async()=>{


try{


const fare = {


baseFare:
Number(baseFare.value),


dayRate:
Number(dayRate.value),


extraRate:
Number(extraRate.value),


nightRate:
Number(nightRate.value)


};





await setDoc(

doc(
db,
"settings",
"fare"

),

{


[service.value]:
fare


},

{

merge:true

}

);





status.innerHTML =
"✅ Fare Updated Successfully";



setTimeout(()=>{


status.innerHTML="";


},3000);



}

catch(error){


status.innerHTML =
error.message;


}



};
