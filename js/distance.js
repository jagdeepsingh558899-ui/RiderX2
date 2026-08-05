// =================================
// RiderX Distance & Fare Calculator
// =================================



// Calculate distance between two locations

export function calculateDistance(

lat1,
lon1,
lat2,
lon2

){


const R = 6371;


const dLat =
(lat2-lat1) * Math.PI / 180;


const dLon =
(lon2-lon1) * Math.PI / 180;



const a =

Math.sin(dLat/2) *
Math.sin(dLat/2)

+

Math.cos(lat1 * Math.PI / 180)

*

Math.cos(lat2 * Math.PI / 180)

*

Math.sin(dLon/2)

*

Math.sin(dLon/2);



const c =
2 * Math.atan2(

Math.sqrt(a),

Math.sqrt(1-a)

);



return (R*c).toFixed(2);


}





// Fare calculation


export function calculateFare(

distance,

service

){


let base = 0;


let perKm = 0;



if(service=="Bike Taxi"){

base = 30;
perKm = 10;

}



else if(service=="Cab"){

base = 80;
perKm = 18;

}



else if(service=="Parcel"){

base = 50;
perKm = 12;

}



else{

base = 60;
perKm = 15;

}



let total =

base + (distance * perKm);



return Math.round(total);


}
