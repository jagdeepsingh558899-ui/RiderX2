// =================================
// RiderX Ride Map Markers
// =================================


let rideMarkers = [];



// Add Pending Rides On Map

export function showPendingRides(

map,

rides

){


clearRideMarkers();



rides.forEach((ride)=>{



if(!ride.pickupLat || !ride.pickupLng){

return;

}



let marker = L.marker(

[

ride.pickupLat,

ride.pickupLng

]

)

.addTo(map);



marker.bindPopup(`


<h3>
🏍 New Ride
</h3>


📍 Pickup

<br>

🏁 ${ride.drop}


<br>

💰 ${ride.fare}


<br>

📏 ${ride.distance || "0"} km


<br><br>


<button onclick="acceptRide('${ride.id}')">

Accept

</button>


`);



rideMarkers.push(marker);



});



}






function clearRideMarkers(){


rideMarkers.forEach((marker)=>{


marker.remove();


});


rideMarkers=[];


}
