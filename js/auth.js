// RiderX Authentication Guard
// Firebase v10.8.0 Compatible


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
// ROLE REDIRECT
// ===============================


async function redirectByRole(uid){


try{


const snap =
await getDoc(
doc(db,"users",uid)
);



if(!snap.exists()){


console.log("User profile missing");

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
"Role Redirect Error:",
error
);


}



}







// ===============================
// AUTH CHECK
// ===============================


onAuthStateChanged(
auth,
(user)=>{


const path =
window.location.pathname;



if(user){


if(
path.includes("/auth/")
||
path.endsWith("index.html")
||
path==="/"
){


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



});







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
