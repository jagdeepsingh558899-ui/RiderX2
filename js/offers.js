// =====================================
// RiderX Admin Offer System
// =====================================


import {

db

}

from "../firebase/config.js";



import {


collection,

addDoc,

getDocs,

serverTimestamp


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";







const saveBtn =

document.getElementById(
"saveOffer"
);



const offersBox =

document.getElementById(
"offers"
);









// =====================================
// CREATE OFFER
// =====================================



if(saveBtn){



saveBtn.onclick = async()=>{



const code =

document.getElementById(
"code"
).value;



const discount =

document.getElementById(
"discount"
).value;



const type =

document.getElementById(
"type"
).value;



const expiry =

document.getElementById(
"expiry"
).value;



const status =

document.getElementById(
"status"
).value;






if(!code || !discount){



alert(
"Fill all details"
);


return;


}







try{



await addDoc(

collection(
db,
"offers"
),


{


code:code.toUpperCase(),


discount:discount,


type:type,


expiry:expiry,


status:status,


createdAt:
serverTimestamp()



}


);





alert(

"Offer Created"

);



loadOffers();



}



catch(error){



alert(
error.message
);



}



};



}









// =====================================
// LOAD OFFERS
// =====================================



async function loadOffers(){



try{



const snap =

await getDocs(

collection(
db,
"offers"
)

);






if(snap.empty){



offersBox.innerHTML=

"No Offers";

return;


}







offersBox.innerHTML="";






snap.forEach(doc=>{



const offer = doc.data();





offersBox.innerHTML +=



`

<div class="offer">


<b>

${offer.code}

</b>


<br>


Discount:

${offer.discount}

${

offer.type==="percent"

?

"%"

:

"₹"

}



<br>


Expiry:

${offer.expiry}


<br>


Status:

${offer.status}



</div>


`;



});





}



catch(error){



console.log(error);



}



}







loadOffers();
