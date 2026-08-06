// =================================
// RiderX Rider Profile System
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
setDoc

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





let riderId = null;





// Load Rider Profile


onAuthStateChanged(

auth,

async(user)=>{


if(user){


riderId = user.uid;





const riderRef =

doc(

db,

"riders",

user.uid

);






const riderSnap =

await getDoc(riderRef);






if(riderSnap.exists()){



const data = riderSnap.data();





document.getElementById("riderName").innerHTML =

data.name || "Rider";



document.getElementById("riderEmail").innerHTML =

data.email || "";




document.getElementById("name").value =

data.name || "";



document.getElementById("phone").value =

data.phone || "";



document.getElementById("bikeModel").value =

data.bikeModel || "";



document.getElementById("vehicleNumber").value =

data.vehicleNumber || "";



document.getElementById("license").value =

data.license || "";



}



}



});









// Save Rider Profile


const saveBtn =

document.getElementById("saveRiderProfile");





if(saveBtn){



saveBtn.onclick = async()=>{





await setDoc(

doc(

db,

"riders",

riderId

),


{


name:

document.getElementById("name").value,


phone:

document.getElementById("phone").value,


bikeModel:

document.getElementById("bikeModel").value,


vehicleNumber:

document.getElementById("vehicleNumber").value,


license:

document.getElementById("license").value



},


{

merge:true

}



);





alert(

"Rider Profile Updated"

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
