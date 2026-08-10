/* =========================================================
   RiderX 2.0
   Firebase Configuration
   File: firebase/firebase-config.js

   Firebase SDK:
   10.8.0

   Services:
   - Firebase Authentication
   - Cloud Firestore
   - Realtime Database
   - Firebase Storage
========================================================= */

"use strict";


/* =========================================================
   FIREBASE SDK
========================================================= */

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
    updateProfile
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
    writeBatch,
    serverTimestamp,
    Timestamp,
    arrayUnion,
    arrayRemove,
    increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


import {
    getDatabase,
    ref,
    set,
    get,
    update,
    remove,
    push,
    onValue,
    off,
    onDisconnect,
    serverTimestamp as databaseServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";


import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

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


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app =
    initializeApp(
        firebaseConfig
    );


/* =========================================================
   SERVICES
========================================================= */

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


/* =========================================================
   GOOGLE AUTH
========================================================= */

const googleProvider =
    new GoogleAuthProvider();


googleProvider.setCustomParameters({
    prompt: "select_account"
});


/* =========================================================
   AUTH EXPORTS
========================================================= */

export {

    app,

    auth,

    db,

    realtimeDb,

    storage,

    googleProvider,


    /* Auth */

    createUserWithEmailAndPassword,

    signInWithEmailAndPassword,

    signOut,

    onAuthStateChanged,

    signInWithPopup,

    RecaptchaVerifier,

    signInWithPhoneNumber,

    sendPasswordResetEmail,

    updateProfile,


    GoogleAuthProvider,


    /* Firestore */

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

    writeBatch,

    serverTimestamp,

    Timestamp,

    arrayUnion,

    arrayRemove,

    increment,


    /* Realtime Database */

    ref,

    set,

    get,

    update,

    remove,

    push,

    onValue,

    off,

    onDisconnect,

    databaseServerTimestamp,


    /* Storage */

    storageRef,

    uploadBytes,

    uploadBytesResumable,

    getDownloadURL,

    deleteObject

};


/* =========================================================
   GLOBAL RIDERX FIREBASE OBJECT
   ---------------------------------------------------------
   This is intentionally exposed for older RiderX modules
   that still read window.RiderXFirebase.

   New code should use ES module imports above.
========================================================= */

window.RiderXFirebase = {

    app,

    auth,

    db,

    realtimeDb,

    storage,

    googleProvider

};


/* =========================================================
   FIREBASE READY EVENT
========================================================= */

window.dispatchEvent(
    new CustomEvent(
        "riderx:firebase-ready",
        {
            detail: {
                app,
                auth,
                db,
                realtimeDb,
                storage
            }
        }
    )
);


/* =========================================================
   DEBUG INFORMATION
   ---------------------------------------------------------
   Does not expose credentials beyond the public Firebase
   configuration already required by the client SDK.
========================================================= */

console.info(
    "RiderX Firebase initialized successfully.",
    {
        projectId:
            firebaseConfig.projectId,

        auth:
            !!auth,

        firestore:
            !!db,

        realtimeDatabase:
            !!realtimeDb,

        storage:
            !!storage
    }
);
