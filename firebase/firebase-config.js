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

   All RiderX modules should use the Firebase services
   exported from this file instead of initializing Firebase
   again.
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
   RIDERX FIREBASE CONFIGURATION
   ---------------------------------------------------------
   Project:
   riderx-1

   This configuration was supplied for the RiderX project.
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
   Firebase must only be initialized once per page.

   If another RiderX module has already initialized the
   default app, this file reuses that app.

   Otherwise this file initializes it.
========================================================= */

let app;


try {

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
        "RiderX Firebase Authentication initialization failed:",
        error
    );

    throw error;

}


/* =========================================================
   CLOUD FIRESTORE
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
   FIREBASE STORAGE
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
   SHARED RIDERX FIREBASE SERVICES
========================================================= */

const firebaseServices =
    Object.freeze({

        /* Firebase application */

        app,


        /* Authentication */

        auth,


        /* Firestore */

        db,

        firestore:
            db,


        /* Realtime Database */

        realtimeDb,

        database:
            realtimeDb,


        /* Storage */

        storage,


        /* Google Authentication */

        googleProvider

    });


/* =========================================================
   FIREBASE READY STATE
========================================================= */

let firebaseReady =
    false;


/* =========================================================
   MARK FIREBASE READY
========================================================= */

function markFirebaseReady() {

    firebaseReady =
        true;


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
            "RiderX Firebase ready event failed:",
            error
        );

    }

}


/* =========================================================
   FIREBASE READY CHECK
========================================================= */

function isFirebaseReady() {

    return (
        firebaseReady === true
    );

}


/* =========================================================
   GLOBAL RIDERX FIREBASE REFERENCES
   ---------------------------------------------------------
   These references DO NOT initialize Firebase again.

   They expose the already initialized Firebase services
   for legacy/non-module RiderX code.
========================================================= */

if (
    typeof window !== "undefined"
) {

    /* Main global reference */

    window.RiderXFirebase =
        firebaseServices;


    /* RX namespace */

    window.RX =
        window.RX ||
        {};


    window.RX.firebase =
        firebaseServices;


    /* RiderX namespace */

    window.RiderX =
        window.RiderX ||
        {};


    window.RiderX.firebase =
        firebaseServices;


    /* Firebase getter */

    window.RiderX.getFirebase =
        function () {

            return firebaseServices;

        };


    /* Ready-state getter */

    window.RiderX.isFirebaseReady =
        function () {

            return isFirebaseReady();

        };

}


/* =========================================================
   FIREBASE READY
   ---------------------------------------------------------
   All core Firebase services have been initialized before
   this function is called.
========================================================= */

markFirebaseReady();


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
       FIREBASE STATE
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
   DEBUG INFORMATION
   ---------------------------------------------------------
   Does not expose private credentials.
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
