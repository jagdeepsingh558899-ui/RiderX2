/**
 * RiderX - Firebase Centralized Configuration & Initialization
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase App if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database ? firebase.database() : null;
const storage = firebase.storage ? firebase.storage() : null;

// Enable Firestore Persistent Cache for offline capabilities
db.settings({ timestampsInSnapshots: true });

console.log("RiderX Firebase Core System Online.");
