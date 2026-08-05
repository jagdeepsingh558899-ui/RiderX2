// =================================
// RiderX Trip Details System
// =================================



// Save Current Trip Data


export function saveTrip(trip){


localStorage.setItem(

"riderx_trip",

JSON.stringify(trip)

);


}





// Get Current Trip Data


export function getTrip(){


let trip = localStorage.getItem(

"riderx_trip"

);



if(trip){


return JSON.parse(trip);


}



return null;


}





// Clear Trip


export function clearTrip(){


localStorage.removeItem(

"riderx_trip"

);


}
