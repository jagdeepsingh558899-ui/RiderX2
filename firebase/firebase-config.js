// ======================================
// RiderX Firebase Configuration
// ======================================


// Firebase SDK

import { initializeApp } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import { getAuth } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import { getFirestore } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import { getStorage } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


import { getDatabase } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";





// Firebase Config

const firebaseConfig = {

apiKey: "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",

authDomain: "riderx-1.firebaseapp.com",

databaseURL:
"https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",

projectId: "riderx-1",

storageBucket:
"riderx-1.firebasestorage.app",

messagingSenderId:
"261640190671",

appId:
"1:261640190671:web:701b3ce5dcb6135fd955ba",

measurementId:
"G-SM8KLBVPWN"

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

realtimeDB

};
