/**
 * ============================================================================
 * RiderX Super App - Core Application Controller (js/App.js)
 * ============================================================================
 * Premium Ride Hailing Super App
 * Theme: Black + Electric Yellow
 * Firebase v10 Modular SDK Integration
 * ============================================================================
 */

import { auth, db, storage } from '../firebase/firebase-config.js';
import { 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Application State
window.RiderXState = {
    currentUser: null,
    userRole: 'customer',
    isOnline: navigator.onLine,
    currentTheme: localStorage.getItem('riderx_theme') || 'dark',
    currentLanguage: localStorage.getItem('riderx_lang') || 'en',
    deferredPrompt: null,
    activeModals: []
};

/**
 * Initialize Application Controller
 */
export async function initApp() {
    try {
        console.log("Initializing RiderX Core Engine...");
        setupNetworkListeners();
        setupThemeAndLanguage();
        setupPWAInstallPrompt();
        checkSession();
        initGlobalUIComponents();
        setupGlobalErrorHandlers();
        console.log("RiderX Engine Initialized Successfully.");
    } catch (error) {
        console.error("Initialization Error:", error);
        logCrash("initApp", error);
    }
}

/**
 * Authentication & Session Management
 */
export function checkSession() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            window.RiderXState.currentUser = user;
            await detectUserRole(user.uid);
            dispatchAuthEvent(true);
        } else {
            window.RiderXState.currentUser = null;
            window.RiderXState.userRole = 'guest';
            dispatchAuthEvent(false);
        }
    });
}

async function detectUserRole(uid) {
    try {
        const collections = ['customers', 'drivers', 'admins'];
        for (const col of collections) {
            const docRef = doc(db, col, uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                if (col === 'customers') window.RiderXState.userRole = 'customer';
                else if (col === 'drivers') window.RiderXState.userRole = 'rider';
                else if (col === 'admins') window.RiderXState.userRole = 'admin';
                return;
            }
        }
        window.RiderXState.userRole = 'customer';
    } catch (error) {
        console.error("Role Detection Failed:", error);
        window.RiderXState.userRole = 'customer';
    }
}

function dispatchAuthEvent(isAuthenticated) {
    const event = new CustomEvent('riderx:authChanged', { detail: { isAuthenticated, role: window.RiderXState.userRole } });
    window.dispatchEvent(event);
}

export async function logout() {
    try {
        showLoader("Signing out...");
        await signOut(auth);
        localStorage.clear();
        sessionStorage.clear();
        hideLoader();
        window.location.href = '../auth/login.html';
    } catch (error) {
        hideLoader();
        showToast("Logout failed: " + error.message, "error");
    }
}

/**
 * Navigation & Routing
 */
export function navigate(path) {
    showLoader();
    setTimeout(() => {
        window.location.href = path;
    }, 200);
}

/**
 * Global Loading Spinner
 */
export function showLoader(message = "Loading...") {
    let loader = document.getElementById('riderx-global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'riderx-global-loader';
        loader.className = 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-black/90 backdrop-blur-md';
        loader.innerHTML = `
            <div class="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mb-4"></div>
            <p id="riderx-loader-text" class="text-xs font-extrabold text-white tracking-wider uppercase">${message}</p>
        `;
        document.body.appendChild(loader);
    } else {
        document.getElementById('riderx-loader-text').innerText = message;
        loader.classList.remove('hidden');
    }
}

export function hideLoader() {
    const loader = document.getElementById('riderx-global-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

/**
 * Toast Notifications & Alerts
 */
export function showToast(message, type = 'success') {
    let container = document.getElementById('riderx-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'riderx-toast-container';
        container.className = 'fixed top-5 right-5 z-50 space-y-3 max-w-sm w-full pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'border-emerald-500/40 text-emerald-400' : type === 'error' ? 'border-rose-500/40 text-rose-400' : 'border-brand-yellow/40 text-brand-yellow';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation';

    toast.className = `pointer-events-auto flex items-center gap-3 p-4 rounded-2xl bg-brand-dark border ${borderColor} shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-[-20px] opacity-0`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-base shrink-0"></i>
        <p class="text-xs font-extrabold text-white flex-grow">${message}</p>
        <button onclick="this.parentElement.remove()" class="text-brand-gray hover:text-white"><i class="fa-solid fa-xmark"></i></button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function showAlert(title, message, type = 'info') {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/80 backdrop-blur-md';
    modal.innerHTML = `
        <div class="bg-brand-dark border border-brand-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 class="text-base font-extrabold text-white">${title}</h3>
            <p class="text-xs text-brand-gray">${message}</p>
            <div class="flex justify-end pt-2">
                <button onclick="this.closest('.fixed').remove()" class="px-5 py-2 rounded-xl bg-brand-yellow text-brand-black font-extrabold text-xs">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export function showConfirm(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/80 backdrop-blur-md';
    modal.innerHTML = `
        <div class="bg-brand-dark border border-brand-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 class="text-base font-extrabold text-white">${title}</h3>
            <p class="text-xs text-brand-gray">${message}</p>
            <div class="flex justify-end gap-2 pt-2">
                <button id="cancel-btn" class="px-4 py-2 rounded-xl bg-brand-black border border-brand-border text-xs font-bold text-brand-gray">Cancel</button>
                <button id="confirm-btn" class="px-5 py-2 rounded-xl bg-brand-yellow text-brand-black font-extrabold text-xs">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#cancel-btn').onclick = () => modal.remove();
    modal.querySelector('#confirm-btn').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };
}

/**
 * Formatters & Utilities
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount || 0);
}

export function formatDate(dateInput) {
    if (!dateInput) return 'N/A';
    const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatPhone(phone) {
    if (!phone) return '';
    return phone.startsWith('+91') ? phone : `+91 ${phone}`;
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard successfully!", "success");
    } catch (err) {
        showToast("Failed to copy text.", "error");
    }
}

export async function shareContent(title, text, url) {
    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
        } catch (err) {
            console.error("Share error:", err);
        }
    } else {
        copyText(url);
    }
}

export function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function printPage() {
    window.print();
}

/**
 * Theme & Language Controller
 */
export function toggleTheme() {
    window.RiderXState.currentTheme = window.RiderXState.currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('riderx_theme', window.RiderXState.currentTheme);
    document.documentElement.classList.toggle('dark', window.RiderXState.currentTheme === 'dark');
}

export function changeLanguage(langCode) {
    window.RiderXState.currentLanguage = langCode;
    localStorage.setItem('riderx_lang', langCode);
    showToast(`Language changed to ${langCode.toUpperCase()}`, "success");
}

function setupThemeAndLanguage() {
    if (window.RiderXState.currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

/**
 * Network Status & PWA
 */
function setupNetworkListeners() {
    window.addEventListener('online', () => {
        window.RiderXState.isOnline = true;
        showToast("Back online!", "success");
    });
    window.addEventListener('offline', () => {
        window.RiderXState.isOnline = false;
        showToast("Internet connection lost. You are offline.", "error");
    });
}

function setupPWAInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.RiderXState.deferredPrompt = e;
    });
}

function initGlobalUIComponents() {
    // Global UI initializations if required
}

function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        console.error("Global Error Captured:", event.error);
    });
}

function logCrash(context, error) {
    console.error(`Crash in [${context}]:`, error);
}

// Auto-initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
