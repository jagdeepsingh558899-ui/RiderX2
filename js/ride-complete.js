// =====================================
// RiderX Ride Complete System V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href = "../auth/login.html";
        return;

    }

    currentUser = user;

});

const completeRideBtn =
document.getElementById("completeRideBtn");

if (completeRideBtn) {

    completeRideBtn.onclick = async () => {

        const bookingId =
        completeRideBtn.dataset.booking;

        if (!bookingId) {

            alert("Booking ID Not Found");
            return;

        }

        try {

            await updateDoc(

                doc(db, "bookings", bookingId),

                {

                    status: "completed",

                    rideCompletedAt: serverTimestamp(),

                    paymentStatus: "pending"

                }

            );

            completeRideBtn.disabled = true;

            completeRideBtn.innerHTML =
            "Ride Completed ✅";

            alert("Ride Completed Successfully");

        }

        catch (error) {

            alert(error.message);

        }

    };

}
