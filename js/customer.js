// RiderX Customer Dashboard Engine
// Map + GPS + Pickup Drop + Fare + Firebase Booking


import {
    auth,
    db
} from "../firebase/firebase-config.js";


import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


console.log("RiderX Customer JS Loaded");



let selectedService = "bike";

let map;

let pickupMarker = null;
let dropMarker = null;

let pickupCoords = null;
let dropCoords = null;



const fareRates = {

    bike: {
        base:20
    },

    cab:{
        base:50
    },

    parcel:{
        base:30
    },

    food:{
        base:25
    }

};




// MAP START

function initMap(){


    const mapBox =
    document.getElementById("map");


    if(!mapBox){

        console.log("Map box not found");
        return;

    }



    map = L.map("map")
    .setView(
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



    console.log("Map Started");





    // MAP CLICK


    map.on("click", async function(e){


        let lat = e.latlng.lat;
        let lng = e.latlng.lng;


        let address =
        await getAddress(lat,lng);



        if(!pickupCoords){


            pickupCoords={
                lat,
                lng
            };


            pickupMarker =
            L.marker(
                [lat,lng]
            )
            .addTo(map)
            .bindPopup("Pickup")
            .openPopup();



            document
            .getElementById("pickup")
            .value =
            address;



        }

        else if(!dropCoords){



            dropCoords={
                lat,
                lng
            };



            dropMarker =
            L.marker(
                [lat,lng]
            )
            .addTo(map)
            .bindPopup("Drop")
            .openPopup();



            document
            .getElementById("drop")
            .value =
            address;



            calculateFare();


        }


    });


}





// GET ADDRESS


async function getAddress(lat,lng){


    try{


        let response =
        await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );


        let data =
        await response.json();



        return data.display_name ||
        `${lat},${lng}`;


    }

    catch(error){


        return `${lat},${lng}`;

    }


}






// DISTANCE


function distanceKm(
lat1,
lon1,
lat2,
lon2
){


let R=6371;


let dLat =
(lat2-lat1)
*
Math.PI/180;


let dLon =
(lon2-lon1)
*
Math.PI/180;



let a =
Math.sin(dLat/2)**2 +

Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180) *

Math.sin(dLon/2)**2;



let c =
2*
Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);



return R*c;


}






// FARE


function calculateFare(){



if(!pickupCoords || !dropCoords){


document.getElementById("fare")
.innerText="₹0";


return 0;


}



let km =
distanceKm(

pickupCoords.lat,
pickupCoords.lng,

dropCoords.lat,
dropCoords.lng

);



let rate=8;


let hour =
new Date()
.getHours();



if(hour>=22 || hour<6){

rate=11;

}

else if(km>10){

rate=9;

}



let fare =

fareRates[selectedService].base
+
(km*rate);



fare=Math.round(fare);



document.getElementById("fare")
.innerText =
"₹"+fare;



return fare;


}






// SERVICE BUTTONS


function serviceSetup(){


document
.querySelectorAll(".service")
.forEach(item=>{


item.onclick=function(){


document
.querySelectorAll(".service")
.forEach(x=>
x.classList.remove("active")
);



item.classList.add("active");



selectedService =
item.dataset.type;



calculateFare();


};



});


}







// BOOK BUTTON


function bookingSetup(){



let btn =
document.getElementById("bookRide");



if(!btn) return;



btn.onclick =
async function(){



let user =
auth.currentUser;



if(!user){


alert("Please Login First");

location.href="../auth/login.html";

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

pickupCoords,

dropCoords,

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




document.getElementById("status")
.innerText =
"Searching RiderX Rider...";



}

catch(error){


alert(error.message);


}



};



}







// START


window.addEventListener(
"load",
()=>{


initMap();

serviceSetup();

bookingSetup();

calculateFare();


});
