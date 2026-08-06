// =====================================
// RiderX App Controller
// Auto Login + Role Redirect
// =====================================


import {

auth,

db

}

from "../firebase/config.js";



import {

onAuthStateChanged

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

doc,

getDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";









onAuthStateChanged(auth, async(user)=>{



if(!user){



return;


}







try{



const userSnap =

await getDoc(

doc(

db,

"users",

user.uid

)

);







if(userSnap.exists()){



const data = userSnap.data();







// ===================
// BLOCK CHECK
// ===================



if(data.status==="blocked"){



alert(

"Your account is blocked"

);



return;


}







// ===================
// ROLE REDIRECT
// ===================



if(data.role==="customer"){



window.location.href=

"customer/home.html";



}







else if(data.role==="rider"){



window.location.href=

"rider/home.html";



}







else if(data.role==="admin"){



window.location.href=

"admin/dashboard.html";



}





}



}



catch(error){



console.log(error);



}



});
