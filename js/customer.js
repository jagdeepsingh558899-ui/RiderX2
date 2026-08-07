// RiderX Customer Dashboard Engine
// Map + Pickup Drop + Fare + Firebase Ride Booking


import { auth, db } from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";



let selectedService = "bike";

let map;

let pickupMarker = null;
let dropMarker = null;

let pickupCoords = null;
let dropCoords = null;



const fareRates = {

    bike: 20,
    cab: 50,
    parcel: 30,
    food: 25

};



// ================= MAP =================


function initMap(){


    const mapElement = document.getElementById("map");


    if(!mapElement){

        console.log("Map not found");
        return;

    }



    map = L.map("map").setView(
        [30.7333,76.7794],
        13
    );



    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);



    console.log("RiderX Map Loaded");




    map.on("click",function(e){


        let lat = e.latlng.lat;
        let lng = e.latlng.lng;



        let locationText =
        lat.toFixed(5)+", "+
        lng.toFixed(5);




        // FIRST CLICK PICKUP

        if(!pickupCoords){


            pickupCoords={
                lat:lat,
                lng:lng
            };


            pickupMarker =
            L.marker([lat,lng])
            .addTo(map)
            .bindPopup("Pickup Location")
            .openPopup();



            document.getElementById("pickup").value =
            locationText;



        }



        // SECOND CLICK DROP

        else if(!dropCoords){


            dropCoords={
                lat:lat,
                lng:lng
            };



            dropMarker =
            L.marker([lat,lng])
            .addTo(map)
            .bindPopup("Drop Location")
            .openPopup();



            document.getElementById("drop").value =
            locationText;



            calculateFare();


        }



    });



}






// ================= DISTANCE =================


function calculateDistance(
lat1,
lon1,
lat2,
lon2
){


let R = 6371;


let dLat =
(lat2-lat1) *
Math.PI/180;


let dLon =
(lon2-lon1) *
Math.PI/180;



let a =
Math.sin(dLat/2) *
Math.sin(dLat/2)

+

Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180)

*

Math.sin(dLon/2) *
Math.sin(dLon/2);



let c =
2 *
Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);



return R*c;


}







// ================= FARE =================


function calculateFare(){



if(!pickupCoords || !dropCoords){


document.getElementById("fare").innerText="₹0";


return 0;


}




let km =
calculateDistance(

pickupCoords.lat,
pickupCoords.lng,

dropCoords.lat,
dropCoords.lng

);



let hour =
new Date().getHours();



let perKm = 8;



if(hour >=22 || hour <6){

perKm = 11;

}

else if(km > 10){

perKm = 9;

}





let total =

fareRates[selectedService]

+

(km * perKm);





total =
Math.round(total);



document.getElementById("fare").innerText =
"₹"+total;



return total;


}








// ================= SERVICE =================


function loadServices(){


document
.querySelectorAll(".service")
.forEach(service=>{


service.addEventListener(
"click",
()=>{


document
.querySelectorAll(".service")
.forEach(x=>
x.classList.remove("active")
);



service.classList.add("active");



selectedService =
service.dataset.type;



calculateFare();



});


});


}







// ================= BOOK =================


function loadBooking(){


const button =
document.getElementById("bookRide");



if(!button)
return;



button.addEventListener(
"click",
async()=>{



let user =
auth.currentUser;



if(!user){


alert("Login required");

location.href =
"../auth/login.html";

return;

}



let pickup =
document.getElementById("pickup").value;


let drop =
document.getElementById("drop").value;



if(!pickup || !drop){


alert("Pickup and Drop select kare");

return;

}




try{


await addDoc(

collection(db,"rides"),

{

customerId:user.uid,

pickupLocation:pickup,

dropLocation:drop,

pickupCoords:pickupCoords,

dropCoords:dropCoords,

serviceType:selectedService,

paymentMethod:
document.getElementById("payment").value,

fare:
calculateFare(),

status:"REQUESTED",

createdAt:
serverTimestamp()

}

);




document.getElementById("status").innerText =
"Searching RiderX Rider...";



}

catch(error){


alert(error.message);


}



});


}







// ================= START =================


document.addEventListener(
"DOMContentLoaded",
()=>{


console.log("RiderX Customer Started");


initMap();

loadServices();

loadBooking();


});
