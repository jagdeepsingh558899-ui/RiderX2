// =====================================
// RiderX Admin Pricing System
// =====================================


import {

db

}

from "../firebase/config.js";



import {


doc,

getDoc,

setDoc


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";







const pricingRef =

doc(

db,

"settings",

"pricing"

);









const fields = [

"bikeRate",

"bikeLongRate",

"bikeNightRate",

"cabRate",

"parcelRate",

"foodRate",

"platformCommission",

"riderCommission",

"minimumFare"

];









// =====================================
// LOAD PRICING
// =====================================



async function loadPricing(){



try{



const snap =

await getDoc(

pricingRef

);






if(snap.exists()){



const data = snap.data();





fields.forEach(field=>{


if(document.getElementById(field)){



document.getElementById(field).value =

data[field] || "";



}



});



}



}



catch(error){



console.log(error);



}



}









// =====================================
// SAVE PRICING
// =====================================



const saveBtn =

document.getElementById(
"savePricing"
);






if(saveBtn){



saveBtn.onclick = async()=>{



let pricing = {};





fields.forEach(field=>{



pricing[field] =

document.getElementById(field).value;



});







try{



await setDoc(

pricingRef,

pricing,

{

merge:true

}

);






alert(

"Pricing Updated Successfully"

);



}



catch(error){



alert(

error.message

);



}



};



}








loadPricing();
