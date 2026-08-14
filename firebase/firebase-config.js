/* =========================================================
   RIDERX 2.0
   FIREBASE CONFIGURATION
   =========================================================

   CANONICAL FIREBASE CONFIGURATION

   Firebase SDK:
   12.2.1

   Firebase Services:
   - Firebase Authentication
   - Cloud Firestore
   - Firebase Realtime Database

   External File Storage:
   - Backblaze B2 Cloud Storage

   IMPORTANT:
   ---------------------------------------------------------
   Firebase Storage is NOT used by RiderX.

   RiderX file/media uploads must use the approved
   Backblaze B2 upload architecture.

   B2 secret/application credentials MUST NEVER be placed
   inside this browser-side configuration file.

   Authentication source of truth:
   - Firebase Authentication

   Database source of truth:
   - Cloud Firestore / Realtime Database

   Browser storage:
   - NOT an authentication source of truth
   ========================================================= */

"use strict";


/* =========================================================
   FIREBASE SDK VERSION
   ========================================================= */

const FIREBASE_SDK_VERSION = "12.2.1";

const FIREBASE_SDK_BASE =
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;


/* =========================================================
   FIREBASE APP
   ========================================================= */

import {
    initializeApp,
    getApps
} from `${FIREBASE_SDK_BASE}/firebase-app.js`;


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
} from `${FIREBASE_SDK_BASE}/firebase-auth.js`;


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
} from `${FIREBASE_SDK_BASE}/firebase-firestore.js`;


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
} from `${FIREBASE_SDK_BASE}/firebase-database.js`;


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

    /*
     * Firebase Storage is intentionally NOT configured.
     *
     * RiderX uses Backblaze B2 for file/media storage.
     */
    storageBucket:
        undefined,

    messagingSenderId:
        "261640190671",

    appId:
        "1:261640190671:web:701b3ce5dcb6135fd955ba",

    measurementId:
        "G-SM8KLBVPWN"

});


/* =========================================================
   FIREBASE APPLICATION
   ========================================================= */

let app;

try {

    const existingApps =
        getApps();

    const existingDefaultApp =
        existingApps.find(
            firebaseApp =>
                firebaseApp.name === "[DEFAULT]"
        );

    app =
        existingDefaultApp ||
        initializeApp(firebaseConfig);

} catch (error) {

    console.error(
        "RiderX: Firebase application initialization failed.",
        error
    );

    throw new Error(
        "RiderX Firebase application could not be initialized."
    );

}


/* =========================================================
   FIREBASE AUTH
   ========================================================= */

let auth;

try {

    auth =
        getAuth(app);

} catch (error) {

    console.error(
        "RiderX: Firebase Authentication initialization failed.",
        error
    );

    throw new Error(
        "RiderX Firebase Authentication could not be initialized."
    );

}


/* =========================================================
   CLOUD FIRESTORE
   ========================================================= */

let db;

try {

    db =
        getFirestore(app);

} catch (error) {

    console.error(
        "RiderX: Cloud Firestore initialization failed.",
        error
    );

    throw new Error(
        "RiderX Cloud Firestore could not be initialized."
    );

}


/* =========================================================
   REALTIME DATABASE
   ========================================================= */

let realtimeDb;

try {

    realtimeDb =
        getDatabase(app);

} catch (error) {

    console.error(
        "RiderX: Realtime Database initialization failed.",
        error
    );

    throw new Error(
        "RiderX Realtime Database could not be initialized."
    );

}


/* =========================================================
   GOOGLE AUTH PROVIDER
   ========================================================= */

const googleProvider =
    new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: "select_account"
});


/* =========================================================
   CANONICAL FIREBASE SERVICES
   =========================================================

   IMPORTANT:
   ---------------------------------------------------------
   There is deliberately NO Firebase Storage object here.

   File storage is handled by Backblaze B2 through the
   dedicated secure upload architecture.

   Never add B2 secret credentials here.
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

        /* Google Authentication */
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
        realtimeDb
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

    return Boolean(

        firebaseReady &&

        app &&

        auth &&

        db &&

        realtimeDb

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
   FIREBASE SERVICE VALIDATION
   ========================================================= */

function assertFirebaseReady() {

    if (!isFirebaseReady()) {

        throw new Error(
            "RiderX Firebase services are unavailable."
        );

    }

    return firebaseServices;

}


/* =========================================================
   GLOBAL RIDERX FIREBASE BRIDGE
   =========================================================

   These bridges exist for compatibility with older RiderX
   pages while the project is migrated toward direct ES
   module imports.

   Firebase remains initialized exactly once.
   ========================================================= */

if (
    typeof window !== "undefined"
) {

    /*
     * Primary global bridge.
     */
    window.RiderXFirebase =
        firebaseServices;


    /*
     * Legacy/shared namespace.
     */
    window.RX =
        window.RX || {};


    window.RX.firebase =
        firebaseServices;


    /*
     * Main RiderX namespace.
     */
    window.RiderX =
        window.RiderX || {};


    window.RiderX.firebase =
        firebaseServices;


    window.RiderX.getFirebase =
        getFirebase;


    window.RiderX.isFirebaseReady =
        isFirebaseReady;


    window.RiderX.waitForFirebase =
        waitForFirebase;


    window.RiderX.assertFirebaseReady =
        assertFirebaseReady;


    /*
     * Explicit B2 marker.
     *
     * This does NOT contain credentials.
     *
     * It only tells the application that Firebase Storage
     * is intentionally not part of the RiderX architecture.
     */
    window.RiderX.storageProvider =
        "backblaze-b2";


    window.RiderX.firebaseStorageEnabled =
        false;


    /* =====================================================
       FIREBASE READY EVENT
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


    /*
     * Firebase initialization above is synchronous.
     *
     * Dispatch asynchronously so modules that are already
     * loading on the page can register their listeners first.
     */
    if (
        typeof queueMicrotask ===
        "function"
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

    /* -----------------------------------------------------
       Firebase Core
       ----------------------------------------------------- */

    FIREBASE_SDK_VERSION,

    FIREBASE_SDK_BASE,

    app,

    firebaseConfig,

    firebaseServices,


    /* -----------------------------------------------------
       Firebase Services
       ----------------------------------------------------- */

    auth,

    db,

    realtimeDb,

    googleProvider,


    /* -----------------------------------------------------
       Firebase Helpers
       ----------------------------------------------------- */

    isFirebaseReady,

    waitForFirebase,

    getFirebase,

    assertFirebaseReady,


    /* -----------------------------------------------------
       Firebase Authentication
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       Cloud Firestore
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       Firebase Realtime Database
       ----------------------------------------------------- */

    ref,

    set,

    get,

    update,

    remove,

    push,

    onValue,

    off,

    onDisconnect,

    databaseServerTimestamp

};


/* =========================================================
   DEVELOPMENT DIAGNOSTICS
   ========================================================= */

console.info(
    "RiderX Firebase initialized successfully.",
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

        firebaseStorage:
            false,

        externalStorage:
            "backblaze-b2",

        ready:
            isFirebaseReady()

    }
);
