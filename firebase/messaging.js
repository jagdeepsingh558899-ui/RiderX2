// =====================================
// RiderX Firebase Messaging Setup
// =====================================


import {

app,

auth,

db

}

from "./config.js";



import {


getMessaging,

getToken,

onMessage


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";



import {


doc,

setDoc


}

from

"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";







const messaging =

getMessaging(app);









// =====================================
// REQUEST NOTIFICATION PERMISSION
// =====================================



export async function enableNotification(){



try{



const permission =

await Notification.requestPermission();






if(permission==="granted"){



const token =

await getToken(

messaging,

{


vapidKey:

"YOUR_FIREBASE_VAPID_KEY"


}

);







if(token){



saveToken(token);



}



}



}



catch(error){



console.log(error);



}



}









// =====================================
// SAVE TOKEN
// =====================================



async function saveToken(token){



const user =

auth.currentUser;



if(!user){

return;

}






await setDoc(

doc(

db,

"users",

user.uid

),


{


notificationToken:

token



},


{


merge:true


}


);



}









// =====================================
// FOREGROUND MESSAGE
// =====================================



onMessage(

messaging,

(payload)=>{



console.log(

"Notification Received",

payload

);




alert(

payload.notification?.title || "RiderX"

);



}

);
