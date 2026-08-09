// ============================================================
// RiderX2
// FIREBASE MASTER CONFIGURATION
// File: firebase/firebase-config.js
// Firebase Web SDK v10.8.0
//
// This file is the central Firebase service layer for RiderX2.
//
// Services:
// - Firebase Authentication
// - Cloud Firestore
// - Firebase Realtime Database
// - Firebase Storage
//
// IMPORTANT:
// Keep this file as the single Firebase import source throughout
// the RiderX2 project.
// ============================================================


// ============================================================
// FIREBASE APP
// ============================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";


// ============================================================
// FIREBASE AUTHENTICATION
// ============================================================

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    sendPasswordResetEmail,
    updateProfile,
    updatePassword,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ============================================================
// FIRESTORE
// ============================================================

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    Timestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// REALTIME DATABASE
//
// Used for:
// - live rider location
// - live customer location
// - online/offline status
// - active ride state
// - nearby rider discovery
// - real-time ride tracking
// ============================================================

import {
    getDatabase,
    ref as rtdbRef,
    set as rtdbSet,
    update as rtdbUpdate,
    get as rtdbGet,
    remove as rtdbRemove,
    push as rtdbPush,
    onValue,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onDisconnect,
    serverTimestamp as rtdbServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";


// ============================================================
// FIREBASE STORAGE
//
// Used for:
// - profile photos
// - rider documents
// - vehicle documents
// - other approved uploads
// ============================================================

import {
    getStorage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


// ============================================================
// FIREBASE PROJECT CONFIGURATION
// ============================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",

    authDomain:
        "riderx-1.firebaseapp.com",

    databaseURL:
        "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId:
        "riderx-1",

    storageBucket:
        "riderx-1.firebasestorage.app",

    messagingSenderId:
        "261640190671",

    appId:
        "1:261640190671:web:701b3ce5dcb6135fd955ba",

    measurementId:
        "G-SM8KLBVPWN"
};


// ============================================================
// INITIALIZE FIREBASE APP
// ============================================================

const app =
    initializeApp(
        firebaseConfig
    );


// ============================================================
// INITIALIZE FIREBASE SERVICES
// ============================================================

const auth =
    getAuth(
        app
    );


const db =
    getFirestore(
        app
    );


const realtimeDb =
    getDatabase(
        app
    );


const storage =
    getStorage(
        app
    );


// ============================================================
// MASTER EXPORTS
//
// Existing RiderX2 code can continue importing the existing
// Firebase services while new ride/location modules can use
// the Realtime Database exports below.
// ============================================================

export {

    // ----------------------------------------------------------
    // Firebase core
    // ----------------------------------------------------------

    app,


    // ----------------------------------------------------------
    // Authentication
    // ----------------------------------------------------------

    auth,

    createUserWithEmailAndPassword,

    signInWithEmailAndPassword,

    signOut,

    onAuthStateChanged,

    GoogleAuthProvider,

    signInWithPopup,

    RecaptchaVerifier,

    signInWithPhoneNumber,

    sendPasswordResetEmail,

    updateProfile,

    updatePassword,

    deleteUser,


    // ----------------------------------------------------------
    // Cloud Firestore
    // ----------------------------------------------------------

    db,

    doc,

    setDoc,

    getDoc,

    updateDoc,

    deleteDoc,

    collection,

    addDoc,

    getDocs,

    query,

    where,

    orderBy,

    limit,

    onSnapshot,

    runTransaction,

    serverTimestamp,

    Timestamp,

    writeBatch,


    // ----------------------------------------------------------
    // Realtime Database
    // ----------------------------------------------------------

    realtimeDb,

    rtdbRef,

    rtdbSet,

    rtdbUpdate,

    rtdbGet,

    rtdbRemove,

    rtdbPush,

    onValue,

    onChildAdded,

    onChildChanged,

    onChildRemoved,

    onDisconnect,

    rtdbServerTimestamp,


    // ----------------------------------------------------------
    // Firebase Storage
    // ----------------------------------------------------------

    storage,

    ref,

    uploadBytes,

    uploadBytesResumable,

    getDownloadURL,

    deleteObject
};
