import { db, auth } from "../firebase/config.js";


import {

doc,
getDoc,
setDoc

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



import {

ref,
set,
remove

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





let riderId;



let online=false;



const user = auth.currentUser;



if(user){

riderId=user.uid;


checkApproval();

}





async function checkApproval(){


let rider = await getDoc(

doc(

db,

"riders",

riderId

)

);



if(rider.exists()){


let data=rider.data();



if(data.status=="approved"){


document.getElementById("approval").innerHTML=

"Approved ✅";


}


else{


document.getElementById("approval").innerHTML=

"Waiting For Approval ⏳";


}


}


}






window.goOnline=function(){



online=true;



navigator.geolocation.watchPosition(

(position)=>{


set(

ref(

db,

"onlineRiders/"+riderId

),

{

lat:

position.coords.latitude,


lng:

position.coords.longitude,


online:true

}

);


}

);



alert("You are Online 🟢");


};






window.goOffline=function(){


remove(

ref(

db,

"onlineRiders/"+riderId

)

);



alert("You are Offline 🔴");


};
