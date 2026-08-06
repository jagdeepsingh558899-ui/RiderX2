/**
 * RiderX Premium Ride Hailing Super App
 * Authentication & Firestore Logic Module (js/auth.js)
 * Firebase v10 Modular SDK Implementation
 */

import { 
    auth, 
    db, 
    storage, 
    googleProvider 
} from '../firebase/firebase-config.js';

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/* ==========================================================================
   UI UTILITIES & TOAST NOTIFICATIONS
   ========================================================================== */

/**
 * Show global toast notification
 * @param {string} message - Message text
 * @param {string} type - 'success' | 'error' | 'info'
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#00e676' : type === 'error' ? '#ff4d4d' : '#ffe500';
    const textColor = type === 'info' ? '#000000' : '#ffffff';

    toast.style.cssText = `
        background: rgba(18, 18, 22, 0.95);
        color: ${textColor};
        border-left: 4px solid ${bgColor};
        padding: 14px 20px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 280px;
        max-width: 380px;
        pointer-events: auto;
        opacity: 0;
        transform: translateX(50px);
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    const iconClass = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-bell';
    toast.innerHTML = `<i class="fa-solid ${iconClass}" style="color: ${bgColor}; font-size: 1.1rem;"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function toastSuccess(msg) { showToast(msg, 'success'); }
export function toastError(msg) { showToast(msg, 'error'); }

/**
 * Loading Spinner Management
 */
export function showLoader() {
    let loader = document.getElementById('riderx-global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'riderx-global-loader';
        loader.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 10, 12, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 99998;
        `;
        loader.innerHTML = `
            <div style="text-align: center;">
                <div class="riderx-spinner" style="
                    width: 50px; height: 50px;
                    border: 4px solid rgba(255, 229, 0, 0.2);
                    border-top: 4px solid #FFE500;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 15px auto;">
                </div>
                <div style="color: #FFE500; font-family: 'Poppins', sans-serif; font-weight: 600; letter-spacing: 1px;">RIDER<span style="color: #FFF;">X</span></div>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
}

export function hideLoader() {
    const loader = document.getElementById('riderx-global-loader');
    if (loader) loader.style.display = 'none';
}

/**
 * Toggle Password Field Visibility
 */
export function togglePasswordVisibility(inputFieldId, iconElement) {
    const input = document.getElementById(inputFieldId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (iconElement) {
            iconElement.classList.remove('fa-eye');
            iconElement.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (iconElement) {
            iconElement.classList.remove('fa-eye-slash');
            iconElement.classList.add('fa-eye');
        }
    }
}

export function showPassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.type = 'text';
}

export function hidePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.type = 'password';
}

/**
 * Calculate Password Strength
 * @param {string} password 
 * @returns {number} Score between 0 and 100
 */
export function checkPasswordStrength(password) {
    let score = 0;
    if (!password) return score;
    if (password.length >= 6) score += 25;
    if (password.match(/[A-Z]/)) score += 25;
    if (password.match(/[0-9]/)) score += 25;
    if (password.match(/[^A-Za-z0-9]/)) score += 25;
    return score;
}

/**
 * Form Input Validation Helper
 */
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

export function validatePhone(phone) {
    const re = /^\+?[1-9]\d{9,14}$/;
    return re.test(String(phone).replace(/\s+/g, ''));
}

export function setButtonLoading(buttonId, isLoading, originalText = 'Submit') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...`;
        btn.style.opacity = '0.7';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalHtml || originalText;
        btn.style.opacity = '1';
    }
}

export function disableButtons(buttonIds = []) {
    buttonIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = true;
    });
}

export function enableButtons(buttonIds = []) {
    buttonIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });
}

/* ==========================================================================
   FILE UPLOAD HELPERS
   ========================================================================== */

/**
 * Upload file to Firebase Storage
 * @param {File} file 
 * @param {string} path 
 * @returns {Promise<string>} Download URL
 */
async function uploadFile(file, path) {
    if (!file) return '';
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
}

/* ==========================================================================
   ROLE CHECK & REDIRECTION ENGINE
   ========================================================================== */

/**
 * Evaluates authenticated user role and routes to correct page
 * @param {Object} user - Firebase Auth User
 */
export async function routeUserByRole(user) {
    showLoader();
    try {
        // Check Customers Collection
        const customerDocRef = doc(db, 'customers', user.uid);
        const customerSnap = await getDoc(customerDocRef);

        if (customerSnap.exists()) {
            hideLoader();
            window.location.href = '../customer/Home.html';
            return;
        }

        // Check Riders Collection
        const riderDocRef = doc(db, 'riders', user.uid);
        const riderSnap = await getDoc(riderDocRef);

        if (riderSnap.exists()) {
            const riderData = riderSnap.data();
            hideLoader();
            if (riderData.adminApproved === true) {
                window.location.href = '../rider/Home.html';
            } else {
                window.location.href = '../rider/pending.html';
            }
            return;
        }

        // Default: Document not found in either collection
        hideLoader();
        window.location.href = '../auth/register.html';

    } catch (error) {
        console.error("Routing Error:", error);
        hideLoader();
        toastError("Failed to verify user profile.");
    }
}

/**
 * Specific check for Rider Approval Status
 * @param {string} uid 
 */
export async function checkRiderApproval(uid) {
    try {
        const riderDocRef = doc(db, 'riders', uid);
        const riderSnap = await getDoc(riderDocRef);
        if (riderSnap.exists()) {
            return riderSnap.data().adminApproved === true;
        }
        return false;
    } catch (error) {
        console.error("Error checking rider approval:", error);
        return false;
    }
}

/* ==========================================================================
   AUTHENTICATION FUNCTIONS
   ========================================================================== */

/**
 * Customer Email/Password Login
 */
export async function loginCustomer(email, password, rememberMe = false) {
    showLoader();
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        if (rememberMe) {
            localStorage.setItem('riderx_remembered_email', email);
        } else {
            localStorage.removeItem('riderx_remembered_email');
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        toastSuccess("Welcome back!");
        await routeUserByRole(userCredential.user);
    } catch (error) {
        hideLoader();
        toastError(error.message || "Login failed. Check credentials.");
        throw error;
    }
}

/**
 * Rider Email/Password Login
 */
export async function loginRider(email, password, rememberMe = false) {
    showLoader();
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        if (rememberMe) {
            localStorage.setItem('riderx_remembered_email', email);
        } else {
            localStorage.removeItem('riderx_remembered_email');
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        toastSuccess("Authenticating Rider profile...");
        await routeUserByRole(userCredential.user);
    } catch (error) {
        hideLoader();
        toastError(error.message || "Rider login failed.");
        throw error;
    }
}

/**
 * Customer Account Registration
 */
export async function registerCustomer(data) {
    const { email, password, fullName, phone, photoFile } = data;

    if (!validateEmail(email)) {
        toastError("Invalid email address format.");
        return;
    }

    showLoader();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let photoURL = '';
        if (photoFile) {
            photoURL = await uploadFile(photoFile, `customers/profiles/${user.uid}`);
        }

        await updateProfile(user, { displayName: fullName, photoURL: photoURL });

        const customerDoc = {
            uid: user.uid,
            name: fullName,
            email: email,
            phone: phone || '',
            role: 'customer',
            photoURL: photoURL,
            createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'customers', user.uid), customerDoc);
        toastSuccess("Registration successful!");
        hideLoader();
        window.location.href = '../customer/Home.html';
    } catch (error) {
        hideLoader();
        toastError(error.message || "Customer registration failed.");
        throw error;
    }
}

/**
 * Rider Account Registration
 */
export async function registerRider(data) {
    const { 
        email, 
        password, 
        fullName, 
        phone, 
        vehicleType, 
        vehicleNumber, 
        licenseNumber, 
        aadhaarNumber, 
        rcFile, 
        licenseFile, 
        photoFile 
    } = data;

    if (!validateEmail(email)) {
        toastError("Invalid email address format.");
        return;
    }

    showLoader();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Upload files concurrently
        const [rcImage, licenseImage, photoURL] = await Promise.all([
            rcFile ? uploadFile(rcFile, `riders/documents/${user.uid}/rc`) : Promise.resolve(''),
            licenseFile ? uploadFile(licenseFile, `riders/documents/${user.uid}/license`) : Promise.resolve(''),
            photoFile ? uploadFile(photoFile, `riders/profiles/${user.uid}`) : Promise.resolve('')
        ]);

        await updateProfile(user, { displayName: fullName, photoURL: photoURL });

        const riderDoc = {
            uid: user.uid,
            name: fullName,
            email: email,
            phone: phone || '',
            role: 'rider',
            photoURL: photoURL,
            vehicleType: vehicleType || '',
            vehicleNumber: vehicleNumber || '',
            licenseNumber: licenseNumber || '',
            aadhaarNumber: aadhaarNumber || '',
            rcImage: rcImage,
            licenseImage: licenseImage,
            adminApproved: false,
            status: 'Pending',
            createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'riders', user.uid), riderDoc);
        toastSuccess("Rider application submitted successfully!");
        hideLoader();
        window.location.href = '../rider/pending.html';
    } catch (error) {
        hideLoader();
        toastError(error.message || "Rider registration failed.");
        throw error;
    }
}

/**
 * Google Sign In / Registration
 */
export async function loginWithGoogle() {
    showLoader();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Determine if existing user in either collection
        const customerSnap = await getDoc(doc(db, 'customers', user.uid));
        const riderSnap = await getDoc(doc(db, 'riders', user.uid));

        if (!customerSnap.exists() && !riderSnap.exists()) {
            // New User Defaults to Customer Profile
            await setDoc(doc(db, 'customers', user.uid), {
                uid: user.uid,
                name: user.displayName || 'Customer',
                email: user.email,
                phone: user.phoneNumber || '',
                role: 'customer',
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp()
            });
            hideLoader();
            toastSuccess("Google account registered!");
            window.location.href = '../customer/Home.html';
        } else {
            toastSuccess("Google Authentication successful!");
            await routeUserByRole(user);
        }
    } catch (error) {
        hideLoader();
        toastError(error.message || "Google Authentication failed.");
        throw error;
    }
}

/* ==========================================================================
   PHONE OTP AUTHENTICATION
   ========================================================================== */

let recaptchaVerifierInstance = null;
let confirmationResultInstance = null;

/**
 * Initialize Invisible reCAPTCHA
 * @param {string} containerId - Element ID for reCAPTCHA widget
 */
export function initRecaptcha(containerId = 'recaptcha-container') {
    if (!recaptchaVerifierInstance) {
        recaptchaVerifierInstance = new RecaptchaVerifier(auth, containerId, {
            'size': 'invisible',
            'callback': () => {},
            'expired-callback': () => {
                toastError("reCAPTCHA expired. Please try again.");
            }
        });
    }
    return recaptchaVerifierInstance;
}

/**
 * Send Phone Verification OTP
 * @param {string} phoneNumber 
 * @param {string} recaptchaContainerId 
 */
export async function sendOTP(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
    if (!validatePhone(phoneNumber)) {
        toastError("Please supply a valid phone number with country code (e.g. +91...)");
        return false;
    }

    showLoader();
    try {
        const appVerifier = initRecaptcha(recaptchaContainerId);
        confirmationResultInstance = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        hideLoader();
        toastSuccess("OTP sent successfully to " + phoneNumber);
        return true;
    } catch (error) {
        hideLoader();
        if (recaptchaVerifierInstance) {
            recaptchaVerifierInstance.clear();
            recaptchaVerifierInstance = null;
        }
        toastError(error.message || "Failed to send OTP.");
        throw error;
    }
}

/**
 * Verify Received OTP Code
 * @param {string} otpCode 
 */
export async function verifyOTP(otpCode) {
    if (!confirmationResultInstance) {
        toastError("No active OTP request found.");
        return;
    }

    showLoader();
    try {
        const result = await confirmationResultInstance.confirm(otpCode);
        const user = result.user;
        toastSuccess("Phone verified!");
        await routeUserByRole(user);
    } catch (error) {
        hideLoader();
        toastError(error.message || "Invalid OTP verification code.");
        throw error;
    }
}

/* ==========================================================================
   PASSWORD RESET & SESSION MANAGEMENT
   ========================================================================== */

/**
 * Send Password Reset Email
 * @param {string} email 
 */
export async function forgotPassword(email) {
    if (!validateEmail(email)) {
        toastError("Please enter a valid email address.");
        return;
    }

    showLoader();
    try {
        await sendPasswordResetEmail(auth, email);
        hideLoader();
        toastSuccess("Password reset email sent! Check your inbox.");
    } catch (error) {
        hideLoader();
        toastError(error.message || "Unable to send reset email.");
        throw error;
    }
}

/**
 * Logout Current Session
 */
export async function logout() {
    showLoader();
    try {
        await signOut(auth);
        hideLoader();
        toastSuccess("Logged out successfully.");
        window.location.href = '../auth/login.html';
    } catch (error) {
        hideLoader();
        toastError("Logout Error: " + error.message);
    }
}

/**
 * Monitor Session State and Handle Auto-Login
 * @param {Function} callback - Optional callback receiving (user)
 */
export function checkSession(callback = null) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (callback) {
                callback(user);
            }
        } else {
            if (callback) {
                callback(null);
            }
        }
    });
}

/**
 * Auto Fill Email from Local Storage on Load
 * @param {string} emailInputId 
 * @param {string} checkboxId 
 */
export function initializeRememberMe(emailInputId, checkboxId) {
    const savedEmail = localStorage.getItem('riderx_remembered_email');
    const emailInput = document.getElementById(emailInputId);
    const checkbox = document.getElementById(checkboxId);

    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (checkbox) checkbox.checked = true;
    }
}

/* Auto Attach Window Objects for Global Non-Module Compatibility */
if (typeof window !== 'undefined') {
    window.RiderXAuth = {
        loginCustomer,
        loginRider,
        registerCustomer,
        registerRider,
        loginWithGoogle,
        sendOTP,
        verifyOTP,
        forgotPassword,
        logout,
        checkSession,
        checkRiderApproval,
        showToast,
        showLoader,
        hideLoader,
        togglePasswordVisibility
    };
}
