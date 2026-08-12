/* =========================================================
   GO BIKE — FIREBASE CONFIGURATION
   ========================================================= */

"use strict";


/* =========================================================
   FIREBASE SDK VERSION
   ========================================================= */

const FIREBASE_SDK_VERSION = "12.2.1";

const FIREBASE_SDK_BASE =
    "https://www.gstatic.com/firebasejs/12.2.1";


/* =========================================================
   FIREBASE APP
   ========================================================= */

import {
    initializeApp,
    getApps
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";


/* =========================================================
   FIREBASE AUTH
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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


/* =========================================================
   FIRESTORE
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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",
    authDomain: "riderx-1.firebaseapp.com",
    databaseURL:
        "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "riderx-1",
    storageBucket: "riderx-1.firebasestorage.app",
    messagingSenderId: "261640190671",
    appId: "1:261640190671:web:701b3ce5dcb6135fd955ba",
    measurementId: "G-SM8KLBVPWN"
};


/* =========================================================
   INITIALIZE FIREBASE APP
   ========================================================= */

let app;

try {
    const existingApps = getApps();

    app =
        existingApps.find(
            firebaseApp => firebaseApp.name === "[DEFAULT]"
        ) ||
        initializeApp(firebaseConfig);

} catch (error) {

    console.error(
        "GO BIKE: Firebase initialization failed:",
        error
    );

    throw error;
}


/* =========================================================
   AUTH
   ========================================================= */

let auth;

try {

    auth = getAuth(app);

} catch (error) {

    console.error(
        "GO BIKE: Firebase Auth initialization failed:",
        error
    );

    throw error;
}


/* =========================================================
   FIRESTORE
   ========================================================= */

let db;

try {

    db = getFirestore(app);

} catch (error) {

    console.error(
        "GO BIKE: Firestore initialization failed:",
        error
    );

    throw error;
}


/* =========================================================
   REALTIME DATABASE
   ========================================================= */

let realtimeDb;

try {

    realtimeDb = getDatabase(app);

} catch (error) {

    console.error(
        "GO BIKE: Realtime Database initialization failed:",
        error
    );

    throw error;
}


/* =========================================================
   STORAGE
   ========================================================= */

let storage;

try {

    storage = getStorage(app);

} catch (error) {

    console.error(
        "GO BIKE: Firebase Storage initialization failed:",
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
    prompt: "select_account"
});


/* =========================================================
   FIREBASE SERVICES
   ========================================================= */

const firebaseServices = Object.freeze({

    app,

    auth,

    db,

    firestore: db,

    realtimeDb,

    database: realtimeDb,

    storage,

    googleProvider

});


/* =========================================================
   FIREBASE READY
   ========================================================= */

const firebaseReady = Boolean(
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
        ? Promise.resolve(firebaseServices)
        : Promise.reject(
            new Error(
                "GO BIKE Firebase services are not ready."
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
        realtimeDb &&
        storage
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
   GLOBAL BRIDGE
   ========================================================= */

if (typeof window !== "undefined") {

    window.RiderXFirebase =
        firebaseServices;


    window.RX =
        window.RX || {};


    window.RX.firebase =
        firebaseServices;


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


    /* =====================================================
       FIREBASE READY EVENT
       ===================================================== */

    const dispatchReadyEvent = () => {

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
                "GO BIKE: Firebase ready event failed:",
                error
            );

        }

    };


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

    /* Firebase */
    FIREBASE_SDK_VERSION,

    app,

    firebaseConfig,

    firebaseServices,

    /* Services */
    auth,

    db,

    realtimeDb,

    storage,

    googleProvider,

    /* Helpers */
    isFirebaseReady,

    waitForFirebase,

    getFirebase,

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

    deleteObject

};


/* =========================================================
   DEBUG
   ========================================================= */

console.info(
    "GO BIKE Firebase initialized successfully.",
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
