// =====================================
// RiderX Customer Wallet System
// =====================================


import {

db,
auth

}

from "../firebase/config.js";



import {


doc,

getDoc,

collection,

query,

where,

onSnapshot


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





const balanceBox =

document.querySelector(".balance");



const transactionBox =

document.querySelector(".card .transaction");








// =====================================
// LOAD WALLET
// =====================================



async function loadWallet(){



const user = auth.currentUser;



if(!user){

return;

}




try{



const walletRef =

doc(

db,

"wallets",

user.uid

);



const walletSnap =

await getDoc(walletRef);





if(walletSnap.exists()){


let data = walletSnap.data();



balanceBox.innerHTML =

"₹"+(data.balance || 0);



}

else{


balanceBox.innerHTML =

"₹0";


}



}



catch(error){


console.log(error);


}



}









// =====================================
// LOAD TRANSACTIONS
// =====================================



function loadTransactions(){



const user = auth.currentUser;



if(!user){

return;

}





const q = query(

collection(
db,
"transactions"
),


where(
"userId",
"==",
user.uid
)


);







onSnapshot(q,(snapshot)=>{



if(snapshot.empty){



transactionBox.innerHTML =

"No transactions yet";

return;


}





transactionBox.innerHTML="";





snapshot.forEach(doc=>{



const t = doc.data();





transactionBox.innerHTML +=



`

<div class="transaction">


${t.type || "Transaction"}


<br>


₹${t.amount || 0}


</div>


`;



});



});



}







auth.onAuthStateChanged(()=>{


loadWallet();


loadTransactions();


});
