import { db } from "../firebase/config.js";


import {

doc,
setDoc,
getDoc,
updateDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";




// Payment


let amount =

localStorage.getItem("fare") || 0;



let amountBox =

document.getElementById("amount");


if(amountBox){

amountBox.innerHTML =
"Amount: ₹"+amount;

}




window.cashPayment=function(){


document.getElementById("message").innerHTML =

"Cash Payment Selected ✅";


};





window.upiPayment=function(){


document.getElementById("message").innerHTML =

"UPI Payment Selected ✅";


};







// Rider Wallet Example


let balanceBox =

document.getElementById("balance");



if(balanceBox){


let riderId="riderDemo";



const walletRef =

doc(

db,

"wallet",

riderId

);



getDoc(walletRef)

.then((data)=>{


if(data.exists()){


balanceBox.innerHTML =

"Balance: ₹"+data.data().balance;


}


else{


setDoc(

walletRef,

{

balance:0

}

);


}


});



}
