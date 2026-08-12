// =====================================
// RiderX Register System
// Customer + Rider Fixed Version
// Firebase v10 Compatible
// =====================================


import {

auth,
db

} from "../firebase/firebase-config.js";


import {

createUserWithEmailAndPassword

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
setDoc,
serverTimestamp

} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";




// Default Role

let selectedRole = "customer";




// Role Buttons

const customerRole =
document.getElementById("customerRole");


const riderRole =
document.getElementById("riderRole");





if(customerRole){


customerRole.onclick=()=>{


selectedRole="customer";


customerRole.classList.add("active");


if(riderRole)
riderRole.classList.remove("active");


};



}





if(riderRole){


riderRole.onclick=()=>{


selectedRole="rider";


riderRole.classList.add("active");


if(customerRole)
customerRole.classList.remove("active");


};



}









// Register Button


const registerBtn =
document.getElementById("registerBtn");





if(registerBtn){



registerBtn.onclick = async()=>{



const name =
document.getElementById("name").value.trim();



const phone =
document.getElementById("phone").value.trim();



const email =
document.getElementById("email").value.trim();



const password =
document.getElementById("password").value;






if(
!name ||
!phone ||
!email ||
!password

){


alert("Please fill all details");

return;


}






try{



const result =

await createUserWithEmailAndPassword(

auth,

email,

password

);



const user = result.user;







const userData = {



uid:user.uid,


name:name,


phone:phone,


email:email,


role:selectedRole,


createdAt:serverTimestamp()



};







// Rider Extra Data


if(selectedRole==="rider"){



userData.approved=false;


userData.status="pending";


userData.vehicleType="bike";


userData.rating=5;


userData.totalRides=0;



}






// Save Main User Collection


await setDoc(

doc(
db,
"users",
user.uid
),

userData

);








// Also Save Role Collection



if(selectedRole==="rider"){



await setDoc(

doc(
db,
"riders",
user.uid
),

userData

);



alert(
"Rider Account Created. Wait For Approval"
);



window.location.href="../rider/pending.html";



}

else{



await setDoc(

doc(
db,
"customers",
user.uid
),

userData

);



alert(
"Customer Account Created"
);



window.location.href="../customer/home.html";



}






}



catch(error){



console.error(error);


alert(error.message);



}




};



}
