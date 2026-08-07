// RiderX Core Application Controller
// Firebase v10.8.0 Compatible


import {
    auth,
    db,
    storage
} from "../firebase/firebase-config.js";


import {
    onAuthStateChanged,
    signOut
} 
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


import {
    doc,
    getDoc
}
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";





window.RiderXState = {

    currentUser:null,

    userRole:"guest",

    isOnline:navigator.onLine,

    theme:
    localStorage.getItem("riderx_theme") || "dark",

    language:
    localStorage.getItem("riderx_lang") || "en"

};







// ===============================
// APP START
// ===============================


export function initApp(){


console.log(
"RiderX App Started"
);



setupNetwork();



checkAuth();



}





// ===============================
// AUTH STATE
// ===============================


function checkAuth(){


onAuthStateChanged(
auth,
async(user)=>{


if(user){


window.RiderXState.currentUser=user;


await getUserRole(user.uid);



}


else{


window.RiderXState.currentUser=null;

window.RiderXState.userRole="guest";


}



});


}







// ===============================
// ROLE
// ===============================


async function getUserRole(uid){



try{


const snap =
await getDoc(
doc(db,"users",uid)
);



if(!snap.exists()){


window.RiderXState.userRole="guest";

return;


}



const data =
snap.data();



window.RiderXState.userRole =
data.role || "customer";



}

catch(error){


console.log(error);


}



}







// ===============================
// LOGOUT
// ===============================


export async function logout(){


await signOut(auth);


localStorage.clear();


sessionStorage.clear();



location.href =
"../auth/login.html";


}







// ===============================
// NAVIGATION
// ===============================


export function navigate(url){


location.href=url;


}







// ===============================
// THEME
// ===============================


export function toggleTheme(){


let theme =
window.RiderXState.theme==="dark"
?
"light"
:
"dark";



window.RiderXState.theme=theme;


localStorage.setItem(
"riderx_theme",
theme
);


document.documentElement.classList.toggle(
"dark",
theme==="dark"
);


}







// ===============================
// NETWORK
// ===============================


function setupNetwork(){


window.addEventListener(
"online",
()=>{

window.RiderXState.isOnline=true;

console.log("Online");

});


window.addEventListener(
"offline",
()=>{

window.RiderXState.isOnline=false;

console.log("Offline");

});


}








// AUTO START


if(
document.readyState==="loading"
){

document.addEventListener(
"DOMContentLoaded",
initApp
);


}
else{


initApp();


}
