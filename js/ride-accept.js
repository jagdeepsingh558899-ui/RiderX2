// =================================
// RiderX Accept Ride
// =================================


export function openRideDetails(id){

localStorage.setItem(
"rideId",
id
);


window.location.href =
"ride-details.html";


}
