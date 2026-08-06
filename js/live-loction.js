// =================================
// RiderX Live Location System
// Customer + Rider GPS Update
// =================================


import {

auth,
rtdb

} from "../firebase/Firebase-config.js";


import {

onAuthStateChanged

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {

ref,
set

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





let currentUser = null;





onAuthStateChanged(

auth,

(user)=>{


if(user){

currentUser = user;


startLocationTracking();


}


});







function startLocationTracking(){



if(!navigator.geolocation){


console.log(
"GPS not supported"
);


return;


}






navigator.geolocation.watchPosition(


(position)=>{



const lat =

position.coords.latitude;



const lng =

position.coords.longitude;






saveLocation(

lat,

lng

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







function saveLocation(

lat,

lng

){



if(!currentUser)

return;





// User role check

const role =

localStorage.getItem("role");





let path = "customers";



if(role==="rider"){


path="riders";


}







set(

ref(

rtdb,

`${path}/${currentUser.uid}`

),


{


lat:lat,


lng:lng,


updatedAt:

Date.now()



}



);



}
