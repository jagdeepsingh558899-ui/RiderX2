// RiderX Authentication Guard
// Firebase v10 Compatible

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

const snap = await getDoc(
doc(db,"users",uid)
);


if(!snap.exists()){

console.log("User profile missing");
return;

}


const user = snap.data();


if(user.role==="admin"){

window.location.href="../admin/dashboard.html";

}


else if(user.role==="rider"){


if(user.approved===true){

window.location.href="../rider/home.html";

}

else{

window.location.href="../rider/pending.html";

}


}


else{


window.location.href="../customer/home.html";


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
// AUTH CHECK
// ===============================

onAuthStateChanged(
auth,
(user)=>{


if(!user){

return;

}


const path =
window.location.pathname;



if(path.includes("/auth/")){


redirectByRole(user.uid);


}



});






// ===============================
// LOGOUT
// ===============================

export async function logoutUser(){


try{

await signOut(auth);

window.location.href="../auth/login.html";


}

catch(error){

console.error(error);

}


}
