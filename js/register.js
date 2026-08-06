// =====================================
// RiderX Register System
// Customer + Rider
// =====================================


import {

auth,

db

}

from "../firebase/config.js";



import {

createUserWithEmailAndPassword

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,

setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// =====================================
// ROLE SELECT
// =====================================


let selectedRole="customer";



const customerRole =

document.getElementById(
"customerRole"
);



const riderRole =

document.getElementById(
"riderRole"
);





if(customerRole){


customerRole.onclick=()=>{


selectedRole="customer";


customerRole.classList.add(
"active"
);


riderRole.classList.remove(
"active"
);


};


}




if(riderRole){


riderRole.onclick=()=>{


selectedRole="rider";


riderRole.classList.add(
"active"
);


customerRole.classList.remove(
"active"
);


};


}








// =====================================
// REGISTER
// =====================================


const registerBtn =

document.getElementById(
"registerBtn"
);





if(registerBtn){



registerBtn.onclick=async()=>{


const name =

document.getElementById(
"name"
).value;



const phone =

document.getElementById(
"phone"
).value;



const email =

document.getElementById(
"email"
).value;



const password =

document.getElementById(
"password"
).value;





if(
!name ||
!phone ||
!email ||
!password

){


alert(
"Please fill all details"
);


return;

}





try{



const userCredential =

await createUserWithEmailAndPassword(

auth,

email,

password

);



const user =

userCredential.user;






await setDoc(

doc(
db,
"users",
user.uid
),


{


uid:user.uid,


name:name,


phone:phone,


email:email,


role:selectedRole,


createdAt:
new Date()



}


);






alert(
"Account Created Successfully"
);





if(selectedRole==="rider"){



window.location.href =

"../rider/home.html";



}

else{



window.location.href =

"../customer/home.html";



}




}



catch(error){



alert(
error.message
);



}



};



}
