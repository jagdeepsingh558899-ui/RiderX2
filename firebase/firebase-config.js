/* =========================================================
   RIDERX 2.0
   FIREBASE CONFIGURATION
   File: firebase/firebase-config.js

   Firebase SDK:
   10.8.0

   Services:
   - Firebase Authentication
   - Cloud Firestore
   - Realtime Database
   - Firebase Storage

   RULE:
   This is the ONLY Firebase initialization file.

   No other RiderX file should call:
       initializeApp()

   Feature modules should import Firebase services from here.
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
   RIDERX FIREBASE CONFIGURATION
========================================================= */

const firebaseConfig = Object.freeze({

    apiKey:
        "AIzaSyAjYxSxATNcUBKI2I4vn3KDWxxLKGJhs",

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
   INTERNAL CONSTANTS
========================================================= */

const FIREBASE_DEFAULT_APP_NAME = "[DEFAULT]";


/* =========================================================
   FIREBASE APP
   ---------------------------------------------------------
   Reuse the existing default Firebase app when available.
   Otherwise create exactly one default application.
========================================================= */

let app;

try {

    const apps = getApps();

    const existingDefaultApp =
        apps.find(
            firebaseApp =>
                firebaseApp.name ===
                FIREBASE_DEFAULT_APP_NAME
        );


    if (existingDefaultApp) {

        app =
            existingDefaultApp;

    } else {

        app =
            initializeApp(
                firebaseConfig
            );

    }

} catch (error) {

    console.error(
        "RiderX Firebase initialization failed:",
        error
    );

    throw error;

}


/* =========================================================
   FIREBASE AUTH
========================================================= */

let auth;

try {

    auth =
        getAuth(
            app
        );

} catch (error) {

    console.error(
        "RiderX Firebase Auth initialization failed:",
        error
    );

    throw error;

}


/* =========================================================
   FIRESTORE
========================================================= */

let db;

try {

    db =
        getFirestore(
            app
        );

} catch (error) {

    console.error(
        "RiderX Firestore initialization failed:",
        error
    );

    throw error;

}


/* =========================================================
   REALTIME DATABASE
========================================================= */

let realtimeDb;

try {

    realtimeDb =
        getDatabase(
            app
        );

} catch (error) {

    console.error(
        "RiderX Realtime Database initialization failed:",
        error
    );

    throw error;

}


/* =========================================================
   STORAGE
========================================================= */

let storage;

try {

    storage =
        getStorage(
            app
        );

} catch (error) {

    console.error(
        "RiderX Firebase Storage initialization failed:",
        error
    );

    throw error;

}


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
   CENTRAL FIREBASE SERVICES
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
   READY STATE
========================================================= */

let firebaseReady = true;


/* =========================================================
   READY PROMISE
   ---------------------------------------------------------
   Firebase initialization is synchronous once this module
   has loaded successfully. Therefore the promise resolves
   immediately with the shared services.
========================================================= */

const firebaseReadyPromise =
    Promise.resolve(
        firebaseServices
    );


/* =========================================================
   READY STATE
========================================================= */

function isFirebaseReady() {

    return (
        firebaseReady === true
    );

}


/* =========================================================
   WAIT FOR FIREBASE
========================================================= */

function waitForFirebase() {

    return firebaseReadyPromise;

}


/* =========================================================
   GET FIREBASE
========================================================= */

function getFirebase() {

    return firebaseServices;

}


/* =========================================================
   GLOBAL COMPATIBILITY BRIDGE
   ---------------------------------------------------------
   This DOES NOT initialize Firebase.
   It only exposes the already-created instances for legacy
   RiderX pages/scripts.

   New code should use ES module imports.
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
        getFirebase;


    window.RiderX.isFirebaseReady =
        isFirebaseReady;


    window.RiderX.waitForFirebase =
        waitForFirebase;


    /*
       Dispatch only after all Firebase services
       have successfully initialized.
    */

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
            "RiderX Firebase ready event could not be dispatched:",
            error
        );

    }

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    /* Firebase */

    app,

    firebaseConfig,

    firebaseServices,


    /* Instances */

    auth,

    db,

    realtimeDb,

    storage,

    googleProvider,


    /* State */

    isFirebaseReady,

    waitForFirebase,

    getFirebase,


    /* =====================================================
       AUTH
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
       FIRESTORE
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
       STORAGE
    ===================================================== */

    storageRef,

    uploadBytes,

    uploadBytesResumable,

    getDownloadURL,

    deleteObject

};


/* =========================================================
   DEBUG
   ---------------------------------------------------------
   Never print the Firebase API key.
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
            Boolean(storage),

        ready:
            firebaseReady

    }
);
