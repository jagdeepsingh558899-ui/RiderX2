// ==========================================
// RiderX Rider Live Engine V2
// Online + GPS Tracking + Active Ride
// ==========================================


import { auth, db } from "../firebase/config.js";


import {

doc,
setDoc,
updateDoc,
serverTimestamp

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const onlineBtn =
document.getElementById("onlineBtn");



let currentUser=null;

let online=false;

let watchId=null;

let activeRide=null;



// AUTH


onAuthStateChanged(auth,(user)=>{


if(!user){

location.href="../auth/login.html";

return;

}


currentUser=user;


});






// ONLINE BUTTON


onlineBtn.onclick=()=>{


if(online){

goOffline();

}
else{

goOnline();

}


};






// GO ONLINE


async function goOnline(){


online=true;


onlineBtn.innerHTML="Online";


onlineBtn.className="online";



startGPS();



}






// GO OFFLINE


async function goOffline(){


online=false;



onlineBtn.innerHTML="Offline";


onlineBtn.className="offline";



if(watchId){

navigator.geolocation.clearWatch(watchId);

}




await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{


online:false,

status:"offline",

updatedAt:serverTimestamp()


},

{
merge:true
}


);



}








// GPS TRACKING


function startGPS(){



watchId = navigator.geolocation.watchPosition(

async(position)=>{


if(!online)
return;




let location={


lat:
position.coords.latitude,


lng:
position.coords.longitude


};






await setDoc(

doc(
db,
"riders",
currentUser.uid
),

{


online:true,

status:"available",


location,


updatedAt:serverTimestamp()



},

{

merge:true

}


);






},

(error)=>{


console.log(
"GPS Error",
error
);


},


{


enableHighAccuracy:true,

maximumAge:0,

timeout:10000


}



);



}







// SEND ACTIVE RIDE LOCATION


export async function sendRideLocation(location){



if(!currentUser || !activeRide)
return;




await setDoc(

doc(

db,

"liveLocations",

activeRide

),

{


riderId:

currentUser.uid,


location,


updatedAt:
serverTimestamp()


},


{

merge:true

}


);


}








// SET ACTIVE RIDE


export function setActiveRide(id){


activeRide=id;


}




console.log(
"RiderX Live Rider Engine V2 Ready"
);
