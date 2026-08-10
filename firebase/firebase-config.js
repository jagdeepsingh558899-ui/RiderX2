/* =========================================================
   RiderX 2.0
   Firebase Configuration
   File: firebase/firebase-config.js

   Firebase SDK: 10.8.0

   Services:
   - Firebase Authentication
   - Cloud Firestore
   - Realtime Database
   - Firebase Storage

   IMPORTANT:
   This is the SINGLE Firebase initialization point for
   the RiderX application.
========================================================= */

"use strict";


/* =========================================================
   FIREBASE APP
========================================================= */

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";


/* =========================================================
   FIREBASE AUTHENTICATION
========================================================= */

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
    deleteUser,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


/* =========================================================
   CLOUD FIRESTORE
========================================================= */

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


/* =========================================================
   REALTIME DATABASE
========================================================= */

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


/* =========================================================
   FIREBASE STORAGE
========================================================= */

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


/* =========================================================
   FIREBASE CONFIGURATION
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
   INITIALIZE FIREBASE ONLY ONCE
========================================================= */

const app =
    getApps().length > 0
        ? getApp()
        : initializeApp(
            firebaseConfig
        );


/* =========================================================
   FIREBASE SERVICES
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
   GOOGLE AUTH PROVIDER
========================================================= */

const googleProvider =
    new GoogleAuthProvider();


googleProvider.setCustomParameters({
    prompt:
        "select_account"
});


/* =========================================================
   SHARED RIDERX FIREBASE SERVICES
========================================================= */

const firebaseServices = {

    app,

    auth,

    db,

    firestore:
        db,

    realtimeDb,

    database:
        realtimeDb,

    storage,

    googleProvider

};


/* =========================================================
   GLOBAL COMPATIBILITY OBJECTS
   ---------------------------------------------------------
   These DO NOT initialize Firebase again.

   They only expose the already initialized Firebase
   services to older RiderX modules.
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.RiderXFirebase =
        firebaseServices;


    window.RX =
        window.RX ||
        {};


    window.RX.firebase =
        firebaseServices;


    window.RiderX =
        window.RiderX ||
        {};


    window.RiderX.firebase =
        firebaseServices;

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    /* Firebase app */

    app,


    /* Firebase services */

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

    GoogleAuthProvider,

    signInWithPopup,

    RecaptchaVerifier,

    signInWithPhoneNumber,

    sendPasswordResetEmail,

    updateProfile,

    deleteUser,

    sendEmailVerification,


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

    deleteObject,


    /* Configuration */

    firebaseConfig,

    firebaseServices

};


/* =========================================================
   FIREBASE READY EVENT
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.dispatchEvent(
        new CustomEvent(
            "riderx:firebase-ready",
            {
                detail:
                    firebaseServices
            }
        )
    );

}


/* =========================================================
   DEBUG INFORMATION
========================================================= */

console.info(
    "RiderX Firebase initialized.",
    {

        projectId:
            firebaseConfig.projectId,

        auth:
            Boolean(auth),

        firestore:
            Boolean(db),

        realtimeDatabase:
            Boolean(realtimeDb),

        storage:
            Boolean(storage)

    }
);
