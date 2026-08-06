// =========================================
// RiderX Booking System
// Real Time Ride Create Engine
// =========================================

import { database } from "../firebase/Firebase-config.js";

import {
    ref,
    push,
    set,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// Create Ride
export async function createRide(rideData){

    try{

        const ridesRef = ref(database,"rides");

        const newRide = push(ridesRef);


        const ride = {

            rideId:newRide.key,

            customerId: rideData.customerId || "",

            customerName: rideData.customerName || "Customer",

            customerPhone: rideData.customerPhone || "",


            pickup:{
                address: rideData.pickupAddress || "",
                lat: rideData.pickupLat || 0,
                lng: rideData.pickupLng || 0
            },


            drop:{
                address: rideData.dropAddress || "",
                lat: rideData.dropLat || 0,
                lng: rideData.dropLng || 0
            },


            serviceType:
            rideData.serviceType || "Bike Taxi",


            vehicleType:
            rideData.vehicleType || "Bike",


            fare:
            rideData.fare || 0,


            payment:
            rideData.payment || "Cash",


            status:
            "searching_rider",


            riderId:
            "",


            riderName:
            "",


            riderPhone:
            "",


            createdAt:
            serverTimestamp()

        };


        await set(newRide,ride);


        console.log(
            "Ride Created:",
            newRide.key
        );


        return {

            success:true,

            rideId:newRide.key

        };


    }

    catch(error){

        console.log(
            "Booking Error:",
            error
        );


        return {

            success:false,

            error:error.message

        };

    }

}



// Update Ride Status

export async function updateRideStatus(
    rideId,
    status
){

    try{


        const rideRef =
        ref(database,
        `rides/${rideId}/status`);


        await set(
            rideRef,
            status
        );


        return true;


    }

    catch(error){

        console.log(error);

        return false;

    }

}
