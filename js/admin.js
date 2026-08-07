/**
 * ============================================================================
 * RiderX Super App - Admin Controller Module (js/admin.js)
 * ============================================================================
 * Premium Ride Hailing Super App
 * Theme: Black + Electric Yellow
 * Firebase v10 Modular SDK Integration
 * ============================================================================
 */

import { auth, db } from '../firebase/firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    getDocs, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot, 
    updateDoc, 
    addDoc, 
    deleteDoc, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Admin State
window.RiderXAdminState = {
    adminUser: null,
    isAuthorized: false,
    activeTab: 'dashboard',
    stats: {
        totalRides: 0,
        activeRiders: 0,
        totalCustomers: 0,
        revenue: 0
    },
    listeners: []
};

/**
 * Initialize Admin Panel & Auth Check
 */
export async function initAdminPanel() {
    console.log("Initializing RiderX Admin Control Tower...");
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            redirectToLogin();
            return;
        }

        const isAuthorized = await verifyAdminRole(user.uid);
        if (!isAuthorized) {
            alert("Access Denied: Administrator privileges required.");
            await signOut(auth);
            redirectToLogin();
            return;
        }

        window.RiderXAdminState.adminUser = user;
        window.RiderXAdminState.isAuthorized = true;
        console.log("Admin Authorized:", user.email);

        // Initialize Dashboard & Listeners
        initDashboardStats();
        initRealtimeListeners();
    });
}

function redirectToLogin() {
    if (!window.location.href.includes('login.html')) {
        window.location.href = '../auth/login.html';
    }
}

/**
 * Role Verification
 */
export async function verifyAdminRole(uid) {
    try {
        const adminDocRef = doc(db, "admins", uid);
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists() && adminSnap.data().role === 'admin') {
            return true;
        }
        
        // Fallback check in users collection
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            return true;
        }

        return false;
    } catch (error) {
        console.error("Admin role verification error:", error);
        return false;
    }
}

/**
 * Dashboard Statistics & Realtime Listener
 */
export function initDashboardStats() {
    const ridesQuery = query(collection(db, "rides"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribeRides = onSnapshot(ridesQuery, (snapshot) => {
        let totalRev = 0;
        let count = snapshot.size;
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.fare && data.status === 'completed') {
                totalRev += Number(data.fare);
            }
        });
        window.RiderXAdminState.stats.totalRides = count;
        window.RiderXAdminState.stats.revenue = totalRev;
        updateUIStats();
    });
    window.RiderXAdminState.listeners.push(unsubscribeRides);

    // Fetch Total Customers & Riders
    fetchUserCounts();
}

async function fetchUserCounts() {
    try {
        const customersSnap = await getDocs(collection(db, "customers"));
        window.RiderXAdminState.stats.totalCustomers = customersSnap.size;

        const ridersQuery = query(collection(db, "drivers"), where("status", "==", "online"));
        const ridersSnap = await getDocs(ridersQuery);
        window.RiderXAdminState.stats.activeRiders = ridersSnap.size;

        updateUIStats();
    } catch (error) {
        console.error("Error fetching user counts:", error);
    }
}

function updateUIStats() {
    const stats = window.RiderXAdminState.stats;
    
    const revEl = document.getElementById('stat-total-revenue');
    if (revEl) revEl.innerText = `₹${stats.revenue.toLocaleString('en-IN')}`;

    const ridesEl = document.getElementById('stat-total-rides');
    if (ridesEl) ridesEl.innerText = stats.totalRides;

    const customersEl = document.getElementById('stat-total-customers');
    if (customersEl) customersEl.innerText = stats.totalCustomers;

    const ridersEl = document.getElementById('stat-active-riders');
    if (ridersEl) ridersEl.innerText = stats.activeRiders;
}

export function initRealtimeListeners() {
    // General realtime activity listener setup
    console.log("Realtime Dashboard Listeners Active.");
}

/**
 * Customers Manager
 */
export async function loadCustomersManager() {
    try {
        const container = document.getElementById('admin-customers-table');
        if (!container) return;

        const snap = await getDocs(collection(db, "customers"));
        let html = '';
        snap.forEach((docSnap) => {
            const c = docSnap.data();
            html += `
                <tr class="border-b border-brand-border hover:bg-brand-dark/50">
                    <td class="px-4 py-3 text-xs font-bold text-white">${c.fullName || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs text-brand-gray">${c.email || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs text-brand-gray">${c.phone || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs font-bold text-brand-yellow">₹${c.walletBalance || 0}</td>
                    <td class="px-4 py-3 text-xs">
                        <button onclick="window.RiderXAdmin.toggleCustomerStatus('${docSnap.id}', ${c.isBlocked})" class="px-3 py-1 rounded-xl text-[10px] font-extrabold ${c.isBlocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
                            ${c.isBlocked ? 'Unblock' : 'Active'}
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading customers:", error);
    }
}

/**
 * Riders Manager
 */
export async function loadRidersManager() {
    try {
        const container = document.getElementById('admin-riders-table');
        if (!container) return;

        const snap = await getDocs(collection(db, "drivers"));
        let html = '';
        snap.forEach((docSnap) => {
            const r = docSnap.data();
            html += `
                <tr class="border-b border-brand-border hover:bg-brand-dark/50">
                    <td class="px-4 py-3 text-xs font-bold text-white">${r.fullName || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs text-brand-gray">${r.vehicleType || 'Bike'} (${r.vehicleNumber || 'N/A'})</td>
                    <td class="px-4 py-3 text-xs text-brand-gray">${r.phone || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs font-bold ${r.isVerified ? 'text-emerald-400' : 'text-amber-400'}">${r.isVerified ? 'Verified' : 'Pending'}</td>
                    <td class="px-4 py-3 text-xs">
                        <button onclick="window.RiderXAdmin.verifyRider('${docSnap.id}')" class="px-3 py-1 rounded-xl text-[10px] font-extrabold bg-brand-yellow text-brand-black">
                            Verify / Edit
                        </button>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading riders:", error);
    }
}

/**
 * Bookings Manager
 */
export async function loadBookingsManager() {
    try {
        const container = document.getElementById('admin-bookings-table');
        if (!container) return;

        const snap = await getDocs(query(collection(db, "rides"), orderBy("createdAt", "desc"), limit(50)));
        let html = '';
        snap.forEach((docSnap) => {
            const b = docSnap.data();
            html += `
                <tr class="border-b border-brand-border hover:bg-brand-dark/50">
                    <td class="px-4 py-3 text-xs font-mono text-brand-yellow">#${docSnap.id.substring(0, 8)}</td>
                    <td class="px-4 py-3 text-xs text-white">${b.serviceType || 'Ride'}</td>
                    <td class="px-4 py-3 text-xs text-brand-gray truncate max-w-xs">${b.pickup?.address || 'Pickup'}</td>
                    <td class="px-4 py-3 text-xs font-bold text-white">₹${b.fare || 0}</td>
                    <td class="px-4 py-3 text-xs font-extrabold uppercase text-brand-yellow">${b.status || 'requested'}</td>
                </tr>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading bookings:", error);
    }
}

/**
 * Wallet & Transactions Manager
 */
export async function loadTransactionsManager() {
    try {
        const container = document.getElementById('admin-transactions-table');
        if (!container) return;

        const snap = await getDocs(query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50)));
        let html = '';
        snap.forEach((docSnap) => {
            const t = docSnap.data();
            html += `
                <tr class="border-b border-brand-border hover:bg-brand-dark/50">
                    <td class="px-4 py-3 text-xs font-mono text-white">${t.transactionId || docSnap.id}</td>
                    <td class="px-4 py-3 text-xs text-brand-gray">${t.userId || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs font-bold text-emerald-400">+₹${t.amount || 0}</td>
                    <td class="px-4 py-3 text-xs uppercase text-brand-yellow">${t.paymentMethod || 'Wallet'}</td>
                </tr>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading transactions:", error);
    }
}

/**
 * Support Manager
 */
export async function loadSupportManager() {
    try {
        const container = document.getElementById('admin-support-tickets');
        if (!container) return;

        const snap = await getDocs(collection(db, "support_tickets"));
        let html = '';
        snap.forEach((docSnap) => {
            const s = docSnap.data();
            html += `
                <div class="p-4 bg-brand-dark border border-brand-border rounded-2xl flex items-center justify-between">
                    <div>
                        <h4 class="text-xs font-extrabold text-white">${s.subject || 'Support Request'}</h4>
                        <p class="text-[10px] text-brand-gray">${s.message || ''}</p>
                    </div>
                    <span class="px-3 py-1 rounded-xl text-[10px] font-bold ${s.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-yellow/20 text-brand-yellow'}">${s.status || 'open'}</span>
                </div>
            `;
        });
        container.innerHTML = html || '<p class="text-xs text-brand-gray">No support tickets found.</p>';
    } catch (error) {
        console.error("Error loading support tickets:", error);
    }
}

/**
 * Notifications Manager
 */
export async function sendGlobalNotification(title, message) {
    try {
        await addDoc(collection(db, "notifications"), {
            title,
            message,
            target: 'all',
            createdAt: Timestamp.now()
        });
        alert("Broadcast notification sent successfully.");
    } catch (error) {
        console.error("Error sending notification:", error);
        alert("Failed to send notification.");
    }
}

/**
 * Coupons & Promo Manager
 */
export async function createPromoCode(code, discountPct, maxDiscount) {
    try {
        await addDoc(collection(db, "coupons"), {
            code: code.toUpperCase(),
            discountPercentage: Number(discountPct),
            maxDiscountAmount: Number(maxDiscount),
            isActive: true,
            createdAt: Timestamp.now()
        });
        alert("Promo code created successfully.");
    } catch (error) {
        console.error("Error creating promo code:", error);
        alert("Failed to create promo code.");
    }
}

// Bind Global Admin Object for Inline HTML Event Handlers
window.RiderXAdmin = {
    initAdminPanel,
    verifyAdminRole,
    loadCustomersManager,
    loadRidersManager,
    loadBookingsManager,
    loadTransactionsManager,
    loadSupportManager,
    sendGlobalNotification,
    createPromoCode,
    toggleCustomerStatus: async (id, currentStatus) => {
        await updateDoc(doc(db, "customers", id), { isBlocked: !currentStatus });
        loadCustomersManager();
    },
    verifyRider: async (id) => {
        await updateDoc(doc(db, "drivers", id), { isVerified: true });
        alert("Rider verified successfully.");
        loadRidersManager();
    }
};

// Auto-initialize if admin body is present
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
    initAdminPanel();
}
