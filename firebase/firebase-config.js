// RiderX Firebase Core Initialization (Compat Mode for PWA / Script Integration)
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "riderx-app.firebaseapp.com",
  projectId: "riderx-app",
  storageBucket: "riderx-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase App
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global Firebase Exports
const auth = firebase.auth();
const db = firebase.firestore();
const realtimeDb = firebase.database();
const storage = firebase.storage();

console.log("RiderX Firebase Services Initialized Successfully.");
