// =====================================
// RiderX Admin Customer Management V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    getDocs,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const customerList = document.getElementById("customerList");
const searchCustomer = document.getElementById("searchCustomer");

let customers = [];

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "../auth/login.html";
        return;
    }

    await loadCustomers();

});

async function loadCustomers() {

    customerList.innerHTML = "";

    const snapshot = await getDocs(collection(db, "users"));

    customers = [];

    snapshot.forEach((document) => {

        const data = document.data();

        if (data.role === "customer") {

            customers.push({
                id: document.id,
                ...data
            });

        }

    });

    renderCustomers(customers);

}

function renderCustomers(list) {

    customerList.innerHTML = "";

    if (list.length === 0) {

        customerList.innerHTML =
        "<div class='service-card'><h3>No Customers Found</h3></div>";

        return;

    }

    list.forEach((customer) => {

        const card = document.createElement("div");

        card.className = "service-card";

        card.innerHTML = `

        <h3>${customer.name}</h3>

        <p>${customer.email}</p>

        <p>Status : ${customer.status}</p>

        <button id="btn-${customer.id}">
        ${customer.status === "blocked" ? "Unblock" : "Block"}
        </button>

        `;

        customerList.appendChild(card);

        document
        .getElementById(`btn-${customer.id}`)
        .onclick = async () => {

            const newStatus =
            customer.status === "blocked"
            ? "active"
            : "blocked";

            await updateDoc(
                doc(db, "users", customer.id),
                {
                    status: newStatus
                }
            );

            await loadCustomers();

        };

    });

}

searchCustomer.oninput = () => {

    const keyword =
    searchCustomer.value.toLowerCase();

    const filtered = customers.filter((customer) =>

        customer.name.toLowerCase().includes(keyword) ||

        customer.email.toLowerCase().includes(keyword)

    );

    renderCustomers(filtered);

};
