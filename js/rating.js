// =====================================
// RiderX Rating & Review System V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

let currentUser = null;

const rating = document.getElementById("rating");
const review = document.getElementById("review");
const submitRatingBtn = document.getElementById("submitRatingBtn");

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href = "../auth/login.html";
        return;

    }

    currentUser = user;

});

submitRatingBtn.onclick = async () => {

    const bookingId = new URLSearchParams(window.location.search).get("booking");

    if (!bookingId) {

        alert("Booking ID not found.");
        return;

    }

    try {

        await addDoc(collection(db, "reviews"), {

            bookingId: bookingId,

            customerId: currentUser.uid,

            rating: Number(rating.value),

            review: review.value.trim(),

            createdAt: serverTimestamp()

        });

        alert("Thank you for your feedback ⭐");

        window.location.href = "history.html";

    }

    catch (error) {

        alert(error.message);

    }

};
