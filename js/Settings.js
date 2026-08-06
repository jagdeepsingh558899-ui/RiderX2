
// ==========================================
// RiderX Settings System V1
// Dark Mode + Language + Logout + Install
// ==========================================


import { auth } from "../firebase/config.js";


import {

signOut

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const darkMode =
document.getElementById("darkMode");


const notifications =
document.getElementById("notifications");


const language =
document.getElementById("language");


const logout =
document.getElementById("logout");


const installBtn =
document.getElementById("installApp");






// DARK MODE


if(localStorage.getItem("darkMode")==="off"){

darkMode.checked=false;

}




darkMode.onchange=()=>{


if(darkMode.checked){


localStorage.setItem(
"darkMode",
"on"
);


document.body.style.background="#000";


}

else{


localStorage.setItem(
"darkMode",
"off"
);


document.body.style.background="#fff";


}


};









// NOTIFICATION


notifications.onchange=()=>{


localStorage.setItem(

"notifications",

notifications.checked

);


};









// LANGUAGE


language.value=

localStorage.getItem("language")
||
"English";




language.onchange=()=>{


localStorage.setItem(

"language",

language.value

);


};









// LOGOUT


logout.onclick=async()=>{


await signOut(auth);


location.href="../auth/login.html";


};









// PWA INSTALL


let deferredPrompt;



window.addEventListener(

"beforeinstallprompt",

(e)=>{


e.preventDefault();


deferredPrompt=e;



if(installBtn){

installBtn.style.display="flex";

}



});






installBtn.onclick=async()=>{


if(!deferredPrompt)

return;



deferredPrompt.prompt();



await deferredPrompt.userChoice;



deferredPrompt=null;



};







console.log(

"RiderX Settings JS Loaded"

);
