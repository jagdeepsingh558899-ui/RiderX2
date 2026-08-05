import { db } from "../firebase/config.js";


import {

ref,
set,
remove

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";




let watch;



window.goOnline=function(){


navigator.geolocation.watchPosition(

(pos)=>{


set(

ref(

db,

"onlineRiders/demoRider"

),

{

lat:pos.coords.latitude,

lng:pos.coords.longitude,

online:true

}

);


document.getElementById("status").innerHTML=

"Online 🟢";


},

);


};





window.goOffline=function(){


remove(

ref(

db,

"onlineRiders/demoRider"

)

);


document.getElementById("status").innerHTML=

"Offline 🔴";


};
