// ============================================================
// RiderX 2.0
// Firebase Configuration
// File: firebase/Firebase-config.js
// ============================================================

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    getDatabase
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";


// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {

    apiKey: "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",

    authDomain: "riderx-1.firebaseapp.com",

    databaseURL:
        "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId: "riderx-1",

    storageBucket:
        "riderx-1.firebasestorage.app",

    messagingSenderId: "261640190671",

    appId:
        "1:261640190671:web:701b3ce5dcb6135fd955ba",

    measurementId: "G-SM8KLBVPWN"

};


// ============================================================
// INITIALIZE FIREBASE APP
// ============================================================

const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);


// ============================================================
// FIREBASE AUTHENTICATION
// ============================================================

const auth = getAuth(app);


// Keep authentication session persistent.
try {

    await setPersistence(
        auth,
        browserLocalPersistence
    );

} catch (error) {

    console.warn(
        "RiderX Auth Persistence Error:",
        error
    );

}


// ============================================================
// FIRESTORE
// ============================================================

const db = getFirestore(app);


// ============================================================
// REALTIME DATABASE
// ============================================================
//
// Used for real-time features:
//
// • Rider online/offline
// • Live rider location
// • Customer live location
// • Active ride tracking
// • Ride request status
// • Driver movement
// • Real-time ride updates
//
// ============================================================

const realtimeDb = getDatabase(app);


// ============================================================
// FIREBASE STORAGE
// ============================================================
//
// Used for:
//
// • Profile photos
// • Rider documents
// • Driving licence
// • Vehicle documents
// • Verification files
//
// ============================================================

const storage = getStorage(app);


// ============================================================
// RIDERX COLLECTIONS
// ============================================================

const COLLECTIONS = {

    USERS: "users",

    CUSTOMERS: "customers",

    RIDERS: "riders",

    ADMINS: "admins",

    RIDES: "rides",

    RIDE_REQUESTS: "rideRequests",

    VEHICLES: "vehicles",

    PAYMENTS: "payments",

    TRANSACTIONS: "transactions",

    WALLETS: "wallets",

    NOTIFICATIONS: "notifications",

    MESSAGES: "messages",

    RATINGS: "ratings",

    SUPPORT: "support",

    PROMOS: "promos",

    REFERRALS: "referrals",

    DOCUMENTS: "documents",

    SETTINGS: "settings"

};


// ============================================================
// USER ROLES
// ============================================================

const USER_ROLES = {

    CUSTOMER: "customer",

    RIDER: "rider",

    ADMIN: "admin"

};


// ============================================================
// SERVICE TYPES
// ============================================================

const SERVICE_TYPES = {

    BIKE: "bike",

    AUTO: "auto",

    CAB: "cab",

    PARCEL: "parcel",

    FOOD: "food"

};


// ============================================================
// RIDE STATUS
// ============================================================

const RIDE_STATUS = {

    SEARCHING: "searching",

    ACCEPTED: "accepted",

    DRIVER_ARRIVING: "driver_arriving",

    DRIVER_ARRIVED: "driver_arrived",

    OTP_PENDING: "otp_pending",

    STARTED: "started",

    COMPLETED: "completed",

    CANCELLED: "cancelled"

};


// ============================================================
// RIDER STATUS
// ============================================================

const RIDER_STATUS = {

    OFFLINE: "offline",

    ONLINE: "online",

    BUSY: "busy",

    SUSPENDED: "suspended"

};


// ============================================================
// PAYMENT METHODS
// ============================================================

const PAYMENT_METHODS = {

    CASH: "cash",

    ONLINE: "online",

    WALLET: "wallet"

};


// ============================================================
// RIDERX CITY
// ============================================================

const RIDERX_CITY = {

    name: "Chandigarh",

    state: "Chandigarh",

    country: "India"

};


// ============================================================
// INITIAL FARE CONFIGURATION
// ============================================================

const FARE_CONFIG = {

    // Day: 08:00 AM → 10:00 PM
    dayStart: 8,

    dayEnd: 22,

    // Up to 10 KM
    dayRate: 8,

    // More than 10 KM
    longDistanceRate: 9,

    // Night: 10:00 PM → 06:00 AM
    nightRate: 11,

    longDistanceThreshold: 10

};


// ============================================================
// RIDERX APP CONFIGURATION
// ============================================================

const APP_CONFIG = {

    name: "RiderX",

    version: "2.0.0",

    city: "Chandigarh",

    country: "India",

    currency: "INR",

    currencySymbol: "₹",

    defaultLanguage: "en",

    supportedLanguages: [
        "en",
        "hi"
    ],

    emergencyNumber: "112"

};


// ============================================================
// EXPORTS
// ============================================================

export {

    app,

    auth,

    db,

    realtimeDb,

    storage,

    firebaseConfig,

    COLLECTIONS,

    USER_ROLES,

    SERVICE_TYPES,

    RIDE_STATUS,

    RIDER_STATUS,

    PAYMENT_METHODS,

    RIDERX_CITY,

    FARE_CONFIG,

    APP_CONFIG

};
