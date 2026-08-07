// =====================================
// RiderX Admin Fare Settings
// Firebase v10
// =====================================


import {
    auth,
    db
} from "../firebase/firebase-config.js";


import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";




// ===============================
// ELEMENTS
// ===============================


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



let currentAdmin = null;



// ===============================
// ADMIN SECURITY CHECK
// ===============================


onAuthStateChanged(
auth,
async(user)=>{


if(!user){

window.location.href="../auth/login.html";
return;

}



const adminSnap =
await getDoc(
doc(db,"users",user.uid)
);



if(!adminSnap.exists()){

window.location.href="../index.html";
return;

}



const adminData =
adminSnap.data();



if(adminData.role !== "admin"){

alert("Access Denied");

window.location.href="../customer/home.html";

return;

}



currentAdmin = user.uid;


loadFare();


});





// ===============================
// LOAD FARE
// ===============================


async function loadFare(){


try{


const snap =
await getDoc(
doc(db,"settings","fare")
);



if(!snap.exists()){

clearFields();
return;

}



const data =
snap.data();



const selectedService =
service.value;



updateFields(
data[selectedService]
);



}

catch(error){

console.log(
"Fare Load Error:",
error
);

}



}






// ===============================
// SERVICE CHANGE
// ===============================


service.addEventListener(
"change",
()=>{

loadFare();

});






// ===============================
// UPDATE INPUTS
// ===============================


function updateFields(data){


if(!data){

clearFields();
return;

}



baseFare.value =
data.baseFare ?? 0;


dayRate.value =
data.dayRate ?? 0;


extraRate.value =
data.extraRate ?? 0;


nightRate.value =
data.nightRate ?? 0;


}






function clearFields(){

baseFare.value=0;
dayRate.value=0;
extraRate.value=0;
nightRate.value=0;

}







// ===============================
// SAVE FARE
// ===============================


saveBtn.onclick =
async()=>{


try{


const serviceName =
service.value;



const fareData = {


baseFare:
Number(baseFare.value || 0),


dayRate:
Number(dayRate.value || 0),


extraRate:
Number(extraRate.value || 0),


nightRate:
Number(nightRate.value || 0),


updatedBy:
currentAdmin,


updatedAt:
new Date()


};





if(
isNaN(fareData.baseFare) ||
isNaN(fareData.dayRate) ||
isNaN(fareData.extraRate) ||
isNaN(fareData.nightRate)
){

status.innerHTML=
"❌ Invalid Fare Value";

return;

}





// SAVE CURRENT FARE

await setDoc(

doc(
db,
"settings",
"fare"
),

{

[serviceName]:
fareData

},

{

merge:true

}

);







// SAVE HISTORY


await addDoc(

collection(
db,
"fare_history"
),

{


service:
serviceName,


fare:
fareData,


admin:
currentAdmin,


time:
serverTimestamp()


}

);






status.innerHTML =
"✅ Fare Updated Successfully";



setTimeout(()=>{

status.innerHTML="";

},3000);



}



catch(error){


console.log(error);


status.innerHTML =
"❌ "+error.message;


}



};
