import { db } from "../firebase/config.js";


import {

doc,
setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



let online=false;



window.toggleOnline=function(){


online=!online;


document.getElementById("status").innerHTML =
online ? "Online 🟢" : "Offline 🔴";



alert(
online ?
"Rider is Online" :
"Rider is Offline"
);



};



window.openRequests=function(){

window.location.href="requests.html";

};



window.openProfile=function(){

window.location.href="profile.html";

};
