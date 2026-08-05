// =====================================
// RiderX Ride History System V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const historyList = document.getElementById("historyList");

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "../auth/login.html";
        return;
    }

    try {

        const q = query(
            collection(db, "bookings"),
            where("customerId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        historyList.innerHTML = "";

        if (snapshot.empty) {

            historyList.innerHTML = `
                <div class="service-card">
                    <h3>No Ride History</h3>
                </div>
            `;

            return;
        }

        snapshot.forEach((ride) => {

            const data = ride.data();

            historyList.innerHTML += `

            <div class="service-card">

                <h3>${data.service}</h3>

                <p><b>Pickup:</b> ${data.pickup}</p>

                <p><b>Drop:</b> ${data.drop}</p>

                <p><b>Fare:</b> ₹${data.fare}</p>

                <p><b>Status:</b> ${data.status}</p>

                <a href="rating.html?booking=${ride.id}">
                    <button>
                        Rate Ride ⭐
                    </button>
                </a>

            </div>

            `;

        });

    }

    catch (error) {

        alert(error.message);

    }

});
