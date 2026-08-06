// =====================================
// RiderX Registration System
// =====================================


import { auth, db } from "../firebase/config.js";


import {

createUserWithEmailAndPassword

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,
setDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const nameBox =
document.getElementById("name");


const emailBox =
document.getElementById("email");


const passwordBox =
document.getElementById("password");


const roleBox =
document.getElementById("role");


const registerBtn =
document.getElementById("registerBtn");







registerBtn.onclick = async()=>{


let name =
nameBox.value.trim();


let email =
emailBox.value.trim();


let password =
passwordBox.value.trim();


let role =
roleBox.value;





if(!name || !email || !password){

alert(
"Sabhi details fill karo"
);

return;

}





try{


const userCredential = await createUserWithEmailAndPassword(

auth,

email,

password

);



const user = userCredential.user;





await setDoc(

doc(db,"users",user.uid),

{


name:name,


email:email,


role:role,


createdAt:serverTimestamp()


}

);





localStorage.setItem(

"role",

role

);





alert(
"Account Created Successfully ✅"
);





if(role==="rider"){


window.location.href="../rider/dashboard.html";


}

else{


window.location.href="../customer/dashboard.html";


}





}

catch(error){


alert(

error.message

);


}



};
