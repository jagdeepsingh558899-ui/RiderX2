// =========================================
// RiderX Firebase Configuration
// =========================================

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
if (typeof firebase !== "undefined") {

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("RiderX Firebase Initialized");
    } else {
        firebase.app();
        console.log("RiderX Firebase Already Running");
    }


    // Firebase Services
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.database = firebase.database();
    window.storage = firebase.storage();

} else {
    console.error("Firebase SDK not loaded");
}
