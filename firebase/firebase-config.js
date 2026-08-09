// ============================================================
// RiderX Firebase Configuration
// FINAL MASTER CONFIGURATION
// Firebase v10 Modular SDK
// ============================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";


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
// INITIALIZE FIREBASE
// ============================================================

const app =
    initializeApp(
        firebaseConfig
    );


// ============================================================
// FIREBASE SERVICES
// ============================================================

const auth =
    getAuth(
        app
    );


const db =
    getFirestore(
        app
    );


const storage =
    getStorage(
        app
    );


// ============================================================
// MASTER EXPORTS
// ============================================================

export {

    // Core
    app,
    auth,
    db,
    storage,


    // -------------------------
    // Authentication
    // -------------------------

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


    // -------------------------
    // Firestore
    // -------------------------

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


    // -------------------------
    // Firebase Storage
    // -------------------------

    ref,

    uploadBytes,

    uploadBytesResumable,

    getDownloadURL,

    deleteObject

};
