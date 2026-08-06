// =====================================
// RiderX Firebase Configuration
// =====================================


// Firebase App

import { initializeApp } 
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";


// Authentication

import { getAuth } 
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


// Firestore Database

import { getFirestore } 
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// Storage

import { getStorage } 
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";


// Realtime Database

import { getDatabase } 
from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";





// =====================================
// YOUR FIREBASE CONFIG
// =====================================


const firebaseConfig = {


apiKey: "YOUR_API_KEY",


authDomain: "YOUR_PROJECT.firebaseapp.com",


projectId: "YOUR_PROJECT_ID",


storageBucket: "YOUR_PROJECT.appspot.com",


messagingSenderId: "YOUR_MESSAGING_SENDER_ID",


appId: "YOUR_APP_ID",


databaseURL:
"https://YOUR_PROJECT-default-rtdb.firebaseio.com"


};







// Initialize Firebase


const app = initializeApp(firebaseConfig);




// Firebase Services


const auth = getAuth(app);


const db = getFirestore(app);


const storage = getStorage(app);


const realtimeDB = getDatabase(app);





// Export


export {

app,

auth,

db,

storage,

realtimeDB,

firebaseConfig

};
