import { db, auth } from "../firebase/config.js";


import {

doc,
setDoc,
getDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Rider Register


window.registerRider = async function(){


let user = auth.currentUser;


if(!user){

alert("Please login first");

return;

}



let data = {


uid:user.uid,


name:

document.getElementById("name").value,


bike:

document.getElementById("bike").value,


vehicleNumber:

document.getElementById("number").value,


license:

document.getElementById("license").value,


role:"rider",


status:"pending",


createdAt:new Date()


};




await setDoc(

doc(

db,

"riders",

user.uid

),

data

);



document.getElementById("message").innerHTML =

"Registration Submitted ✅ Waiting For Approval";



};






// Show Profile


let profile =

document.getElementById("profile");



if(profile){


let user = auth.currentUser;



if(user){


getDoc(

doc(

db,

"riders",

user.uid

)

)

.then((snap)=>{


if(snap.exists()){


let d=snap.data();



profile.innerHTML=

`

<h3>${d.name}</h3>

<p>Bike: ${d.bike}</p>

<p>Number: ${d.vehicleNumber}</p>

<p>Status: ${d.status}</p>


`;


}


});


}


}
