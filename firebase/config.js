// =========================================
// RiderX Firebase Configuration
// =========================================

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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}


// Firebase Services
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

console.log("RiderX Firebase Connected Successfully");
