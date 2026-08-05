import { db } from "../firebase/config.js";


import {

collection,
onSnapshot

}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



// USERS

const usersBox =
document.getElementById("users");


if(usersBox){


onSnapshot(

collection(db,"users"),

(snapshot)=>{


usersBox.innerHTML="";


snapshot.forEach((user)=>{


let data=user.data();


usersBox.innerHTML += `

<div class="card">

<h3>${data.name || "User"}</h3>

<p>
${data.email || data.phone}
</p>

<p>
Role: ${data.role}
</p>


</div>

`;

});


}

);


}




// RIDES


const ridesBox =
document.getElementById("rides");



if(ridesBox){


onSnapshot(

collection(db,"rides"),

(snapshot)=>{


ridesBox.innerHTML="";


snapshot.forEach((ride)=>{


let data=ride.data();


ridesBox.innerHTML += `

<div class="card">


<h3>${data.type}</h3>


<p>
From: ${data.pickup}
</p>


<p>
To: ${data.drop}
</p>


<p>
Status: ${data.status}
</p>


</div>

`;

});


}

);


}
