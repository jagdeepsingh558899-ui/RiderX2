// =================================
// RiderX Customer Ride Tracking
// Status + Rider Details
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
onValue

} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





let customerId = null;

let activeRide = null;





onAuthStateChanged(

auth,

(user)=>{


if(user){


customerId = user.uid;


listenRide();


}



});







// Find Customer Ride


function listenRide(){



const ridesRef =

ref(

rtdb,

"rides"

);





onValue(

ridesRef,

(snapshot)=>{



snapshot.forEach((child)=>{



const ride = child.val();





if(

ride.customerId === customerId

&&

ride.status !== "completed"

){



activeRide = child.key;



showRideStatus(ride);



}






});



});



}









function showRideStatus(ride){



const status =

document.getElementById("rideStatus");



const riderInfo =

document.getElementById("riderInfo");





if(!status)

return;






if(ride.status==="searching"){



status.innerHTML =

"🔍 Searching Rider...";



}






if(ride.status==="accepted"){



status.innerHTML =

"🏍 Rider Found";





getRiderDetails(

ride.riderId

);



if(window.RiderXTracking){



window.RiderXTracking.start();


window.RiderXTracking.rider(

ride.riderId

);



}




}





}








// Rider Details


function getRiderDetails(id){



const riderRef =

ref(

rtdb,

"riders/"+id

);






onValue(

riderRef,

(snapshot)=>{


const data = snapshot.val();



if(data){



document.getElementById("riderInfo").innerHTML = `


<h3>Rider Details</h3>

<p>

🏍 Rider ID: ${id}

</p>


<p>

📍 Live Tracking Active

</p>


`;



}



}



);



}
