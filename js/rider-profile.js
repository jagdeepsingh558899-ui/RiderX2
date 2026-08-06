// =====================================
// RiderX Rider Profile System
// =====================================


import {

auth,

db

}

from "../firebase/config.js";



import {

onAuthStateChanged,

signOut

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,

getDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";








const nameBox =

document.getElementById("name");



const emailBox =

document.getElementById("email");



const phoneBox =

document.getElementById("phone");



const vehicleBox =

document.getElementById("vehicle");



const licenseBox =

document.getElementById("license");



const logoutBtn =

document.getElementById("logout");









// =====================================
// LOAD RIDER PROFILE
// =====================================



onAuthStateChanged(auth,async(user)=>{



if(!user){



window.location.href=

"../auth/login.html";


return;


}







try{



const snap =

await getDoc(

doc(

db,

"users",

user.uid

)

);







if(snap.exists()){



const data = snap.data();




nameBox.innerHTML =

data.name || "Rider";



emailBox.innerHTML =

data.email || user.email;



phoneBox.innerHTML =

data.phone || user.phoneNumber || "Not Added";



vehicleBox.innerHTML =

data.vehicle || "Not Added";



licenseBox.innerHTML =

data.license || "Not Added";



}



}



catch(error){


console.log(error);


}



});









// =====================================
// LOGOUT
// =====================================



if(logoutBtn){



logoutBtn.onclick=async()=>{


try{


await signOut(auth);



alert(

"Logout Successful"

);



window.location.href=

"../auth/login.html";



}


catch(error){



alert(
error.message
);



}



};



}
