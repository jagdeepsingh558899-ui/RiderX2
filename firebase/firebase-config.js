/* =========================================================
   RIDERX 2.0
   FIREBASE CONFIGURATION
   File: firebase/firebase-config.js

   CANONICAL FIREBASE CONFIGURATION

   Firebase SDK:
   12.2.1

   Services:
   - Firebase Authentication
   - Cloud Firestore
   - Realtime Database
   - Firebase Storage

   IMPORTANT:
   This is the ONLY RiderX page-side Firebase
   initialization file.

   No other RiderX page/module should call:
       initializeApp()

   Feature modules should import Firebase services
   from this file.
========================================================= */

"use strict";


/* =========================================================
   FIREBASE SDK
========================================================= */

const FIREBASE_SDK_VERSION = "12.2.1";

const FIREBASE_BASE_URL =
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;


/* =========================================================
   FIREBASE APP
========================================================= */

import {
    initializeApp,
    getApps
} from `${FIREBASE_BASE_URL}/firebase-app.js`;


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
} from `${FIREBASE_BASE_URL}/firebase-auth.js`;


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
} from `${FIREBASE_BASE_URL}/firebase-firestore.js`;


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
} from `${FIREBASE_BASE_URL}/firebase-database.js`;


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
} from `${FIREBASE_BASE_URL}/firebase-storage.js`;


/* =========================================================
   RIDERX FIREBASE CONFIGURATION
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
   Reuse the existing default Firebase app if one already
   exists. Otherwise initialize exactly one default app.

   IMPORTANT:
   No other RiderX file should call initializeApp().
========================================================= */

let app = null;

try {

    const existingApps =
        getApps();


    app =
        existingApps.find(
            firebaseApp =>
                firebaseApp.name === "[DEFAULT]"
        ) || null;


    if (!app) {

        app =
            initializeApp(
                firebaseConfig
            );

    }

} catch (error) {

    console.error(
        "RiderX: Firebase app initialization failed.",
        error
    );

    throw error;

}


/* =========================================================
   FIREBASE AUTH
========================================================= */

let auth = null;

try {

    auth =
        getAuth(
            app
        );

} catch (error) {

    console.error(
        "RiderX: Firebase Authentication initialization failed.",
        error
    );

    throw error;

}


/* =========================================================
   CLOUD FIRESTORE
========================================================= */

let db = null;

try {

    db =
        getFirestore(
            app
        );

} catch (error) {

    console.error(
        "RiderX: Cloud Firestore initialization failed.",
        error
    );

    throw error;

}


/* =========================================================
   REALTIME DATABASE
========================================================= */

let realtimeDb = null;

try {

    realtimeDb =
        getDatabase(
            app
        );

} catch (error) {

    console.error(
        "RiderX: Realtime Database initialization failed.",
        error
    );

    throw error;

}


/* =========================================================
   FIREBASE STORAGE
========================================================= */

let storage = null;

try {

    storage =
        getStorage(
            app
        );

} catch (error) {

    console.error(
        "RiderX: Firebase Storage initialization failed.",
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
   FIREBASE READY STATE
========================================================= */

const firebaseReady =
    Boolean(
        app &&
        auth &&
        db &&
        realtimeDb &&
        storage
    );


/* =========================================================
   FIREBASE READY PROMISE
========================================================= */

const firebaseReadyPromise =
    firebaseReady
        ? Promise.resolve(
            firebaseServices
        )
        : Promise.reject(
            new Error(
                "RiderX Firebase services are not ready."
            )
        );


/* =========================================================
   CHECK FIREBASE READY
========================================================= */

function isFirebaseReady() {

    return (
        firebaseReady === true &&
        Boolean(app) &&
        Boolean(auth) &&
        Boolean(db) &&
        Boolean(realtimeDb) &&
        Boolean(storage)
    );

}


/* =========================================================
   WAIT FOR FIREBASE
========================================================= */

function waitForFirebase() {

    return firebaseReadyPromise;

}


/* =========================================================
   GET FIREBASE SERVICES
========================================================= */

function getFirebase() {

    return firebaseServices;

}


/* =========================================================
   LEGACY COMPATIBILITY BRIDGE
   ---------------------------------------------------------
   This bridge DOES NOT initialize Firebase.

   It only exposes already initialized RiderX Firebase
   instances to older non-module scripts/pages.

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


    /* =====================================================
       FIREBASE READY EVENT
       -----------------------------------------------------
       Dispatch asynchronously so page scripts have time
       to register their listeners.
    ===================================================== */

    const dispatchReadyEvent =
        () => {

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
                    "RiderX: Firebase ready event could not be dispatched.",
                    error
                );

            }

        };


    if (
        typeof queueMicrotask === "function"
    ) {

        queueMicrotask(
            dispatchReadyEvent
        );

    } else {

        setTimeout(
            dispatchReadyEvent,
            0
        );

    }

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    /* =====================================================
       FIREBASE APP / CONFIG
    ===================================================== */

    app,

    firebaseConfig,

    firebaseServices,


    /* =====================================================
       FIREBASE INSTANCES
    ===================================================== */

    auth,

    db,

    realtimeDb,

    storage,

    googleProvider,


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
   Never print:
   - API key
   - Auth credentials
   - User tokens
   - Firebase secrets
========================================================= */

console.info(
    "RiderX Firebase initialized.",
    {

        sdk:
            FIREBASE_SDK_VERSION,

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
            isFirebaseReady()

    }
);
