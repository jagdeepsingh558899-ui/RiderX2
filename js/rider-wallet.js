// =================================
// RiderX Rider Wallet & Earnings
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





let riderId = null;






onAuthStateChanged(

auth,

(user)=>{


if(user){


riderId = user.uid;


loadEarnings();



}



});








function loadEarnings(){



const ridesRef =

ref(

rtdb,

"rides"

);





onValue(

ridesRef,

(snapshot)=>{



let total = 0;

let today = 0;

let count = 0;



const transactionBox =

document.getElementById("transactions");



if(transactionBox)

transactionBox.innerHTML="";







snapshot.forEach((child)=>{



const ride = child.val();






if(

ride.riderId === riderId

&&

ride.status==="completed"

){



count++;





total += Number(

ride.fare || 0

);






let date =

new Date(

ride.createdAt

);






let now =

new Date();






if(

date.toDateString() === now.toDateString()

){



today += Number(

ride.fare || 0

);



}







if(transactionBox){



transactionBox.innerHTML += `



<div class="booking-card">


<h3>

${ride.service}

</h3>



<p>

${ride.pickup}

➡️

${ride.drop}

</p>



<h3>

₹${ride.fare}

</h3>



<small>

${date.toLocaleString()}

</small>


</div>



`;



}





}





});







document.getElementById("totalEarning").innerHTML =

"₹"+total;





document.getElementById("todayEarning").innerHTML =

"₹"+today;





document.getElementById("rideCount").innerHTML =

count;





}



);



}
