// =====================================
// RiderX Wallet System V2
// =====================================

import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const walletBalance = document.getElementById("walletBalance");
const amount = document.getElementById("amount");
const addMoneyBtn = document.getElementById("addMoneyBtn");
const transactionList = document.getElementById("transactionList");

let currentUser = null;

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "../auth/login.html";
        return;

    }

    currentUser = user;

    await loadWallet();
    await loadTransactions();

});

async function loadWallet() {

    const walletRef = doc(db, "wallets", currentUser.uid);

    const walletDoc = await getDoc(walletRef);

    if (!walletDoc.exists()) {

        await setDoc(walletRef, {
            balance: 0
        });

        walletBalance.innerHTML = "₹0";
        return;

    }

    walletBalance.innerHTML = "₹" + walletDoc.data().balance;

}

addMoneyBtn.onclick = async () => {

    const money = Number(amount.value);

    if (money <= 0) {

        alert("Enter valid amount");
        return;

    }

    const walletRef = doc(db, "wallets", currentUser.uid);

    const walletDoc = await getDoc(walletRef);

    const currentBalance = walletDoc.data().balance;

    const newBalance = currentBalance + money;

    await updateDoc(walletRef, {

        balance: newBalance

    });

    await addDoc(collection(db, "wallet_transactions"), {

        userId: currentUser.uid,
        type: "Credit",
        amount: money,
        createdAt: serverTimestamp()

    });

    walletBalance.innerHTML = "₹" + newBalance;

    amount.value = "";

    await loadTransactions();

    alert("Money Added Successfully");

};

async function loadTransactions() {

    transactionList.innerHTML = "";

    const q = query(
        collection(db, "wallet_transactions"),
        where("userId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {

        transactionList.innerHTML =
        "<p>No Transactions</p>";

        return;

    }

    snapshot.forEach((doc) => {

        const data = doc.data();

        transactionList.innerHTML += `

        <div class="service-card">

            <p><b>${data.type}</b></p>

            <p>₹${data.amount}</p>

        </div>

        `;

    });

}
