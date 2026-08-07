// =====================================
// RiderX Authentication System
// Customer + Rider + Admin Redirect
// Firebase v10 Compatible
// =====================================


import {

auth,
db

} from "../firebase/firebase-config.js";


import {

onAuthStateChanged,
signOut

} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


import {

doc,
getDoc

} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";




// =====================================
// ROLE REDIRECT
// =====================================


async function redirectByRole(uid){


try{


const userSnap = await getDoc(

doc(
db,
"users",
uid
)

);





if(!userSnap.exists()){


console.log(
"User data not found"
);


return;


}





const user = userSnap.data();





// ADMIN

if(user.role==="admin"){


window.location.href =
"../admin/dashboard.html";


return;


}







// RIDER

if(user.role==="rider"){



if(
user.approved===true &&
user.status==="active"

){


window.location.href =
"../rider/home.html";


}

else{


window.location.href =
"../rider/pending.html";


}



return;


}







// CUSTOMER


window.location.href =
"../customer/home.html";





}


catch(error){


console.error(
"Redirect Error:",
error
);


}



}








// =====================================
// AUTH CHECK
// =====================================


onAuthStateChanged(

auth,

(user)=>{


if(user){


redirectByRole(
user.uid
);



}

else{


const path =
window.location.pathname;



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









// =====================================
// LOGOUT
// =====================================


export async function logoutUser(){


try{


await signOut(auth);


window.location.href =
"../auth/login.html";


}

catch(error){


console.log(error);


}



}
