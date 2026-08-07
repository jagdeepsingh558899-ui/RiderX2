// RiderX Firebase Configuration
// Firebase v10 Modular SDK

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

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


// Firebase Project Configuration

const firebaseConfig = {
  apiKey: "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",
  authDomain: "riderx-1.firebaseapp.com",
  databaseURL: "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "riderx-1",
  storageBucket: "riderx-1.firebasestorage.app",
  messagingSenderId: "261640190671",
  appId: "1:261640190671:web:701b3ce5dcb6135fd955ba",
  measurementId: "G-SM8KLBVPWN"
};


// Initialize Firebase

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);


// Export

export {
  app,
  auth,
  db,
  storage,

  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,

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
};
