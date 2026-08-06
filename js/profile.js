// =================================
// RiderX Profile System
// Load + Update + Logout
// =================================


import {

auth,
db

} from "../firebase/Firebase-config.js";


import {

onAuthStateChanged,
signOut

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

doc,
getDoc,
updateDoc

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





let userId = null;





// Load Profile


onAuthStateChanged(

auth,

async(user)=>{


if(user){


userId = user.uid;



const userRef =

doc(

db,

"users",

user.uid

);





const userSnap =

await getDoc(userRef);





if(userSnap.exists()){



const data = userSnap.data();





document.getElementById("userName").innerHTML =

data.name || "User";



document.getElementById("userEmail").innerHTML =

data.email;



document.getElementById("name").value =

data.name || "";



document.getElementById("phone").value =

data.phone || "";



document.getElementById("email").value =

data.email || "";



}



}



});









// Save Profile


const saveBtn =

document.getElementById("saveProfile");





if(saveBtn){



saveBtn.onclick = async()=>{





const name =

document.getElementById("name").value;



const phone =

document.getElementById("phone").value;






await updateDoc(

doc(

db,

"users",

userId

),


{


name:name,

phone:phone



}



);



alert(

"Profile Updated Successfully"

);



};

}









// Logout


const logout =

document.getElementById("logout");





if(logout){



logout.onclick = ()=>{



signOut(auth)

.then(()=>{


window.location.href =

"../auth/login.html";


});



};



}
