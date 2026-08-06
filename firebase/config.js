// =================================
// RiderX Firebase Configuration
// =================================


// Firebase App

import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";


// Authentication

import { 
getAuth 
} from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


// Firestore Database

import { 
getFirestore 
} from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// Realtime Database

import { 
getDatabase 
} from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


// Storage

import { 
getStorage 
} from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";




// Firebase Config

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




// Services

const auth = getAuth(app);

const db = getFirestore(app);

const rtdb = getDatabase(app);

const storage = getStorage(app);




// Export

export {

app,

auth,

db,

rtdb,

storage

};
