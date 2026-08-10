/* =========================================================
   RIDERX 2.0
   FIREBASE CONFIGURATION
   File: firebase/firebase-config.js

   Firebase SDK: 10.8.0

   Services:
   - Firebase Authentication
   - Cloud Firestore
   - Realtime Database
   - Firebase Storage

   IMPORTANT:
   This file is the SINGLE Firebase initialization point
   for the RiderX application.

   All application modules should import Firebase services
   from this file instead of initializing Firebase again.
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
   FIREBASE REALTIME DATABASE
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

const firebaseConfig = Object.freeze({

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

});


/* =========================================================
   INITIALIZE FIREBASE
   ---------------------------------------------------------
   Firebase must only be initialized once per page.
========================================================= */

let app;

const existingApps =
    getApps();


if (
    existingApps.length > 0
) {

    app =
        getApp();

} else {

    app =
        initializeApp(
            firebaseConfig
        );

}


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

const firebaseServices =
    Object.freeze({

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

    });


/* =========================================================
   FIREBASE READY STATE
========================================================= */

let firebaseReady =
    false;


function markFirebaseReady() {

    firebaseReady =
        true;


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

}


function isFirebaseReady() {

    return (
        firebaseReady === true
    );

}


/* =========================================================
   GLOBAL RIDERX FIREBASE REFERENCE
   ---------------------------------------------------------
   These references DO NOT initialize Firebase again.

   They only expose the already initialized services to
   application modules that need a global reference.
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


    window.RiderX.getFirebase =
        function () {

            return firebaseServices;

        };


    window.RiderX.isFirebaseReady =
        function () {

            return isFirebaseReady();

        };

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

    firebaseServices,


    /* Configuration */

    firebaseConfig,


    /* Firebase readiness */

    isFirebaseReady,


    /* Authentication */

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

    deleteObject

};


/* =========================================================
   FIREBASE READY
========================================================= */

markFirebaseReady();


/* =========================================================
   DEBUG INFORMATION
========================================================= */

console.info(
    "RiderX Firebase initialized successfully.",
    {

        projectId:
            firebaseConfig.projectId,

        app:
            Boolean(app),

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
