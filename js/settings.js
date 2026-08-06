// =====================================
// RiderX Admin Settings System
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








const settingsRef =

doc(

db,

"settings",

"app"

);









const fields = [

"appName",

"supportNumber",

"bikeService",

"cabService",

"parcelService",

"foodService",

"cashPayment",

"onlinePayment",

"maintenance"

];









// =====================================
// LOAD SETTINGS
// =====================================



async function loadSettings(){



try{



const snap =

await getDoc(

settingsRef

);






if(snap.exists()){



const data = snap.data();





fields.forEach(field=>{



const element =

document.getElementById(field);





if(element){



element.value =

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
// SAVE SETTINGS
// =====================================



const saveBtn =

document.getElementById(
"saveSettings"
);






if(saveBtn){



saveBtn.onclick = async()=>{



let settings={};






fields.forEach(field=>{



settings[field] =

document.getElementById(field).value;



});








try{



await setDoc(

settingsRef,

settings,

{

merge:true

}

);






alert(

"Settings Saved Successfully"

);



}



catch(error){



alert(

error.message

);



}



};



}








loadSettings();
