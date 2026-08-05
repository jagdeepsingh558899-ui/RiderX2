import { db } from "../firebase/config.js";


import {

ref,
onValue

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





const box =

document.getElementById("riders");



if(box){


onValue(

ref(db,"onlineRiders"),

(snapshot)=>{


box.innerHTML="";



snapshot.forEach((rider)=>{


let data=rider.val();



box.innerHTML +=

`

<div class="card">

<h3>
Nearby Rider 🏍
</h3>

<p>
Lat: ${data.lat}
</p>

<p>
Lng: ${data.lng}
</p>


</div>

`;



});


});


}
