// =================================
// RiderX Firebase Configuration
// =================================


// Firebase App
import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";


// Firebase Authentication
import { getAuth } from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


// Firestore Database
import { getFirestore } from 
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// Firebase Configuration

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


// Export Services

export const auth = getAuth(app);

export const db = getFirestore(app);
