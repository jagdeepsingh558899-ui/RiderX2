// =====================================
// RiderX Admin Dashboard System
// =====================================


import {

db

}

from "../firebase/config.js";



import {


collection,

query,

where,

onSnapshot,

getDocs


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";







const customerBox =

document.getElementById(
"customers"
);



const riderBox =

document.getElementById(
"riders"
);



const rideBox =

document.getElementById(
"rides"
);



const revenueBox =

document.getElementById(
"revenue"
);









// =====================================
// COUNT USERS
// =====================================



async function loadUsers(){



try{



const usersSnap =

await getDocs(

collection(
db,
"users"
)

);




let customers=0;

let riders=0;






usersSnap.forEach(doc=>{


let data=doc.data();



if(data.role==="customer"){


customers++;


}



if(data.role==="rider"){


riders++;


}



});







customerBox.innerHTML=

customers;



riderBox.innerHTML=

riders;



}



catch(error){



console.log(error);



}



}









// =====================================
// LIVE RIDES
// =====================================



function loadRides(){



const q = query(

collection(
db,
"rides"
),


where(

"status",

"!=",

"completed"

)


);







onSnapshot(q,(snapshot)=>{



rideBox.innerHTML=

snapshot.size;



});



}









// =====================================
// REVENUE
// =====================================



function loadRevenue(){



const q = query(

collection(
db,
"rides"
),


where(

"status",

"==",

"completed"

)


);








onSnapshot(q,(snapshot)=>{



let total=0;



snapshot.forEach(doc=>{


const ride = doc.data();



let fare =

Number(

ride.fare?.replace("₹","")

);



total += fare;



});







revenueBox.innerHTML=

"₹"+total;



});



}









loadUsers();


loadRides();


loadRevenue();
