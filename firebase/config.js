// =====================================
// RiderX Firebase Configuration
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

// Authentication
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// Firestore
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Storage
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

// Realtime Database
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Analytics (Optional)
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";

// =====================================
// FIREBASE CONFIG
// =====================================

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

// =====================================
// INITIALIZE FIREBASE
// =====================================

const app = initializeApp(firebaseConfig);

// Analytics
const analytics = getAnalytics(app);

// Services
const auth = getAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);

const realtimeDB = getDatabase(app);

// =====================================
// EXPORTS
// =====================================

export {

  app,

  analytics,

  auth,

  db,

  storage,

  realtimeDB,

  firebaseConfig

};
