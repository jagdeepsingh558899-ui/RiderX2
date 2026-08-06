// ==========================================
// RiderX Firebase Messaging Setup
// Push Notification System
// ==========================================


import { app } from "./config.js";


import {

getMessaging,
getToken,
onMessage

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";





const messaging = getMessaging(app);






// ASK NOTIFICATION PERMISSION


export async function requestNotificationPermission(){



try{


const permission =

await Notification.requestPermission();





if(permission==="granted"){



const token = await getToken(

messaging,

{


vapidKey:

"YOUR_FIREBASE_VAPID_KEY"


}

);




console.log(

"RiderX Notification Token:",

token

);



return token;



}



}

catch(error){


console.log(

"Notification Error",

error

);



}



}








// FOREGROUND MESSAGE


onMessage(

messaging,

(payload)=>{


console.log(

"New Notification",

payload

);



if(

payload.notification

){


alert(

payload.notification.title+

"\n"+

payload.notification.body

);


}



}

);






console.log(

"RiderX Messaging Ready"

);
