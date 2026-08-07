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
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";



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
// ADMIN CHECK
// ===============================


onAuthStateChanged(
auth,
async(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}



const snap =
await getDoc(
doc(db,"users",user.uid)
);



if(!snap.exists()){

location.href="../index.html";

return;

}



const data =
snap.data();



if(data.role!=="admin"){


alert("Access Denied");


location.href="../customer/home.html";


return;


}



currentAdmin=user.uid;



loadFare();



});









// ===============================
// LOAD FARE
// ===============================


async function loadFare(){


try{


const fareSnap =
await getDoc(
doc(
db,
"settings",
"fare"
)
);



if(fareSnap.exists()){


const data =
fareSnap.data();



updateFields(
data[service.value]
);


}



}

catch(error){

console.log(error);

}


}









service.addEventListener(
"change",
()=>{

loadFare();

});









function updateFields(data){


if(!data)
return;


baseFare.value =
data.baseFare || 0;


dayRate.value =
data.dayRate || 0;


extraRate.value =
data.extraRate || 0;


nightRate.value =
data.nightRate || 0;


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


[serviceName]:

fareData


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
