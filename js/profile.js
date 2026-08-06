// =====================================
// RiderX Customer Profile
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



const logoutBtn =

document.getElementById("logout");









// =====================================
// LOAD PROFILE
// =====================================



onAuthStateChanged(auth,async(user)=>{



if(!user){



window.location.href=

"../auth/login.html";


return;


}







try{



const userSnap =

await getDoc(

doc(

db,

"users",

user.uid

)

);






if(userSnap.exists()){



const data = userSnap.data();




nameBox.innerHTML =

data.name || "Customer";



emailBox.innerHTML =

data.email || user.email;



phoneBox.innerHTML =

data.phone || user.phoneNumber || "Not Added";



}



else{



nameBox.innerHTML=

user.email;



emailBox.innerHTML=

user.email;



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
