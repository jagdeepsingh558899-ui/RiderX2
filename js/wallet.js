/**
 * ============================================================================
 * RiderX Super App - Wallet & Financial Management Module (js/Wallet.js)
 * ============================================================================
 * Premium Ride Hailing Super App
 * Theme: Black + Electric Yellow
 * Firebase v10 Modular SDK Integration
 * ============================================================================
 */

import { auth, db } from '../firebase/firebase-config.js';
import { 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    increment, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Wallet State
window.RiderXWalletState = {
    balance: 0,
    availableBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    monthlyEarnings: 0,
    transactions: [],
    unsubscribe: null
};

/**
 * Initialize Wallet Module & Realtime Balance Listener
 */
export async function initWalletModule(userRole = 'customer', userId = null) {
    const targetUserId = userId || (auth.currentUser ? auth.currentUser.uid : null);
    if (!targetUserId) {
        console.warn("Wallet initialization skipped: No active user.");
        return;
    }

    const collectionName = userRole === 'rider' ? 'drivers' : userRole === 'admin' ? 'admins' : 'customers';
    
    // Setup Realtime Listener on User Wallet
    const userDocRef = doc(db, collectionName, targetUserId);
    window.RiderXWalletState.unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.RiderXWalletState.balance = data.walletBalance || data.balance || 0;
            window.RiderXWalletState.availableBalance = data.availableBalance || window.RiderXWalletState.balance;
            window.RiderXWalletState.pendingBalance = data.pendingBalance || 0;
            window.RiderXWalletState.totalEarnings = data.totalEarnings || 0;
            window.RiderXWalletState.monthlyEarnings = data.monthlyEarnings || 0;
            
            updateWalletUI();
        }
    });

    loadTransactionHistory(targetUserId);
}

/**
 * Update Wallet Dashboard UI Elements
 */
function updateWalletUI() {
    const state = window.RiderXWalletState;

    const balanceEl = document.getElementById('wallet-balance-display');
    if (balanceEl) balanceEl.innerText = `₹${state.balance.toLocaleString('en-IN')}`;

    const availEl = document.getElementById('wallet-available-display');
    if (availEl) availEl.innerText = `₹${state.availableBalance.toLocaleString('en-IN')}`;

    const pendingEl = document.getElementById('wallet-pending-display');
    if (pendingEl) pendingEl.innerText = `₹${state.pendingBalance.toLocaleString('en-IN')}`;

    const earningsEl = document.getElementById('wallet-earnings-display');
    if (earningsEl) earningsEl.innerText = `₹${state.totalEarnings.toLocaleString('en-IN')}`;

    const monthlyEl = document.getElementById('wallet-monthly-display');
    if (monthlyEl) monthlyEl.innerText = `₹${state.monthlyEarnings.toLocaleString('en-IN')}`;
}

/**
 * Load Transaction History
 */
async function loadTransactionHistory(userId) {
    try {
        const q = query(
            collection(db, "transactions"),
            where("userId", "==", userId),
            orderBy("timestamp", "desc")
        );

        onSnapshot(q, (snapshot) => {
            let txList = [];
            snapshot.forEach((doc) => {
                txList.push({ id: doc.id, ...doc.data() });
            });
            window.RiderXWalletState.transactions = txList;
            renderTransactionTable(txList);
        });
    } catch (error) {
        console.error("Error loading transaction history:", error);
    }
}

function renderTransactionTable(transactions) {
    const container = document.getElementById('wallet-transactions-container');
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = `<p class="text-xs text-brand-gray text-center py-4">No recent transactions found.</p>`;
        return;
    }

    let html = '';
    transactions.forEach(tx => {
        const isCredit = tx.type === 'credit' || tx.amount > 0;
        const colorClass = isCredit ? 'text-emerald-400' : 'text-rose-400';
        const sign = isCredit ? '+' : '-';

        html += `
            <div class="flex items-center justify-between p-4 bg-brand-dark border border-brand-border rounded-2xl">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-brand-yellow/10 border border-brand-yellow/20 flex items-center justify-center text-brand-yellow">
                        <i class="fa-solid ${isCredit ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                    </div>
                    <div>
                        <h4 class="text-xs font-extrabold text-white">${tx.description || 'Wallet Transaction'}</h4>
                        <p class="text-[10px] text-brand-gray">${tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}) : 'Just now'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-extrabold ${colorClass}">${sign}₹${Math.abs(tx.amount || 0)}</span>
                    <p class="text-[10px] uppercase text-brand-yellow font-mono">${tx.status || 'success'}</p>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Add Funds to Wallet (Top-Up)
 */
export async function addMoneyToWallet(amount, paymentMethod = 'razorpay') {
    const user = auth.currentUser;
    if (!user) {
        alert("Please sign in to add funds.");
        return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    try {
        const userDocRef = doc(db, "customers", user.uid);
        await updateDoc(userDocRef, {
            walletBalance: increment(numAmount)
        });

        // Record Transaction
        await addDoc(collection(db, "transactions"), {
            userId: user.uid,
            amount: numAmount,
            type: 'credit',
            description: `Wallet Top-Up via ${paymentMethod.toUpperCase()}`,
            paymentMethod: paymentMethod,
            status: 'success',
            timestamp: Timestamp.now()
        });

        alert(`Successfully added ₹${numAmount} to your wallet.`);
    } catch (error) {
        console.error("Top-up failed:", error);
        alert("Failed to add funds. Please try again.");
    }
}

/**
 * Withdraw Funds from Wallet (Riders / Drivers)
 */
export async function withdrawFunds(amount, upiId) {
    const user = auth.currentUser;
    if (!user) return;

    const numAmount = Number(amount);
    if (numAmount <= 0 || numAmount > window.RiderXWalletState.balance) {
        alert("Invalid withdrawal amount or insufficient balance.");
        return;
    }

    try {
        const driverDocRef = doc(db, "drivers", user.uid);
        await updateDoc(driverDocRef, {
            walletBalance: increment(-numAmount),
            pendingBalance: increment(numAmount)
        });

        await addDoc(collection(db, "transactions"), {
            userId: user.uid,
            amount: -numAmount,
            type: 'debit',
            description: `Withdrawal request to UPI: ${upiId}`,
            paymentMethod: 'upi',
            status: 'pending',
            timestamp: Timestamp.now()
        });

        alert("Withdrawal request submitted successfully.");
    } catch (error) {
        console.error("Withdrawal failed:", error);
        alert("Withdrawal request failed.");
    }
}

// Bind Global Wallet Object for UI Integration
window.RiderXWallet = {
    initWalletModule,
    addMoneyToWallet,
    withdrawFunds
};

// Auto-initialize if wallet element exists
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (auth.currentUser) {
            initWalletModule();
        }
    });
} else {
    if (auth.currentUser) {
        initWalletModule();
    }
}
