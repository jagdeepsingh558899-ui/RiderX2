// =================================
// RiderX Login System
// Firebase Authentication
// =================================



import {

auth,
db

} from "../firebase/Firebase-config.js";



import {

signInWithEmailAndPassword,
onAuthStateChanged

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,
getDoc

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const loginForm =
document.getElementById("loginForm");


const message =
document.getElementById("message");





if(loginForm){



loginForm.addEventListener(

"submit",

async(e)=>{


e.preventDefault();




const email =
document.getElementById("email").value.trim();



const password =
document.getElementById("password").value;





try{



message.innerHTML =
"Logging in...";





const userCredential =

await signInWithEmailAndPassword(

auth,

email,

password

);





const user = userCredential.user;






// Get User Role From Firestore


const userDoc =

await getDoc(

doc(

db,

"users",

user.uid

)

);






if(userDoc.exists()){



const data =
userDoc.data();



message.innerHTML =
"Login Successful";





setTimeout(()=>{



if(data.role==="rider"){



window.location.href =
"../rider/home.html";



}



else if(data.role==="admin"){



window.location.href =
"../admin/dashboard.html";



}



else{



window.location.href =
"../customer/home.html";



}



},1000);




}

else{


message.innerHTML =
"User profile not found";


}




}



catch(error){


message.innerHTML =
error.message;


}



}


);


}
