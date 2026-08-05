// =================================
// RiderX Notification System
// =================================



// Show Notification


export function showNotification(

title,
message

){



if(!("Notification" in window)){


alert(message);

return;


}





if(Notification.permission === "granted"){


new Notification(

title,

{

body:message,

icon:"../assets/logo.svg"

}

);



}

else{


Notification.requestPermission()
.then((permission)=>{


if(permission==="granted"){


new Notification(

title,

{

body:message,

icon:"../assets/logo.svg"

}

);


}


});


}



}







// Ride Accepted Notification


export function rideAccepted(){


showNotification(

"RiderX",

"Your ride has been accepted 🏍"

);


}







// Ride Completed Notification


export function rideCompleted(){


showNotification(

"RiderX",

"Ride completed successfully ✅"

);


}
