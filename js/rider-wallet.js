// =====================================
// RiderX Rider Wallet System
// Earnings Calculator
// =====================================


import {

db,
auth

}

from "../firebase/config.js";



import {


collection,

query,

where,

onSnapshot


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";






const totalBox =

document.getElementById(
"total"
);



const todayBox =

document.getElementById(
"today"
);



const ridesBox =

document.getElementById(
"rides"
);





const transactionBox =

document.getElementById(
"transactions"
);









function loadWallet(){



const user = auth.currentUser;



if(!user){

return;

}







const q = query(

collection(
db,
"rides"
),


where(
"riderId",
"==",
user.uid
),


where(
"status",
"==",
"completed"
)


);









onSnapshot(q,(snapshot)=>{



let total=0;

let today=0;

let count=0;



transactionBox.innerHTML="";




const currentDate =

new Date()
.toDateString();







snapshot.forEach(doc=>{



const ride = doc.data();



count++;




let fare =

Number(

ride.fare
.replace("₹","")

);



total += fare;



if(

ride.completedAt &&

ride.completedAt.toDate()
.toDateString()
===currentDate

){


today += fare;


}






transactionBox.innerHTML +=



`

<div class="transaction">


🏍 ${ride.service}


<br>


💰 ₹${fare}


</div>


`;



});








totalBox.innerHTML =

"₹"+total;



todayBox.innerHTML =

"₹"+today;



ridesBox.innerHTML =

count;







if(count===0){


transactionBox.innerHTML=

"No transactions yet";


}




});



}









auth.onAuthStateChanged(()=>{


loadWallet();


});
