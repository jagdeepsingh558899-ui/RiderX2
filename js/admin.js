// =================================
// RiderX Admin System
// =================================


import { db } from "../firebase/config.js";


import {

collection,
getDocs

} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";





// Load Users Count


export async function loadUsersCount(){


let box =
document.getElementById("usersCount");



if(!box) return;



try{


const snapshot = await getDocs(

collection(db,"users")

);



box.innerHTML = snapshot.size;



}

catch(error){


console.log(error);


box.innerHTML="0";


}


}






// Load Rides Count


export async function loadRidesCount(){


let box =
document.getElementById("ridesCount");



if(!box) return;



try{


const snapshot = await getDocs(

collection(db,"rides")

);



box.innerHTML = snapshot.size;



}

catch(error){


console.log(error);


box.innerHTML="0";


}


}
