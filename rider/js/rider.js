// ======================================
// RiderX Rider Profile System
// Final Firebase Version
// ======================================

import { auth, db, storage } 
from "../../firebase/firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


let riderId = null;


// ================================
// AUTH CHECK
// ================================

onAuthStateChanged(auth, async(user)=>{

    if(!user){

        window.location.href="../auth/rider-login.html";
        return;

    }


    riderId = user.uid;

    loadProfile();

});




// ================================
// LOAD PROFILE
// ================================

async function loadProfile(){

try{


const riderRef = doc(db,"riders",riderId);

const snap = await getDoc(riderRef);



if(!snap.exists()){

alert("Rider profile not found");
return;

}



const data = snap.data();



document.getElementById("headerFullName").innerText =
data.fullName || "RiderX Captain";


document.getElementById("headerRiderId").innerText =
"ID: RX-"+riderId.substring(0,6).toUpperCase();


document.getElementById("headerVehicleType").innerText =
data.vehicleType || "BIKE";


document.getElementById("headerRating").innerText =
data.rating || "5.0";


document.getElementById("headerTripsCount").innerText =
(data.totalTrips || 0)+" Rides";



document.getElementById("inputFullName").value =
data.fullName || "";



document.getElementById("inputPhone").value =
data.phone || "";



document.getElementById("inputEmail").value =
data.email || "";



document.getElementById("inputDOB").value =
data.dob || "";



document.getElementById("inputGender").value =
data.gender || "Male";



document.getElementById("inputVehicleType").value =
data.vehicleType || "BIKE";


document.getElementById("inputAddress").value =
data.address || "";



if(data.photoURL){

document.getElementById("avatarImage").src =
data.photoURL;

}



document
.getElementById("profileSkeleton")
.classList.add("hidden");


document
.getElementById("profileContent")
.classList.remove("hidden");



}
catch(error){

console.log(error);

}



}




// ================================
// UPDATE PROFILE
// ================================

window.handleProfileUpdate = async function(e){

e.preventDefault();


try{


await updateDoc(
doc(db,"riders",riderId),
{


fullName:
document.getElementById("inputFullName").value,


dob:
document.getElementById("inputDOB").value,


gender:
document.getElementById("inputGender").value,


address:
document.getElementById("inputAddress").value,


updatedAt:
serverTimestamp()


}

);



alert("Profile Updated Successfully");


loadProfile();



}
catch(error){

console.log(error);

alert("Update Failed");

}



};




// ================================
// PHOTO UPLOAD
// ================================

window.handlePhotoUpload = async function(event){


const file =
event.target.files[0];


if(!file)return;



try{


const storageRef =
ref(
storage,
"riderProfile/"+riderId
);



await uploadBytes(
storageRef,
file
);



const url =
await getDownloadURL(storageRef);



await updateDoc(
doc(db,"riders",riderId),
{

photoURL:url

}

);



document.getElementById("avatarImage").src=url;



alert("Photo Updated");


}
catch(error){

console.log(error);

alert("Photo Upload Failed");

}



};




// ================================
// LOGOUT
// ================================

window.handleLogout = async function(){


await signOut(auth);


window.location.href=
"../auth/rider-login.html";


};
