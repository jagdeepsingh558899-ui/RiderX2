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
   This is the SINGLE Firebase initialization point
   for the RiderX application.

   Application modules should import Firebase services
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
   FIREBASE APP INITIALIZATION
   ---------------------------------------------------------
   Reuse an existing default Firebase app when available.
   Otherwise initialize Firebase exactly once.
========================================================= */

let app;

try {

    if (getApps().length > 0) {

        app = getApp();

    } else {

        app = initializeApp(firebaseConfig);

    }

} catch (error) {

    console.error(
        "RiderX Firebase initialization failed.",
        error
    );

    throw error;

}


/* =========================================================
   FIREBASE SERVICES
========================================================= */

const auth =
    getAuth(app);


const db =
    getFirestore(app);


const realtimeDb =
    getDatabase(app);


const storage =
    getStorage(app);


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
    true;


function isFirebaseReady() {

    return (
        firebaseReady === true
    );

}


/* =========================================================
   FIREBASE READY EVENT
   ---------------------------------------------------------
   Dispatch after all Firebase services are initialized.
========================================================= */

function dispatchFirebaseReady() {

    if (
        typeof window === "undefined"
    ) {

        return;

    }


    try {

        window.dispatchEvent(
            new CustomEvent(
                "riderx:firebase-ready",
                {
                    detail:
                        firebaseServices
                }
            )
        );

    } catch (error) {

        console.warn(
            "RiderX Firebase ready event could not be dispatched.",
            error
        );

    }

}


/* =========================================================
   GLOBAL RIDERX FIREBASE REFERENCE
   ---------------------------------------------------------
   These references DO NOT initialize Firebase again.

   They expose the already initialized services for legacy
   or non-module RiderX code that needs a global reference.
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

    /* =====================================================
       FIREBASE APP
    ===================================================== */

    app,


    /* =====================================================
       FIREBASE SERVICES
    ===================================================== */

    auth,

    db,

    realtimeDb,

    storage,

    googleProvider,

    firebaseServices,


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    firebaseConfig,


    /* =====================================================
       FIREBASE READY
    ===================================================== */

    isFirebaseReady,


    /* =====================================================
       AUTHENTICATION
    ===================================================== */

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


    /* =====================================================
       CLOUD FIRESTORE
    ===================================================== */

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


    /* =====================================================
       REALTIME DATABASE
    ===================================================== */

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


    /* =====================================================
       FIREBASE STORAGE
    ===================================================== */

    storageRef,

    uploadBytes,

    uploadBytesResumable,

    getDownloadURL,

    deleteObject

};


/* =========================================================
   FIREBASE READY
========================================================= */

dispatchFirebaseReady();


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
