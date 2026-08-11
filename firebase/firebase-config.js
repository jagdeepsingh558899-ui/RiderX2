/* =========================================================
   RIDERX 2.0
   FIREBASE CONFIGURATION
   File: firebase/firebase-config.js

   FIREBASE SDK:
   10.8.0

   SERVICES:
   - Firebase Authentication
   - Cloud Firestore
   - Realtime Database
   - Firebase Storage

   ARCHITECTURE:
   - SINGLE Firebase initialization point
   - SINGLE default Firebase app
   - Shared service instances
   - Modular Firebase SDK
   - No Firebase initialization in feature modules
   - Compatibility bridge for legacy RiderX code

   IMPORTANT:
   Application modules MUST import Firebase services from
   this file.

   Do NOT call initializeApp() anywhere else in RiderX.
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

   NOTE:
   Firebase Web configuration is client-side configuration.
   The API key is NOT treated as a private server secret.

   Real security MUST be enforced through:
   - Firebase Authentication
   - Firestore Security Rules
   - Realtime Database Security Rules
   - Storage Security Rules
   - Google/Firebase API restrictions

   Project:
   riderx-1
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
   INTERNAL CONSTANTS
========================================================= */

const FIREBASE_DEFAULT_APP_NAME = "[DEFAULT]";


/* =========================================================
   FIREBASE APP INITIALIZATION
   ---------------------------------------------------------
   This is the ONLY initializeApp() call in RiderX.

   If the default app already exists, it is reused.

   Named Firebase applications are ignored here because
   RiderX intentionally operates on one default application.
========================================================= */

let app;

try {

    const existingApps = getApps();

    const defaultAppExists =
        existingApps.some(
            firebaseApp =>
                firebaseApp.name ===
                FIREBASE_DEFAULT_APP_NAME
        );


    if (defaultAppExists) {

        app = getApp();

    } else {

        app = initializeApp(
            firebaseConfig
        );

    }

} catch (error) {

    console.error(
        "RiderX Firebase app initialization failed.",
        error
    );

    throw new Error(
        "RiderX Firebase could not be initialized."
    );

}


/* =========================================================
   FIREBASE AUTHENTICATION INSTANCE
========================================================= */

let auth;

try {

    auth = getAuth(app);

} catch (error) {

    console.error(
        "RiderX Firebase Authentication initialization failed.",
        error
    );

    throw new Error(
        "RiderX Firebase Authentication could not be initialized."
    );

}


/* =========================================================
   CLOUD FIRESTORE INSTANCE
========================================================= */

let db;

try {

    db = getFirestore(app);

} catch (error) {

    console.error(
        "RiderX Cloud Firestore initialization failed.",
        error
    );

    throw new Error(
        "RiderX Cloud Firestore could not be initialized."
    );

}


/* =========================================================
   REALTIME DATABASE INSTANCE
========================================================= */

let realtimeDb;

try {

    realtimeDb = getDatabase(app);

} catch (error) {

    console.error(
        "RiderX Firebase Realtime Database initialization failed.",
        error
    );

    throw new Error(
        "RiderX Realtime Database could not be initialized."
    );

}


/* =========================================================
   FIREBASE STORAGE INSTANCE
========================================================= */

let storage;

try {

    storage = getStorage(app);

} catch (error) {

    console.error(
        "RiderX Firebase Storage initialization failed.",
        error
    );

    throw new Error(
        "RiderX Firebase Storage could not be initialized."
    );

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
   CENTRAL RIDERX FIREBASE SERVICES
   ---------------------------------------------------------
   This is the primary shared Firebase object.

   Preferred usage:

       import {
           firebaseServices
       } from "../firebase/firebase-config.js";

   Or import individual services directly.
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


        /* Google authentication */

        googleProvider

    });


/* =========================================================
   FIREBASE READY STATE
========================================================= */

let firebaseReady = false;

let firebaseReadyResolve;

let firebaseReadyReject;


/* =========================================================
   FIREBASE READY PROMISE
   ---------------------------------------------------------
   A Promise is provided so modules loaded after this file
   can safely wait for Firebase without depending only on
   a browser event that may already have fired.
========================================================= */

const firebaseReadyPromise =
    new Promise(
        (resolve, reject) => {

            firebaseReadyResolve =
                resolve;

            firebaseReadyReject =
                reject;

        }
    );


/* =========================================================
   FIREBASE ERROR NORMALIZER
========================================================= */

function normalizeFirebaseError(
    error,
    fallbackMessage
) {

    if (
        error &&
        typeof error === "object"
    ) {

        return {

            code:
                typeof error.code === "string"
                    ? error.code
                    : "firebase/unknown",

            message:
                typeof error.message === "string"
                    ? error.message
                    : fallbackMessage,

            originalError:
                error

        };

    }


    return {

        code:
            "firebase/unknown",

        message:
            fallbackMessage,

        originalError:
            error

    };

}


/* =========================================================
   FIREBASE READY EVENT
========================================================= */

function markFirebaseReady() {

    if (firebaseReady === true) {

        return;

    }


    firebaseReady = true;


    firebaseReadyResolve(
        firebaseServices
    );


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
            "RiderX Firebase ready event dispatch failed.",
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
   WAIT FOR FIREBASE
   ---------------------------------------------------------
   Allows application modules to safely wait for the
   centralized Firebase services.

   Usage:

       const firebase =
           await waitForFirebase();

========================================================= */

function waitForFirebase() {

    if (firebaseReady === true) {

        return Promise.resolve(
            firebaseServices
        );

    }


    return firebaseReadyPromise;

}


/* =========================================================
   GET FIREBASE SERVICES
   ---------------------------------------------------------
   Synchronous helper for modules that are already loaded
   after this configuration module has initialized.
========================================================= */

function getFirebase() {

    return firebaseServices;

}


/* =========================================================
   GLOBAL RIDERX FIREBASE REFERENCES
   ---------------------------------------------------------
   These references DO NOT initialize Firebase.

   They exist only as compatibility bridges for existing
   non-module/legacy RiderX pages.

   New code SHOULD use ES module imports instead.
========================================================= */

if (
    typeof window !== "undefined"
) {

    /* -----------------------------------------------------
       Main Firebase reference
    ----------------------------------------------------- */

    window.RiderXFirebase =
        firebaseServices;


    /* -----------------------------------------------------
       RX namespace
    ----------------------------------------------------- */

    window.RX =
        window.RX ||
        {};


    window.RX.firebase =
        firebaseServices;


    /* -----------------------------------------------------
       RiderX namespace
    ----------------------------------------------------- */

    window.RiderX =
        window.RiderX ||
        {};


    window.RiderX.firebase =
        firebaseServices;


    /* -----------------------------------------------------
       Firebase getter
    ----------------------------------------------------- */

    window.RiderX.getFirebase =
        getFirebase;


    /* -----------------------------------------------------
       Firebase ready-state getter
    ----------------------------------------------------- */

    window.RiderX.isFirebaseReady =
        isFirebaseReady;


    /* -----------------------------------------------------
       Firebase wait helper
    ----------------------------------------------------- */

    window.RiderX.waitForFirebase =
        waitForFirebase;

}


/* =========================================================
   MARK FIREBASE AS READY
   ---------------------------------------------------------
   At this point all core Firebase services have already
   been initialized successfully.
========================================================= */

try {

    markFirebaseReady();

} catch (error) {

    const normalizedError =
        normalizeFirebaseError(
            error,
            "RiderX Firebase ready-state initialization failed."
        );


    firebaseReadyReject(
        normalizedError
    );


    console.error(
        "RiderX Firebase ready-state initialization failed.",
        normalizedError
    );

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
       FIREBASE CONFIGURATION
    ===================================================== */

    firebaseConfig,


    /* =====================================================
       FIREBASE STATE / HELPERS
    ===================================================== */

    isFirebaseReady,

    waitForFirebase,

    getFirebase,


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
   DEBUG INFORMATION
   ---------------------------------------------------------
   Only non-sensitive service initialization state is
   logged.

   The Firebase API key is intentionally NOT logged.
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
