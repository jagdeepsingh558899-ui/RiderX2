// =====================================
// RiderX Admin Dashboard V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const totalCustomers = document.getElementById("totalCustomers");
const totalRiders = document.getElementById("totalRiders");
const activeBookings = document.getElementById("activeBookings");
const totalEarnings = document.getElementById("totalEarnings");

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "../auth/login.html";
        return;

    }

    try {

        // Customers
        const customerQuery = query(
            collection(db, "users"),
            where("role", "==", "customer")
        );

        const customerSnap = await getDocs(customerQuery);

        totalCustomers.innerHTML = customerSnap.size;

        // Riders
        const riderQuery = query(
            collection(db, "users"),
            where("role", "==", "rider")
        );

        const riderSnap = await getDocs(riderQuery);

        totalRiders.innerHTML = riderSnap.size;

        // Active Bookings
        const bookingQuery = query(
            collection(db, "bookings"),
            where("status", "!=", "completed")
        );

        const bookingSnap = await getDocs(bookingQuery);

        activeBookings.innerHTML = bookingSnap.size;

        // Earnings
        const paymentSnap = await getDocs(collection(db, "payments"));

        let total = 0;

        paymentSnap.forEach((doc) => {

            const data = doc.data();

            if (data.amount) {
                total += Number(data.amount);
            }

        });

        totalEarnings.innerHTML = "₹" + total;

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

});
