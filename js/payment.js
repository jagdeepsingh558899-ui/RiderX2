// =====================================
// RiderX Payment System V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const fareAmount = document.getElementById("fareAmount");
const payBtn = document.getElementById("payBtn");
const paymentStatus = document.getElementById("paymentStatus");

let currentUser = null;
let bookingId = "";
let fare = 0;

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "../auth/login.html";
        return;

    }

    currentUser = user;

    bookingId = new URLSearchParams(window.location.search).get("booking");

    if (!bookingId) {

        paymentStatus.innerHTML = "Booking Not Found";
        return;

    }

    const bookingRef = doc(db, "bookings", bookingId);

    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {

        paymentStatus.innerHTML = "Booking Not Found";
        return;

    }

    fare = bookingSnap.data().fare;

    fareAmount.innerHTML = "₹" + fare;

});

payBtn.onclick = async () => {

    const method =
        document.querySelector('input[name="payment"]:checked').value;

    try {

        if (method === "Wallet") {

            const walletRef = doc(db, "wallets", currentUser.uid);

            const walletSnap = await getDoc(walletRef);

            if (!walletSnap.exists()) {

                alert("Wallet Not Found");
                return;

            }

            const balance = walletSnap.data().balance;

            if (balance < fare) {

                alert("Insufficient Wallet Balance");
                return;

            }

            await updateDoc(walletRef, {

                balance: balance - fare

            });

        }

        await updateDoc(
            doc(db, "bookings", bookingId),
            {

                paymentMethod: method,
                paymentStatus: "Paid",
                paidAt: serverTimestamp()

            }
        );

        await addDoc(collection(db, "payments"), {

            bookingId: bookingId,
            customerId: currentUser.uid,
            amount: fare,
            method: method,
            status: "Paid",
            createdAt: serverTimestamp()

        });

        paymentStatus.innerHTML =
            "✅ Payment Successful";

        payBtn.disabled = true;

        alert("Payment Completed Successfully");

    }

    catch (error) {

        alert(error.message);

    }

};
