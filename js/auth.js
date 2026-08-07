// js/auth.js
// Handles Authentication, Registration, Session Guards & Role Redirection

import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "../firebase/firebase-config.js";

// Session Listener & Guard
onAuthStateChanged(auth, async (user) => {
  const currentPath = window.location.pathname;

  if (user) {
    // Fetch User Role
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        redirectByRole(userData.role, currentPath);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  } else {
    // Protected Path Enforcement
    if (currentPath.includes("/customer/") || currentPath.includes("/rider/") || currentPath.includes("/admin/")) {
      window.location.href = "../auth/login.html";
    }
  }
});

// Role Redirection Logic
function redirectByRole(role, path) {
  if (path.includes("/auth/")) {
    if (role === "admin") window.location.href = "../admin/dashboard.html";
    else if (role === "rider") window.location.href = "../rider/dashboard.html";
    else window.location.href = "../customer/book.html";
  }
}

// Signup Form Listener
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("error-message");
    errorEl.style.display = "none";

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Save User Doc in Firestore
      await setDoc(doc(db, "users", uid), {
        uid: uid,
        fullName: fullName,
        email: email,
        phone: phone,
        role: role,
        walletBalance: 0,
        status: role === "rider" ? "pending_approval" : "active",
        createdAt: serverTimestamp()
      });

      if (role === "rider") {
        await setDoc(doc(db, "drivers", uid), {
          driverId: uid,
          fullName: fullName,
          isOnline: false,
          currentLocation: { lat: 0, lng: 0 },
          activeRideId: null
        });
      }

      redirectByRole(role, window.location.pathname);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    }
  });
}

// Login Form Listener
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("error-message");
    errorEl.style.display = "none";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      errorEl.textContent = "Invalid email or password.";
      errorEl.style.display = "block";
    }
  });
}

// Global Logout Handler
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "../auth/login.html";
}
