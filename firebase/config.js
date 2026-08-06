const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "riderx-1.firebaseapp.com",
  databaseURL: "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "riderx-1",
  storageBucket: "riderx-1.firebasestorage.app",
  messagingSenderId: "261640190671",
  appId: "1:261640190671:web:701b3ce5dcb6135fd955ba",
  measurementId: "G-SM8KLBVPWN"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
