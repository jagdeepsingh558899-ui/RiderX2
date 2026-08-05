// =================================
// RiderX Fare & Coupon Settings
// =================================


import {db} from "../firebase/config.js";


import {

doc,
getDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





export async function getFareSettings(){


let snap = await getDoc(

doc(db,"settings","app")

);



if(snap.exists()){


return snap.data();


}



return {


bikeBase:50,

bikeKm:10,

cabBase:100,

cabKm:15,

coupon:"",

discount:0


};


}
