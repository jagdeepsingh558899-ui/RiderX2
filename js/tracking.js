import { db } from "../firebase/config.js";


import {

ref,
set,
onValue

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";




// Rider Live Location


window.startTracking=function(){


if(navigator.geolocation){



navigator.geolocation.watchPosition(

(position)=>{


let lat =
position.coords.latitude;


let lng =
position.coords.longitude;



set(

ref(
db,
"liveRider/location"
),

{

latitude:lat,

longitude:lng,

time:new Date().toString()

}

);



let status =
document.getElementById("status");


if(status){

status.innerHTML =
"Location Sharing ON 🟢";

}


}

);



}

else{


alert("GPS Not Supported");


}


};







// Customer Tracking


const locationBox =
document.getElementById("location");



if(locationBox){


onValue(

ref(db,"liveRider/location"),

(snapshot)=>{


let data =
snapshot.val();



if(data){


locationBox.innerHTML =

`

Latitude: ${data.latitude}

<br>

Longitude: ${data.longitude}

<br>

Updated: ${data.time}

`;


}


}

);


}
