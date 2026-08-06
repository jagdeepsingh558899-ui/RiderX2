// ==========================================
// RiderX Notification Manager V1
// ==========================================


export function showNotification(

title,

message

){



if(

"Notification" in window

){



if(

Notification.permission==="granted"

){



new Notification(

title,

{


body:message,


icon:"../assets/logo.png"



}

);



}

else{


Notification.requestPermission();



}



}



}





// NEW RIDE


export function newRideNotification(){


showNotification(

"🏍 New Ride Request",

"New customer ride available"

);


}







// RIDE ACCEPTED


export function rideAcceptedNotification(){



showNotification(

"✅ Rider Found",

"Your rider has accepted the ride"

);



}








// RIDER ARRIVING


export function riderArrivingNotification(){


showNotification(

"🏍 Rider Arriving",

"Your rider is coming"

);


}








// RIDE START


export function rideStartNotification(){


showNotification(

"🚕 Ride Started",

"Your ride has started"

);


}







// CHAT


export function chatNotification(){


showNotification(

"💬 New Message",

"You received a new message"

);


}





console.log(

"RiderX Notification Manager Loaded"

);
