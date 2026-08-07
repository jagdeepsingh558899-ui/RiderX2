// RiderX Authentication System
// Firebase v10 Modular SDK
// Customer + Rider + Admin Role Management


import {

auth,
db,
signOut,
onAuthStateChanged,
doc,
getDoc

}

from "../firebase/firebase-config.js";





// ===============================
// ROLE BASED REDIRECT
// ===============================

async function redirectByRole(uid){


try{


const userRef =
doc(db,"users",uid);


const snap =
await getDoc(userRef);



if(!snap.exists()){

console.log("User profile not found");
return;

}



const user =
snap.data();





if(user.role==="admin"){


window.location.href =
"../admin/dashboard.html";


}





else if(user.role==="rider"){



if(user.approved===true && user.status==="active"){


window.location.href =
"../rider/home.html";


}

else{


window.location.href =
"../rider/pending.html";


}


}





else{


window.location.href =
"../customer/home.html";


}



}

catch(error){

console.error(
"Redirect Error:",
error
);

}


}








// ===============================
// LOGIN SESSION CHECK
// ===============================


onAuthStateChanged(
auth,
(user)=>{


const path =
window.location.pathname;



if(user){



if(path.includes("/auth/")){


redirectByRole(user.uid);


}



}

else{



if(

path.includes("/customer/") ||

path.includes("/rider/") ||

path.includes("/admin/")

){


window.location.href =
"../auth/login.html";


}



}



}

);









// ===============================
// LOGOUT
// ===============================


export async function logoutUser(){


try{


await signOut(auth);


window.location.href =
"../auth/login.html";


}

catch(error){


console.error(error);


}



}
