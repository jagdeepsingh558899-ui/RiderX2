// ============================================================
// RiderX Firebase Configuration
// FINAL CENTRAL FIREBASE CONFIG
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";


// ============================================================
// FIREBASE PROJECT CONFIG
// ============================================================

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


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app =
  initializeApp(firebaseConfig);


// ============================================================
// FIREBASE SERVICES
// ============================================================

const auth =
  getAuth(app);

const db =
  getFirestore(app);

const storage =
  getStorage(app);

const rtdb =
  getDatabase(app);


// ============================================================
// EXPORT RIDERX FIREBASE SERVICES
// ============================================================

export {

  // Firebase App
  app,

  // Firebase Authentication
  auth,

  // Firestore
  db,

  // Firebase Storage
  storage,

  // Realtime Database
  rtdb,

  // ----------------------------------------------------------
  // Authentication Functions
  // ----------------------------------------------------------

  createUserWithEmailAndPassword,

  signInWithEmailAndPassword,

  signOut,

  onAuthStateChanged,

  // ----------------------------------------------------------
  // Firestore Functions
  // ----------------------------------------------------------

  doc,

  setDoc,

  getDoc,

  updateDoc,

  collection,

  addDoc,

  query,

  where,

  onSnapshot,

  runTransaction,

  serverTimestamp,

  // ----------------------------------------------------------
  // Realtime Database Functions
  // ----------------------------------------------------------

  ref,

  set,

  get,

  update,

  remove,

  onValue,

  off
};
